"use strict";

const { ipcMain, app, clipboard } = require("electron");
const { pages, getAdhanAudioSrc } = require("../../config/paths");

let _registered = false;

function setupHandlers(mainWindow) {
  if (_registered) return;
  _registered = true;

  ipcMain.handle("minimize-window", () => mainWindow?.minimize());
  ipcMain.handle("close-window", () => mainWindow?.hide());

  ipcMain.handle("resize-window", (_e, width, height) => {
    if (!mainWindow) return { width: 850, height: 560 };
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
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

  ipcMain.handle("navigate-to", (_e, page, width, height) => {
    if (!mainWindow) return false;
    if (width && height) {
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
  ipcMain.handle("get-adhan-audio-src", () => getAdhanAudioSrc());
  ipcMain.handle("check-for-updates-manual", () => {
    const { autoUpdater } = require("electron-updater");
    return autoUpdater.checkForUpdates();
  });

  ipcMain.handle("clipboard-write-text", (_e, text) => {
    clipboard.writeText(String(text ?? ""));
    return true;
  });

  ipcMain.on(
    "show-main-window",
    () => mainWindow?.show() && mainWindow?.focus(),
  );
}

module.exports = { setupHandlers };
