import { contextBridge, ipcRenderer } from 'electron';
import type { WoWSyncApi } from '../shared/api';
import type { AppConfig, SyncState, UpdateCheckResult } from '../shared/types';

const api: WoWSyncApi = {
  loadConfig: () => ipcRenderer.invoke('config:load'),
  saveConfig: (config: AppConfig) => ipcRenderer.invoke('config:save', config),
  getState: () => ipcRenderer.invoke('sync:getState'),
  startSync: (config: AppConfig) => ipcRenderer.invoke('sync:start', config),
  stopSync: () => ipcRenderer.invoke('sync:stop'),
  runSyncNow: (config: AppConfig) => ipcRenderer.invoke('sync:runNow', config),
  pickDirectory: (currentPath?: string) => ipcRenderer.invoke('dialog:pickDirectory', currentPath),
  pickGitBinary: (currentPath?: string) => ipcRenderer.invoke('dialog:pickGitBinary', currentPath),
  checkForAppUpdate: () => ipcRenderer.invoke('update:check') as Promise<UpdateCheckResult>,
  openExternalUrl: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  onState: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, state: SyncState) => callback(state);
    ipcRenderer.on('sync:state', handler);
    return () => {
      ipcRenderer.removeListener('sync:state', handler);
    };
  },
};

contextBridge.exposeInMainWorld('wowSync', api);
