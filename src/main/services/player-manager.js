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

/** @type {BrowserWindow | null} */
let playerWindow = null;
let isPlayerPlaying = false;
let currentTheme = "navy";
let isPlayerReady = false;
/** @type {object[]} commands sent before the player page finished loading */
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
  const win = new BrowserWindow(createBackgroundPlayerOptions());
  playerWindow = win;
  win.loadURL(pages.backgroundPlayer);

  if (shouldOpenDevTools()) win.webContents.openDevTools({ mode: "detach" });

  win.webContents.on("did-finish-load", () => {
    isPlayerReady = true;
    win.webContents.send("apply-theme", { theme: currentTheme });

    const queued = pendingCommands;
    pendingCommands = [];
    queued.forEach((cmd) => win.webContents.send("player-command", cmd));
  });

  win.on("closed", () => {
    playerWindow = null;
    isPlayerReady = false;
    pendingCommands = [];
  });
  return win;
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
  const win = playerWindow;
  if (!win) return;
  try {
    const { x, y, width, height } = screen.getPrimaryDisplay().workArea;
    const w = 300,
      h = 100;
    win.setBounds({
      x: x + width - w - 20,
      y: y + height - h - 20,
      width: w,
      height: h,
    });
    win.setAlwaysOnTop(true, "screen-saver");
    win.show();
  } catch (err) {
    log.error("showing the mini player failed:", err);
    win.show();
  }
}

let ipcRegistered = false;

/** @param {() => BrowserWindow | null} getMainWindow read each time a message arrives */
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
