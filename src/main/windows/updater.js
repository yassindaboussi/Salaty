"use strict";

const secureIpc = require("../ipc/secure-ipc");
const { autoUpdater } = require("electron-updater");
const log = require("../services/logger").logger("Updater");

function configureAutoUpdater(getMainWindow, markQuitting) {
  autoUpdater.logger = log; // update checks/downloads go to the app log file
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  const send = (channel, ...args) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, ...args);
    }
  };

  secureIpc.on("start-download", () => autoUpdater.downloadUpdate());
  secureIpc.on("install-update", () => {
    markQuitting?.();
    autoUpdater.quitAndInstall(false, true);
  });

  autoUpdater.on("update-available", (info) => send("update-available", info));

  autoUpdater.on("update-not-available", () => send("update-not-available"));

  autoUpdater.on("download-progress", (progress) =>
    send("download-progress", progress),
  );

  autoUpdater.on("update-downloaded", (info) =>
    send("update-downloaded", info),
  );

  autoUpdater.on("error", (err) => {
    log.error("update check failed:", err);
    send("update-error", err?.message || String(err));
  });
}

function startUpdateChecks() {
  setTimeout(() => autoUpdater.checkForUpdates(), 3000);
  setInterval(() => autoUpdater.checkForUpdates(), 12 * 60 * 60 * 1000);
}

module.exports = { configureAutoUpdater, startUpdateChecks };
