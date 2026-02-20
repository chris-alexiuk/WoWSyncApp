import type { SyncState } from '../../shared/types';
import { formatDate } from '../utils';

interface LogViewerProps {
  state: SyncState;
}

export function LogViewer({ state }: LogViewerProps): JSX.Element {
  return (
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
  );
}
