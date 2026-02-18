import type { PreflightAction, PreflightIssue, PreflightResult } from '../../shared/types';

function preflightActionLabel(action: PreflightAction): string {
  switch (action) {
    case 'openSettings':
      return 'Open Settings';
    case 'openSync':
      return 'Open Sync';
    case 'pickGitBinary':
      return 'Select Git';
    case 'pickSourceAddonsPath':
      return 'Select Source AddOns';
    case 'pickSourceProfilesPath':
      return 'Select Source Profiles';
    case 'pickTargetAddonsPath':
      return 'Select Client AddOns';
    case 'pickTargetProfilesPath':
      return 'Select Client Profiles';
    case 'checkAgain':
      return 'Recheck';
    default:
      return 'Fix';
  }
}

function formatDate(iso: string | null): string {
  if (!iso) {
    return 'Never';
  }

  return new Date(iso).toLocaleString();
}

interface PreflightPanelProps {
  preflight: PreflightResult;
  preflightBusy: boolean;
  saving: boolean;
  inFlight: boolean;
  onRunCheck: () => void;
  onIssueAction: (issue: PreflightIssue) => void;
}

export function PreflightPanel({
  preflight,
  preflightBusy,
  saving,
  inFlight,
  onRunCheck,
  onIssueAction,
}: PreflightPanelProps): JSX.Element {
  return (
    <section className="panel preflight-panel">
      <header>
        <h2>Startup Checks</h2>
        <p>
          {preflight.checkedAt
            ? `Last checked ${formatDate(preflight.checkedAt)}`
            : 'Checks run automatically at startup'}
        </p>
      </header>
      {preflight.issues.length === 0 ? (
        <p className="preflight-ok">All checks passed.</p>
      ) : (
        <ul className="preflight-list">
          {preflight.issues.map((issue) => (
            <li key={`${issue.code}-${issue.message}`} className={`preflight-item preflight-item--${issue.severity}`}>
              <div>
                <strong>{issue.severity === 'error' ? 'Error' : 'Warning'}</strong>
                <p>{issue.message}</p>
              </div>
              {issue.action ? (
                <button
                  type="button"
                  onClick={() => onIssueAction(issue)}
                  disabled={preflightBusy || saving || inFlight}
                >
                  {preflightActionLabel(issue.action)}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <div className="actions actions--tight">
        <button type="button" onClick={onRunCheck} disabled={preflightBusy}>
          {preflightBusy ? 'Checking...' : 'Run Checks Again'}
        </button>
      </div>
    </section>
  );
}
