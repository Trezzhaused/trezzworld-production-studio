import { app, BrowserWindow, crashReporter, ipcMain, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;
let pendingDeepLinkUrl: string | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'TrezzWorld Production Studio',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  if (pendingDeepLinkUrl) {
    mainWindow.webContents.send('deep-link-url', pendingDeepLinkUrl);
    pendingDeepLinkUrl = null;
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle('app:get-runtime-info', () => ({
    platform: process.platform,
    isPackaged: app.isPackaged,
    protocol: process.env.TREZZWORLD_PROTOCOL || 'trezzworld',
  }));
}

function configureDeepLinks(): void {
  const protocol = process.env.TREZZWORLD_PROTOCOL || 'trezzworld';
  if (!app.isDefaultProtocolClient(protocol)) {
    app.setAsDefaultProtocolClient(protocol);
  }

  app.on('open-url', (event, url) => {
    event.preventDefault();
    pendingDeepLinkUrl = url;
    if (mainWindow) {
      mainWindow.webContents.send('deep-link-url', url);
      pendingDeepLinkUrl = null;
    }
  });
}

function configureCrashReporter(): void {
  const submitUrl = process.env.CRASH_REPORT_URL;
  if (!submitUrl) {
    console.info('Crash reporting disabled; set CRASH_REPORT_URL to enable it.');
    return;
  }

  crashReporter.start({
    submitURL: submitUrl,
    uploadToServer: true,
  });
}

function configureAutoUpdater(): void {
  if (!app.isPackaged) {
    return;
  }

  autoUpdater.checkForUpdatesAndNotify().catch(() => undefined);
}

app.whenReady().then(() => {
  registerIpcHandlers();
  configureCrashReporter();
  configureDeepLinks();
  createWindow();
  configureAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

