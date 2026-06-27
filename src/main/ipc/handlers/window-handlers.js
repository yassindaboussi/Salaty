"use strict";
/**
 * window-handlers.js — Window control and navigation.
 *
 * Navigation is handled entirely in the main process.
 * The renderer calls 'navigate-to' with an optional size — the main process
 * resizes and loads the file atomically. No sequential renderer-side awaits.
 */

const { ipcMain, app } = require("electron");
const { pages } = require("../../config/paths");

// Page size map — pages that need a specific size declare it here.
// Undefined = keep current window size.
const PAGE_SIZES = {
  index: null, // dynamic (managed by renderer)
  features: null, // keep current
  settings: null, // keep current
  quran: { width: 850, height: 600 },
  athkar: null,
  ramadan: null,
  qibla: null,
  asma: null,
  tasbih: null,
  "hijri-calendar": null,
  tasbih: null,
  albums: { width: 850, height: 600 },
  playlist: { width: 850, height: 600 },
  radio: null,
  livestreams: null,
};

let _registered = false;

function setupHandlers(mainWindow) {
  if (_registered) return;
  _registered = true;

  ipcMain.handle("minimize-window", () => mainWindow?.minimize());
  ipcMain.handle("close-window", () => mainWindow?.hide());

  // Flag to distinguish intentional unmaximize (our resize call) from
  // accidental unmaximize (double-click on title bar).
  let _intentionalUnmaximize = false;

  ipcMain.handle("resize-window", (_e, width, height) => {
    if (!mainWindow) return { width: 850, height: 560 };
    if (mainWindow.isMaximized()) {
      _intentionalUnmaximize = true;
      mainWindow.unmaximize();
      _intentionalUnmaximize = false;
    }
    mainWindow.setSize(Math.round(width), Math.round(height), false);
    return { width, height };
  });

  ipcMain.handle("maximize-window", () => {
    if (!mainWindow) return;
    mainWindow.maximize();
  });

  ipcMain.handle("unmaximize-window", () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
  });

  // navigate-to: optionally resize then load. Renderer passes width/height when needed.
  ipcMain.handle("navigate-to", (_e, page, width, height) => {
    if (!mainWindow) return false;
    if (width && height) {
      // Must unmaximize before setSize, otherwise Windows ignores the resize.
      if (mainWindow.isMaximized()) mainWindow.unmaximize();
      mainWindow.setSize(Math.round(width), Math.round(height), false);
    }
    mainWindow.loadFile(pages.byName(page));
    return true;
  });

  ipcMain.handle("go-back", () => {
    mainWindow?.loadFile(pages.index);
    return true;
  });

  // Show the window on first launch (main process kept it hidden).
  ipcMain.once("app-ready", () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
  });

  ipcMain.handle("show-playlist-in-main", () => {
    if (!mainWindow) return false;
    mainWindow.setSize(850, 600, true);
    mainWindow.show();
    mainWindow.focus();
    mainWindow.loadFile(pages.playlist);
    return true;
  });

  ipcMain.handle("is-dev-mode", () => !app.isPackaged);
  ipcMain.handle("get-app-version", () => app.getVersion());
  ipcMain.handle("check-for-updates-manual", () => {
    const { autoUpdater } = require("electron-updater");
    return autoUpdater.checkForUpdates();
  });

  ipcMain.on(
    "show-main-window",
    () => mainWindow?.show() && mainWindow?.focus(),
  );
}

module.exports = { setupHandlers };
