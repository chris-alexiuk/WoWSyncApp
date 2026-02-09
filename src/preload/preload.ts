import { contextBridge, ipcRenderer } from 'electron';
import type { WoWSyncApi } from '../shared/api';
import type { AppConfig, AppUpdateState, SyncState, WindowState } from '../shared/types';

const api: WoWSyncApi = {
  loadConfig: () => ipcRenderer.invoke('config:load'),
  saveConfig: (config: AppConfig) => ipcRenderer.invoke('config:save', config),
  getState: () => ipcRenderer.invoke('sync:getState'),
  startSync: (config: AppConfig) => ipcRenderer.invoke('sync:start', config),
  stopSync: () => ipcRenderer.invoke('sync:stop'),
  runSyncNow: (config: AppConfig) => ipcRenderer.invoke('sync:runNow', config),
  pickDirectory: (currentPath?: string) => ipcRenderer.invoke('dialog:pickDirectory', currentPath),
  pickGitBinary: (currentPath?: string) => ipcRenderer.invoke('dialog:pickGitBinary', currentPath),
  getAppUpdateState: () => ipcRenderer.invoke('update:getState') as Promise<AppUpdateState>,
  checkForAppUpdate: () => ipcRenderer.invoke('update:check') as Promise<AppUpdateState>,
  downloadAppUpdate: () => ipcRenderer.invoke('update:download') as Promise<AppUpdateState>,
  installAppUpdate: () =>
    ipcRenderer.invoke('update:install') as Promise<{ ok: boolean; message: string }>,
  openExternalUrl: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  onAppUpdateState: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, state: AppUpdateState) => callback(state);
    ipcRenderer.on('update:state', handler);
    return () => {
      ipcRenderer.removeListener('update:state', handler);
    };
  },
  getWindowState: () => ipcRenderer.invoke('window:getState') as Promise<WindowState>,
  usesCustomWindowChrome: () => ipcRenderer.invoke('window:usesCustomChrome') as Promise<boolean>,
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('window:toggleMaximize') as Promise<WindowState>,
  closeWindow: () => ipcRenderer.invoke('window:close'),
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
