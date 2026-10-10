"use strict";
const { BrowserWindow, screen } = require("electron");
const secureIpc = require("../ipc/secure-ipc");
const { THEMES, isPlainObject } = require("../ipc/validate");
const { pages } = require("../config/paths");
const {
  createBackgroundPlayerOptions,
  shouldOpenDevTools,
} = require("../config/window-options");
const log = require("./logger").logger("Player");

let playerWindow = null;
let isPlayerPlaying = false;
let currentTheme = "navy";
let isPlayerReady = false;
let pendingCommands = [];

const PLAYBACK_STARTING_COMMANDS = new Set(["set-playlist"]);
// What the pages may ask the background player to do (windows/background-player.js).
const PLAYER_COMMANDS = new Set([
  "get-state",
  "next",
  "pause",
  "play",
  "prev",
  "resume",
  "seek",
  "set-playlist",
  "volume",
]);

function createPlayerWindow() {
  if (playerWindow && !playerWindow.isDestroyed()) return playerWindow;

  isPlayerReady = false;
  playerWindow = new BrowserWindow(createBackgroundPlayerOptions());
  playerWindow.loadFile(pages.backgroundPlayer);

  if (shouldOpenDevTools())
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
    log.error("showing the mini player failed:", err);
    playerWindow.show();
  }
}

let ipcRegistered = false;

// getMainWindow: returns the main window (or null), read each time a message arrives.
function registerPlayerIpc(getMainWindow) {
  if (ipcRegistered) return;
  ipcRegistered = true;

  secureIpc.on("theme-changed", (_e, theme) => {
    if (!THEMES.has(theme)) return;
    currentTheme = theme;
    if (playerWindow && !playerWindow.isDestroyed())
      playerWindow.webContents.send("apply-theme", { theme });
  });

  secureIpc.on("player-command", (_e, arg) => {
    if (!isPlainObject(arg) || !PLAYER_COMMANDS.has(arg.type)) return;
    if (
      (!playerWindow || playerWindow.isDestroyed()) &&
      PLAYBACK_STARTING_COMMANDS.has(arg?.type)
    ) {
      createPlayerWindow();
    }

    sendPlayerCommand(arg);
  });

  secureIpc.on("player-update", (_e, arg) => {
    if (!isPlainObject(arg)) return;
    if (arg.type === "state") isPlayerPlaying = arg.state?.isPlaying === true;
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed())
      mainWindow.webContents.send("player-update", arg);
  });

  secureIpc.on("close-mini-player", () => {
    playerWindow?.hide();
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
  registerPlayerIpc,
  getPlayerWindow,
  getIsPlayerPlaying,
};
