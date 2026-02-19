import type { AppUpdateState } from '../../shared/types';
import { formatDate, formatMegabytes } from '../utils';

interface UpdatePanelProps {
  updateState: AppUpdateState;
  onCheck: () => void;
  onDownload: () => void;
  onInstall: () => void;
  onOpenReleasePage: () => void;
}

export function UpdatePanel({ updateState, onCheck, onDownload, onInstall, onOpenReleasePage }: UpdatePanelProps): JSX.Element {
  return (
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
        <button type="button" onClick={onCheck} disabled={!updateState.canCheck}>
          {updateState.phase === 'checking' ? 'Checking...' : 'Check'}
        </button>
        <button type="button" className="primary" onClick={onDownload} disabled={!updateState.canDownload}>
          {updateState.phase === 'downloading' ? 'Downloading...' : 'Download'}
        </button>
        <button type="button" className="primary" onClick={onInstall} disabled={!updateState.canInstall}>
          Restart to Apply
        </button>
        <button type="button" onClick={onOpenReleasePage} disabled={!updateState.releaseUrl}>
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
  );
}
