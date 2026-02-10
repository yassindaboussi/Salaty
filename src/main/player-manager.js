const { BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

let playerWindow = null;
let isPlayerPlaying = false;

function createPlayerWindow() {
  playerWindow = new BrowserWindow({
    width: 300,
    height: 120,
    frame: false,
    transparent: true,
    show: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      backgroundThrottling: false
    }
  });

  playerWindow.loadFile(path.join(__dirname, '../renderer/pages/background-player.html'));

  // ── Open DevTools for this window so [MiniPlayer Theme] logs are visible ──
  // Remove this line once the theme issue is confirmed fixed.
  if (process.argv.includes('--enable-logging')) {
    playerWindow.webContents.openDevTools({ mode: 'detach' });
  }

  console.log('[PlayerManager] Mini-player window created');
}

function showMiniPlayer() {
  if (!playerWindow) return;
  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    if (!primaryDisplay?.workArea) {
      console.error('Could not detect primary display workArea');
      playerWindow.show();
      return;
    }
    const { x, y, width, height } = primaryDisplay.workArea;
    const w = 300;
    const h = 100;
    playerWindow.setBounds({
      x: x + width - w - 20,
      y: y + height - h - 20,
      width: w,
      height: h
    });
    playerWindow.setAlwaysOnTop(true, 'screen-saver');
    playerWindow.show();
  } catch (error) {
    console.error('Error showing mini player:', error);
    playerWindow.show();
  }
}

function setupPlayerIpc(mainWindow) {
  ipcMain.on('player-command', (event, arg) => {
    if (playerWindow && !playerWindow.isDestroyed()) {
      playerWindow.webContents.send('player-command', arg);
    }
  });

  ipcMain.on('player-update', (event, arg) => {
    if (arg.type === 'state') {
      isPlayerPlaying = arg.state.isPlaying;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('player-update', arg);
    }
  });

  ipcMain.on('close-mini-player', () => {
    if (playerWindow) playerWindow.hide();
  });

  ipcMain.on('player-get-state', () => {
    if (playerWindow && !playerWindow.isDestroyed()) {
      playerWindow.webContents.send('player-command', { type: 'get-state' });
    }
  });

  ipcMain.on('show-main-window', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function getPlayerWindow() {
  return playerWindow;
}

function getIsPlayerPlaying() {
  return isPlayerPlaying;
}

module.exports = {
  createPlayerWindow,
  showMiniPlayer,
  setupPlayerIpc,
  getPlayerWindow,
  getIsPlayerPlaying
};