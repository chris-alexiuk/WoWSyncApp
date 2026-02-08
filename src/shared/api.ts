import type { AppConfig, SyncRunResult, SyncState, UpdateCheckResult } from './types';

export interface WoWSyncApi {
  loadConfig: () => Promise<AppConfig>;
  saveConfig: (config: AppConfig) => Promise<{ ok: boolean }>;
  getState: () => Promise<SyncState>;
  startSync: (config: AppConfig) => Promise<SyncState>;
  stopSync: () => Promise<SyncState>;
  runSyncNow: (config: AppConfig) => Promise<SyncRunResult>;
  pickDirectory: (currentPath?: string) => Promise<string>;
  pickGitBinary: (currentPath?: string) => Promise<string>;
  checkForAppUpdate: () => Promise<UpdateCheckResult>;
  openExternalUrl: (url: string) => Promise<{ ok: boolean }>;
  onState: (callback: (state: SyncState) => void) => () => void;
}
