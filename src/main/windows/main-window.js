"use strict";

const { BrowserWindow } = require("electron");
const { createMainWindowOptions } = require("../config/window-options");
const { pages } = require("../config/paths");
const ipcHandlers = require("../ipc");
const playerManager = require("../services/player-manager");
const analytics = require("../services/analytics-manager");

function createMainWindow({ onCloseToTray } = {}) {
  ipcHandlers.loadSettings();
  // NOTE: the background-player window is intentionally NOT created here.
  // It is an extra renderer process (+ its own DevTools window in dev mode)
  // and is only needed once the user actually starts playing an audio track
  // from the Audio Archive. player-manager.js creates it lazily on the
  // first real playback command ("set-playlist") instead.

  const settings = ipcHandlers.getSettingsData();
  analytics.init(settings);

  const mainWindow = new BrowserWindow(createMainWindowOptions(settings));
  // show: false is set in createMainWindowOptions — window shown after app-ready IPC

  ipcHandlers.setupHandlers(mainWindow);
  playerManager.setupPlayerIpc(mainWindow);

  if (process.argv.includes("--enable-logging")) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  mainWindow.on("minimize", () => {
    if (playerManager.getIsPlayerPlaying()) playerManager.showMiniPlayer();
  });

  // Prevent double-click on title bar from unmaximizing.
  // save-settings is called BEFORE resize-window in toggleScreenSize(),
  // so getSettingsData() always reflects the correct intended state here.
  mainWindow.on("unmaximize", () => {
    setImmediate(() => {
      const s = ipcHandlers.getSettingsData();
      if (!s.bigScreen) {
        // Still in fullscreen mode → double-click triggered this. Re-maximize.
        mainWindow.maximize();
      }
      // bigScreen=true → triggered by our compress button. Let it stay unmaximized.
    });
  });
  mainWindow.on("restore", () => playerManager.getPlayerWindow()?.hide());
  mainWindow.on("show", () => playerManager.getPlayerWindow()?.hide());

  mainWindow.on("moved", () => {
    const [x, y] = mainWindow.getPosition();
    ipcHandlers.savePosition(x, y);
  });

  if (onCloseToTray) mainWindow.on("close", onCloseToTray);

  mainWindow.loadFile(pages.index);

  // If fullscreen mode, maximize after page loads
  if (!settings.bigScreen) {
    mainWindow.once("ready-to-show", () => mainWindow.maximize());
  }

  return mainWindow;
}

function showExistingWindow(mainWindow) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

module.exports = { createMainWindow, showExistingWindow };
