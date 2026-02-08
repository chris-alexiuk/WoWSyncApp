import { useEffect, useMemo, useState } from 'react';
import type { AppConfig, SyncMode, SyncState, UpdateCheckResult } from '../shared/types';

const EMPTY_STATE: SyncState = {
  running: false,
  inFlight: false,
  lastRunAt: null,
  lastSuccessAt: null,
  lastError: null,
  logs: [],
};

function emailsToText(emails: string[]): string {
  return emails.join(', ');
}

function textToEmails(text: string): string[] {
  return text
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function App(): JSX.Element {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [trustedEmailsText, setTrustedEmailsText] = useState('');
  const [state, setState] = useState<SyncState>(EMPTY_STATE);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('Loading config...');
  const [updateState, setUpdateState] = useState<UpdateCheckResult | null>(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);

  useEffect(() => {
    let unsubscribe = () => {};

    void (async () => {
      try {
        const initialConfig = await window.wowSync.loadConfig();
        const initialState = await window.wowSync.getState();
        setConfig(initialConfig);
        setTrustedEmailsText(emailsToText(initialConfig.trustedAuthorEmails));
        setState(initialState);
        setStatus('Ready');
        unsubscribe = window.wowSync.onState((next) => setState(next));

        void (async () => {
          setCheckingUpdates(true);

          try {
            const updateResult = await window.wowSync.checkForAppUpdate();
            setUpdateState(updateResult);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setUpdateState({
              currentVersion: 'unknown',
              latestVersion: null,
              hasUpdate: false,
              releaseUrl: null,
              publishedAt: null,
              notes: null,
              message: `Update check failed: ${message}`,
            });
          } finally {
            setCheckingUpdates(false);
          }
        })();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus(`Failed to load config: ${message}`);
      }
    })();

    return () => {
      unsubscribe();
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

  if (!config) {
    return (
      <main className="app-shell">
        <section className="panel hero">
          <h1>WoW Sync App</h1>
          <p>{status}</p>
        </section>
      </main>
    );
  }

  const patchConfig = (patch: Partial<AppConfig>) => {
    setConfig((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const currentConfig = (): AppConfig => ({
    ...config,
    trustedAuthorEmails: trustedEmails,
  });

  const saveConfig = async () => {
    setSaving(true);
    const nextConfig = currentConfig();

    await window.wowSync.saveConfig(nextConfig);
    setConfig(nextConfig);
    setSaving(false);
    setStatus('Config saved');
  };

  const runNow = async () => {
    setStatus('Running sync...');
    const result = await window.wowSync.runSyncNow(currentConfig());
    setStatus(result.message);
  };

  const startAutoSync = async () => {
    const nextConfig = currentConfig();
    await window.wowSync.saveConfig(nextConfig);
    setConfig(nextConfig);
    await window.wowSync.startSync(nextConfig);
    setStatus('Auto-sync running');
  };

  const stopAutoSync = async () => {
    await window.wowSync.stopSync();
    setStatus('Auto-sync stopped');
  };

  const pickDir = async (
    field: 'sourceAddonsPath' | 'targetAddonsPath' | 'sourceProfilesPath' | 'targetProfilesPath',
  ) => {
    const selected = await window.wowSync.pickDirectory(config[field]);
    if (selected) {
      patchConfig({ [field]: selected } as Partial<AppConfig>);
    }
  };

  const pickGitBinary = async () => {
    const selected = await window.wowSync.pickGitBinary(config.gitBinaryPath);
    if (selected) {
      patchConfig({ gitBinaryPath: selected });
    }
  };

  const checkForUpdates = async () => {
    setCheckingUpdates(true);

    try {
      const result = await window.wowSync.checkForAppUpdate();
      setUpdateState(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setUpdateState({
        currentVersion: 'unknown',
        latestVersion: null,
        hasUpdate: false,
        releaseUrl: null,
        publishedAt: null,
        notes: null,
        message: `Update check failed: ${message}`,
      });
    } finally {
      setCheckingUpdates(false);
    }
  };

  const openLatestRelease = async () => {
    if (!updateState?.releaseUrl) {
      return;
    }

    await window.wowSync.openExternalUrl(updateState.releaseUrl);
  };

  const formatDate = (iso: string | null) => {
    if (!iso) {
      return 'Never';
    }

    return new Date(iso).toLocaleString();
  };

  const modeLabel = (modeValue: SyncMode) =>
    modeValue === 'source' ? 'Source Machine (Push)' : 'Client Machine (Pull)';

  return (
    <main className="app-shell">
      <section className="panel hero">
        <div className="hero-brand">
          <span className="badge">v0 prototype</span>
          <h1>WoW Sync App</h1>
          <p>Keep addon folders aligned across machines through one shared GitHub flow.</p>
        </div>
        <div className="hero-metrics">
          <article>
            <h3>Status</h3>
            <p>{state.inFlight ? 'Syncing now' : state.running ? 'Auto-sync ON' : 'Idle'}</p>
          </article>
          <article>
            <h3>Last Success</h3>
            <p>{formatDate(state.lastSuccessAt)}</p>
          </article>
          <article>
            <h3>Mode</h3>
            <p>{modeLabel(mode)}</p>
          </article>
        </div>
      </section>

      <section className="panel updates">
        <header>
          <h2>App Updates</h2>
          <p>{updateState?.message ?? 'No update check yet'}</p>
        </header>
        <div className="update-grid">
          <article>
            <h3>Current Version</h3>
            <p>{updateState?.currentVersion ? `v${updateState.currentVersion}` : 'Unknown'}</p>
          </article>
          <article>
            <h3>Latest Release</h3>
            <p>{updateState?.latestVersion ? `v${updateState.latestVersion}` : 'Unknown'}</p>
          </article>
          <article>
            <h3>Published</h3>
            <p>{formatDate(updateState?.publishedAt ?? null)}</p>
          </article>
        </div>
        {updateState?.notes ? <pre className="update-notes">{updateState.notes}</pre> : null}
        <div className="actions">
          <button type="button" onClick={checkForUpdates} disabled={checkingUpdates}>
            {checkingUpdates ? 'Checking...' : 'Check for Updates'}
          </button>
          <button
            type="button"
            className="primary"
            onClick={openLatestRelease}
            disabled={!updateState?.releaseUrl}
          >
            {updateState?.hasUpdate && updateState.latestVersion
              ? `Download v${updateState.latestVersion}`
              : 'Open Release Page'}
          </button>
        </div>
      </section>

      <section className="panel controls">
        <header>
          <h2>Configuration</h2>
          <p>{status}</p>
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

        <div className="grid two-up">
          <label>
            Machine Label
            <input
              value={config.machineLabel}
              onChange={(event) => patchConfig({ machineLabel: event.target.value })}
              placeholder="Raid-PC-Source"
            />
          </label>
          <label>
            Branch
            <input
              value={config.branch}
              onChange={(event) => patchConfig({ branch: event.target.value })}
              placeholder="development"
            />
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
              Source Addons Folder
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
              Client Addons Folder
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
            Git Author Name
            <input
              value={config.authorName}
              onChange={(event) => patchConfig({ authorName: event.target.value })}
              placeholder="WoW Sync Bot"
            />
          </label>
          <label>
            Git Author Email
            <input
              value={config.authorEmail}
              onChange={(event) => patchConfig({ authorEmail: event.target.value })}
              placeholder="wow-sync-bot@example.local"
            />
          </label>
        </div>

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
          <label className="checkbox-line">
            <input
              type="checkbox"
              checked={config.requireSignedCommits}
              onChange={(event) => patchConfig({ requireSignedCommits: event.target.checked })}
            />
            Require signed commits on client ingest
          </label>
        </div>

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
            Configure trusted author emails or enable signed-commit requirement for client mode.
          </p>
        ) : null}

        <div className="actions">
          <button type="button" className="primary" disabled={!canSave || saving} onClick={saveConfig}>
            {saving ? 'Saving...' : 'Save Config'}
          </button>
          <button type="button" onClick={startAutoSync} disabled={!canSave || state.inFlight}>
            Start Auto Sync
          </button>
          <button type="button" onClick={runNow} disabled={!canSave || state.inFlight}>
            {state.inFlight ? 'Syncing...' : 'Sync Now'}
          </button>
          <button type="button" className="ghost" onClick={stopAutoSync}>
            Stop
          </button>
        </div>
      </section>

      <section className="panel logs">
        <header>
          <h2>Runtime</h2>
          <p>{state.lastError ? `Error: ${state.lastError}` : 'No active errors'}</p>
        </header>
        <div className="runtime-grid">
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
            <p>{state.inFlight ? 'Sync in progress' : state.running ? 'Auto mode active' : 'Manual mode'}</p>
          </article>
        </div>
        <pre className="log-view">{state.logs.join('\n') || 'No logs yet'}</pre>
      </section>
    </main>
  );
}
