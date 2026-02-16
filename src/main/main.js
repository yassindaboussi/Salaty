const { app, BrowserWindow, Tray, Menu, dialog, ipcMain, screen } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const ipcHandlers = require('./ipc-handlers');
const playerManager = require('./player-manager');
const analytics    = require('../renderer/js/utils/analytics-manager');

// Configure logging
autoUpdater.logger = console;
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

// Set App User Model ID for Windows Notifications
if (process.platform === 'win32') {
  app.setAppUserModelId('Salaty Time');
}

let mainWindow;
let tray = null;
let isQuitting = false;

// Permettre à l'application de se fermer lors d'un arrêt système ou d'une désinstallation
app.on('before-quit', () => {
  isQuitting = true;
});

function createWindow() {
  // Load settings
  ipcHandlers.loadSettings();

  // Create hidden player window first
  playerManager.createPlayerWindow();

  // Get settings after loading
  const settings = ipcHandlers.getSettingsData();

   // ── ① Initialize analytics right after settings are available ──────────────
   analytics.init(settings);
   // ───────────────────────────────────────────────────────────────────────────

   // Determine initial window size based on settings
    const useBigScreen = settings.bigScreen || false;
    const initialWidth = useBigScreen ? 850 : 320;
    const initialHeight = useBigScreen ? 600 : 575;

  // Choose the correct icon based on platform
  const iconPath = process.platform === 'darwin'
    ? path.join(__dirname, '../assets/icons/app_icon.png')
    : path.join(__dirname, '../assets/icons/app_icon.ico');

  mainWindow = new BrowserWindow({
    width: initialWidth,
    height: initialHeight,
    frame: false,
    transparent: true,
    resizable: true,
    alwaysOnTop: false,
    x: settings.position.x,
    y: settings.position.y,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webviewTag: true,
      webSecurity: false,
      allowRunningInsecureContent: true
    },
    minWidth: 320,
    minHeight: 575,
    show: false
  });

  // Affiche le DevTools seulement si --enable-logging est passé en argument
  if (process.argv.includes('--enable-logging')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Handle Minimize/Restore behavior for Mini Player
  mainWindow.on('minimize', () => {
    if (playerManager.getIsPlayerPlaying()) {
      playerManager.showMiniPlayer();
    }
  });

  mainWindow.on('restore', () => {
    const playerWindow = playerManager.getPlayerWindow();
    if (playerWindow) playerWindow.hide();
  });

  mainWindow.on('show', () => {
      const playerWindow = playerManager.getPlayerWindow();
      if (playerWindow) playerWindow.hide();
  });

  // Load main page
  mainWindow.loadFile(path.join(__dirname, '../renderer/pages/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('moved', () => {
    const position = mainWindow.getPosition();
    // Use the savePosition
    ipcHandlers.savePosition(position[0], position[1]);
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Ajout du Tray
  if (!tray) {
    const trayIconPath = process.platform === 'darwin'
      ? path.join(__dirname, '../assets/icons/app_icon.png')
      : path.join(__dirname, '../assets/icons/app_icon.ico');

    tray = new Tray(trayIconPath);
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Afficher Salaty Time',
        click: () => {
          mainWindow.show();
        }
      },
      {
        label: 'Quitter',
        click: () => {
          isQuitting = true;
          tray.destroy();
          tray = null;
          app.quit();
        }
      }
    ]);
    tray.setToolTip('Salaty Time');
    tray.setContextMenu(contextMenu);
    tray.on('click', () => {
      mainWindow.show();
    });
  }

  // Setup IPC handlers
  ipcHandlers.setupHandlers(mainWindow);
  playerManager.setupPlayerIpc(mainWindow);

  // Update IPC Handlers
  ipcMain.on('start-download', () => {
    autoUpdater.downloadUpdate();
  });

  ipcMain.on('install-update', () => {
    isQuitting = true;
    autoUpdater.quitAndInstall(false, true);
  });
}

// Update handling
autoUpdater.on('update-available', (info) => {
  if (mainWindow) {
    mainWindow.webContents.send('update-available', info);
  }
});

autoUpdater.on('download-progress', (progressObj) => {
  if (mainWindow) {
    mainWindow.webContents.send('download-progress', progressObj);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded', info);
  }
});

autoUpdater.on('error', (err) => {
  console.error('Error in auto-updater', err);
  // Optional: Notify user about error only if logging is enabled or critical
});

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    try {
      // Load settings first
      ipcHandlers.loadSettings();

      createWindow();
      // Check for updates after window creation
      // Adding a small delay to ensure window is ready
      setTimeout(() => {
          autoUpdater.checkForUpdates();
      }, 3000);

      // Check for updates every 12 hours
      setInterval(() => {
        autoUpdater.checkForUpdates();
      }, 12 * 60 * 60 * 1000);

      // Démarrage automatique avec Windows
      app.setLoginItemSettings({
        openAtLogin: true,
        path: process.execPath,
        args: []
      });
    } catch (error) {
      console.error('Error creating window:', error);
    }
  });
}

app.on('window-all-closed', () => {
  // Ne quitte pas l'app si le tray existe
  if (process.platform !== 'darwin' && !tray) {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    mainWindow.show();
  }
});