"use strict";

// Thin senders for usage statistics. The main process (services/analytics-manager.js) drops
// every event unless the user turned statistics on in Settings. Never pass anything personal
// here: no location, no names of what is listened to, no free text typed by the user.
const { ipcRenderer } = require("electron");

function track(eventName, params = {}) {
  try {
    ipcRenderer.send("analytics:track", eventName, params);
  } catch (e) {
    console.warn("[Analytics] track() failed:", e.message);
  }
}

function featureOpen(featureName) {
  try {
    ipcRenderer.send("analytics:feature-open", featureName);
  } catch (e) {
    console.warn("[Analytics] featureOpen() failed:", e.message);
  }
}

function settingsSaved(settings) {
  try {
    // only these fields; main turns them into the event parameters
    ipcRenderer.send("analytics:settings-saved", {
      language: settings.language,
      theme: settings.theme,
      bigScreen: settings.bigScreen,
      athkarAlertEnabled: settings.athkarAlertEnabled,
      athkarAlertInterval: settings.athkarAlertInterval,
      preAdhanNotificationEnabled: settings.preAdhanNotificationEnabled,
      preAdhanMinutes: settings.preAdhanMinutes,
    });
  } catch (e) {
    console.warn("[Analytics] settingsSaved() failed:", e.message);
  }
}

function navigation(fromPage, toPage) {
  try {
    ipcRenderer.send("analytics:navigation", fromPage, toPage);
  } catch (e) {
    console.warn("[Analytics] navigation() failed:", e.message);
  }
}

function error(context, message) {
  try {
    ipcRenderer.send("analytics:error", context, message);
  } catch (e) {
    console.warn("[Analytics] error() failed:", e.message);
  }
}

// Which station is not sent: that would be listening history.
function radioStationPlay() {
  track("radio_station_play");
}

function radioStop() {
  track("radio_stop");
}

function tasbihCompleted(dhikrName) {
  track("tasbih_dhikr_completed", {
    dhikr_name: String(dhikrName || "custom").substring(0, 50),
  });
}

// "added" / "edited" / "deleted": never the words themselves
function tasbihCustomDhikr(action) {
  track("tasbih_custom_dhikr", { action });
}

function tasbihSequenceCompleted() {
  track("tasbih_sequence_completed");
}

function athkarCategoryView(categoryName) {
  track("athkar_category_view", {
    category_name: String(categoryName || "").substring(0, 50),
  });
}

function athkarCategoryCompleted(categoryName) {
  track("athkar_category_completed", {
    category_name: String(categoryName || "").substring(0, 50),
  });
}

function livestreamSwitch(streamKey) {
  track("livestream_switch", { stream: streamKey });
}

function qiblaLocationResolved(source) {
  track("qibla_location_resolved", { source });
}

function ramadanTabSwitch(tabName) {
  track("ramadan_tab_switch", { tab_name: tabName });
}

function ramadanDayTracked(hijriDay, action) {
  track("ramadan_day_tracked", {
    hijri_day: String(hijriDay),
    action,
  });
}

function calendarMonthNavigated(direction) {
  track("calendar_month_navigated", { direction });
}

// The kind of fast ("monThu", "whiteDays"…), never a date.
function fastingReminderToggled(type, enabled) {
  track("fasting_reminder_toggled", { type, enabled });
}

function sunnahFastMarked(action) {
  track("sunnah_fast_marked", { action });
}

function asmaCopied() {
  track("asma_name_copied");
}

// Which album/reciter is not sent: that would be listening history.
function playlistTrackPlay() {
  track("playlist_track_play");
}

// "added" / "edited" / "activated" / "deleted" — never the place itself.
function locationAction(action) {
  track("location_action", { action });
}

module.exports = {
  track,
  featureOpen,
  settingsSaved,
  navigation,
  error,

  radioStationPlay,
  radioStop,

  tasbihCompleted,
  tasbihCustomDhikr,
  tasbihSequenceCompleted,

  athkarCategoryView,
  athkarCategoryCompleted,

  livestreamSwitch,

  qiblaLocationResolved,

  fastingReminderToggled,
  sunnahFastMarked,

  ramadanTabSwitch,
  ramadanDayTracked,

  calendarMonthNavigated,

  asmaCopied,

  playlistTrackPlay,

  locationAction,
};
