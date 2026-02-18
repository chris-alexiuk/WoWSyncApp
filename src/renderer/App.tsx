import { useEffect, useMemo, useState } from 'react';
import type {
  AppUpdateState,
  AppConfig,
  PreflightIssue,
  PreflightResult,
  ProfileSyncPreset,
  SyncMode,
  SyncState,
  WindowState,
} from '../shared/types';
import { AzerSyncMark, TitleBar } from './components/TitleBar';
import { PreflightPanel } from './components/PreflightPanel';

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

const EMPTY_PREFLIGHT: PreflightResult = {
  checkedAt: null,
  ok: true,
  issues: [],
};

const VIEWS: Array<{ id: AppView; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'sync', label: 'Sync' },
  { id: 'settings', label: 'Settings' },
];

const PROFILE_PRESETS: Array<{ id: ProfileSyncPreset; label: string; hint: string }> = [
  {
    id: 'addons_only',
    label: 'AddOns Only',
    hint: 'Fastest: sync only Interface/AddOns.',
  },
  {
    id: 'account_saved_variables',
    label: 'Account SavedVariables',
    hint: 'Sync a SavedVariables folder (recommended for per-character addon state).',
  },
  {
    id: 'full_wtf',
    label: 'Full WTF',
    hint: 'Sync full WTF profile tree, including settings beyond addons.',
  },
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

function normalizeSlashes(value: string): string {
  return value.replace(/\\/g, '/');
}

function inferPathSeparator(value: string): string {
  return value.includes('\\') ? '\\' : '/';
}

function deriveWoWRootFromAddonsPath(addonsPath: string): string {
  const trimmed = addonsPath.trim();
  if (!trimmed) {
    return '';
  }

  const normalized = normalizeSlashes(trimmed).replace(/\/+$/, '');
  const marker = '/interface/addons';
  const lower = normalized.toLowerCase();

  if (lower.endsWith(marker)) {
    return normalized.slice(0, normalized.length - marker.length);
  }

  return '';
}

function suggestProfilesPath(addonsPath: string, preset: ProfileSyncPreset): string {
  const wowRoot = deriveWoWRootFromAddonsPath(addonsPath);
  if (!wowRoot || preset === 'addons_only') {
    return '';
  }

  const separator = inferPathSeparator(addonsPath);

  if (preset === 'full_wtf') {
    return `${wowRoot}${separator}WTF`;
  }

  return `${wowRoot}${separator}WTF${separator}SavedVariables`;
}

export function App(): JSX.Element {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [trustedEmailsText, setTrustedEmailsText] = useState('');
  const [state, setState] = useState<SyncState>(EMPTY_STATE);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('Loading config...');
  const [preflight, setPreflight] = useState<PreflightResult>(EMPTY_PREFLIGHT);
  const [preflightBusy, setPreflightBusy] = useState(false);
  const [updateState, setUpdateState] = useState<AppUpdateState>(EMPTY_UPDATE_STATE);
  const [windowState, setWindowState] = useState<WindowState>(EMPTY_WINDOW_STATE);
  const [useCustomWindowChrome, setUseCustomWindowChrome] = useState(true);
  const [activeView, setActiveView] = useState<AppView>('dashboard');

  useEffect(() => {
    let unsubscribeSyncState = () => {};
    let unsubscribeUpdateState = () => {};

    void (async () => {
      try {
        const loadedConfig = await window.wowSync.loadConfig();
        const initialConfig = normalizedConfig(loadedConfig);
        const initialState = await window.wowSync.getState();
        const initialUpdateState = await window.wowSync.getAppUpdateState();
        setConfig(initialConfig);
        setTrustedEmailsText(emailsToText(initialConfig.trustedAuthorEmails));
        setState(initialState);
        setUpdateState(initialUpdateState);
        setPreflightBusy(true);
        const initialPreflight = await window.wowSync.runPreflight(initialConfig);
        setPreflight(initialPreflight);
        setStatus('Ready');
        unsubscribeSyncState = window.wowSync.onState((next) => setState(next));
        unsubscribeUpdateState = window.wowSync.onAppUpdateState((next) => setUpdateState(next));

        if (initialUpdateState.canCheck) {
          await window.wowSync.checkForAppUpdate();
        }
      } catch (error) {
        setStatus(`Failed to load config: ${asErrorMessage(error)}`);
      } finally {
        setPreflightBusy(false);
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
  const profileSyncEnabled = config ? config.profileSyncPreset !== 'addons_only' : false;
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

    const syncProfiles = config.profileSyncPreset !== 'addons_only';

    if (mode === 'source' && syncProfiles && !config.sourceProfilesPath.trim()) {
      return false;
    }

    if (mode === 'client' && syncProfiles && !config.targetProfilesPath.trim()) {
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

  const normalizedConfig = (value: AppConfig): AppConfig => {
    const syncProfiles = value.profileSyncPreset !== 'addons_only';
    return {
      ...value,
      syncProfiles,
    };
  };

  const currentConfig = (): AppConfig => {
    if (!config) {
      throw new Error('Config is not loaded.');
    }

    return normalizedConfig({
      ...config,
      trustedAuthorEmails: trustedEmails,
    });
  };

  const runPreflightCheck = async (targetConfig?: AppConfig): Promise<void> => {
    try {
      setPreflightBusy(true);
      const resolved = targetConfig ?? currentConfig();
      const result = await window.wowSync.runPreflight(resolved);
      setPreflight(result);
    } catch (error) {
      setStatus(`Preflight check failed: ${asErrorMessage(error)}`);
    } finally {
      setPreflightBusy(false);
    }
  };

  const runIssueAction = async (issue: PreflightIssue): Promise<void> => {
    if (!issue.action) {
      return;
    }

    let preflightTarget: AppConfig | undefined;

    switch (issue.action) {
      case 'openSettings':
        setActiveView('settings');
        break;
      case 'openSync':
        setActiveView('sync');
        break;
      case 'pickGitBinary': {
        setActiveView('settings');
        preflightTarget = (await pickGitBinary()) ?? undefined;
        break;
      }
      case 'pickSourceAddonsPath':
        setActiveView('sync');
        preflightTarget = (await pickDir('sourceAddonsPath')) ?? undefined;
        break;
      case 'pickSourceProfilesPath':
        setActiveView('sync');
        preflightTarget = (await pickDir('sourceProfilesPath')) ?? undefined;
        break;
      case 'pickTargetAddonsPath':
        setActiveView('sync');
        preflightTarget = (await pickDir('targetAddonsPath')) ?? undefined;
        break;
      case 'pickTargetProfilesPath':
        setActiveView('sync');
        preflightTarget = (await pickDir('targetProfilesPath')) ?? undefined;
        break;
      case 'checkAgain':
        break;
      default:
        break;
    }

    await runPreflightCheck(preflightTarget);
  };

  const saveConfig = async () => {
    if (!config) {
      return;
    }

    setSaving(true);
    const nextConfig = normalizedConfig(currentConfig());

    try {
      await window.wowSync.saveConfig(nextConfig);
      setConfig(nextConfig);
      setStatus('Settings saved');
      await runPreflightCheck(nextConfig);
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
      await runPreflightCheck();
    } catch (error) {
      setStatus(`Sync failed: ${asErrorMessage(error)}`);
    }
  };

  const startAutoSync = async () => {
    try {
      const nextConfig = normalizedConfig(currentConfig());
      await window.wowSync.saveConfig(nextConfig);
      setConfig(nextConfig);
      await window.wowSync.startSync(nextConfig);
      setStatus('Auto-sync running');
      await runPreflightCheck(nextConfig);
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

  const restoreLatestBackup = async () => {
    try {
      setStatus('Restoring latest snapshot...');
      const result = await window.wowSync.restoreLatestBackup(currentConfig());
      setStatus(result.message);
      await runPreflightCheck();
    } catch (error) {
      setStatus(`Rollback failed: ${asErrorMessage(error)}`);
    }
  };

  const pickDir = async (
    field: 'sourceAddonsPath' | 'targetAddonsPath' | 'sourceProfilesPath' | 'targetProfilesPath',
  ): Promise<AppConfig | null> => {
    if (!config) {
      return null;
    }

    const selected = await window.wowSync.pickDirectory(config[field]);
    if (selected) {
      const nextConfig = {
        ...config,
        [field]: selected,
      } as AppConfig;
      setConfig(nextConfig);
      return nextConfig;
    }

    return null;
  };

  const pickGitBinary = async (): Promise<AppConfig | null> => {
    if (!config) {
      return null;
    }

    const selected = await window.wowSync.pickGitBinary(config.gitBinaryPath);
    if (selected) {
      const nextConfig = {
        ...config,
        gitBinaryPath: selected,
      };
      setConfig(nextConfig);
      return nextConfig;
    }

    return null;
  };

  const applyProfilePreset = (preset: ProfileSyncPreset) => {
    if (!config) {
      return;
    }

    const syncProfiles = preset !== 'addons_only';
    const profileField = mode === 'source' ? 'sourceProfilesPath' : 'targetProfilesPath';
    const currentProfilesPath = mode === 'source' ? config.sourceProfilesPath : config.targetProfilesPath;
    const addonsPath = mode === 'source' ? config.sourceAddonsPath : config.targetAddonsPath;
    const suggested = syncProfiles && !currentProfilesPath.trim() ? suggestProfilesPath(addonsPath, preset) : '';

    const nextConfig = {
      ...config,
      profileSyncPreset: preset,
      syncProfiles,
      ...(suggested ? { [profileField]: suggested } : {}),
    } as AppConfig;

    setConfig(nextConfig);
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
    <TitleBar
      isMaximized={windowState.isMaximized}
      onMinimize={minimizeWindow}
      onToggleMaximize={toggleMaximizeWindow}
      onClose={closeWindow}
    />
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
            <PreflightPanel
              preflight={preflight}
              preflightBusy={preflightBusy}
              saving={saving}
              inFlight={state.inFlight}
              onRunCheck={() => void runPreflightCheck()}
              onIssueAction={(issue) => void runIssueAction(issue)}
            />

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
                  {mode === 'client' ? (
                    <button type="button" className="ghost" onClick={restoreLatestBackup} disabled={state.inFlight}>
                      Restore Previous Snapshot
                    </button>
                  ) : null}
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

            <div className="profile-preset-group">
              <p className="profile-preset-label">Profile Sync Preset</p>
              <div className="mode-toggle profile-toggle" role="radiogroup" aria-label="Profile sync preset">
                {PROFILE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    className={preset.id === config.profileSyncPreset ? 'active' : ''}
                    onClick={() => applyProfilePreset(preset.id)}
                    type="button"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <p className="profile-preset-hint">
                {PROFILE_PRESETS.find((preset) => preset.id === config.profileSyncPreset)?.hint}
              </p>
            </div>

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
                {profileSyncEnabled ? (
                  <label>
                    Source Profile Folder
                    <div className="inline-field">
                      <input
                        value={config.sourceProfilesPath}
                        onChange={(event) => patchConfig({ sourceProfilesPath: event.target.value })}
                        placeholder={
                          config.profileSyncPreset === 'full_wtf'
                            ? '/path/to/WTF'
                            : '/path/to/.../SavedVariables'
                        }
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
                {profileSyncEnabled ? (
                  <label>
                    Client Profile Folder
                    <div className="inline-field">
                      <input
                        value={config.targetProfilesPath}
                        onChange={(event) => patchConfig({ targetProfilesPath: event.target.value })}
                        placeholder={
                          config.profileSyncPreset === 'full_wtf'
                            ? '/path/to/WTF'
                            : '/path/to/.../SavedVariables'
                        }
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
              {mode === 'client' ? (
                <button type="button" className="ghost" onClick={restoreLatestBackup} disabled={state.inFlight}>
                  Restore Previous Snapshot
                </button>
              ) : null}
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
