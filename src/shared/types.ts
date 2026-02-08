/** Operating mode: source pushes addons to the repo, client pulls them. */
export type SyncMode = 'source' | 'client';

/** Preset controlling which profile directories to synchronize. */
export type ProfileSyncPreset = 'addons_only' | 'account_saved_variables' | 'full_wtf';

/** Severity level for preflight diagnostic issues. */
export type PreflightSeverity = 'error' | 'warning';

/** Action a user can take to resolve a preflight issue. */
export type PreflightAction =
  | 'openSettings'
  | 'openSync'
  | 'pickGitBinary'
  | 'pickSourceAddonsPath'
  | 'pickSourceProfilesPath'
  | 'pickTargetAddonsPath'
  | 'pickTargetProfilesPath'
  | 'checkAgain';

/** Persisted user configuration for the sync application. */
export interface AppConfig {
  /** Whether this machine acts as the addon source or as a client. */
  mode: SyncMode;
  /** Human-readable label used in commit messages. */
  machineLabel: string;
  /** HTTPS URL of the private GitHub sync repository. */
  repoUrl: string;
  /** Git branch used for syncing. */
  branch: string;
  /** GitHub personal access token for repository authentication. */
  githubToken: string;
  /** Optional path to a git binary (overrides PATH lookup). */
  gitBinaryPath: string;
  /** Active profile sync preset. */
  profileSyncPreset: ProfileSyncPreset;
  /** Whether profile directories are included in sync. */
  syncProfiles: boolean;
  /** Local path to the source AddOns folder (source mode). */
  sourceAddonsPath: string;
  /** Local path to the source profile folder (source mode). */
  sourceProfilesPath: string;
  /** Local path to the client AddOns folder (client mode). */
  targetAddonsPath: string;
  /** Local path to the client profile folder (client mode). */
  targetProfilesPath: string;
  /** Interval in seconds between automatic sync runs. */
  syncIntervalSeconds: number;
  /** Email addresses trusted for commit authorship verification. */
  trustedAuthorEmails: string[];
  /** When true, client mode rejects unsigned commits. */
  requireSignedCommits: boolean;
  /** Git author name used for sync commits. */
  authorName: string;
  /** Git author email used for sync commits. */
  authorEmail: string;
}

/** Live state of the sync engine exposed to the renderer. */
export interface SyncState {
  /** Whether automatic sync is currently enabled. */
  running: boolean;
  /** Whether a sync or rollback operation is actively executing. */
  inFlight: boolean;
  /** ISO timestamp of the last sync run attempt, or null if never run. */
  lastRunAt: string | null;
  /** ISO timestamp of the last successful sync, or null if never succeeded. */
  lastSuccessAt: string | null;
  /** Error message from the most recent failed sync, or null. */
  lastError: string | null;
  /** Rolling log buffer of timestamped sync activity messages. */
  logs: string[];
}

/** Outcome of a single sync or rollback run. */
export interface SyncRunResult {
  /** Whether the operation completed successfully. */
  ok: boolean;
  /** Human-readable summary of the result. */
  message: string;
}

/** A single diagnostic issue found during preflight checks. */
export interface PreflightIssue {
  /** Machine-readable identifier for the issue type. */
  code: string;
  /** Whether this issue blocks sync or is informational. */
  severity: PreflightSeverity;
  /** Human-readable description of the problem. */
  message: string;
  /** Suggested UI action to resolve the issue, if any. */
  action?: PreflightAction;
}

/** Aggregate result of all preflight checks. */
export interface PreflightResult {
  /** ISO timestamp when the preflight check was performed. */
  checkedAt: string | null;
  /** True when no error-severity issues were found. */
  ok: boolean;
  /** List of all diagnostic issues discovered. */
  issues: PreflightIssue[];
}

/** Current lifecycle phase of the auto-update process. */
export type AppUpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'
  | 'unsupported';

/** Full state snapshot of the application auto-updater. */
export interface AppUpdateState {
  /** Current phase of the update lifecycle. */
  phase: AppUpdatePhase;
  /** Semantic version of the running application. */
  currentVersion: string;
  /** Semantic version of the latest release, or null if unknown. */
  latestVersion: string | null;
  /** Whether a newer version is available for download. */
  hasUpdate: boolean;
  /** URL to the latest GitHub release page. */
  releaseUrl: string | null;
  /** ISO date string when the latest release was published. */
  publishedAt: string | null;
  /** Truncated release notes markdown, or null. */
  notes: string | null;
  /** Human-readable status message for the UI. */
  message: string;
  /** ISO timestamp of the last completed update check. */
  checkedAt: string | null;
  /** Download progress percentage (0-100), or null. */
  downloadPercent: number | null;
  /** Current download speed in bytes per second, or null. */
  bytesPerSecond: number | null;
  /** Bytes downloaded so far, or null. */
  transferredBytes: number | null;
  /** Total download size in bytes, or null. */
  totalBytes: number | null;
  /** Whether the user can trigger an update check. */
  canCheck: boolean;
  /** Whether the user can start downloading an available update. */
  canDownload: boolean;
  /** Whether a downloaded update is ready to install. */
  canInstall: boolean;
}

/** Current window chrome state exposed to the renderer. */
export interface WindowState {
  /** Whether the application window is currently maximized. */
  isMaximized: boolean;
}
