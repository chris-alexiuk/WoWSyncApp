import type {
  PreflightResult,
  AppUpdateState,
  AppConfig,
  SyncRunResult,
  SyncState,
  WindowState,
} from './types';

/** IPC bridge between the renderer and main Electron processes. */
export interface WoWSyncApi {
  /** Load the persisted application configuration. */
  loadConfig: () => Promise<AppConfig>;
  /** Persist updated application configuration. */
  saveConfig: (config: AppConfig) => Promise<{ ok: boolean }>;
  /** Retrieve the current sync engine state snapshot. */
  getState: () => Promise<SyncState>;
  /** Enable automatic sync with the given configuration. */
  startSync: (config: AppConfig) => Promise<SyncState>;
  /** Disable automatic sync and cancel any pending timers. */
  stopSync: () => Promise<SyncState>;
  /** Trigger a single immediate sync run outside the automatic interval. */
  runSyncNow: (config: AppConfig) => Promise<SyncRunResult>;
  /** Run preflight checks to validate configuration and connectivity. */
  runPreflight: (config: AppConfig) => Promise<PreflightResult>;
  /** Restore local addons from the most recent client backup snapshot. */
  restoreLatestBackup: (config: AppConfig) => Promise<SyncRunResult>;
  /** Open a native directory picker dialog. */
  pickDirectory: (currentPath?: string) => Promise<string>;
  /** Open a native file picker dialog filtered to git executables. */
  pickGitBinary: (currentPath?: string) => Promise<string>;
  /** Retrieve the current auto-updater state snapshot. */
  getAppUpdateState: () => Promise<AppUpdateState>;
  /** Check for a new application version. */
  checkForAppUpdate: () => Promise<AppUpdateState>;
  /** Download an available application update. */
  downloadAppUpdate: () => Promise<AppUpdateState>;
  /** Install a downloaded update and restart the application. */
  installAppUpdate: () => Promise<{ ok: boolean; message: string }>;
  /** Open a URL in the user's default browser. */
  openExternalUrl: (url: string) => Promise<{ ok: boolean }>;
  /** Subscribe to auto-updater state changes. Returns an unsubscribe function. */
  onAppUpdateState: (callback: (state: AppUpdateState) => void) => () => void;
  /** Retrieve the current window chrome state. */
  getWindowState: () => Promise<WindowState>;
  /** Check whether the app uses a custom frameless title bar. */
  usesCustomWindowChrome: () => Promise<boolean>;
  /** Minimize the application window. */
  minimizeWindow: () => Promise<{ ok: boolean }>;
  /** Toggle the application window between maximized and restored. */
  toggleMaximizeWindow: () => Promise<WindowState>;
  /** Close the application window. */
  closeWindow: () => Promise<{ ok: boolean }>;
  /** Subscribe to window state changes. Returns an unsubscribe function. */
  onWindowState: (callback: (state: WindowState) => void) => () => void;
  /** Subscribe to sync engine state changes. Returns an unsubscribe function. */
  onState: (callback: (state: SyncState) => void) => () => void;
}
