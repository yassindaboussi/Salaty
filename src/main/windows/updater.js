"use strict";

const { ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");

function configureAutoUpdater(getMainWindow, markQuitting) {
  autoUpdater.logger = console;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  const send = (channel, ...args) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, ...args);
    }
  };

  ipcMain.on("start-download", () => autoUpdater.downloadUpdate());
  ipcMain.on("install-update", () => {
    markQuitting?.();
    autoUpdater.quitAndInstall(false, true);
  });

  autoUpdater.on("update-available", (info) => send("update-available", info));

  autoUpdater.on("update-not-available", () => send("update-not-available"));

  autoUpdater.on("download-progress", (progress) =>
    send("download-progress", progress),
  );

  autoUpdater.on("update-downloaded", (info) => send("update-downloaded", info));

  autoUpdater.on("error", (err) => {
    console.error("[Updater] Error:", err);
    send("update-error", err?.message || String(err));
  });
}

function startUpdateChecks() {
  setTimeout(() => autoUpdater.checkForUpdates(), 3000);
  setInterval(() => autoUpdater.checkForUpdates(), 12 * 60 * 60 * 1000);
}

module.exports = { configureAutoUpdater, startUpdateChecks };
