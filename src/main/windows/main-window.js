"use strict";

const { BrowserWindow } = require("electron");
const { createMainWindowOptions } = require("../config/window-options");
const { pages } = require("../config/paths");
const ipcHandlers = require("../ipc");
const playerManager = require("../services/player-manager");
const analytics = require("../services/analytics-manager");

function createMainWindow({ onCloseToTray } = {}) {
  ipcHandlers.loadSettings();
  playerManager.createPlayerWindow();

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
  mainWindow.on("restore", () => playerManager.getPlayerWindow()?.hide());
  mainWindow.on("show", () => playerManager.getPlayerWindow()?.hide());
  mainWindow.on("moved", () => {
    const [x, y] = mainWindow.getPosition();
    ipcHandlers.savePosition(x, y);
  });

  if (onCloseToTray) mainWindow.on("close", onCloseToTray);

  mainWindow.loadFile(pages.index);

  return mainWindow;
}

function showExistingWindow(mainWindow) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

module.exports = { createMainWindow, showExistingWindow };
