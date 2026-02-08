import path from 'node:path';
import {
  BrowserWindow,
  app,
  dialog,
  ipcMain,
  type OpenDialogOptions,
} from 'electron';
import { loadConfig, saveConfig } from './configStore';
import { SyncService } from './syncService';
import type { AppConfig, SyncState } from '../shared/types';

let mainWindow: BrowserWindow | null = null;
const syncService = new SyncService((state: SyncState) => {
  mainWindow?.webContents.send('sync:state', state);
});

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#05070d',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    await mainWindow.loadURL(devUrl);
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
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
