import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const managerHome = process.env.VHOST_MANAGER_HOME || path.join(/*turbopackIgnore: true*/ process.cwd());
const localConfigPath = path.join(managerHome, 'config/app.env.local');
const fallbackConfigPath = path.join(managerHome, 'config/app.env');
const exampleConfigPath = path.join(managerHome, 'config/app.env.example');

export type SetupFieldValues = {
  managerDomain: string;
  baseDir: string;
  allowedBaseDirs: string;
  owner: string;
  group: string;
  appUsers: string;
  hostIp: string;
  availableDir: string;
  enabledDir: string;
  allowedClients: string;
  allowedPhpVersions: string;
};

export type SetupCheck = {
  label: string;
  ok: boolean;
  detail: string;
};

export type SetupState = {
  runtime: 'local' | 'vercel';
  ready: boolean;
  canSave: boolean;
  configExists: boolean;
  configPath: string;
  recommended: SetupFieldValues;
  checks: SetupCheck[];
  commands: string[];
  configText: string;
};

async function exists(target: string): Promise<boolean> {
  try {
    await access(target, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function commandExists(command: string): Promise<boolean> {
  try {
    await execFileAsync('bash', ['-lc', `command -v ${command}`], { timeout: 2500 });
    return true;
  } catch {
    return false;
  }
}

function parseEnv(content: string): Record<string, string> {
  const output: Record<string, string> = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    const match = trimmed.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) output[match[1]] = match[2].trim();
  }

  return output;
}

function recommendedValues(raw: Record<string, string> = {}): SetupFieldValues {
  const user = raw.VHOST_OWNER || os.userInfo().username;
  const baseDir = raw.VHOST_BASE_DIR || path.join(os.homedir(), 'www');

  return {
    managerDomain: raw.VHOST_MANAGER_DOMAIN || 'vhost-manager.local',
    baseDir,
    allowedBaseDirs: raw.VHOST_ALLOWED_BASE_DIRS || baseDir,
    owner: user,
    group: raw.VHOST_GROUP || 'www-data',
    appUsers: raw.VHOST_APP_USERS || user,
    hostIp: raw.VHOST_HOST_IP || '127.0.0.1',
    availableDir: raw.VHOST_NGINX_SITES_AVAILABLE || '/etc/nginx/sites-available',
    enabledDir: raw.VHOST_NGINX_SITES_ENABLED || '/etc/nginx/sites-enabled',
    allowedClients: raw.VHOST_ALLOWED_CLIENTS || '127.0.0.1,192.168.1.0/24',
    allowedPhpVersions: raw.VHOST_ALLOWED_PHP_VERSIONS || '8.5,8.3,8.2,8.1,8.0,7.4,5.6',
  };
}

function configText(values: SetupFieldValues): string {
  return [
    '# Local machine config. Keep this file private.',
    `VHOST_MANAGER_DOMAIN=${values.managerDomain}`,
    `VHOST_BASE_DIR=${values.baseDir}`,
    `VHOST_ALLOWED_BASE_DIRS=${values.allowedBaseDirs}`,
    `VHOST_OWNER=${values.owner}`,
    `VHOST_GROUP=${values.group}`,
    `VHOST_WEB_USER=www-data`,
    `VHOST_APP_USERS=${values.appUsers}`,
    `VHOST_HOST_IP=${values.hostIp}`,
    `VHOST_NGINX_SITES_AVAILABLE=${values.availableDir}`,
    `VHOST_NGINX_SITES_ENABLED=${values.enabledDir}`,
    `VHOST_ALLOWED_CLIENTS=${values.allowedClients}`,
    `VHOST_ALLOWED_PHP_VERSIONS=${values.allowedPhpVersions}`,
    '',
  ].join('\n');
}

async function readRawConfig() {
  for (const configPath of [localConfigPath, fallbackConfigPath, exampleConfigPath]) {
    try {
      return parseEnv(await readFile(configPath, 'utf8'));
    } catch {
      continue;
    }
  }

  return {};
}

export async function setupState(): Promise<SetupState> {
  const runtime = process.env.VERCEL ? 'vercel' : 'local';
  const configExists = await exists(localConfigPath) || await exists(fallbackConfigPath);
  const raw = await readRawConfig();
  const recommended = recommendedValues(raw);
  const checks: SetupCheck[] = [];

  const [baseDirOk, availableDirOk, enabledDirOk, helperOk, nginxOk, sudoOk, aptCacheOk] = await Promise.all([
    exists(recommended.baseDir),
    exists(recommended.availableDir),
    exists(recommended.enabledDir),
    exists(path.join(managerHome, 'bin/vhostctl')),
    commandExists('nginx'),
    commandExists('sudo'),
    commandExists('apt-cache'),
  ]);

  checks.push(
    { label: 'Project root', ok: baseDirOk, detail: recommended.baseDir },
    { label: 'Nginx sites-available', ok: availableDirOk, detail: recommended.availableDir },
    { label: 'Nginx sites-enabled', ok: enabledDirOk, detail: recommended.enabledDir },
    { label: 'vhostctl helper', ok: helperOk, detail: path.join(managerHome, 'bin/vhostctl') },
    { label: 'nginx command', ok: nginxOk, detail: nginxOk ? 'found' : 'missing' },
    { label: 'sudo command', ok: sudoOk, detail: sudoOk ? 'found' : 'missing' },
    { label: 'apt-cache command', ok: aptCacheOk, detail: aptCacheOk ? 'found' : 'missing' },
  );

  const commands = [
    'cp config/app.env.example config/app.env.local',
    'nano config/app.env.local',
    'sudo ./bin/install-sudoers',
    'pnpm install',
    'pnpm dev',
  ];

  return {
    runtime,
    ready: runtime === 'local' && configExists && checks.every((check) => check.ok),
    canSave: runtime === 'local',
    configExists,
    configPath: localConfigPath,
    recommended,
    checks,
    commands,
    configText: configText(recommended),
  };
}

export async function saveSetup(values: SetupFieldValues) {
  if (process.env.VERCEL) {
    return { saved: false, configText: configText(values), message: 'Vercel cannot write local machine config.' };
  }

  await mkdir(path.dirname(localConfigPath), { recursive: true });
  await writeFile(localConfigPath, configText(values), 'utf8');
  return { saved: true, configText: configText(values), message: `Saved ${localConfigPath}` };
}
