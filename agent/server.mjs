#!/usr/bin/env node
import { createServer } from 'node:http';
import { access, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { execFile, spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const appDir = path.resolve(process.env.VHOST_MANAGER_HOME || path.join(import.meta.dirname, '..'));
const port = Number(process.env.VHOST_AGENT_PORT || 3036);
const token = process.env.VHOST_AGENT_TOKEN || '';
const allowedOrigins = (process.env.VHOST_AGENT_ALLOWED_ORIGINS || 'http://localhost:3025,http://127.0.0.1:3025')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

function parseEnv(content) {
  const output = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) output[match[1]] = match[2].trim();
  }
  return output;
}

function csv(value, fallback) {
  return (value || fallback).split(',').map((item) => item.trim()).filter(Boolean);
}

async function exists(target) {
  try {
    await access(target, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readConfig() {
  const localConfigPath = path.join(appDir, 'config/app.env.local');
  const configPath = process.env.VHOST_MANAGER_CONFIG || ((await exists(localConfigPath)) ? localConfigPath : path.join(appDir, 'config/app.env'));
  let raw = {};

  try {
    raw = parseEnv(await readFile(configPath, 'utf8'));
  } catch {
    raw = {};
  }

  const user = raw.VHOST_OWNER || os.userInfo().username;
  const baseDir = raw.VHOST_BASE_DIR || path.join(os.homedir(), 'www');

  return {
    managerDomain: raw.VHOST_MANAGER_DOMAIN || 'vhost-manager.local',
    baseDir: baseDir.replace(/\/+$/, ''),
    allowedBaseDirs: csv(raw.VHOST_ALLOWED_BASE_DIRS, baseDir).map((item) => item.replace(/\/+$/, '')),
    owner: user,
    group: raw.VHOST_GROUP || 'www-data',
    hostIp: raw.VHOST_HOST_IP || '127.0.0.1',
    availableDir: (raw.VHOST_NGINX_SITES_AVAILABLE || '/etc/nginx/sites-available').replace(/\/+$/, ''),
    enabledDir: (raw.VHOST_NGINX_SITES_ENABLED || '/etc/nginx/sites-enabled').replace(/\/+$/, ''),
    allowedPhpVersions: csv(raw.VHOST_ALLOWED_PHP_VERSIONS, '8.5,8.3,8.2,8.1,8.0,7.4,5.6'),
    helperPath: path.join(appDir, 'bin/vhostctl'),
  };
}

function isPathInside(candidate, allowed) {
  const normalizedCandidate = path.resolve(candidate);
  const normalizedAllowed = path.resolve(allowed);
  return normalizedCandidate === normalizedAllowed || normalizedCandidate.startsWith(`${normalizedAllowed}/`);
}

function resolveBaseDir(config, requested) {
  const fallback = config.baseDir;
  const selected = (requested || fallback).trim();

  if (!selected || !path.isAbsolute(selected)) {
    return { baseDir: fallback, error: selected ? 'Project root must be an absolute path.' : '' };
  }

  const normalized = path.resolve(selected);
  const allowed = config.allowedBaseDirs.some((allowedBase) => isPathInside(normalized, allowedBase));
  return allowed ? { baseDir: normalized, error: '' } : { baseDir: fallback, error: `Project root is outside allowed roots: ${normalized}` };
}

async function installedPhpVersions(config) {
  let entries = [];
  try {
    entries = await readdir('/run/php');
  } catch {
    return [];
  }
  const installed = entries.map((entry) => entry.match(/^php([0-9]+\.[0-9]+)-fpm\.sock$/)?.[1]).filter(Boolean);
  return config.allowedPhpVersions.filter((version) => installed.includes(version));
}

async function downloadablePhpVersions(config) {
  try {
    const { stdout } = await execFileAsync('apt-cache', ['search', '^php[0-9]+\\.[0-9]+-fpm$'], { timeout: 5000 });
    const versions = new Set();
    for (const line of stdout.split(/\r?\n/)) {
      const version = line.match(/^php([0-9]+\.[0-9]+)-fpm\s/)?.[1];
      if (version) versions.add(version);
    }
    return config.allowedPhpVersions.filter((version) => versions.has(version));
  } catch {
    return [];
  }
}

async function projectFolders(config) {
  let entries = [];
  try {
    entries = await readdir(config.baseDir);
  } catch {
    return [];
  }

  const folders = [];
  for (const entry of entries) {
    if (entry === '.' || entry === '..' || entry.startsWith('.')) continue;
    const fullPath = path.join(config.baseDir, entry);
    try {
      if (!(await stat(fullPath)).isDirectory()) continue;
      folders.push((await exists(path.join(fullPath, 'public'))) ? `${entry}/public` : entry);
    } catch {
      continue;
    }
  }
  return folders.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

async function rootSuggestions(config) {
  const suggestions = new Set();
  for (const allowed of config.allowedBaseDirs) {
    suggestions.add(allowed);
    let entries = [];
    try {
      entries = await readdir(allowed);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.startsWith('.')) continue;
      const fullPath = path.join(allowed, entry);
      try {
        if ((await stat(fullPath)).isDirectory()) suggestions.add(fullPath);
      } catch {
        continue;
      }
    }
  }
  return Array.from(suggestions).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function relativeRoot(config, root) {
  const prefix = `${config.baseDir}/`;
  return root.startsWith(prefix) ? root.slice(prefix.length) : '';
}

async function existingSites(config) {
  let entries = [];
  try {
    entries = await readdir(config.availableDir);
  } catch {
    return [];
  }

  const sites = [];
  for (const entry of entries) {
    const filePath = path.join(config.availableDir, entry);
    try {
      if (!(await stat(filePath)).isFile()) continue;
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

async function getState(requestedBaseDir) {
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

function validateDomain(domain) {
  return /^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/.test(domain);
}

function validateRoot(root) {
  return root !== '' && !root.startsWith('/') && !root.includes('..') && /^[A-Za-z0-9._/-]+$/.test(root);
}

async function commandFromPayload(payload) {
  const config = await readConfig();
  const action = String(payload.action || 'create');

  if (action === 'delete') {
    const domain = String(payload.domain || '').trim();
    const confirm = String(payload.confirm || '').trim();
    const errors = [];
    if (!validateDomain(domain)) errors.push('Domain format is invalid.');
    if (confirm !== domain) errors.push('Typed confirmation must match the domain exactly.');
    if (domain === config.managerDomain) errors.push('The manager vhost cannot remove itself.');
    return { errors, command: errors.length ? [] : ['sudo', '-n', config.helperPath, 'delete', '--domain', domain, '--confirm', confirm] };
  }

  const domain = String(payload.domain || '').trim();
  const baseDir = String(payload.baseDir || config.baseDir).trim();
  const root = String(payload.root || '').trim();
  const php = String(payload.php || '').trim();
  const installPhp = Boolean(payload.installPhp);
  const [installed, downloadable] = await Promise.all([installedPhpVersions(config), downloadablePhpVersions(config)]);
  const errors = [];
  const resolved = resolveBaseDir(config, baseDir);
  const noPhp = php === 'none';

  if (!validateDomain(domain)) errors.push('Domain format is invalid.');
  if (resolved.error) errors.push(resolved.error);
  if (!resolved.error && !(await exists(resolved.baseDir))) errors.push(`Project root does not exist: ${resolved.baseDir}`);
  if (!validateRoot(root)) errors.push(`Project path must be a safe relative path under ${resolved.baseDir}.`);
  if (!noPhp && !config.allowedPhpVersions.includes(php)) errors.push('Selected PHP-FPM version is not supported by this manager.');
  if (!noPhp && !installed.includes(php) && !installPhp) errors.push('Selected PHP-FPM version is not installed. Enable install option or choose an installed version.');
  if (!noPhp && !installed.includes(php) && !downloadable.includes(php)) errors.push('Selected PHP-FPM version is not available from apt. Update apt sources or allow it in config.');

  const command = ['sudo', '-n', config.helperPath, 'create', '--domain', domain, '--root', root, '--base-dir', resolved.baseDir];
  if (noPhp) command.push('--no-php');
  else command.push('--php', php);
  if (installPhp) command.push('--install-php');

  return { errors, command: errors.length ? [] : command };
}

function originAllowed(origin) {
  if (!origin) return true;
  return allowedOrigins.includes('*') || allowedOrigins.includes(origin);
}

function writeCors(req, res) {
  const origin = req.headers.origin;
  if (origin && originAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

function authorized(req) {
  if (!token) return true;
  return req.headers.authorization === `Bearer ${token}`;
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString('utf8');
  return body ? JSON.parse(body) : {};
}

createServer(async (req, res) => {
  writeCors(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (!originAllowed(req.headers.origin)) {
    json(res, 403, { error: 'Origin is not allowed.' });
    return;
  }

  if (!authorized(req)) {
    json(res, 401, { error: 'Missing or invalid VHOST_AGENT_TOKEN.' });
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      json(res, 200, { ok: true, appDir, port });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/state') {
      json(res, 200, await getState(url.searchParams.get('baseDir') || undefined));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/stream') {
      const prepared = await commandFromPayload(await readJson(req));
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      });

      if (prepared.errors.length) {
        res.end(`${prepared.errors.join('\n')}\n__VHOST_EXIT_CODE:1\n`);
        return;
      }

      res.write('Starting...\n');
      const [command, ...args] = prepared.command;
      const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, FORCE_COLOR: '0' } });
      child.stdout.on('data', (chunk) => res.write(chunk));
      child.stderr.on('data', (chunk) => res.write(chunk));
      child.on('error', (error) => res.end(`${error.message}\n__VHOST_EXIT_CODE:1\n`));
      child.on('close', (code) => res.end(`\n__VHOST_EXIT_CODE:${code ?? 1}\n`));
      return;
    }

    json(res, 404, { error: 'Not found.' });
  } catch (error) {
    json(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Vhost Manager agent ready: http://127.0.0.1:${port}`);
});
