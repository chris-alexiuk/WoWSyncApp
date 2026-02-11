export type SyncMode = 'source' | 'client';
export type ProfileSyncPreset = 'addons_only' | 'account_saved_variables' | 'full_wtf';
export type PreflightSeverity = 'error' | 'warning';
export type PreflightAction =
  | 'openSettings'
  | 'openSync'
  | 'pickGitBinary'
  | 'pickSourceAddonsPath'
  | 'pickSourceProfilesPath'
  | 'pickTargetAddonsPath'
  | 'pickTargetProfilesPath'
  | 'checkAgain';

export interface AppConfig {
  mode: SyncMode;
  machineLabel: string;
  repoUrl: string;
  branch: string;
  githubToken: string;
  gitBinaryPath: string;
  profileSyncPreset: ProfileSyncPreset;
  syncProfiles: boolean;
  sourceAddonsPath: string;
  sourceProfilesPath: string;
  targetAddonsPath: string;
  targetProfilesPath: string;
  syncIntervalSeconds: number;
  trustedAuthorEmails: string[];
  requireSignedCommits: boolean;
  authorName: string;
  authorEmail: string;
}

export interface SyncState {
  running: boolean;
  inFlight: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  logs: string[];
}

export interface SyncRunResult {
  ok: boolean;
  message: string;
}

export interface PreflightIssue {
  code: string;
  severity: PreflightSeverity;
  message: string;
  action?: PreflightAction;
}

export interface PreflightResult {
  checkedAt: string | null;
  ok: boolean;
  issues: PreflightIssue[];
}

export type AppUpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'
  | 'unsupported';

export interface AppUpdateState {
  phase: AppUpdatePhase;
  currentVersion: string;
  latestVersion: string | null;
  hasUpdate: boolean;
  releaseUrl: string | null;
  publishedAt: string | null;
  notes: string | null;
  message: string;
  checkedAt: string | null;
  downloadPercent: number | null;
  bytesPerSecond: number | null;
  transferredBytes: number | null;
  totalBytes: number | null;
  canCheck: boolean;
  canDownload: boolean;
  canInstall: boolean;
}

export interface WindowState {
  isMaximized: boolean;
}
