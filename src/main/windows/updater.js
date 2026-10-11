"use strict";

// Update checks (electron-updater, GitHub releases). electron-updater takes ~80-100 ms to load,
// most of the main process's own start-up (measured), so it is loaded on first use: the first
// check runs 3 s after start, or when the user asks in Settings.
//
// How a copy of the app gets new versions depends on how it was installed (updateMode):
//   "auto"    downloads and installs them: the Windows installer, a Linux AppImage or .deb
//   "notify"  finds them but can only open the download page: Apple lets only signed apps
//             replace themselves (the macOS build is not signed), and an app run from an
//             unpacked folder has no installer to update
//   "store"   the Microsoft Store installs them; the app does not check at all
const fs = require("fs");
const path = require("path");
const secureIpc = require("../ipc/secure-ipc");
const { openExternalSafely } = require("../app/security");
const log = require("../services/logger").logger("Updater");

/**
 * @import { BrowserWindow } from "electron"
 * @import { AppUpdater } from "electron-updater"
 * @typedef {"auto" | "notify" | "store"} UpdateMode
 */

const DOWNLOAD_PAGE =
  "https://github.com/yassindaboussi/Salaty/releases/latest";

/** @type {AppUpdater | null} */
let updater = null;
/** @type {() => BrowserWindow | null} */
let getMainWindow = () => null;

/** @returns {UpdateMode} */
function updateMode() {
  if (process.windowsStore) return "store";
  if (process.platform === "darwin") return "notify";
  if (process.platform === "linux") {
    // electron-builder marks .deb/.rpm installs with this file; an AppImage sets APPIMAGE
    const packaged = fs.existsSync(
      path.join(process.resourcesPath, "package-type"),
    );
    return process.env.APPIMAGE || packaged ? "auto" : "notify";
  }
  return "auto";
}

/**
 * @param {string} channel
 * @param {...unknown} args
 */
function send(channel, ...args) {
  const win = getMainWindow();
  if (win && !win.isDestroyed()) win.webContents.send(channel, ...args);
}

/** electron-updater, loaded and set up the first time it is needed. */
function getUpdater() {
  if (updater) return updater;
  const { autoUpdater } = require("electron-updater");
  autoUpdater.logger = log; // update checks/downloads go to the app log file
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

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
  updater = autoUpdater;
  return autoUpdater;
}

/**
 * @param {() => BrowserWindow | null} getMainWindowFn
 * @param {() => void} [markQuitting] called before quitting to install an update
 */
function configureAutoUpdater(getMainWindowFn, markQuitting) {
  getMainWindow = getMainWindowFn;
  secureIpc.handle("get-update-mode", () => updateMode());
  // "Download" on the page: the update itself, or (notify mode) the download page. Download
  // failures arrive through the "error" event (getUpdater): logged and shown on the page.
  secureIpc.on("start-download", () => {
    if (updateMode() !== "auto") {
      openExternalSafely(DOWNLOAD_PAGE);
      return;
    }
    getUpdater()
      .downloadUpdate()
      .catch(() => {});
  });
  secureIpc.on("install-update", () => {
    if (updateMode() !== "auto") return;
    markQuitting?.();
    getUpdater().quitAndInstall(false, true);
  });
}

// Errors are reported by the "error" event: catch the promise too, or every failed check
// (offline, no release feed) is also an unhandled rejection.
function checkForUpdates() {
  getUpdater()
    .checkForUpdates()
    ?.catch(() => {});
}

/** The check the user starts from Settings; the page shows its result. */
function checkForUpdatesNow() {
  if (updateMode() === "store") return Promise.resolve(null);
  return getUpdater().checkForUpdates();
}

function startUpdateChecks() {
  if (updateMode() === "store") return;
  setTimeout(checkForUpdates, 3000);
  setInterval(checkForUpdates, 12 * 60 * 60 * 1000);
}

module.exports = {
  configureAutoUpdater,
  startUpdateChecks,
  checkForUpdatesNow,
  updateMode,
};
