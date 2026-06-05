"use strict";

const { ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");

function configureAutoUpdater(getMainWindow, markQuitting) {
  autoUpdater.logger = console;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  ipcMain.on("start-download", () => autoUpdater.downloadUpdate());
  ipcMain.on("install-update", () => {
    markQuitting?.();
    autoUpdater.quitAndInstall(false, true);
  });

  autoUpdater.on("update-available", (info) =>
    getMainWindow()?.webContents.send("update-available", info),
  );

  // Forward "no update" so the renderer doesn't rely on the 8-second timeout
  autoUpdater.on("update-not-available", () =>
    getMainWindow()?.webContents.send("update-not-available"),
  );

  autoUpdater.on("download-progress", (progress) =>
    getMainWindow()?.webContents.send("download-progress", progress),
  );

  autoUpdater.on("update-downloaded", (info) =>
    getMainWindow()?.webContents.send("update-downloaded", info),
  );

  // Forward errors to the renderer so the UI shows "Check failed" correctly
  autoUpdater.on("error", (err) => {
    console.error("[Updater] Error:", err);
    getMainWindow()?.webContents.send("update-error", err?.message || String(err));
  });
}

function startUpdateChecks() {
  setTimeout(() => autoUpdater.checkForUpdates(), 3000);
  setInterval(() => autoUpdater.checkForUpdates(), 12 * 60 * 60 * 1000);
}

module.exports = { configureAutoUpdater, startUpdateChecks };
