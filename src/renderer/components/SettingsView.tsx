import type { AppConfig } from '../../shared/types';

interface SettingsViewProps {
  config: AppConfig;
  status: string;
  trustedEmailsText: string;
  trustConfigured: boolean;
  canSave: boolean;
  saving: boolean;
  onPatchConfig: (patch: Partial<AppConfig>) => void;
  onSetTrustedEmailsText: (text: string) => void;
  onPickGitBinary: () => void;
  onSaveConfig: () => void;
}

export function SettingsView({
  config,
  status,
  trustedEmailsText,
  trustConfigured,
  canSave,
  saving,
  onPatchConfig,
  onSetTrustedEmailsText,
  onPickGitBinary,
  onSaveConfig,
}: SettingsViewProps): JSX.Element {
  return (
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
            onChange={(event) => onPatchConfig({ branch: event.target.value })}
            placeholder="development"
          />
        </label>
        <label>
          Git Binary Path (optional)
          <div className="inline-field">
            <input
              value={config.gitBinaryPath}
              onChange={(event) => onPatchConfig({ gitBinaryPath: event.target.value })}
              placeholder="C:\Program Files\Git\cmd\git.exe or /usr/bin/git"
            />
            <button type="button" onClick={onPickGitBinary}>
              Browse
            </button>
          </div>
        </label>
      </div>

      <label>
        GitHub Repository URL
        <input
          value={config.repoUrl}
          onChange={(event) => onPatchConfig({ repoUrl: event.target.value })}
          placeholder="https://github.com/your-org/wow-sync-data.git"
        />
      </label>

      <label>
        GitHub Token (PAT)
        <input
          type="password"
          value={config.githubToken}
          onChange={(event) => onPatchConfig({ githubToken: event.target.value })}
          placeholder="ghp_..."
        />
      </label>

      <div className="grid two-up">
        <label>
          Git Author Name
          <input
            value={config.authorName}
            onChange={(event) => onPatchConfig({ authorName: event.target.value })}
            placeholder="AzerSync Bot"
          />
        </label>
        <label>
          Git Author Email
          <input
            value={config.authorEmail}
            onChange={(event) => onPatchConfig({ authorEmail: event.target.value })}
            placeholder="azersync-bot@example.local"
          />
        </label>
      </div>

      <label className="checkbox-line">
        <input
          type="checkbox"
          checked={config.requireSignedCommits}
          onChange={(event) => onPatchConfig({ requireSignedCommits: event.target.checked })}
        />
        Require signed commits on client ingest
      </label>

      <label>
        Trusted Author Emails (comma separated)
        <textarea
          value={trustedEmailsText}
          onChange={(event) => onSetTrustedEmailsText(event.target.value)}
          placeholder="you@example.com, alt@example.com"
        />
      </label>

      {!trustConfigured ? (
        <p className="inline-warning">
          Configure trusted emails or enable signed-commit enforcement for client mode.
        </p>
      ) : null}

      <div className="actions actions--tight">
        <button type="button" className="primary" disabled={!canSave || saving} onClick={onSaveConfig}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </section>
  );
}
