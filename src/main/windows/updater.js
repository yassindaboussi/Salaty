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
// Once per run: later checks of the same run don't bring the dialog back.
//
// A new version found by an automatic check is also told outside the window, once per version
// (<userData>/update-notified.json), without taking the focus (an update is not urgent, unlike
// the adhan): the app's own small popup in the screen corner, the same one as the athkar and
// fasting reminders on every OS, with an "Update" button that opens the window on the update
// dialog; and a flashing taskbar button (a bouncing Dock icon on macOS) when the window is open
// but behind other windows. No popup when the user is already looking at the window.
//
// When to check: 3 s after start, then every 12 h of real time. The app starts with Windows,
// often before the network is up, and laptops sleep (a timer doesn't run then), so a failed
// check is tried again when the connection comes back, and an hourly tick (and waking from
// sleep) checks whether 12 h have passed since the last check.
const fs = require("fs");
const path = require("path");
const { app, powerMonitor } = require("electron");
const secureIpc = require("../ipc/secure-ipc");
const { openExternalSafely } = require("../app/security");
const connectionManager = require("../services/connection-manager");
const log = require("../services/logger").logger("Updater");
const { t } = require("../services/i18n");
const settingsStore = require("../services/settings-store");
const { pages } = require("../config/paths");

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
let readyVersion = ""; // the version the page was told is ready, this run
let manualCheck = false; // a check started from Settings: its page waits for an answer
let lastCheckAt = 0; // Date.now() of the last automatic or manual check
let lastCheckFailed = false;
/** @type {any} the last "update-available" info, for the popup's "Update" */
let lastFound = null;

const FIRST_CHECK_MS = 3000;
const CHECK_EVERY_MS = 12 * 60 * 60 * 1000;
const TICK_MS = 60 * 60 * 1000;
const AFTER_WAKE_MS = 15_000; // the network comes back a few seconds after waking
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
    lastFound = info;
    if (!manualCheck) tellOutsideWindow(String(info?.version ?? ""));
    const kept = updateMode() === "auto" && info?.version === pendingVersion();
    // already ready this run: the dialog said so once; Settings still gets its answer
    if (kept && info.version === readyVersion) {
      if (manualCheck) send("update-downloaded", info);
      return;
    }
    // downloaded before and not installed yet: make it ready, don't ask to download it again
    if (kept) {
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
    readyVersion = String(info?.version ?? "");
    setPendingVersion(readyVersion);
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

// ── Telling the user outside the window ─────────────────────────────────────

const notifiedFile = () =>
  path.join(app.getPath("userData"), "update-notified.json");

/** @param {string} version @returns {boolean} the popup was shown for it already */
function wasNotified(version) {
  try {
    return (
      JSON.parse(fs.readFileSync(notifiedFile(), "utf8")).version === version
    );
  } catch {
    return false;
  }
}

/** @param {string} version */
function setNotified(version) {
  try {
    fs.writeFileSync(notifiedFile(), JSON.stringify({ version }), "utf8");
  } catch (err) {
    log.warn("update notified file:", err);
  }
}

/** The popup and the taskbar flash, once per version (see the top of this file). */
function tellOutsideWindow(version) {
  if (!version || wasNotified(version)) return;
  const win = getMainWindow();
  if (win && !win.isDestroyed() && win.isVisible() && win.isFocused()) return;
  setNotified(version);
  const settings = settingsStore.get();
  const lang = settings.language || "en";
  const { showThemedPopup } = require("../ipc/handlers/popup-handlers");
  showThemedPopup(
    {
      icon: "fa-circle-arrow-down",
      theme: settings.theme || "navy",
      title: `Salaty Time · ${t("updatePopupTitle", lang)}`,
      content: t("updatePopupText", lang).replace("{version}", version),
      button: t("updatePopupButton", lang),
    },
    "update",
  );
  if (win && !win.isDestroyed() && win.isVisible()) {
    win.flashFrame(true);
    win.once("focus", () => !win.isDestroyed() && win.flashFrame(false));
  }
}

/** "Update" on the popup: the window in front, on the home page's update dialog. */
function openUpdateDialog() {
  const win = getMainWindow();
  if (!win || win.isDestroyed()) return;
  require("./main-window").showExistingWindow(win);
  win.flashFrame(false);
  const tell = () => win.webContents.send("open-update-dialog", lastFound);
  if (win.webContents.getURL().split(/[?#]/)[0] === pages.index) tell();
  else {
    // the dialog lives on the home page; it listens once its script has run
    win.webContents.once("did-finish-load", () => setTimeout(tell, 800));
    win.loadURL(pages.index);
  }
}

/**
 * @param {() => BrowserWindow | null} getMainWindowFn
 * @param {() => void} [markQuitting] called before quitting to install an update
 */
function configureAutoUpdater(getMainWindowFn, markQuitting) {
  getMainWindow = getMainWindowFn;
  secureIpc.handle("get-update-mode", () => updateMode());
  secureIpc.on("open-update-dialog", () => openUpdateDialog());
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

/**
 * One check. Errors are reported by the "error" event: the promise is caught too, or every
 * failed check (offline, no release feed) is also an unhandled rejection.
 * @param {boolean} [manual] started from Settings
 */
function runCheck(manual = false) {
  lastCheckAt = Date.now();
  manualCheck = manual;
  const done = getUpdater()
    .checkForUpdates()
    ?.then(
      (result) => {
        lastCheckFailed = false;
        return result;
      },
      (err) => {
        lastCheckFailed = true;
        throw err;
      },
    )
    .finally(() => {
      manualCheck = false;
    });
  return done ?? Promise.resolve(null);
}

function checkForUpdates() {
  runCheck().catch(() => {});
}

/**
 * The hourly tick and waking from sleep: a check if the last one is 12 h old, or failed an
 * hour ago (the site was down while the connection was fine).
 */
function checkIfDue() {
  const since = Date.now() - lastCheckAt;
  if (since >= CHECK_EVERY_MS || (lastCheckFailed && since >= TICK_MS))
    checkForUpdates();
}

/** The check the user starts from Settings; the page shows its result. */
function checkForUpdatesNow() {
  if (updateMode() === "store") return Promise.resolve(null);
  return runCheck(true);
}

function startUpdateChecks() {
  if (updateMode() === "store") return;
  setTimeout(checkForUpdates, FIRST_CHECK_MS);
  setInterval(checkIfDue, TICK_MS);
  powerMonitor.on("resume", () => setTimeout(checkIfDue, AFTER_WAKE_MS));
  connectionManager.onRestored(() => {
    if (lastCheckFailed) checkForUpdates();
  });
}

module.exports = {
  configureAutoUpdater,
  startUpdateChecks,
  checkForUpdatesNow,
  updateMode,
};
