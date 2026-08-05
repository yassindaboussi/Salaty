"use strict";

const { app, BrowserWindow } = require("electron");
const { createMainWindowOptions } = require("../config/window-options");
const { pages } = require("../config/paths");
const ipcHandlers = require("../ipc");
const playerManager = require("../services/player-manager");
const analytics = require("../services/analytics-manager");

function createMainWindow({ onCloseToTray } = {}) {
  ipcHandlers.loadSettings();

  const settings = ipcHandlers.getSettingsData();
  analytics.init(settings);

  const mainWindow = new BrowserWindow(createMainWindowOptions(settings));

  ipcHandlers.setupHandlers(mainWindow);
  playerManager.setupPlayerIpc(mainWindow);

  if (process.argv.includes("--enable-logging")) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  const hideStaleTooltip = () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send("force-hide-tooltip");
    }
  };

  mainWindow.on("minimize", () => {
    if (playerManager.getIsPlayerPlaying()) playerManager.showMiniPlayer();
    hideStaleTooltip();
  });
  mainWindow.on("blur", hideStaleTooltip);
  mainWindow.on("hide", hideStaleTooltip);
  // Also re-hide immediately when the window comes back — a stuck hover
  // state can otherwise cause the tooltip to reappear the instant the
  // window becomes interactive again, if the cursor happens to still be
  // resting over the same screen position it was at before minimizing.
  mainWindow.on("restore", hideStaleTooltip);
  mainWindow.on("show", hideStaleTooltip);
  mainWindow.on("focus", hideStaleTooltip);

  mainWindow.on("unmaximize", () => {
    setImmediate(() => {
      const s = ipcHandlers.getSettingsData();
      if (!s.bigScreen) {
        mainWindow.maximize();
      }
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

function bringToFrontForAdhan(mainWindow) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const wasHidden = !mainWindow.isVisible();

  showExistingWindow(mainWindow);

  const forceForeground = () => {
    if (mainWindow.isDestroyed()) return;

    // Briefly toggling always-on-top forces the window above others at
    // the window-manager level — unlike a plain focus request, this
    // isn't blocked by the OS's anti-focus-stealing protections, and is
    // the standard workaround for windows that were fully hidden (tray
    // mode) rather than merely minimized, where a plain show()+focus()
    // doesn't reliably bring the window forward on every platform.
    mainWindow.setAlwaysOnTop(true);
    mainWindow.setAlwaysOnTop(false);
    mainWindow.focus();

    try {
      app.focus({ steal: true });
    } catch {
      // Some platforms/window managers can reject this — flashFrame
      // below still provides a visible signal either way.
    }

    mainWindow.flashFrame(true);
    mainWindow.once("focus", () => {
      if (!mainWindow.isDestroyed()) mainWindow.flashFrame(false);
    });
  };

  if (wasHidden) {
    // Give the hide -> show transition a moment to fully settle before
    // forcing focus — observed to be flakier than restoring from a
    // simple minimize, which already has an OS-level window presence to
    // reactivate.
    setTimeout(forceForeground, 60);
  } else {
    forceForeground();
  }
}

module.exports = { createMainWindow, showExistingWindow, bringToFrontForAdhan };
