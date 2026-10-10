"use strict";

// Registers every IPC channel the pages use (called once from app/bootstrap.js).
const { registerSettingsHandlers } = require("./handlers/settings-handlers");
const { registerWindowHandlers } = require("./handlers/window-handlers");
const popupHandlers = require("./handlers/popup-handlers");
const playerManager = require("../services/player-manager");
const prayerTimerManager = require("../services/prayer-timer-manager");
const analytics = require("../services/analytics-manager");
const { refreshTrayMenu } = require("../windows/tray");
const log = require("../services/logger").logger("IPC");

// getMainWindow: returns the main window (or null); read whenever a handler runs.
function registerIpcHandlers({ getMainWindow }) {
  const sendToMain = (channel, payload) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
  };

  registerSettingsHandlers({
    onLocationChange: () => {
      prayerTimerManager
        .reloadPrayerData()
        .then(() => {
          sendToMain("location-changed");
          // The desktop widget already listens for fresh data; without this it kept the
          // old city/method's times until its own hourly refresh.
          const widget = popupHandlers.getPrayerWidgetWindow();
          const data = prayerTimerManager.getPrayerData();
          if (widget && !widget.isDestroyed() && data) {
            widget.webContents.send("prayer-data-from-main", data);
          }
        })
        .catch((err) => {
          log.error("reloading prayer times failed:", err);
          sendToMain("location-changed");
        });
    },
    onThemeChange: (theme) => {
      sendToMain("theme-changed", theme);
      const playerWindow = playerManager.getPlayerWindow();
      if (playerWindow && !playerWindow.isDestroyed())
        playerWindow.webContents.send("theme-changed", theme);
      popupHandlers.broadcastThemeToPopups(theme);
    },
    onLanguageChange: () => refreshTrayMenu(),
    onAnalyticsChange: (enabled) => analytics.applyConsent(enabled),
  });

  registerWindowHandlers(getMainWindow);
  popupHandlers.registerPopupHandlers({ getMainWindow });
  playerManager.registerPlayerIpc(getMainWindow);
}

module.exports = { registerIpcHandlers };
