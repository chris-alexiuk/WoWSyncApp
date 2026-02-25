import type { AppConfig, ProfileSyncPreset, SyncMode, SyncState } from '../../shared/types';
import { modeLabel } from '../utils';

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

interface SyncViewProps {
  config: AppConfig;
  state: SyncState;
  canSave: boolean;
  saving: boolean;
  mode: SyncMode;
  profileSyncEnabled: boolean;
  onPatchConfig: (patch: Partial<AppConfig>) => void;
  onApplyProfilePreset: (preset: ProfileSyncPreset) => void;
  onPickDir: (field: 'sourceAddonsPath' | 'targetAddonsPath' | 'sourceProfilesPath' | 'targetProfilesPath') => void;
  onRunNow: () => void;
  onStartAutoSync: () => void;
  onStopAutoSync: () => void;
  onRestoreBackup: () => void;
  onSaveConfig: () => void;
}

export function SyncView({
  config,
  state,
  canSave,
  saving,
  mode,
  profileSyncEnabled,
  onPatchConfig,
  onApplyProfilePreset,
  onPickDir,
  onRunNow,
  onStartAutoSync,
  onStopAutoSync,
  onRestoreBackup,
  onSaveConfig,
}: SyncViewProps): JSX.Element {
  return (
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
            onClick={() => onPatchConfig({ mode: option })}
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
              onClick={() => onApplyProfilePreset(preset.id)}
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
          <label htmlFor="source-addons-path">
            Source AddOns Folder
            <div className="inline-field">
              <input
                id="source-addons-path"
                value={config.sourceAddonsPath}
                onChange={(event) => onPatchConfig({ sourceAddonsPath: event.target.value })}
                placeholder="/path/to/Interface/AddOns"
              />
              <button type="button" onClick={() => onPickDir('sourceAddonsPath')}>
                Browse
              </button>
            </div>
          </label>
          {profileSyncEnabled ? (
            <label htmlFor="source-profiles-path">
              Source Profile Folder
              <div className="inline-field">
                <input
                  id="source-profiles-path"
                  value={config.sourceProfilesPath}
                  onChange={(event) => onPatchConfig({ sourceProfilesPath: event.target.value })}
                  placeholder={
                    config.profileSyncPreset === 'full_wtf'
                      ? '/path/to/WTF'
                      : '/path/to/.../SavedVariables'
                  }
                />
                <button type="button" onClick={() => onPickDir('sourceProfilesPath')}>
                  Browse
                </button>
              </div>
            </label>
          ) : null}
        </>
      ) : (
        <>
          <label htmlFor="target-addons-path">
            Client AddOns Folder
            <div className="inline-field">
              <input
                id="target-addons-path"
                value={config.targetAddonsPath}
                onChange={(event) => onPatchConfig({ targetAddonsPath: event.target.value })}
                placeholder="/path/to/Interface/AddOns"
              />
              <button type="button" onClick={() => onPickDir('targetAddonsPath')}>
                Browse
              </button>
            </div>
          </label>
          {profileSyncEnabled ? (
            <label htmlFor="target-profiles-path">
              Client Profile Folder
              <div className="inline-field">
                <input
                  id="target-profiles-path"
                  value={config.targetProfilesPath}
                  onChange={(event) => onPatchConfig({ targetProfilesPath: event.target.value })}
                  placeholder={
                    config.profileSyncPreset === 'full_wtf'
                      ? '/path/to/WTF'
                      : '/path/to/.../SavedVariables'
                  }
                />
                <button type="button" onClick={() => onPickDir('targetProfilesPath')}>
                  Browse
                </button>
              </div>
            </label>
          ) : null}
        </>
      )}

      <div className="grid two-up">
        <label htmlFor="sync-interval">
          Sync Interval (seconds)
          <input
            id="sync-interval"
            type="number"
            min={10}
            value={config.syncIntervalSeconds}
            onChange={(event) =>
              onPatchConfig({ syncIntervalSeconds: Math.max(10, Number(event.target.value) || 10) })
            }
          />
        </label>
        <label htmlFor="machine-label">
          Machine Label
          <input
            id="machine-label"
            value={config.machineLabel}
            onChange={(event) => onPatchConfig({ machineLabel: event.target.value })}
            placeholder="Raid-PC-Source"
          />
        </label>
      </div>

      <div className="actions actions--tight">
        <button type="button" className="primary" onClick={onRunNow} disabled={!canSave || state.inFlight}>
          {state.inFlight ? 'Syncing...' : 'Sync Now'}
        </button>
        <button type="button" onClick={onStartAutoSync} disabled={!canSave || state.inFlight}>
          Start Auto Sync
        </button>
        <button type="button" className="ghost" onClick={onStopAutoSync}>
          Stop
        </button>
        {mode === 'client' ? (
          <button type="button" className="ghost" onClick={onRestoreBackup} disabled={state.inFlight}>
            Restore Previous Snapshot
          </button>
        ) : null}
        <button type="button" className="primary" disabled={!canSave || saving} onClick={onSaveConfig}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </section>
  );
}
