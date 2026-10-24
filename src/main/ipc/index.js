"use strict";

// Registers every IPC channel the pages use (called once from app/bootstrap.js).
const { registerSettingsHandlers } = require("./handlers/settings-handlers");
const { registerWindowHandlers } = require("./handlers/window-handlers");
const { registerFeedbackHandlers } = require("./handlers/feedback-handlers");
const popupHandlers = require("./handlers/popup-handlers");
const playerManager = require("../services/player-manager");
const prayerTimerManager = require("../services/prayer-timer-manager");
const prayerTimes = require("../services/prayer-times");
const islamicCalendar = require("../services/islamic-calendar");
const fastingReminders = require("../services/fasting-reminders");
const settingsStore = require("../services/settings-store");
const check = require("./validate");
const secureIpc = require("./secure-ipc");
const analytics = require("../services/analytics-manager");
const { refreshTrayMenu } = require("../windows/tray");
const log = require("../services/logger").logger("IPC");

// getMainWindow: returns the main window (or null); read whenever a handler runs.
function registerIpcHandlers({ getMainWindow }) {
  const sendToMain = (channel, payload) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
  };

  // New prayer times (new day, location, or a corrected calendar): the home page and the
  // desktop widget show them right away.
  prayerTimerManager.onDataChange((data) => {
    sendToMain("prayer-data-from-main", data);
    const widget = popupHandlers.getPrayerWidgetWindow();
    if (widget && !widget.isDestroyed())
      widget.webContents.send("prayer-data-from-main", data);
  });

  // Aladhan data for the pages, from the main process's disk cache (works offline). Each
  // channel takes checked numbers only: pages can never make the app fetch an arbitrary URL.
  // One month of times for the monthly table.
  secureIpc.handle("get-prayer-month", (_e, year, month) => {
    const y = check.int(year, 2000, 2100);
    const m = check.int(month, 1, 12);
    if (y === undefined || m === undefined) return null;
    return prayerTimes.getMonth(settingsStore.get(), y, m);
  });
  // Ramadan (Hijri month 9) of a Hijri year, with its times, for the Ramadan page.
  secureIpc.handle("get-ramadan-calendar", (_e, hijriYear) => {
    const y = check.int(hijriYear, 1400, 1600);
    if (y === undefined) return null;
    return prayerTimes.getHijriMonth(settingsStore.get(), y, 9);
  });
  // Hijri dates with the user's correction (Settings, -2…+2 days).
  const hijriAdjustment = () =>
    islamicCalendar.adjustmentOf(settingsStore.get());
  secureIpc.handle("gregorian-to-hijri", (_e, day, month, year) => {
    const d = check.int(day, 1, 31);
    const m = check.int(month, 1, 12);
    const y = check.int(year, 2000, 2100);
    if (d === undefined || m === undefined || y === undefined) return null;
    return islamicCalendar.gregorianToHijri(d, m, y, hijriAdjustment());
  });
  // Every day of a Hijri month with its Gregorian date (the Hijri calendar page).
  secureIpc.handle("get-hijri-month", (_e, month, year) => {
    const m = check.int(month, 1, 12);
    const y = check.int(year, 1400, 1600);
    if (m === undefined || y === undefined) return null;
    return islamicCalendar.hijriMonthCalendar(m, y, hijriAdjustment());
  });
  secureIpc.handle("hijri-to-gregorian", (_e, day, month, year) => {
    const d = check.int(day, 1, 30);
    const m = check.int(month, 1, 12);
    const y = check.int(year, 1400, 1600);
    if (d === undefined || m === undefined || y === undefined) return null;
    return islamicCalendar.hijriToGregorian(d, m, y, hijriAdjustment());
  });

  registerSettingsHandlers({
    onLocationChange: () => {
      prayerTimerManager
        .reloadPrayerData()
        .catch((err) => log.error("reloading prayer times failed:", err))
        .finally(() => sendToMain("location-changed"));
      fastingReminders.replan(); // Isha and Fajr of the new location
    },
    onFastingRemindersChange: () => fastingReminders.replan(),
    onThemeChange: (theme) => {
      sendToMain("theme-changed", theme);
      const playerWindow = playerManager.getPlayerWindow();
      if (playerWindow && !playerWindow.isDestroyed())
        playerWindow.webContents.send("theme-changed", theme);
      popupHandlers.broadcastThemeToPopups(theme);
    },
    // Today's Hijri date (home page, widget) and the fasting days move with the correction
    onHijriAdjustmentChange: () => {
      prayerTimerManager
        .reloadPrayerData()
        .catch((err) => log.error("reloading prayer times failed:", err));
      fastingReminders.reload();
    },
    onLanguageChange: () => refreshTrayMenu(),
    onAnalyticsChange: (enabled) => analytics.applyConsent(enabled),
  });

  registerWindowHandlers(getMainWindow);
  registerFeedbackHandlers();
  popupHandlers.registerPopupHandlers({ getMainWindow });
  playerManager.registerPlayerIpc(getMainWindow);
}

module.exports = { registerIpcHandlers };
