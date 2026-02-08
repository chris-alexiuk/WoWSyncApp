import { contextBridge, ipcRenderer } from 'electron';
import type { AppConfig, SyncRunResult, SyncState } from '../shared/types';

export interface WoWSyncApi {
  loadConfig: () => Promise<AppConfig>;
  saveConfig: (config: AppConfig) => Promise<{ ok: boolean }>;
  getState: () => Promise<SyncState>;
  startSync: (config: AppConfig) => Promise<SyncState>;
  stopSync: () => Promise<SyncState>;
  runSyncNow: (config: AppConfig) => Promise<SyncRunResult>;
  pickDirectory: (currentPath?: string) => Promise<string>;
  onState: (callback: (state: SyncState) => void) => () => void;
}

const api: WoWSyncApi = {
  loadConfig: () => ipcRenderer.invoke('config:load'),
  saveConfig: (config) => ipcRenderer.invoke('config:save', config),
  getState: () => ipcRenderer.invoke('sync:getState'),
  startSync: (config) => ipcRenderer.invoke('sync:start', config),
  stopSync: () => ipcRenderer.invoke('sync:stop'),
  runSyncNow: (config) => ipcRenderer.invoke('sync:runNow', config),
  pickDirectory: (currentPath) => ipcRenderer.invoke('dialog:pickDirectory', currentPath),
  onState: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, state: SyncState) => callback(state);
    ipcRenderer.on('sync:state', handler);
    return () => {
      ipcRenderer.removeListener('sync:state', handler);
    };
  },
};

contextBridge.exposeInMainWorld('wowSync', api);
