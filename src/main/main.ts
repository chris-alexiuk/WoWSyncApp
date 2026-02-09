import path from 'node:path';
import {
  BrowserWindow,
  app,
  dialog,
  ipcMain,
  shell,
  type OpenDialogOptions,
} from 'electron';
import { loadConfig, saveConfig } from './configStore';
import { SyncService } from './syncService';
import { UpdateService } from './updateService';
import type { AppConfig, SyncState, WindowState } from '../shared/types';

let mainWindow: BrowserWindow | null = null;
const useCustomWindowChrome = process.platform !== 'darwin';
const syncService = new SyncService((state: SyncState) => {
  mainWindow?.webContents.send('sync:state', state);
});
const updateService = new UpdateService((state) => {
  mainWindow?.webContents.send('update:state', state);
});

function currentWindowState(): WindowState {
  return {
    isMaximized: mainWindow?.isMaximized() ?? false,
  };
}

function emitWindowState(): void {
  if (!mainWindow) {
    return;
  }

  mainWindow.webContents.send('window:state', currentWindowState());
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#05070d',
    frame: !useCustomWindowChrome,
    titleBarStyle: useCustomWindowChrome ? 'hidden' : 'hiddenInset',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on('maximize', emitWindowState);
  mainWindow.on('unmaximize', emitWindowState);
  mainWindow.on('enter-full-screen', emitWindowState);
  mainWindow.on('leave-full-screen', emitWindowState);
  mainWindow.on('focus', emitWindowState);
  mainWindow.on('blur', emitWindowState);

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    await mainWindow.loadURL(devUrl);
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  emitWindowState();
}

function registerIpc(): void {
  ipcMain.handle('config:load', async () => loadConfig());

  ipcMain.handle('config:save', async (_event, config: AppConfig) => {
    await saveConfig(config);
    return { ok: true };
  });

  ipcMain.handle('sync:getState', async () => syncService.getState());

  ipcMain.handle('sync:start', async (_event, config: AppConfig) => {
    syncService.start(config);
    return syncService.getState();
  });

  ipcMain.handle('sync:stop', async () => {
    syncService.stop();
    return syncService.getState();
  });

  ipcMain.handle('sync:runNow', async (_event, config: AppConfig) => syncService.runNow(config));

  ipcMain.handle('update:getState', async () => updateService.getState());
  ipcMain.handle('update:check', async () => updateService.checkForUpdates());
  ipcMain.handle('update:download', async () => updateService.downloadUpdate());
  ipcMain.handle('update:install', async () => updateService.installUpdateAndRestart());

  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    await shell.openExternal(url);
    return { ok: true };
  });

  ipcMain.handle('window:getState', async () => currentWindowState());
  ipcMain.handle('window:usesCustomChrome', async () => useCustomWindowChrome);

  ipcMain.handle('window:minimize', async () => {
    mainWindow?.minimize();
    return { ok: true };
  });

  ipcMain.handle('window:toggleMaximize', async () => {
    if (!mainWindow) {
      return { isMaximized: false };
    }

    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }

    const state = currentWindowState();
    emitWindowState();
    return state;
  });

  ipcMain.handle('window:close', async () => {
    mainWindow?.close();
    return { ok: true };
  });

  ipcMain.handle('dialog:pickDirectory', async (_event, currentPath?: string) => {
    const options: OpenDialogOptions = {
      title: 'Choose Folder',
      properties: ['openDirectory', 'createDirectory'],
    };

    if (currentPath) {
      options.defaultPath = currentPath;
    }

    const result = await dialog.showOpenDialog(mainWindow!, options);
    if (result.canceled || result.filePaths.length === 0) {
      return '';
    }

    return result.filePaths[0] ?? '';
  });

  ipcMain.handle('dialog:pickGitBinary', async (_event, currentPath?: string) => {
    const options: OpenDialogOptions = {
      title: 'Choose Git Executable',
      properties: ['openFile'],
      filters:
        process.platform === 'win32'
          ? [
              {
                name: 'Executables',
                extensions: ['exe', 'cmd', 'bat'],
              },
            ]
          : undefined,
    };

    if (currentPath) {
      options.defaultPath = currentPath;
    }

    const result = await dialog.showOpenDialog(mainWindow!, options);
    if (result.canceled || result.filePaths.length === 0) {
      return '';
    }

    return result.filePaths[0] ?? '';
  });
}

app.whenReady().then(async () => {
  registerIpc();
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
