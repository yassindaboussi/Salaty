"use strict";

// What happens when something crashes. Everything is written to the log file (main.log), whose
// last errors the user can send with "Send feedback" (app/feedback.js):
//   - a main-process error: the error dialog, then the app quits ("Report a problem" there
//     opens the feedback window at the next start)
//   - a page's process crashes (blank window): the page is reloaded, at most 3 times a minute
//     so a page that crashes on load does not loop (Electron's crash-reporting guide)
//   - a helper process (GPU, network...) crashes: Chromium restarts it; it is logged
//   - a window stops responding, and when it responds again: logged
// Errors inside the pages are sent here by renderer/js/core/error-watch.js (ipc/handlers/
// feedback-handlers.js).

const { app, dialog } = require("electron");
const { t } = require("../services/i18n");
const log = require("../services/logger").logger("Crash");

const RELOADS_PER_MINUTE = 3;
/** @type {Map<number, number[]>} webContents id -> times of its recent reloads */
const recentReloads = new Map();
let quitting = false;

function initCrashHandlers() {
  process.on("uncaughtException", _handleFatal);
  process.on("unhandledRejection", _handleNonFatal);
  app.on("render-process-gone", _onPageProcessGone);
  app.on("child-process-gone", _onHelperProcessGone);
  app.on("browser-window-created", (_e, win) => {
    const page = () => pageName(win.webContents);
    win.on("unresponsive", () => log.warn("window not responding:", page()));
    win.on("responsive", () => log.info("window responding again:", page()));
  });
}

/**
 * Short name of the page shown in a webContents ("index", "settings"...), never a full URL.
 * @param {import("electron").WebContents} webContents
 */
function pageName(webContents) {
  try {
    const url = new URL(webContents.getURL());
    if (url.protocol !== "app:") return url.protocol.replace(":", "");
    return (
      url.pathname
        .split("/")
        .pop()
        ?.replace(/\.html$/, "") || "app"
    );
  } catch {
    return "unknown";
  }
}

function _report(context, error) {
  try {
    const analytics = require("../services/analytics-manager");
    analytics.trackError(context, error?.message || String(error));
  } catch {
    // reporting must never throw from inside the crash handler
  }
}

/**
 * @param {import("electron").Event} _event
 * @param {import("electron").WebContents} webContents
 * @param {import("electron").RenderProcessGoneDetails} details
 */
function _onPageProcessGone(_event, webContents, details) {
  if (details.reason === "clean-exit") return;
  const page = pageName(webContents);
  log.error(
    `page process gone (${details.reason}, exit code ${details.exitCode}):`,
    page,
  );
  _report("render_process_gone", `${details.reason} ${page}`);

  const now = Date.now();
  const times = (recentReloads.get(webContents.id) ?? []).filter(
    (time) => now - time < 60_000,
  );
  if (times.length >= RELOADS_PER_MINUTE) {
    log.error(
      `not reloading "${page}" again: it crashed ${times.length} times in a minute`,
    );
    return;
  }
  recentReloads.set(webContents.id, [...times, now]);
  // On a later task: reloading inside the event itself can crash the app (electron#51900).
  setTimeout(() => {
    if (!webContents.isDestroyed()) webContents.reload();
  }, 500);
}

/**
 * @param {import("electron").Event} _event
 * @param {import("electron").Details} details
 */
function _onHelperProcessGone(_event, details) {
  if (details.reason === "clean-exit") return;
  const name = details.name ? ` (${details.name})` : "";
  log.error(
    `${details.type} process gone${name}: ${details.reason}, exit code ${details.exitCode}`,
  );
  _report("child_process_gone", `${details.type} ${details.reason}`);
}

// The saved settings, if they were loaded before the crash.
function _currentSettings() {
  try {
    return require("../services/settings-store").get();
  } catch {
    return undefined;
  }
}

function _handleFatal(error) {
  log.error("uncaught exception:", error);
  if (quitting) return; // a second error while the dialog is open: the app is quitting anyway
  quitting = true;
  _report("uncaught_exception", error);

  if (!app.isReady()) {
    app.exit(1);
    return;
  }
  let report = false;
  try {
    const lang = _currentSettings()?.language;
    const choice = dialog.showMessageBoxSync({
      type: "error",
      title: `Salaty Time — ${t("crashTitle", lang)}`,
      message: t("crashMessage", lang),
      detail: error?.message || String(error),
      buttons: [t("crashClose", lang), t("reportProblem", lang)],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    report = choice === 1;
  } catch {
    // the dialog is best effort; the app exits either way
  }
  // the feedback window opens at the next start (app/feedback.js)
  if (report) require("./feedback").markCrashForReport();
  app.exit(1);
}

function _handleNonFatal(reason) {
  log.warn("unhandled promise rejection:", reason);
  _report("unhandled_rejection", reason);
}

module.exports = { initCrashHandlers, pageName };
