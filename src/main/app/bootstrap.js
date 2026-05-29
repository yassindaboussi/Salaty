"use strict";

const { app } = require("electron");
const {
  configureAutoUpdater,
  startUpdateChecks,
} = require("../windows/updater");
const {
  createMainWindow,
  showExistingWindow,
} = require("../windows/main-window");
const { createTray, destroyTray, hasTray } = require("../windows/tray");
const ipcHandlers = require("../ipc");
const playerManager = require("../services/player-manager");
const prayerTimerManager = require("../services/prayer-timer-manager");
const connectionManager = require("../services/connection-manager");

let mainWindow = null;
let isQuitting = false;

function startApplication() {
  configureApplication();
  configureAutoUpdater(
    () => mainWindow,
    () => {
      isQuitting = true;
    },
  );

  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
    return;
  }

  app.on("second-instance", () => showExistingWindow(mainWindow));

  app.whenReady().then(() => {
    try {
      mainWindow = createMainWindow({
        onCloseToTray: (event) => {
          if (!isQuitting) {
            event.preventDefault();
            mainWindow.hide();
          }
        },
      });

      createTray({
        getSettings: ipcHandlers.getSettingsData,
        getMainWindow: () => mainWindow,
        onQuit: () => {
          isQuitting = true;
          destroyTray();
          app.quit();
        },
      });

      connectionManager.initializeConnectionManager(mainWindow);
      prayerTimerManager.init(mainWindow, ipcHandlers.getSettingsData);

      const settings = ipcHandlers.getSettingsData();
      app.setLoginItemSettings({ openAtLogin: settings.openAtLogin !== false });
      startUpdateChecks();
    } catch (err) {
      console.error("[Main] Startup error:", err);
    }
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin" && !hasTray()) app.quit();
  });

  app.on("activate", () => {
    if (!mainWindow || mainWindow.isDestroyed())
      mainWindow = createMainWindow();
    else mainWindow.show();
  });

  app.on("before-quit", () => {
    isQuitting = true;
  });
  app.on("will-quit", () => {
    connectionManager.cleanup();
    prayerTimerManager.cleanup();
  });
}

function configureApplication() {
  if (process.platform === "win32") app.setAppUserModelId("Salaty Time");
}

module.exports = { startApplication };
