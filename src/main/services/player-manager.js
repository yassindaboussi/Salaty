"use strict";
const { BrowserWindow, ipcMain, screen } = require("electron");
const { pages } = require("../config/paths");
const { createBackgroundPlayerOptions } = require("../config/window-options");

let playerWindow = null;
let isPlayerPlaying = false;
let currentTheme = "navy";
let isPlayerReady = false;
let pendingCommands = [];

const PLAYBACK_STARTING_COMMANDS = new Set(["set-playlist"]);

function createPlayerWindow() {
  if (playerWindow && !playerWindow.isDestroyed()) return playerWindow;

  isPlayerReady = false;
  playerWindow = new BrowserWindow(createBackgroundPlayerOptions());
  playerWindow.loadFile(pages.backgroundPlayer);

  if (process.argv.includes("--enable-logging"))
    playerWindow.webContents.openDevTools({ mode: "detach" });

  playerWindow.webContents.on("did-finish-load", () => {
    isPlayerReady = true;
    playerWindow.webContents.send("apply-theme", { theme: currentTheme });

    const queued = pendingCommands;
    pendingCommands = [];
    queued.forEach((cmd) =>
      playerWindow.webContents.send("player-command", cmd),
    );
  });

  playerWindow.on("closed", () => {
    playerWindow = null;
    isPlayerReady = false;
    pendingCommands = [];
  });
  return playerWindow;
}

function sendPlayerCommand(arg) {
  if (!playerWindow || playerWindow.isDestroyed()) return;
  if (isPlayerReady) {
    playerWindow.webContents.send("player-command", arg);
  } else {
    pendingCommands.push(arg);
  }
}

function showMiniPlayer() {
  if (!playerWindow) return;
  try {
    const { x, y, width, height } = screen.getPrimaryDisplay().workArea;
    const w = 300,
      h = 100;
    playerWindow.setBounds({
      x: x + width - w - 20,
      y: y + height - h - 20,
      width: w,
      height: h,
    });
    playerWindow.setAlwaysOnTop(true, "screen-saver");
    playerWindow.show();
  } catch (err) {
    console.error("[PlayerManager] Error showing mini player:", err);
    playerWindow.show();
  }
}

function setupPlayerIpc(mainWindow) {
  ipcMain.on("theme-changed", (_e, theme) => {
    currentTheme = theme;
    if (playerWindow && !playerWindow.isDestroyed())
      playerWindow.webContents.send("apply-theme", { theme });
  });

  ipcMain.on("player-command", (_e, arg) => {
    if (
      (!playerWindow || playerWindow.isDestroyed()) &&
      PLAYBACK_STARTING_COMMANDS.has(arg?.type)
    ) {
      createPlayerWindow();
    }

    sendPlayerCommand(arg);
  });

  ipcMain.on("player-update", (_e, arg) => {
    if (arg.type === "state") isPlayerPlaying = arg.state.isPlaying;
    if (mainWindow && !mainWindow.isDestroyed())
      mainWindow.webContents.send("player-update", arg);
  });

  ipcMain.on("close-mini-player", () => {
    playerWindow?.hide();
  });

  ipcMain.on("player-get-state", () => {
    sendPlayerCommand({ type: "get-state" });
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
  getIsPlayerPlaying,
};
