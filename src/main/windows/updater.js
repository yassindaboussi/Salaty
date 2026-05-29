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
  autoUpdater.on("download-progress", (progress) =>
    getMainWindow()?.webContents.send("download-progress", progress),
  );
  autoUpdater.on("update-downloaded", (info) =>
    getMainWindow()?.webContents.send("update-downloaded", info),
  );
  autoUpdater.on("error", (err) => console.error("[Updater] Error:", err));
}

function startUpdateChecks() {
  setTimeout(() => autoUpdater.checkForUpdates(), 3000);
  setInterval(() => autoUpdater.checkForUpdates(), 12 * 60 * 60 * 1000);
}

module.exports = { configureAutoUpdater, startUpdateChecks };
