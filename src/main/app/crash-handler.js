"use strict";

const { app, dialog } = require("electron");
const { t } = require("../services/i18n");
const log = require("../services/logger").logger("Crash");

function initCrashHandlers() {
  process.on("uncaughtException", _handleFatal);
  process.on("unhandledRejection", _handleNonFatal);
}

function _report(context, error) {
  try {
    const analytics = require("../services/analytics-manager");
    analytics.trackError(context, error?.message || String(error));
  } catch {
    // reporting must never throw from inside the crash handler
  }
}

// The saved language, if the settings were loaded before the crash.
function _currentLanguage() {
  try {
    return require("../services/settings-store").get().language;
  } catch {
    return undefined;
  }
}

function _handleFatal(error) {
  log.error("uncaught exception:", error);
  _report("uncaught_exception", error);

  try {
    if (app.isReady()) {
      const lang = _currentLanguage();
      dialog.showErrorBox(
        `Salaty Time — ${t("crashTitle", lang)}`,
        `${t("crashMessage", lang)}\n\n${error?.message || String(error)}`,
      );
    }
  } catch {
    // the dialog is best effort; the app exits either way
  }

  app.exit(1);
}

function _handleNonFatal(reason) {
  log.warn("unhandled promise rejection:", reason);
  _report("unhandled_rejection", reason);
}

module.exports = { initCrashHandlers };
