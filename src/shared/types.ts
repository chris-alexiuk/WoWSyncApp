export type SyncMode = 'source' | 'client';

export interface AppConfig {
  mode: SyncMode;
  machineLabel: string;
  repoUrl: string;
  branch: string;
  githubToken: string;
  gitBinaryPath: string;
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
