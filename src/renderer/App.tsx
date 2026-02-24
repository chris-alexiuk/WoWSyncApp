import { useEffect, useState } from 'react';
import type {
  AppUpdateState,
  AppConfig,
  PreflightIssue,
  PreflightResult,
  WindowState,
} from '../shared/types';
import { AzerSyncMark, TitleBar } from './components/TitleBar';
import { DashboardView } from './components/DashboardView';
import { SyncView } from './components/SyncView';
import { SettingsView } from './components/SettingsView';
import { useConfig } from './hooks/useConfig';
import { useSyncState } from './hooks/useSyncState';
import { formatDate, asErrorMessage, modeLabel, emailsToText } from './utils';

type AppView = 'dashboard' | 'sync' | 'settings';

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

export function App(): JSX.Element {
  const {
    config, trustedEmailsText, mode, profileSyncEnabled, canSave, saving, trustConfigured,
    setTrustedEmailsText, patchConfig, setConfig, saveConfig: saveConfigHook,
    currentConfig, normalizedConfig, applyProfilePreset, pickDir, pickGitBinary,
  } = useConfig();

  const state = useSyncState();
  const [status, setStatus] = useState('Loading config...');
  const [preflight, setPreflight] = useState<PreflightResult>(EMPTY_PREFLIGHT);
  const [preflightBusy, setPreflightBusy] = useState(false);
  const [updateState, setUpdateState] = useState<AppUpdateState>(EMPTY_UPDATE_STATE);
  const [windowState, setWindowState] = useState<WindowState>(EMPTY_WINDOW_STATE);
  const [useCustomWindowChrome, setUseCustomWindowChrome] = useState(true);
  const [activeView, setActiveView] = useState<AppView>('dashboard');

  useEffect(() => {
    let unsubscribeUpdateState = () => {};

    void (async () => {
      try {
        const loadedConfig = await window.wowSync.loadConfig();
        const initialConfig = normalizedConfig(loadedConfig);
        const initialUpdateState = await window.wowSync.getAppUpdateState();
        setConfig(initialConfig);
        setTrustedEmailsText(emailsToText(initialConfig.trustedAuthorEmails));
        setUpdateState(initialUpdateState);
        setPreflightBusy(true);
        const initialPreflight = await window.wowSync.runPreflight(initialConfig);
        setPreflight(initialPreflight);
        setStatus('Ready');
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
    const error = await saveConfigHook();
    if (error) {
      setStatus(error);
    } else {
      setStatus('Settings saved');
      await runPreflightCheck();
    }
  };

  const runNow = async () => {
    if (mode === 'source') {
      const confirmed = window.confirm('Push local addons to the sync repository?');
      if (!confirmed) return;
    }

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
    const confirmed = window.confirm(
      'Restore the most recent backup snapshot? This will overwrite your current addons folder.',
    );
    if (!confirmed) return;

    try {
      setStatus('Restoring latest snapshot...');
      const result = await window.wowSync.restoreLatestBackup(currentConfig());
      setStatus(result.message);
      await runPreflightCheck();
    } catch (error) {
      setStatus(`Rollback failed: ${asErrorMessage(error)}`);
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
              <p>{state.inFlight ? 'Syncing' : state.running ? 'Auto Sync On' : 'Idle'}</p>
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
          <DashboardView
            config={config}
            state={state}
            preflight={preflight}
            preflightBusy={preflightBusy}
            saving={saving}
            updateState={updateState}
            status={status}
            canSave={canSave}
            mode={mode}
            onRunPreflightCheck={() => void runPreflightCheck()}
            onIssueAction={(issue) => void runIssueAction(issue)}
            onRunNow={runNow}
            onStartAutoSync={startAutoSync}
            onStopAutoSync={stopAutoSync}
            onRestoreBackup={restoreLatestBackup}
            onSaveConfig={saveConfig}
            onCheckForUpdates={checkForUpdates}
            onDownloadUpdate={downloadUpdate}
            onInstallUpdate={installUpdate}
            onOpenReleasePage={openLatestRelease}
          />
        ) : null}

        {activeView === 'sync' ? (
          <SyncView
            config={config}
            state={state}
            canSave={canSave}
            saving={saving}
            mode={mode}
            profileSyncEnabled={profileSyncEnabled}
            onPatchConfig={patchConfig}
            onApplyProfilePreset={applyProfilePreset}
            onPickDir={pickDir}
            onRunNow={runNow}
            onStartAutoSync={startAutoSync}
            onStopAutoSync={stopAutoSync}
            onRestoreBackup={restoreLatestBackup}
            onSaveConfig={saveConfig}
          />
        ) : null}

        {activeView === 'settings' ? (
          <SettingsView
            config={config}
            status={status}
            trustedEmailsText={trustedEmailsText}
            trustConfigured={trustConfigured}
            canSave={canSave}
            saving={saving}
            onPatchConfig={patchConfig}
            onSetTrustedEmailsText={setTrustedEmailsText}
            onPickGitBinary={pickGitBinary}
            onSaveConfig={saveConfig}
          />
        ) : null}
      </div>
    </main>
  );
}
