import type {
  PreflightResult,
  AppUpdateState,
  AppConfig,
  SyncRunResult,
  SyncState,
  WindowState,
} from './types';

export interface WoWSyncApi {
  loadConfig: () => Promise<AppConfig>;
  saveConfig: (config: AppConfig) => Promise<{ ok: boolean }>;
  getState: () => Promise<SyncState>;
  startSync: (config: AppConfig) => Promise<SyncState>;
  stopSync: () => Promise<SyncState>;
  runSyncNow: (config: AppConfig) => Promise<SyncRunResult>;
  runPreflight: (config: AppConfig) => Promise<PreflightResult>;
  restoreLatestBackup: (config: AppConfig) => Promise<SyncRunResult>;
  pickDirectory: (currentPath?: string) => Promise<string>;
  pickGitBinary: (currentPath?: string) => Promise<string>;
  getAppUpdateState: () => Promise<AppUpdateState>;
  checkForAppUpdate: () => Promise<AppUpdateState>;
  downloadAppUpdate: () => Promise<AppUpdateState>;
  installAppUpdate: () => Promise<{ ok: boolean; message: string }>;
  openExternalUrl: (url: string) => Promise<{ ok: boolean }>;
  onAppUpdateState: (callback: (state: AppUpdateState) => void) => () => void;
  getWindowState: () => Promise<WindowState>;
  usesCustomWindowChrome: () => Promise<boolean>;
  minimizeWindow: () => Promise<{ ok: boolean }>;
  toggleMaximizeWindow: () => Promise<WindowState>;
  closeWindow: () => Promise<{ ok: boolean }>;
  onWindowState: (callback: (state: WindowState) => void) => () => void;
  onState: (callback: (state: SyncState) => void) => () => void;
}
