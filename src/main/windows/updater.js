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
//
// A downloaded update installs when the app quits (autoInstallOnAppQuit). It can still be
// waiting on the next start: "Later", then the PC was restarted (Windows ends apps without a
// normal quit) or the window was only closed to the tray. Its version is remembered
// (<userData>/pending-update.json), and when a check finds that version again it is made
// ready at once: electron-updater re-checks the file it kept (sha512) and only downloads it
// again if that file is gone or damaged. So the page says "Update ready", not "Download".
const fs = require("fs");
const path = require("path");
const { app } = require("electron");
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
let readyingPending = false; // making a kept download ready (no "update-available" sent)
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

// ── The version already downloaded, waiting to be installed ─────────────────

const pendingFile = () =>
  path.join(app.getPath("userData"), "pending-update.json");

/** @returns {string} "" when none */
function pendingVersion() {
  try {
    const { version } = JSON.parse(fs.readFileSync(pendingFile(), "utf8"));
    return typeof version === "string" ? version : "";
  } catch {
    return ""; // no file (nothing waiting) or unreadable
  }
}

/** @param {string} version "" forgets it */
function setPendingVersion(version) {
  try {
    if (version)
      fs.writeFileSync(pendingFile(), JSON.stringify({ version }), "utf8");
    else fs.rmSync(pendingFile(), { force: true });
  } catch (err) {
    log.warn("pending update file:", err);
  }
}

/** electron-updater, loaded and set up the first time it is needed. */
function getUpdater() {
  if (updater) return updater;
  const { autoUpdater } = require("electron-updater");
  autoUpdater.logger = log; // update checks/downloads go to the app log file
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    // downloaded before and not installed yet: make it ready, don't ask to download it again
    if (updateMode() === "auto" && info?.version === pendingVersion()) {
      log.info(
        `update ${info.version} was downloaded before: getting it ready`,
      );
      readyingPending = true;
      autoUpdater.downloadUpdate().catch(() => {});
      return;
    }
    send("update-available", info);
  });
  autoUpdater.on("update-not-available", () => {
    setPendingVersion(""); // installed, or withdrawn from the releases
    send("update-not-available");
  });
  autoUpdater.on("download-progress", (progress) =>
    send("download-progress", progress),
  );
  autoUpdater.on("update-downloaded", (info) => {
    readyingPending = false;
    setPendingVersion(String(info?.version ?? ""));
    send("update-downloaded", info);
  });
  autoUpdater.on("error", (err) => {
    log.error("update check failed:", err);
    // the kept file could not be made ready: forget it, the next check offers it again
    if (readyingPending) {
      readyingPending = false;
      setPendingVersion("");
    }
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
