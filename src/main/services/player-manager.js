"use strict";
const { BrowserWindow, ipcMain, screen } = require("electron");
const { pages } = require("../config/paths");
const { createBackgroundPlayerOptions } = require("../config/window-options");

let playerWindow = null;
let isPlayerPlaying = false;
let currentTheme = "navy";
let isPlayerReady = false;
let pendingCommands = [];

// Commands that genuinely need the background player to exist/start.
// Everything else (pause/resume/seek/volume/get-state/...) is only
// meaningful once playback has already begun, so it's safe to no-op
// when the window hasn't been created yet.
const PLAYBACK_STARTING_COMMANDS = new Set(["set-playlist"]);

/**
 * Lazily creates the hidden background-player BrowserWindow the first time
 * it's actually needed (i.e. when the user starts playing a track from the
 * Audio Archive), instead of eagerly on every app launch. This avoids
 * spinning up an extra renderer process (and, in dev mode, an extra
 * DevTools window) for users who never touch the audio player.
 */
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

    // Flush any command(s) that arrived while the renderer was still
    // loading (e.g. the very "set-playlist" that triggered this window's
    // creation) — without this, that first command is silently dropped
    // because did-finish-load hasn't fired yet and no IPC listener exists
    // in the renderer to receive it.
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

/**
 * Sends a player-command to the background player, queuing it if the
 * window is still being created/loaded rather than dropping it.
 */
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
  // Theme changes forwarded from the renderer (live preview in settings)
  ipcMain.on("theme-changed", (_e, theme) => {
    currentTheme = theme;
    if (playerWindow && !playerWindow.isDestroyed())
      playerWindow.webContents.send("apply-theme", { theme });
  });

  ipcMain.on("player-command", (_e, arg) => {
    // Create the player window on-demand the first time real playback is
    // requested; ignore other commands (pause/seek/volume/get-state/...)
    // if playback was never started, instead of spinning the window up.
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
  // NOTE: 'show-main-window' is registered once in window-handlers.js — not here.
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
