/**
 * ipc-handlers.js — thin orchestrator
 * Delegates to focused handler modules and wires up cross-cutting callbacks.
 */
"use strict";

const settingsHandlers = require("./handlers/settings-handlers");
const windowHandlers = require("./handlers/window-handlers");
// popup-handlers self-registers at require-time (top-level ipcMain.on calls)
const popupHandlers = require("./handlers/popup-handlers");
const playerManager = require("../services/player-manager");
const prayerTimerManager = require("../services/prayer-timer-manager");

function setupHandlers(mainWindow) {
  settingsHandlers.setupHandlers(mainWindow, {
    onLocationChange: () => {
      // Reload prayer data in main process, then tell the renderer to
      // refresh its UI with the new location.  We wait for the fetch to
      // finish so the renderer gets fresh data immediately.
      prayerTimerManager
        .reloadPrayerData()
        .then(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("location-changed");
          }
        })
        .catch((err) => {
          console.error("[IPC] reloadPrayerData failed:", err);
          // Still notify renderer so it can re-fetch itself
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("location-changed");
          }
        });
    },
    onThemeChange: (theme) => {
      if (mainWindow && !mainWindow.isDestroyed())
        mainWindow.webContents.send("theme-changed", theme);

      const playerWindow = playerManager.getPlayerWindow();
      if (playerWindow && !playerWindow.isDestroyed())
        playerWindow.webContents.send("theme-changed", theme);

      popupHandlers.broadcastThemeToPopups(theme);
    },
  });

  windowHandlers.setupHandlers(mainWindow);
}

// Re-export settings helpers consumed by main.js and prayer-timer-manager
module.exports = {
  loadSettings: settingsHandlers.loadSettings,
  saveSettings: settingsHandlers.saveSettings,
  getSettingsData: settingsHandlers.getSettingsData,
  savePosition: settingsHandlers.savePosition,
  setupHandlers,
};
