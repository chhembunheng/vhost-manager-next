'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Ban,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleSlash,
  Cpu,
  ExternalLink,
  FileCode2,
  Folder,
  Languages,
  Loader2,
  Moon,
  Play,
  RefreshCw,
  Search,
  Server,
  Settings2,
  ShieldAlert,
  Sun,
  TerminalSquare,
  Trash2,
  UploadCloud,
  Wand2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Terminal } from '@/components/ui/terminal';

type AppConfig = {
  managerDomain: string;
  baseDir: string;
  allowedBaseDirs: string[];
  allowedPhpVersions: string[];
};

type Site = {
  name: string;
  root: string;
  relativeRoot: string;
  php: string;
  enabled: boolean;
  config: string;
  removable: boolean;
};

type PhpOption = {
  version: string;
  installed: boolean;
  available: boolean;
};

type VhostState = {
  config: AppConfig;
  folders: string[];
  phpOptions: PhpOption[];
  sites: Site[];
  rootSuggestions: string[];
  rootError: string;
};

type DeleteTarget = {
  name: string;
  root: string;
} | null;

type Lang = 'en' | 'km';
type Theme = 'light' | 'dark';

const copy = {
  en: {
    realtime: 'Realtime local tooling',
    title: 'Vhost Manager',
    sites: 'sites',
    phpFpm: 'PHP-FPM',
    projectRoot: 'Project Root',
    managerDomain: 'Manager Domain',
    phpVersions: 'PHP Versions',
    change: 'Change',
    projectConfig: 'Project Config',
    projectConfigDesc: 'Create or rewrite a local Nginx vhost.',
    domain: 'Domain',
    domainPlaceholder: 'project.local',
    projectFolder: 'Project Folder',
    projectFolderPlaceholder: 'project/public',
    installMissing: 'Install PHP-FPM if missing',
    createVhost: 'Create vhost',
    working: 'Working',
    loadConfig: 'Load config',
    nginxConfig: 'Nginx Config',
    noConfigLoaded: 'No config loaded',
    configEmpty: 'Select an existing domain and click Load config.',
    lines: 'lines',
    liveOutput: 'Live Output',
    liveOutputDesc: 'Command output streams here while create/remove runs.',
    idle: 'Idle',
    ready: 'Ready.',
    creating: 'Creating vhost',
    removing: 'Removing vhost',
    done: 'Done',
    failed: 'Failed',
    loadFailed: 'Load Failed',
    existingSites: 'Existing Sites',
    existingSitesDesc: 'Load, inspect, open, or remove local vhosts.',
    searchPlaceholder: 'Search domain, root, PHP',
    root: 'Root',
    php: 'PHP',
    status: 'Status',
    actions: 'Actions',
    enabled: 'Enabled',
    available: 'Available',
    load: 'Load',
    remove: 'Remove',
    manager: 'Manager',
    removeVhost: 'Remove Vhost',
    removeDesc: 'Project files stay on disk. This only removes the Nginx vhost and hosts entry.',
    typeDomain: 'Type domain to confirm',
    cancel: 'Cancel',
    loadProjectRoot: 'Load Project Root',
    loadProjectRootDesc: "Choose the folder that contains this teammate's projects, like /home/wintech/www/ums or /home/wintech/www/school.",
    projectRootPath: 'Project root path',
    loadRoot: 'Load root',
    installed: 'installed',
    downloadable: 'available to install',
    unavailable: 'not available',
    noPhp: 'No PHP-FPM / static',
    staticSite: 'Static site',
    install: 'install',
    loading: 'Loading...',
    terminalTitle: 'vhostctl --stream',
    noOutput: 'No output.',
    noStream: 'This browser cannot stream command output.',
    refresh: 'Refresh',
    light: 'Light',
    dark: 'Dark',
    english: 'English',
    khmer: 'Khmer',
  },
  km: {
    realtime: 'ឧបករណ៍ Local បែប Real-time',
    title: 'គ្រប់គ្រង Vhost',
    sites: 'សាយ',
    phpFpm: 'PHP-FPM',
    projectRoot: 'ទីតាំង Project',
    managerDomain: 'Domain របស់ Manager',
    phpVersions: 'កំណែ PHP',
    change: 'ប្តូរ',
    projectConfig: 'កំណត់ Project',
    projectConfigDesc: 'បង្កើត ឬសរសេរ Nginx vhost ឡើងវិញ។',
    domain: 'Domain',
    domainPlaceholder: 'project.local',
    projectFolder: 'Folder Project',
    projectFolderPlaceholder: 'project/public',
    installMissing: 'ដំឡើង PHP-FPM ប្រសិនបើមិនទាន់មាន',
    createVhost: 'បង្កើត vhost',
    working: 'កំពុងដំណើរការ',
    loadConfig: 'ទាញ config',
    nginxConfig: 'Nginx Config',
    noConfigLoaded: 'មិនទាន់មាន config',
    configEmpty: 'ជ្រើស domain មានស្រាប់ រួចចុច Load config។',
    lines: 'បន្ទាត់',
    liveOutput: 'លទ្ធផលផ្ទាល់',
    liveOutputDesc: 'លទ្ធផល command នឹងបង្ហាញផ្ទាល់ពេល create/remove។',
    idle: 'ទំនេរ',
    ready: 'រួចរាល់។',
    creating: 'កំពុងបង្កើត vhost',
    removing: 'កំពុងលុប vhost',
    done: 'រួចរាល់',
    failed: 'បរាជ័យ',
    loadFailed: 'ទាញទិន្នន័យបរាជ័យ',
    existingSites: 'សាយមានស្រាប់',
    existingSitesDesc: 'ទាញ ពិនិត្យ បើក ឬលុប local vhost។',
    searchPlaceholder: 'ស្វែងរក domain, root, PHP',
    root: 'Root',
    php: 'PHP',
    status: 'ស្ថានភាព',
    actions: 'សកម្មភាព',
    enabled: 'បានបើក',
    available: 'មាន',
    load: 'ទាញ',
    remove: 'លុប',
    manager: 'Manager',
    removeVhost: 'លុប Vhost',
    removeDesc: 'ឯកសារ project នៅរក្សាទុក។ វាលុបតែ Nginx vhost និង hosts entry ប៉ុណ្ណោះ។',
    typeDomain: 'វាយ domain ដើម្បីបញ្ជាក់',
    cancel: 'បោះបង់',
    loadProjectRoot: 'ជ្រើស Project Root',
    loadProjectRootDesc: 'ជ្រើស folder ដែលផ្ទុក project របស់ team ដូចជា /home/wintech/www/ums ឬ /home/wintech/www/school។',
    projectRootPath: 'Path របស់ Project root',
    loadRoot: 'ទាញ root',
    installed: 'បានដំឡើង',
    downloadable: 'អាចដំឡើងបាន',
    unavailable: 'មិនមាន',
    noPhp: 'មិនប្រើ PHP-FPM / static',
    staticSite: 'Static site',
    install: 'ដំឡើង',
    loading: 'កំពុងទាញ...',
    terminalTitle: 'vhostctl --stream',
    noOutput: 'មិនមានលទ្ធផល។',
    noStream: 'Browser នេះមិនអាច stream command output បានទេ។',
    refresh: 'Refresh',
    light: 'ភ្លឺ',
    dark: 'ងងឹត',
    english: 'អង់គ្លេស',
    khmer: 'ខ្មែរ',
  },
} satisfies Record<Lang, Record<string, string>>;

