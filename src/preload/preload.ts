import { contextBridge, ipcRenderer } from 'electron';
import type { WoWSyncApi } from '../shared/api';
import type {
  AppConfig,
  AppUpdateState,
  PreflightResult,
  SyncRunResult,
  SyncState,
  WindowState,
} from '../shared/types';

const api: WoWSyncApi = {
  loadConfig: () => ipcRenderer.invoke('config:load') as Promise<AppConfig>,
  saveConfig: (config: AppConfig) => ipcRenderer.invoke('config:save', config) as Promise<{ ok: boolean }>,
  getState: () => ipcRenderer.invoke('sync:getState') as Promise<SyncState>,
  startSync: (config: AppConfig) => ipcRenderer.invoke('sync:start', config) as Promise<SyncState>,
  stopSync: () => ipcRenderer.invoke('sync:stop') as Promise<SyncState>,
  runSyncNow: (config: AppConfig) => ipcRenderer.invoke('sync:runNow', config) as Promise<SyncRunResult>,
  runPreflight: (config: AppConfig) => ipcRenderer.invoke('sync:preflight', config) as Promise<PreflightResult>,
  restoreLatestBackup: (config: AppConfig) =>
    ipcRenderer.invoke('sync:restoreLatestBackup', config) as Promise<SyncRunResult>,
  pickDirectory: (currentPath?: string) => ipcRenderer.invoke('dialog:pickDirectory', currentPath) as Promise<string>,
  pickGitBinary: (currentPath?: string) => ipcRenderer.invoke('dialog:pickGitBinary', currentPath) as Promise<string>,
  getAppUpdateState: () => ipcRenderer.invoke('update:getState') as Promise<AppUpdateState>,
  checkForAppUpdate: () => ipcRenderer.invoke('update:check') as Promise<AppUpdateState>,
  downloadAppUpdate: () => ipcRenderer.invoke('update:download') as Promise<AppUpdateState>,
  installAppUpdate: () =>
    ipcRenderer.invoke('update:install') as Promise<{ ok: boolean; message: string }>,
  openExternalUrl: (url: string) => ipcRenderer.invoke('shell:openExternal', url) as Promise<{ ok: boolean }>,
  onAppUpdateState: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, state: AppUpdateState) => callback(state);
    ipcRenderer.on('update:state', handler);
    return () => {
      ipcRenderer.removeListener('update:state', handler);
    };
  },
  getWindowState: () => ipcRenderer.invoke('window:getState') as Promise<WindowState>,
  usesCustomWindowChrome: () => ipcRenderer.invoke('window:usesCustomChrome') as Promise<boolean>,
  minimizeWindow: () => ipcRenderer.invoke('window:minimize') as Promise<{ ok: boolean }>,
  toggleMaximizeWindow: () => ipcRenderer.invoke('window:toggleMaximize') as Promise<WindowState>,
  closeWindow: () => ipcRenderer.invoke('window:close') as Promise<{ ok: boolean }>,
  onWindowState: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, state: WindowState) => callback(state);
    ipcRenderer.on('window:state', handler);
    return () => {
      ipcRenderer.removeListener('window:state', handler);
    };
  },
  onState: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, state: SyncState) => callback(state);
    ipcRenderer.on('sync:state', handler);
    return () => {
      ipcRenderer.removeListener('sync:state', handler);
    };
  },
};

contextBridge.exposeInMainWorld('wowSync', api);
