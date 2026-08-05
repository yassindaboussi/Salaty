"use strict";

const settingsHandlers = require("./handlers/settings-handlers");
const windowHandlers = require("./handlers/window-handlers");
const popupHandlers = require("./handlers/popup-handlers");
const playerManager = require("../services/player-manager");
const prayerTimerManager = require("../services/prayer-timer-manager");

function setupHandlers(mainWindow) {
  settingsHandlers.setupHandlers(mainWindow, {
    onLocationChange: () => {
      prayerTimerManager
        .reloadPrayerData()
        .then(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("location-changed");
          }
        })
        .catch((err) => {
          console.error("[IPC] reloadPrayerData failed:", err);
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

module.exports = {
  loadSettings: settingsHandlers.loadSettings,
  saveSettings: settingsHandlers.saveSettings,
  getSettingsData: settingsHandlers.getSettingsData,
  savePosition: settingsHandlers.savePosition,
  setupHandlers,
};
