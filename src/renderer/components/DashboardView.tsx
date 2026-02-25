import type { AppConfig, AppUpdateState, PreflightIssue, PreflightResult, SyncMode, SyncState } from '../../shared/types';
import { formatDate, modeLabel } from '../utils';
import { PreflightPanel } from './PreflightPanel';
import { UpdatePanel } from './UpdatePanel';
import { LogViewer } from './LogViewer';

interface DashboardViewProps {
  config: AppConfig;
  state: SyncState;
  preflight: PreflightResult;
  preflightBusy: boolean;
  saving: boolean;
  updateState: AppUpdateState;
  status: string;
  canSave: boolean;
  mode: SyncMode;
  onRunPreflightCheck: () => void;
  onIssueAction: (issue: PreflightIssue) => void;
  onRunNow: () => void;
  onStartAutoSync: () => void;
  onStopAutoSync: () => void;
  onRestoreBackup: () => void;
  onSaveConfig: () => void;
  onCheckForUpdates: () => void;
  onDownloadUpdate: () => void;
  onInstallUpdate: () => void;
  onOpenReleasePage: () => void;
}

function syncStatusClass(state: SyncState): string {
  if (state.inFlight) return 'status-pill status-pill--syncing';
  if (state.running) return 'status-pill status-pill--running';
  return 'status-pill status-pill--idle';
}

function syncStatusLabel(state: SyncState): string {
  if (state.inFlight) return 'Syncing';
  if (state.running) return 'Auto Sync On';
  return 'Idle';
}

export function DashboardView(props: DashboardViewProps): JSX.Element {
  return (
    <>
      <PreflightPanel
        preflight={props.preflight}
        preflightBusy={props.preflightBusy}
        saving={props.saving}
        inFlight={props.state.inFlight}
        onRunCheck={props.onRunPreflightCheck}
        onIssueAction={props.onIssueAction}
      />

      <div className="dashboard-grid">
        <section className="panel quick-panel">
          <header>
            <h2>Sync Control</h2>
            <p>{props.status}</p>
          </header>
          <div className="status-row">
            <span className={syncStatusClass(props.state)}>
              <span className="status-pill__dot" />
              {syncStatusLabel(props.state)}
            </span>
            <span className={`status-pill status-pill--${props.mode}`}>
              {props.mode === 'source' ? '\u2191' : '\u2193'} {modeLabel(props.mode)}
            </span>
          </div>
          <div className="actions actions--tight">
            <button type="button" className="primary" onClick={props.onRunNow} disabled={!props.canSave || props.state.inFlight}>
              {props.state.inFlight ? 'Syncing...' : 'Sync Now'}
            </button>
            <button type="button" onClick={props.onStartAutoSync} disabled={!props.canSave || props.state.inFlight}>
              Start Auto Sync
            </button>
            <button type="button" className="ghost" onClick={props.onStopAutoSync}>
              Stop
            </button>
            {props.mode === 'client' ? (
              <button type="button" className="ghost" onClick={props.onRestoreBackup} disabled={props.state.inFlight}>
                Restore Previous Snapshot
              </button>
            ) : null}
            <button type="button" className="primary" disabled={!props.canSave || props.saving} onClick={props.onSaveConfig}>
              {props.saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </section>

        <UpdatePanel
          updateState={props.updateState}
          onCheck={props.onCheckForUpdates}
          onDownload={props.onDownloadUpdate}
          onInstall={props.onInstallUpdate}
          onOpenReleasePage={props.onOpenReleasePage}
        />
      </div>

      <LogViewer state={props.state} />
    </>
  );
}
