"use strict";

// Composition root: the one place where the main process is wired together, in start-up
// order. Services receive what they need (settings, a getter for the main window) instead of
// importing each other's state.
const { app, Menu } = require("electron");
const {
  configureAutoUpdater,
  startUpdateChecks,
} = require("../windows/updater");
const {
  createMainWindow,
  showExistingWindow,
} = require("../windows/main-window");
const { createTray, destroyTray, hasTray } = require("../windows/tray");
const { registerIpcHandlers } = require("../ipc");
const { applySecurityRules } = require("./security");
const { registerAppScheme, handleAppScheme } = require("./app-protocol");
const { migrateLocalStorage } = require("../services/storage-migration");
const startup = require("./startup-timing");
const settingsStore = require("../services/settings-store");
const analytics = require("../services/analytics-manager");
const prayerTimerManager = require("../services/prayer-timer-manager");
const fastingReminders = require("../services/fasting-reminders");
const connectionManager = require("../services/connection-manager");
const athkarAlertManager = require("../services/athkar-alert-manager");
const feedback = require("./feedback");
const log = require("../services/logger").logger("Main");

/** @import { BrowserWindow } from "electron" */

/** @type {BrowserWindow | null} */
let mainWindow = null;
let isQuitting = false;
const getMainWindow = () => mainWindow;

function startApplication() {
  configureApplication();

  Menu.setApplicationMenu(null);

  configureAutoUpdater(getMainWindow, () => {
    isQuitting = true;
  });

  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
    return;
  }

  app.on("second-instance", () => showExistingWindow(mainWindow));

  // Before any window exists, so every web page the app ever creates gets the rules.
  applySecurityRules();
  // The pages' app:// scheme must be declared before "ready".
  registerAppScheme();

  app.whenReady().then(async () => {
    startup.mark("ready");
    try {
      // 1. data, 2. IPC (before the first page asks for anything), 3. the pages' protocol
      // and their data moved from file:// (once), 4. windows, 5. services
      settingsStore.load();
      analytics.init(settingsStore.get);
      registerIpcHandlers({ getMainWindow });
      handleAppScheme();
      await migrateLocalStorage();

      startup.mark("migrated");
      mainWindow = createMainWindow({
        onCloseToTray: (event) => {
          if (!isQuitting) {
            event.preventDefault();
            mainWindow?.hide();
          }
        },
      });

      startup.mark("window");
      createTray({
        getSettings: settingsStore.get,
        getMainWindow,
        onQuit: () => {
          isQuitting = true;
          destroyTray();
          app.quit();
        },
      });

      connectionManager.initializeConnectionManager(getMainWindow);
      prayerTimerManager.init(getMainWindow, settingsStore.get);
      // back online: refresh the prayer times (the cache covered the offline time)
      connectionManager.onRestored(() => prayerTimerManager.reloadPrayerData());
      // feedback written while offline
      connectionManager.onRestored(() => feedback.flushQueue());
      setTimeout(() => feedback.flushQueue(), 30_000);
      fastingReminders.init(settingsStore.get);
      // back online: Hijri dates calculated offline are replaced by Aladhan's
      connectionManager.onRestored(() => fastingReminders.reload());
      athkarAlertManager.init(settingsStore.get);

      settingsStore.syncOpenAtLogin();
      startUpdateChecks();
      log.info(`started v${app.getVersion()}`);
    } catch (err) {
      log.error("start-up failed:", err);
    }
  });

  app.on("window-all-closed", () => {
    // also emitted when the storage move closes its hidden window, before the main one exists
    if (!mainWindow) return;
    if (process.platform !== "darwin" && !hasTray()) app.quit();
  });

  // macOS dock click. Closing the window only hides it (onCloseToTray above), so it still
  // exists here.
  app.on("activate", () => showExistingWindow(mainWindow));

  app.on("before-quit", () => {
    isQuitting = true;
  });
  app.on("will-quit", () => {
    settingsStore.flush();
    connectionManager.cleanup();
    prayerTimerManager.cleanup();
    fastingReminders.cleanup();
    athkarAlertManager.cleanup();
  });
}

function configureApplication() {
  if (process.platform === "win32") app.setAppUserModelId("Salaty Time");
}

module.exports = { startApplication };
