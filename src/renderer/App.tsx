import { useEffect, useMemo, useState } from 'react';
import type {
  AppUpdateState,
  AppConfig,
  SyncMode,
  SyncState,
  WindowState,
} from '../shared/types';

type AppView = 'dashboard' | 'sync' | 'settings';

const EMPTY_STATE: SyncState = {
  running: false,
  inFlight: false,
  lastRunAt: null,
  lastSuccessAt: null,
  lastError: null,
  logs: [],
};

const EMPTY_WINDOW_STATE: WindowState = {
  isMaximized: false,
};

const EMPTY_UPDATE_STATE: AppUpdateState = {
  phase: 'idle',
  currentVersion: 'unknown',
  latestVersion: null,
  hasUpdate: false,
  releaseUrl: null,
  publishedAt: null,
  notes: null,
  message: 'Update state unavailable.',
  checkedAt: null,
  downloadPercent: null,
  bytesPerSecond: null,
  transferredBytes: null,
  totalBytes: null,
  canCheck: true,
  canDownload: false,
  canInstall: false,
};

const VIEWS: Array<{ id: AppView; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'sync', label: 'Sync' },
  { id: 'settings', label: 'Settings' },
];

function emailsToText(emails: string[]): string {
  return emails.join(', ');
}

function textToEmails(text: string): string[] {
  return text
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function modeLabel(modeValue: SyncMode): string {
  return modeValue === 'source' ? 'Source (Push)' : 'Client (Pull)';
}

function asErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatDate(iso: string | null): string {
  if (!iso) {
    return 'Never';
  }

  return new Date(iso).toLocaleString();
}

function formatMegabytes(bytes: number | null): string {
  if (!bytes || Number.isNaN(bytes)) {
    return '0 MB';
  }

  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

function AzerSyncMark(): JSX.Element {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="azersync-mark-gradient" x1="8" y1="10" x2="56" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#74e8c8" />
          <stop offset="1" stopColor="#6f9eff" />
        </linearGradient>
      </defs>
      <rect x="6" y="6" width="52" height="52" rx="16" fill="url(#azersync-mark-gradient)" />
      <path
        d="M20 40L30 20L44 44M24 32H38"
        fill="none"
        stroke="#0a182a"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M47 18C51 23 53 30 53 37"
        fill="none"
        stroke="#0a182a"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M15 46C11 41 9 34 9 27"
        fill="none"
        stroke="#0a182a"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function App(): JSX.Element {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [trustedEmailsText, setTrustedEmailsText] = useState('');
  const [state, setState] = useState<SyncState>(EMPTY_STATE);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('Loading config...');
  const [updateState, setUpdateState] = useState<AppUpdateState>(EMPTY_UPDATE_STATE);
  const [windowState, setWindowState] = useState<WindowState>(EMPTY_WINDOW_STATE);
  const [useCustomWindowChrome, setUseCustomWindowChrome] = useState(true);
  const [activeView, setActiveView] = useState<AppView>('dashboard');

  useEffect(() => {
    let unsubscribeSyncState = () => {};
    let unsubscribeUpdateState = () => {};

    void (async () => {
      try {
        const initialConfig = await window.wowSync.loadConfig();
        const initialState = await window.wowSync.getState();
        const initialUpdateState = await window.wowSync.getAppUpdateState();
        setConfig(initialConfig);
        setTrustedEmailsText(emailsToText(initialConfig.trustedAuthorEmails));
        setState(initialState);
        setUpdateState(initialUpdateState);
        setStatus('Ready');
        unsubscribeSyncState = window.wowSync.onState((next) => setState(next));
        unsubscribeUpdateState = window.wowSync.onAppUpdateState((next) => setUpdateState(next));

        if (initialUpdateState.canCheck) {
          await window.wowSync.checkForAppUpdate();
        }
      } catch (error) {
        setStatus(`Failed to load config: ${asErrorMessage(error)}`);
      }
    })();

    return () => {
      unsubscribeSyncState();
      unsubscribeUpdateState();
    };
  }, []);

  useEffect(() => {
    let unsubscribeWindowState = () => {};

    void (async () => {
      try {
        const useCustomChrome = await window.wowSync.usesCustomWindowChrome();
        setUseCustomWindowChrome(useCustomChrome);

        if (!useCustomChrome) {
          return;
        }

        const current = await window.wowSync.getWindowState();
        setWindowState(current);
        unsubscribeWindowState = window.wowSync.onWindowState((next) => setWindowState(next));
      } catch {
        setUseCustomWindowChrome(false);
      }
    })();

    return () => {
      unsubscribeWindowState();
    };
  }, []);

  const mode = config?.mode ?? 'source';
  const trustedEmails = useMemo(() => textToEmails(trustedEmailsText), [trustedEmailsText]);

  const trustConfigured = useMemo(() => {
    if (!config || config.mode !== 'client') {
      return true;
    }

    return config.requireSignedCommits || trustedEmails.length > 0;
  }, [config, trustedEmails]);

  const canSave = useMemo(() => {
    if (!config) {
      return false;
    }

    if (!config.repoUrl.trim() || !config.branch.trim()) {
      return false;
    }

    if (mode === 'source' && !config.sourceAddonsPath.trim()) {
      return false;
    }

    if (mode === 'client' && !config.targetAddonsPath.trim()) {
      return false;
    }

    if (mode === 'source' && config.syncProfiles && !config.sourceProfilesPath.trim()) {
      return false;
    }

    if (mode === 'client' && config.syncProfiles && !config.targetProfilesPath.trim()) {
      return false;
    }

    if (!trustConfigured) {
      return false;
    }

    return true;
  }, [config, mode, trustConfigured]);

  const syncStatus = state.inFlight ? 'Syncing' : state.running ? 'Auto Sync On' : 'Idle';

  const patchConfig = (patch: Partial<AppConfig>) => {
    setConfig((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const currentConfig = (): AppConfig => {
    if (!config) {
      throw new Error('Config is not loaded.');
    }

    return {
      ...config,
      trustedAuthorEmails: trustedEmails,
    };
  };

  const saveConfig = async () => {
    if (!config) {
      return;
    }

    setSaving(true);
    const nextConfig = currentConfig();

    try {
      await window.wowSync.saveConfig(nextConfig);
      setConfig(nextConfig);
      setStatus('Settings saved');
    } catch (error) {
      setStatus(`Save failed: ${asErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const runNow = async () => {
    try {
      setStatus('Running sync...');
      const result = await window.wowSync.runSyncNow(currentConfig());
      setStatus(result.message);
    } catch (error) {
      setStatus(`Sync failed: ${asErrorMessage(error)}`);
    }
  };

  const startAutoSync = async () => {
    try {
      const nextConfig = currentConfig();
      await window.wowSync.saveConfig(nextConfig);
      setConfig(nextConfig);
      await window.wowSync.startSync(nextConfig);
      setStatus('Auto-sync running');
    } catch (error) {
      setStatus(`Failed to start auto-sync: ${asErrorMessage(error)}`);
    }
  };

  const stopAutoSync = async () => {
    try {
      await window.wowSync.stopSync();
      setStatus('Auto-sync stopped');
    } catch (error) {
      setStatus(`Failed to stop auto-sync: ${asErrorMessage(error)}`);
    }
  };

  const pickDir = async (
    field: 'sourceAddonsPath' | 'targetAddonsPath' | 'sourceProfilesPath' | 'targetProfilesPath',
  ) => {
    if (!config) {
      return;
    }

    const selected = await window.wowSync.pickDirectory(config[field]);
    if (selected) {
      patchConfig({ [field]: selected } as Partial<AppConfig>);
    }
  };

  const pickGitBinary = async () => {
    if (!config) {
      return;
    }

    const selected = await window.wowSync.pickGitBinary(config.gitBinaryPath);
    if (selected) {
      patchConfig({ gitBinaryPath: selected });
    }
  };

  const checkForUpdates = async () => {
    try {
      const result = await window.wowSync.checkForAppUpdate();
      setUpdateState(result);
    } catch (error) {
      setStatus(`Update check failed: ${asErrorMessage(error)}`);
    }
  };

  const downloadUpdate = async () => {
    try {
      const result = await window.wowSync.downloadAppUpdate();
      setUpdateState(result);
    } catch (error) {
      setStatus(`Download failed: ${asErrorMessage(error)}`);
    }
  };

  const installUpdate = async () => {
    const result = await window.wowSync.installAppUpdate();
    setStatus(result.message);
  };

  const openLatestRelease = async () => {
    if (!updateState.releaseUrl) {
      return;
    }

    await window.wowSync.openExternalUrl(updateState.releaseUrl);
  };

  const minimizeWindow = async () => {
    await window.wowSync.minimizeWindow();
  };

  const toggleMaximizeWindow = async () => {
    const next = await window.wowSync.toggleMaximizeWindow();
    setWindowState(next);
  };

  const closeWindow = async () => {
    await window.wowSync.closeWindow();
  };

  const windowChrome = useCustomWindowChrome ? (
    <header className="window-chrome">
      <div className="window-chrome__title">
        <span className="window-brand-mark">
          <AzerSyncMark />
        </span>
        AzerSync
      </div>
      <div className="window-chrome__controls">
        <button type="button" className="window-btn" onClick={minimizeWindow} aria-label="Minimize window">
          -
        </button>
        <button
          type="button"
          className="window-btn"
          onClick={toggleMaximizeWindow}
          aria-label={windowState.isMaximized ? 'Restore window' : 'Maximize window'}
        >
          {windowState.isMaximized ? '[]' : '[ ]'}
        </button>
        <button type="button" className="window-btn window-btn--close" onClick={closeWindow} aria-label="Close window">
          x
        </button>
      </div>
    </header>
  ) : null;

  if (!config) {
    return (
      <main className="app-shell">
        {windowChrome}
        <div className="app-content">
          <section className="panel loading-panel">
            <div className="loading-brand">
              <span className="brand-mark" aria-hidden="true">
                <AzerSyncMark />
              </span>
              <div>
                <h1>AzerSync</h1>
                <p>{status}</p>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      {windowChrome}
      <div className="app-content">
        <section className="panel masthead masthead--minimal">
          <div className="masthead__left">
            <div className="brand-lockup">
              <span className="brand-mark" aria-hidden="true">
                <AzerSyncMark />
              </span>
              <div>
                <p className="brand-eyebrow">WoW Addon Sync</p>
                <h1>AzerSync</h1>
                <p className="brand-subtle">One repo. Consistent AddOns and profiles.</p>
              </div>
            </div>
            <nav className="view-nav" aria-label="App sections">
              {VIEWS.map((view) => (
                <button
                  key={view.id}
                  type="button"
                  className={activeView === view.id ? 'active' : ''}
                  onClick={() => setActiveView(view.id)}
                >
                  {view.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="masthead__right">
            <article>
              <h3>Status</h3>
              <p>{syncStatus}</p>
            </article>
            <article>
              <h3>Mode</h3>
              <p>{modeLabel(mode)}</p>
            </article>
            <article>
              <h3>Last Success</h3>
              <p>{formatDate(state.lastSuccessAt)}</p>
            </article>
            <article>
              <h3>App</h3>
              <p>v{updateState.currentVersion}</p>
            </article>
          </div>
        </section>

        {activeView === 'dashboard' ? (
          <>
            <div className="dashboard-grid">
              <section className="panel quick-panel">
                <header>
                  <h2>Sync Control</h2>
                  <p>{status}</p>
                </header>
                <div className="status-row">
                  <span className="status-pill">{syncStatus}</span>
                  <span className="status-pill">{modeLabel(mode)}</span>
                </div>
                <div className="actions actions--tight">
                  <button type="button" className="primary" onClick={runNow} disabled={!canSave || state.inFlight}>
                    {state.inFlight ? 'Syncing...' : 'Sync Now'}
                  </button>
                  <button type="button" onClick={startAutoSync} disabled={!canSave || state.inFlight}>
                    Start Auto Sync
                  </button>
                  <button type="button" className="ghost" onClick={stopAutoSync}>
                    Stop
                  </button>
                  <button type="button" className="primary" disabled={!canSave || saving} onClick={saveConfig}>
                    {saving ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </section>

              <section className="panel updates updates--compact">
                <header>
                  <h2>Updates</h2>
                  <p>{updateState.message}</p>
                </header>
                <div className="update-summary-row">
                  <article>
                    <h3>Current</h3>
                    <p>{updateState.currentVersion ? `v${updateState.currentVersion}` : 'Unknown'}</p>
                  </article>
                  <article>
                    <h3>Latest</h3>
                    <p>{updateState.latestVersion ? `v${updateState.latestVersion}` : 'Unknown'}</p>
                  </article>
                  <article>
                    <h3>Checked</h3>
                    <p>{formatDate(updateState.checkedAt)}</p>
                  </article>
                </div>
                {updateState.downloadPercent !== null ? (
                  <div className="download-progress-wrap">
                    <div className="download-progress" role="presentation">
                      <span style={{ width: `${Math.max(0, Math.min(100, updateState.downloadPercent))}%` }} />
                    </div>
                    <p>
                      {updateState.downloadPercent.toFixed(1)}% ({formatMegabytes(updateState.transferredBytes)} /{' '}
                      {formatMegabytes(updateState.totalBytes)})
                    </p>
                  </div>
                ) : null}
                <div className="actions actions--tight">
                  <button type="button" onClick={checkForUpdates} disabled={!updateState.canCheck}>
                    {updateState.phase === 'checking' ? 'Checking...' : 'Check'}
                  </button>
                  <button type="button" className="primary" onClick={downloadUpdate} disabled={!updateState.canDownload}>
                    {updateState.phase === 'downloading' ? 'Downloading...' : 'Download'}
                  </button>
                  <button type="button" className="primary" onClick={installUpdate} disabled={!updateState.canInstall}>
                    Restart to Apply
                  </button>
                  <button type="button" onClick={openLatestRelease} disabled={!updateState.releaseUrl}>
                    Release Page
                  </button>
                </div>
                {updateState.notes ? (
                  <details className="update-details">
                    <summary>Release notes</summary>
                    <pre className="update-notes">{updateState.notes}</pre>
                  </details>
                ) : null}
              </section>
            </div>

            <section className="panel logs logs--minimal">
              <header>
                <h2>Runtime</h2>
                <p>{state.lastError ? `Error: ${state.lastError}` : 'No active errors'}</p>
              </header>
              <div className="runtime-grid runtime-grid--compact">
                <article>
                  <h3>Last Run</h3>
                  <p>{formatDate(state.lastRunAt)}</p>
                </article>
                <article>
                  <h3>Last Success</h3>
                  <p>{formatDate(state.lastSuccessAt)}</p>
                </article>
                <article>
                  <h3>Process</h3>
                  <p>{state.inFlight ? 'Syncing now' : state.running ? 'Auto mode active' : 'Manual mode'}</p>
                </article>
              </div>
              <details className="activity-details">
                <summary>Show detailed log</summary>
                <pre className="log-view">{state.logs.join('\n') || 'No logs yet'}</pre>
              </details>
            </section>
          </>
        ) : null}

        {activeView === 'sync' ? (
          <section className="panel controls">
            <header>
              <h2>Sync Paths</h2>
              <p>{modeLabel(mode)}</p>
            </header>

            <div className="mode-toggle" role="radiogroup" aria-label="Sync mode">
              {(['source', 'client'] as SyncMode[]).map((option) => (
                <button
                  key={option}
                  className={option === mode ? 'active' : ''}
                  onClick={() => patchConfig({ mode: option })}
                  type="button"
                >
                  {modeLabel(option)}
                </button>
              ))}
            </div>

            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={config.syncProfiles}
                onChange={(event) => patchConfig({ syncProfiles: event.target.checked })}
              />
              Sync profile/config folder too (WTF / SavedVariables)
            </label>

            {mode === 'source' ? (
              <>
                <label>
                  Source AddOns Folder
                  <div className="inline-field">
                    <input
                      value={config.sourceAddonsPath}
                      onChange={(event) => patchConfig({ sourceAddonsPath: event.target.value })}
                      placeholder="/path/to/Interface/AddOns"
                    />
                    <button type="button" onClick={() => pickDir('sourceAddonsPath')}>
                      Browse
                    </button>
                  </div>
                </label>
                {config.syncProfiles ? (
                  <label>
                    Source Profiles Folder
                    <div className="inline-field">
                      <input
                        value={config.sourceProfilesPath}
                        onChange={(event) => patchConfig({ sourceProfilesPath: event.target.value })}
                        placeholder="/path/to/WTF or .../SavedVariables"
                      />
                      <button type="button" onClick={() => pickDir('sourceProfilesPath')}>
                        Browse
                      </button>
                    </div>
                  </label>
                ) : null}
              </>
            ) : (
              <>
                <label>
                  Client AddOns Folder
                  <div className="inline-field">
                    <input
                      value={config.targetAddonsPath}
                      onChange={(event) => patchConfig({ targetAddonsPath: event.target.value })}
                      placeholder="/path/to/Interface/AddOns"
                    />
                    <button type="button" onClick={() => pickDir('targetAddonsPath')}>
                      Browse
                    </button>
                  </div>
                </label>
                {config.syncProfiles ? (
                  <label>
                    Client Profiles Folder
                    <div className="inline-field">
                      <input
                        value={config.targetProfilesPath}
                        onChange={(event) => patchConfig({ targetProfilesPath: event.target.value })}
                        placeholder="/path/to/WTF or .../SavedVariables"
                      />
                      <button type="button" onClick={() => pickDir('targetProfilesPath')}>
                        Browse
                      </button>
                    </div>
                  </label>
                ) : null}
              </>
            )}

            <div className="grid two-up">
              <label>
                Sync Interval (seconds)
                <input
                  type="number"
                  min={10}
                  value={config.syncIntervalSeconds}
                  onChange={(event) =>
                    patchConfig({ syncIntervalSeconds: Math.max(10, Number(event.target.value) || 10) })
                  }
                />
              </label>
              <label>
                Machine Label
                <input
                  value={config.machineLabel}
                  onChange={(event) => patchConfig({ machineLabel: event.target.value })}
                  placeholder="Raid-PC-Source"
                />
              </label>
            </div>

            <div className="actions actions--tight">
              <button type="button" className="primary" onClick={runNow} disabled={!canSave || state.inFlight}>
                {state.inFlight ? 'Syncing...' : 'Sync Now'}
              </button>
              <button type="button" onClick={startAutoSync} disabled={!canSave || state.inFlight}>
                Start Auto Sync
              </button>
              <button type="button" className="ghost" onClick={stopAutoSync}>
                Stop
              </button>
              <button type="button" className="primary" disabled={!canSave || saving} onClick={saveConfig}>
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </section>
        ) : null}

        {activeView === 'settings' ? (
          <section className="panel controls">
            <header>
              <h2>Repository & Trust</h2>
              <p>{status}</p>
            </header>

            <div className="grid two-up">
              <label>
                Branch
                <input
                  value={config.branch}
                  onChange={(event) => patchConfig({ branch: event.target.value })}
                  placeholder="development"
                />
              </label>
              <label>
                Git Binary Path (optional)
                <div className="inline-field">
                  <input
                    value={config.gitBinaryPath}
                    onChange={(event) => patchConfig({ gitBinaryPath: event.target.value })}
                    placeholder="C:\\Program Files\\Git\\cmd\\git.exe or /usr/bin/git"
                  />
                  <button type="button" onClick={pickGitBinary}>
                    Browse
                  </button>
                </div>
              </label>
            </div>

            <label>
              GitHub Repository URL
              <input
                value={config.repoUrl}
                onChange={(event) => patchConfig({ repoUrl: event.target.value })}
                placeholder="https://github.com/your-org/wow-sync-data.git"
              />
            </label>

            <label>
              GitHub Token (PAT)
              <input
                type="password"
                value={config.githubToken}
                onChange={(event) => patchConfig({ githubToken: event.target.value })}
                placeholder="ghp_..."
              />
            </label>

            <div className="grid two-up">
              <label>
                Git Author Name
                <input
                  value={config.authorName}
                  onChange={(event) => patchConfig({ authorName: event.target.value })}
                  placeholder="AzerSync Bot"
                />
              </label>
              <label>
                Git Author Email
                <input
                  value={config.authorEmail}
                  onChange={(event) => patchConfig({ authorEmail: event.target.value })}
                  placeholder="azersync-bot@example.local"
                />
              </label>
            </div>

            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={config.requireSignedCommits}
                onChange={(event) => patchConfig({ requireSignedCommits: event.target.checked })}
              />
              Require signed commits on client ingest
            </label>

            <label>
              Trusted Author Emails (comma separated)
              <textarea
                value={trustedEmailsText}
                onChange={(event) => setTrustedEmailsText(event.target.value)}
                placeholder="you@example.com, alt@example.com"
              />
            </label>

            {!trustConfigured ? (
              <p className="inline-warning">
                Configure trusted emails or enable signed-commit enforcement for client mode.
              </p>
            ) : null}

            <div className="actions actions--tight">
              <button type="button" className="primary" disabled={!canSave || saving} onClick={saveConfig}>
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
