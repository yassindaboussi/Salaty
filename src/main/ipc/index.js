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
          // The desktop widget already listens for fresh data; without this it kept the
          // old city/method's times until its own hourly refresh.
          const widget = popupHandlers.getPrayerWidgetWindow();
          const data = prayerTimerManager.getPrayerData();
          if (widget && !widget.isDestroyed() && data) {
            widget.webContents.send("prayer-data-from-main", data);
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
