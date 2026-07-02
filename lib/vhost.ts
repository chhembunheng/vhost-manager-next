import { access, readdir, readFile, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type AppConfig = {
  managerDomain: string;
  baseDir: string;
  allowedBaseDirs: string[];
  owner: string;
  group: string;
  hostIp: string;
  availableDir: string;
  enabledDir: string;
  allowedPhpVersions: string[];
  helperPath: string;
};

export type Site = {
  name: string;
  root: string;
  relativeRoot: string;
  php: string;
  enabled: boolean;
  config: string;
  removable: boolean;
};

export type PhpOption = {
  version: string;
  installed: boolean;
  available: boolean;
};

export type VhostState = {
  config: AppConfig;
  folders: string[];
  phpOptions: PhpOption[];
  sites: Site[];
  rootSuggestions: string[];
  rootError: string;
};

const defaultManagerHome = process.cwd();
const defaultUser = os.userInfo().username;
const defaultBaseDir = path.join(os.homedir(), 'www');

function parseEnv(content: string): Record<string, string> {
  const output: Record<string, string> = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const match = trimmed.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) {
      continue;
    }

    output[match[1]] = match[2].trim();
  }

  return output;
}

function csv(value: string | undefined, fallback: string): string[] {
  return (value || fallback)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function readConfig(): Promise<AppConfig> {
  const managerHome = process.env.VHOST_MANAGER_HOME || defaultManagerHome;
  const localConfigPath = path.join(managerHome, 'config/app.env.local');
  const configPath = process.env.VHOST_MANAGER_CONFIG || ((await exists(localConfigPath)) ? localConfigPath : path.join(managerHome, 'config/app.env'));
  let raw: Record<string, string> = {};

  try {
    raw = parseEnv(await readFile(configPath, 'utf8'));
  } catch {
    raw = {};
  }

  return {
    managerDomain: raw.VHOST_MANAGER_DOMAIN || 'vhost-manager.local',
    baseDir: (raw.VHOST_BASE_DIR || defaultBaseDir).replace(/\/+$/, ''),
    allowedBaseDirs: csv(raw.VHOST_ALLOWED_BASE_DIRS, raw.VHOST_BASE_DIR || defaultBaseDir).map((item) => item.replace(/\/+$/, '')),
    owner: raw.VHOST_OWNER || defaultUser,
    group: raw.VHOST_GROUP || 'www-data',
    hostIp: raw.VHOST_HOST_IP || '127.0.0.1',
    availableDir: (raw.VHOST_NGINX_SITES_AVAILABLE || '/etc/nginx/sites-available').replace(/\/+$/, ''),
    enabledDir: (raw.VHOST_NGINX_SITES_ENABLED || '/etc/nginx/sites-enabled').replace(/\/+$/, ''),
    allowedPhpVersions: csv(raw.VHOST_ALLOWED_PHP_VERSIONS, '8.5,8.3,8.2,8.1,8.0,7.4,5.6'),
    helperPath: path.join(managerHome, 'bin/vhostctl'),
  };
}

async function exists(target: string): Promise<boolean> {
  try {
    await access(target, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function installedPhpVersions(config: AppConfig): Promise<string[]> {
  let entries: string[] = [];

  try {
    entries = await readdir('/run/php');
  } catch {
    return [];
  }

  const installed = entries
    .map((entry) => entry.match(/^php([0-9]+\.[0-9]+)-fpm\.sock$/)?.[1])
    .filter((item): item is string => Boolean(item));

  return config.allowedPhpVersions.filter((version) => installed.includes(version));
}

export async function downloadablePhpVersions(config: AppConfig): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync('apt-cache', ['search', '^php[0-9]+\\.[0-9]+-fpm$'], { timeout: 5000 });
    const versions = new Set<string>();

    for (const line of stdout.split(/\r?\n/)) {
      const version = line.match(/^php([0-9]+\.[0-9]+)-fpm\s/)?.[1];
      if (version) versions.add(version);
    }

    return config.allowedPhpVersions.filter((version) => versions.has(version));
  } catch {
    return [];
  }
}

export async function projectFolders(config: AppConfig): Promise<string[]> {
  let entries: string[] = [];

  try {
    entries = await readdir(config.baseDir);
  } catch {
    return [];
  }

  const folders: string[] = [];

  for (const entry of entries) {
    if (entry === '.' || entry === '..' || entry.startsWith('.')) {
      continue;
    }

    const fullPath = path.join(config.baseDir, entry);
    try {
      if (!(await stat(fullPath)).isDirectory()) {
        continue;
      }

      folders.push((await exists(path.join(fullPath, 'public'))) ? `${entry}/public` : entry);
    } catch {
      continue;
    }
  }

  return folders.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function isPathInside(candidate: string, allowed: string): boolean {
  const normalizedCandidate = path.resolve(candidate);
  const normalizedAllowed = path.resolve(allowed);
  return normalizedCandidate === normalizedAllowed || normalizedCandidate.startsWith(`${normalizedAllowed}/`);
}

export function resolveBaseDir(config: AppConfig, requested?: string): { baseDir: string; error: string } {
  const fallback = config.baseDir;
  const selected = (requested || fallback).trim();

  if (!selected || !path.isAbsolute(selected)) {
    return { baseDir: fallback, error: selected ? 'Project root must be an absolute path.' : '' };
  }

  const normalized = path.resolve(selected);
  const allowed = config.allowedBaseDirs.some((allowedBase) => isPathInside(normalized, allowedBase));

  if (!allowed) {
    return { baseDir: fallback, error: `Project root is outside allowed roots: ${normalized}` };
  }

  return { baseDir: normalized, error: '' };
}

export async function rootSuggestions(config: AppConfig): Promise<string[]> {
  const suggestions = new Set<string>();

  for (const allowed of config.allowedBaseDirs) {
    suggestions.add(allowed);

    let entries: string[] = [];
    try {
      entries = await readdir(allowed);
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.startsWith('.')) continue;
      const fullPath = path.join(allowed, entry);
      try {
        if ((await stat(fullPath)).isDirectory()) {
          suggestions.add(fullPath);
        }
      } catch {
        continue;
      }
    }
  }

  return Array.from(suggestions).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function relativeRoot(config: AppConfig, root: string): string {
  const prefix = `${config.baseDir}/`;
  return root.startsWith(prefix) ? root.slice(prefix.length) : '';
}

export async function existingSites(config: AppConfig): Promise<Site[]> {
  let entries: string[] = [];

  try {
    entries = await readdir(config.availableDir);
  } catch {
    return [];
  }

  const sites: Site[] = [];

  for (const entry of entries) {
    const filePath = path.join(config.availableDir, entry);

    try {
      if (!(await stat(filePath)).isFile()) {
        continue;
      }

      const content = await readFile(filePath, 'utf8');
      const root = content.match(/^\s*root\s+([^;]+);/m)?.[1]?.trim() || '';
      const php = content.match(/php([0-9]+\.[0-9]+)-fpm\.sock/)?.[1] || '';

      sites.push({
        name: entry,
        root,
        relativeRoot: relativeRoot(config, root),
        php,
        enabled: await exists(path.join(config.enabledDir, entry)),
        config: content,
        removable: entry !== config.managerDomain,
      });
    } catch {
      continue;
    }
  }

  return sites.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getState(requestedBaseDir?: string): Promise<VhostState> {
  const config = await readConfig();
  const resolved = resolveBaseDir(config, requestedBaseDir);
  let rootError = resolved.error;

  if (!rootError && !(await exists(resolved.baseDir))) {
    rootError = `Project root does not exist: ${resolved.baseDir}`;
  }

  const effectiveConfig = { ...config, baseDir: resolved.baseDir };
  const [installed, downloadable, folders, sites, suggestions] = await Promise.all([
    installedPhpVersions(config),
    downloadablePhpVersions(config),
    projectFolders(effectiveConfig),
    existingSites(effectiveConfig),
    rootSuggestions(config),
  ]);

  return {
    config: effectiveConfig,
    folders,
    sites,
    rootSuggestions: suggestions,
    rootError,
    phpOptions: config.allowedPhpVersions.map((version) => ({
      version,
      installed: installed.includes(version),
      available: installed.includes(version) || downloadable.includes(version),
    })),
  };
}

export function validateDomain(domain: string): boolean {
  return /^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/.test(domain);
}

export function validateRoot(root: string): boolean {
  return root !== '' && !root.startsWith('/') && !root.includes('..') && /^[A-Za-z0-9._/-]+$/.test(root);
}

export async function commandFromPayload(payload: Record<string, unknown>): Promise<{ command: string[]; errors: string[] }> {
  const config = await readConfig();
  const action = String(payload.action || 'create');

  if (action === 'delete') {
    const domain = String(payload.domain || '').trim();
    const confirm = String(payload.confirm || '').trim();
    const errors: string[] = [];

    if (!validateDomain(domain)) errors.push('Domain format is invalid.');
    if (confirm !== domain) errors.push('Typed confirmation must match the domain exactly.');
    if (domain === config.managerDomain) errors.push('The manager vhost cannot remove itself.');

    return {
      errors,
      command: errors.length ? [] : ['sudo', '-n', config.helperPath, 'delete', '--domain', domain, '--confirm', confirm],
    };
  }

  const domain = String(payload.domain || '').trim();
  const baseDir = String(payload.baseDir || config.baseDir).trim();
  const root = String(payload.root || '').trim();
  const php = String(payload.php || '').trim();
  const installPhp = Boolean(payload.installPhp);
  const [installed, downloadable] = await Promise.all([installedPhpVersions(config), downloadablePhpVersions(config)]);
  const errors: string[] = [];
  const resolved = resolveBaseDir(config, baseDir);
  const noPhp = php === 'none';

  if (!validateDomain(domain)) errors.push('Domain format is invalid.');
  if (resolved.error) errors.push(resolved.error);
  if (!resolved.error && !(await exists(resolved.baseDir))) errors.push(`Project root does not exist: ${resolved.baseDir}`);
  if (!validateRoot(root)) errors.push(`Project path must be a safe relative path under ${resolved.baseDir}.`);
  if (noPhp) {
    // Static sites and SPA frontends do not need a PHP-FPM upstream.
  } else if (!config.allowedPhpVersions.includes(php)) {
    errors.push('Selected PHP-FPM version is not supported by this manager.');
  } else if (!installed.includes(php) && !installPhp) {
    errors.push('Selected PHP-FPM version is not installed. Enable install option or choose an installed version.');
  } else if (!installed.includes(php) && !downloadable.includes(php)) {
    errors.push('Selected PHP-FPM version is not available from apt. Update apt sources or allow it in config.');
  }

  const command = ['sudo', '-n', config.helperPath, 'create', '--domain', domain, '--root', root, '--base-dir', resolved.baseDir];
  if (noPhp) {
    command.push('--no-php');
  } else {
    command.push('--php', php);
  }
  if (installPhp) command.push('--install-php');

  return { errors, command: errors.length ? [] : command };
}