const emptyState: VhostState = {
  config: {
    managerDomain: '',
    baseDir: '',
    allowedBaseDirs: [],
    allowedPhpVersions: [],
  },
  folders: [],
  phpOptions: [],
  sites: [],
  rootSuggestions: [],
  rootError: '',
};

export default function Home() {
  const [state, setState] = useState<VhostState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [domain, setDomain] = useState('');
  const [root, setRoot] = useState('');
  const [php, setPhp] = useState('');
  const [installPhp, setInstallPhp] = useState(true);
  const [loadedConfig, setLoadedConfig] = useState('');
  const [selectedBaseDir, setSelectedBaseDir] = useState('');
  const [pendingBaseDir, setPendingBaseDir] = useState('');
  const [rootDialogOpen, setRootDialogOpen] = useState(false);
  const [lang, setLang] = useState<Lang>('en');
  const [theme, setTheme] = useState<Theme>('light');
  const t = copy[lang];
  const [terminalTitle, setTerminalTitle] = useState(copy.en.idle);
  const [terminalStatus, setTerminalStatus] = useState<'idle' | 'running' | 'ok' | 'bad'>('idle');
  const [terminal, setTerminal] = useState(copy.en.ready);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  async function refreshState(baseDir = selectedBaseDir) {
    const suffix = baseDir ? `?baseDir=${encodeURIComponent(baseDir)}` : '';
    const response = await fetch(`/api/state${suffix}`, { cache: 'no-store' });
    const nextState = (await response.json()) as VhostState;
    setState(nextState);
    setSelectedBaseDir(nextState.config.baseDir);
    setPendingBaseDir(nextState.config.baseDir);
    setPhp((current) => current || nextState.phpOptions.find((item) => item.installed)?.version || nextState.phpOptions[0]?.version || '');
    setLoading(false);
  }

  useEffect(() => {
    const savedRoot = window.localStorage.getItem('vhost-manager-project-root') || '';
    const savedLang = window.localStorage.getItem('vhost-manager-language') as Lang | null;
    const savedTheme = window.localStorage.getItem('vhost-manager-theme') as Theme | null;

    if (savedLang === 'en' || savedLang === 'km') {
      setLang(savedLang);
    }

    if (savedTheme === 'light' || savedTheme === 'dark') {
      setTheme(savedTheme);
      document.documentElement.dataset.theme = savedTheme;
    }

    if (!savedRoot) {
      setRootDialogOpen(true);
    }

    refreshState(savedRoot).catch((error) => {
      setTerminalStatus('bad');
      setTerminalTitle(copy.en.loadFailed);
      setTerminal(error.message);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    window.localStorage.setItem('vhost-manager-language', lang);
    document.documentElement.lang = lang === 'km' ? 'km' : 'en';
    document.documentElement.dataset.lang = lang;
  }, [lang]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('vhost-manager-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (terminalStatus === 'idle') {
      setTerminalTitle(t.idle);
      setTerminal(t.ready);
    }
  }, [lang]);

  async function applyProjectRoot(nextRoot = pendingBaseDir) {
    const trimmed = nextRoot.trim();
    if (!trimmed) return;
    window.localStorage.setItem('vhost-manager-project-root', trimmed);
    setSelectedBaseDir(trimmed);
    setRoot('');
    setLoadedConfig('');
    setRootDialogOpen(false);
    await refreshState(trimmed);
  }

  const filteredSites = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return state.sites;
    return state.sites.filter((site) => `${site.name} ${site.root} ${site.php}`.toLowerCase().includes(needle));
  }, [query, state.sites]);

  const selectedSite = useMemo(() => state.sites.find((site) => site.name === domain), [domain, state.sites]);

  function loadSite(site = selectedSite) {
    if (!site) return;
    setDomain(site.name);
    if (site.relativeRoot) setRoot(site.relativeRoot);
    if (site.php) setPhp(site.php);
    setLoadedConfig(site.config);
  }

  async function streamAction(payload: Record<string, unknown>, title: string) {
    setBusy(true);
    setTerminalTitle(title);
    setTerminalStatus('running');
    setTerminal('');

    try {
      const response = await fetch('/api/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.body) {
        throw new Error(t.noStream);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let output = '';
      let exitCode = 1;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        output += decoder.decode(value, { stream: true });
        const marker = output.match(/\n__VHOST_EXIT_CODE:(-?\d+)\n?$/);
        if (marker) {
          exitCode = Number(marker[1]);
          output = output.replace(/\n__VHOST_EXIT_CODE:-?\d+\n?$/, '');
        }

        setTerminal(output);
      }

      output += decoder.decode();
      output = output.replace(/\n__VHOST_EXIT_CODE:-?\d+\n?$/, '').trim();
      setTerminal(output || t.noOutput);

      if (exitCode === 0) {
        setTerminalTitle(t.done);
        setTerminalStatus('ok');
        setDeleteTarget(null);
        setDeleteConfirm('');
        await refreshState();
      } else {
        setTerminalTitle(t.failed);
        setTerminalStatus('bad');
      }
    } catch (error) {
      setTerminalTitle(t.failed);
      setTerminalStatus('bad');
      setTerminal(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    streamAction({ action: 'create', domain, baseDir: state.config.baseDir, root, php, installPhp: php !== 'none' && installPhp }, t.creating);
  }

  function submitDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!deleteTarget) return;
    streamAction({ action: 'delete', domain: deleteTarget.name, confirm: deleteConfirm }, t.removing);
  }

  const installedCount = state.phpOptions.filter((item) => item.installed).length;

  return (
    <main className="shell">
      <section className="heroPanel">
        <header className="topbar">
          <div>
            <p className="eyebrow">
              <TerminalSquare size={14} />
              {t.realtime}
            </p>
            <h1>{t.title}</h1>
          </div>
          <div className="topbarMeta">
            <div className="segmented" aria-label="Language">
              <Button
                variant={lang === 'en' ? 'default' : 'ghost'}
                size="sm"
                type="button"
                onClick={() => setLang('en')}
                title={t.english}
              >
                <Languages size={14} />
                <span className="languageMark en">EN</span>
              </Button>
              <Button
                variant={lang === 'km' ? 'default' : 'ghost'}
                size="sm"
                type="button"
                onClick={() => setLang('km')}
                title={t.khmer}
              >
                <span className="languageMark km">ខ្មែរ</span>
              </Button>
            </div>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
              title={theme === 'light' ? t.dark : t.light}
            >
              {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
              {theme === 'light' ? t.dark : t.light}
            </Button>
            <Badge variant="outline">
              <Folder size={14} />
              {state.config.baseDir || t.loading}
            </Badge>
            <Badge variant="outline">
              <Server size={14} />
              {state.sites.length} {t.sites}
            </Badge>
            <Badge variant="success">
              <Activity size={14} />
              {installedCount} {t.phpFpm}
            </Badge>
          </div>
        </header>

        <section className="statsGrid">
          <Metric
            icon={<Folder size={18} />}
            label={t.projectRoot}
            value={state.config.baseDir || '-'}
            action={
              <Button variant="secondary" size="sm" type="button" onClick={() => setRootDialogOpen(true)} disabled={busy}>
                <Wand2 size={14} />
                {t.change}
              </Button>
            }
          />
          <Metric icon={<Server size={18} />} label={t.managerDomain} value={state.config.managerDomain || '-'} />
          <Metric icon={<Settings2 size={18} />} label={t.phpVersions} value={state.phpOptions.map((item) => item.version).join(', ') || '-'} />
        </section>
      </section>

      <div className="workspace">
        <Card className="formPanel">
          <CardHeader>
            <div>
              <CardTitle>{t.projectConfig}</CardTitle>
              <CardDescription>{t.projectConfigDesc}</CardDescription>
            </div>
            <Button variant="ghost" size="icon" type="button" onClick={() => refreshState()} disabled={busy} title={t.refresh}>
              <RefreshCw size={17} className={loading ? 'spin' : ''} />
            </Button>
          </CardHeader>

          <form onSubmit={submitCreate} className="stack">
            <Field>
              <FieldLabel>{t.domain}</FieldLabel>
              <Input
                list="domains"
                value={domain}
                onChange={(event) => setDomain(event.target.value)}
                placeholder={t.domainPlaceholder}
                disabled={busy}
                required
              />
              <datalist id="domains">
                {state.sites.map((site) => (
                  <option key={site.name} value={site.name} />
                ))}
              </datalist>
            </Field>

            <Field>
              <FieldLabel>{t.projectFolder}</FieldLabel>
              <Input
                list="folders"
                value={root}
                onChange={(event) => setRoot(event.target.value)}
                placeholder={t.projectFolderPlaceholder}
                disabled={busy}
                required
              />
              <datalist id="folders">
                {state.folders.map((folder) => (
                  <option key={folder} value={folder} />
                ))}
              </datalist>
            </Field>

            <Field>
              <FieldLabel>{t.phpFpm}</FieldLabel>
              <PhpVersionPicker value={php} options={state.phpOptions} disabled={busy} labels={t} onChange={setPhp} />
            </Field>

            <Field className="checkLine">
              <Input
                type="checkbox"
                checked={installPhp}
                onChange={(event) => setInstallPhp(event.target.checked)}
                disabled={busy || php === 'none'}
              />
              <span>{t.installMissing}</span>
            </Field>

            <div className="buttonRow">
              <Button type="submit" disabled={busy || loading}>
                {busy ? <Loader2 size={16} className="spin" /> : <Play size={16} />}
                {busy ? t.working : t.createVhost}
              </Button>
              <Button variant="secondary" type="button" onClick={() => loadSite()} disabled={busy || !selectedSite}>
                <UploadCloud size={16} />
                {t.loadConfig}
              </Button>
            </div>
          </form>

          <div className="configBox">
            <div className="configHeader">
              <span>{t.nginxConfig}</span>
              <span>{loadedConfig ? `${loadedConfig.split('\n').length} ${t.lines}` : t.noConfigLoaded}</span>
            </div>
            <pre>{loadedConfig || t.configEmpty}</pre>
          </div>
        </Card>

        <Card className="terminalPanel">
          <CardHeader>
            <div>
              <CardTitle>{t.liveOutput}</CardTitle>
              <CardDescription>{t.liveOutputDesc}</CardDescription>
            </div>
            <Badge variant={terminalStatus === 'ok' ? 'success' : terminalStatus === 'bad' ? 'destructive' : terminalStatus === 'running' ? 'warning' : 'outline'}>
              {terminalStatus === 'running' ? <Loader2 size={14} className="spin" /> : terminalStatus === 'bad' ? <CircleSlash size={14} /> : <CheckCircle2 size={14} />}
              {terminalTitle}
            </Badge>
          </CardHeader>
          <CardContent className="terminalContent">
            <Terminal title={t.terminalTitle} value={terminal} />
          </CardContent>
        </Card>
      </div>

      <Card className="sitesPanel">
        <CardHeader className="sitesHeader">
          <div>
            <CardTitle>{t.existingSites}</CardTitle>
            <CardDescription>{t.existingSitesDesc}</CardDescription>
          </div>
          <div className="searchWrap">
            <Search size={16} />
            <Input
              className="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.searchPlaceholder}
            />
          </div>
        </CardHeader>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>{t.domain}</th>
                <th>{t.root}</th>
                <th>{t.php}</th>
                <th>{t.status}</th>
                <th>{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {filteredSites.map((site) => (
                <tr key={site.name}>
                  <td>
                    <a href={`http://${site.name}`} target="_blank" rel="noreferrer">
                      {site.name}
                      <ExternalLink size={13} />
                    </a>
                  </td>
                  <td className="mono">{site.root || '-'}</td>
                  <td>{site.php || '-'}</td>
                  <td>
                    <Badge variant={site.enabled ? 'success' : 'outline'}>{site.enabled ? t.enabled : t.available}</Badge>
                  </td>
                  <td>
                    <div className="rowActions">
                      <Button size="sm" variant="secondary" type="button" onClick={() => loadSite(site)} disabled={busy}>
                        <FileCode2 size={14} />
                        {t.load}
                      </Button>
                      {site.removable ? (
                        <Button size="sm" variant="destructive" type="button" onClick={() => setDeleteTarget(site)} disabled={busy}>
                          <Trash2 size={14} />
                          {t.remove}
                        </Button>
                      ) : (
                        <span className="muted">{t.manager}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={Boolean(deleteTarget)} onMouseDown={(event) => event.target === event.currentTarget && setDeleteTarget(null)}>
        {deleteTarget && (
          <DialogContent aria-labelledby="remove-title">
            <DialogHeader>
              <DialogTitle id="remove-title">
                <ShieldAlert size={18} />
                {t.removeVhost}
              </DialogTitle>
              <DialogDescription>{t.removeDesc}</DialogDescription>
            </DialogHeader>
            <form onSubmit={submitDelete} className="stack">
              <Field>
                <FieldLabel>{t.domain}</FieldLabel>
                <Input value={deleteTarget.name} readOnly />
              </Field>
              <Field>
                <FieldLabel>{t.projectRoot}</FieldLabel>
                <Input value={deleteTarget.root || '-'} readOnly />
              </Field>
              <Field>
                <FieldLabel>{t.typeDomain}</FieldLabel>
                <Input value={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.value)} autoFocus />
              </Field>
              <div className="buttonRow">
                <Button variant="destructive" type="submit" disabled={busy || deleteConfirm !== deleteTarget.name}>
                  <Trash2 size={16} />
                  {t.remove}
                </Button>
                <Button variant="secondary" type="button" onClick={() => setDeleteTarget(null)} disabled={busy}>
                  {t.cancel}
                </Button>
              </div>
            </form>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={rootDialogOpen} onMouseDown={(event) => event.target === event.currentTarget && !loading && setRootDialogOpen(false)}>
        <DialogContent className="rootDialog" aria-labelledby="root-title">
          <DialogHeader>
            <DialogTitle id="root-title">
              <Folder size={18} />
              {t.loadProjectRoot}
            </DialogTitle>
            <DialogDescription>{t.loadProjectRootDesc}</DialogDescription>
          </DialogHeader>

          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              applyProjectRoot();
            }}
          >
            <Field>
              <FieldLabel>{t.projectRootPath}</FieldLabel>
              <Input
                list="root-suggestions"
                value={pendingBaseDir}
                onChange={(event) => setPendingBaseDir(event.target.value)}
                placeholder="/home/wintech/www/ums"
                autoFocus
              />
              <datalist id="root-suggestions">
                {state.rootSuggestions.map((suggestion) => (
                  <option key={suggestion} value={suggestion} />
                ))}
              </datalist>
            </Field>

            {state.rootError && <p className="inlineError">{state.rootError}</p>}

            <div className="rootSuggestions">
              {state.rootSuggestions.slice(0, 12).map((suggestion) => (
                <Button key={suggestion} variant="secondary" size="sm" type="button" onClick={() => setPendingBaseDir(suggestion)}>
                  <Folder size={14} />
                  {suggestion}
                </Button>
              ))}
            </div>

            <div className="buttonRow">
              <Button type="submit" disabled={!pendingBaseDir.trim() || busy}>
                <CheckCircle2 size={16} />
                {t.loadRoot}
              </Button>
              {state.config.baseDir && (
                <Button variant="secondary" type="button" onClick={() => setRootDialogOpen(false)}>
                  {t.cancel}
                </Button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function Metric({ icon, label, value, action }: { icon: React.ReactNode; label: string; value: string; action?: React.ReactNode }) {
  return (
    <div className="metric">
      <div className="metricTop">
        <span>
          {icon}
          {label}
        </span>
        {action}
      </div>
      <strong>{value}</strong>
    </div>
  );
}

function PhpVersionPicker({
  value,
  options,
  disabled,
  labels,
  onChange,
}: {
  value: string;
  options: PhpOption[];
  disabled: boolean;
  labels: (typeof copy)['en'];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.version === value);
  const selectedTitle = value === 'none' ? labels.noPhp : selected ? `PHP ${selected.version}` : labels.loading;
  const selectedStatus = value === 'none' ? labels.staticSite : selected ? phpStatusLabel(selected, labels) : labels.loading;

  function choose(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
  }

  return (
    <div
      className="phpPicker"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className="phpPickerButton"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
          if (event.key === 'ArrowDown') setOpen(true);
        }}
      >
        <span className="phpPickerIcon">{value === 'none' ? <Ban size={16} /> : <Cpu size={16} />}</span>
        <span className="phpPickerText">
          <strong>{selectedTitle}</strong>
          <small>{selectedStatus}</small>
        </span>
        <ChevronDown size={17} className={open ? 'chevronOpen' : ''} />
      </button>

      {open && (
        <div className="phpPickerMenu" role="listbox" tabIndex={-1}>
          <button type="button" role="option" aria-selected={value === 'none'} className="phpPickerItem" onClick={() => choose('none')}>
            <span className="phpPickerIcon mutedIcon">
              <Ban size={16} />
            </span>
            <span className="phpPickerText">
              <strong>{labels.noPhp}</strong>
              <small>{labels.staticSite}</small>
            </span>
            {value === 'none' && <Check size={16} />}
          </button>

          {options.map((option) => (
            <button
              key={option.version}
              type="button"
              role="option"
              aria-selected={value === option.version}
              className="phpPickerItem"
              disabled={!option.available}
              onClick={() => choose(option.version)}
            >
              <span className="phpPickerIcon">
                <Cpu size={16} />
              </span>
              <span className="phpPickerText">
                <strong>PHP {option.version}</strong>
                <small>{phpStatusLabel(option, labels)}</small>
              </span>
              <span className={`phpStatusPill ${option.installed ? 'phpStatusInstalled' : option.available ? 'phpStatusDownloadable' : 'phpStatusUnavailable'}`}>
                {option.installed ? labels.installed : option.available ? labels.install : labels.unavailable}
              </span>
              {value === option.version && <Check size={16} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function phpStatusLabel(option: PhpOption, labels: (typeof copy)['en']) {
  if (option.installed) return labels.installed;
  if (option.available) return labels.downloadable;
  return labels.unavailable;
}
