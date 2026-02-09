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

export interface UpdateCheckResult {
  currentVersion: string;
  latestVersion: string | null;
  hasUpdate: boolean;
  releaseUrl: string | null;
  publishedAt: string | null;
  notes: string | null;
  message: string;
}

export interface WindowState {
  isMaximized: boolean;
}
