"use strict";

const { app, BrowserWindow } = require("electron");
const {
  createMainWindowOptions,
  shouldOpenDevTools,
} = require("../config/window-options");
const { pages } = require("../config/paths");
const settingsStore = require("../services/settings-store");
const playerManager = require("../services/player-manager");
const startup = require("../app/startup-timing");

/**
 * Builds the main window (settings must already be loaded; IPC is registered by bootstrap).
 * @param {{ onCloseToTray?: (event: Electron.Event) => void }} [options]
 */
function createMainWindow({ onCloseToTray } = {}) {
  const settings = settingsStore.get();
  const mainWindow = new BrowserWindow(createMainWindowOptions(settings));

  if (shouldOpenDevTools()) {
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

  // Windows is the source of truth for maximized/normal. Every way of changing it ends up
  // here: the app's own button, a double-click on the title bar, dragging the window to or
  // away from the top edge, Win+Up/Down, Snap. The saved setting and the page follow.
  mainWindow.on("maximize", () => syncWindowState(mainWindow));
  mainWindow.on("unmaximize", () => syncWindowState(mainWindow));

  // The page fades its title bar while another window is active (core/app-shell.js). It
  // cannot tell by itself: its "blur" also fires when focus moves into an embedded frame (the
  // live streams). Sent on every change and to every page that loads.
  /** @param {boolean} focused */
  const sendFocus = (focused) =>
    mainWindow.webContents.send("window-focus-changed", focused);
  mainWindow.on("focus", () => sendFocus(true));
  mainWindow.on("blur", () => sendFocus(false));
  mainWindow.webContents.on("did-finish-load", () =>
    sendFocus(mainWindow.isFocused()),
  );
  mainWindow.webContents.once("did-finish-load", () => startup.mark("page"));
  mainWindow.on("restore", () => playerManager.getPlayerWindow()?.hide());
  mainWindow.on("show", () => playerManager.getPlayerWindow()?.hide());

  // Only the normal position is remembered: a maximized window sits at about -7,-7, and
  // reopening the app there in normal size would put its edge off screen.
  mainWindow.on("moved", () => {
    if (mainWindow.isMaximized() || mainWindow.isMinimized()) return;
    const [x, y] = mainWindow.getPosition();
    settingsStore.savePosition(x, y);
  });

  if (onCloseToTray) mainWindow.on("close", onCloseToTray);

  mainWindow.loadURL(pages.index);

  if (!settings.bigScreen) {
    mainWindow.once("ready-to-show", () => mainWindow.maximize());
  }

  return mainWindow;
}

// Saves the app's mode ("full screen" = maximized) and tells the page, which updates its
// layout and the expand/compress button. Also called to re-send the state when a page asks
// for a change that is already true.
function syncWindowState(mainWindow) {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isMinimized())
    return;
  const maximized = mainWindow.isMaximized();
  if (settingsStore.get().bigScreen === maximized) {
    settingsStore.update({ bigScreen: !maximized });
  }
  mainWindow.webContents.send("window-maximized-changed", maximized);
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

module.exports = {
  createMainWindow,
  showExistingWindow,
  bringToFrontForAdhan,
  syncWindowState,
};
