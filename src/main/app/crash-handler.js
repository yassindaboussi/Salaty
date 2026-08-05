"use strict";

const { app, dialog } = require("electron");

function initCrashHandlers() {
  process.on("uncaughtException", _handleFatal);
  process.on("unhandledRejection", _handleNonFatal);
}

function _report(context, error) {
  try {
    const analytics = require("../services/analytics-manager");
    analytics.trackError(context, error?.message || String(error));
  } catch {
  }
}

function _handleFatal(error) {
  console.error("[FATAL] Uncaught exception:", error);
  _report("uncaught_exception", error);

  try {
    if (app.isReady()) {
      dialog.showErrorBox(
        "Salaty Time — Unexpected Error",
        "Something went wrong and the app needs to close.\n\n" +
          (error?.message || String(error)),
      );
    }
  } catch {
  }

  app.exit(1);
}

function _handleNonFatal(reason) {
  console.error("[WARN] Unhandled promise rejection:", reason);
  _report("unhandled_rejection", reason);
}

module.exports = { initCrashHandlers };
