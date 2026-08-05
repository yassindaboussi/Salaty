
"use strict";

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
    ipcRenderer.send("analytics:settings-saved", {
      language: settings.language,
      theme: settings.theme,
      screen_size: settings.bigScreen ? "big" : "small",
      city: settings.city || "",
      country: settings.country || "",
      athkar_alert_enabled: !!settings.athkarAlertEnabled,
      athkar_alert_interval: parseInt(settings.athkarAlertInterval) || 0,
      pre_adhan_enabled: !!settings.preAdhanNotificationEnabled,
      pre_adhan_minutes: parseInt(settings.preAdhanMinutes) || 0,
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


function radioStationPlay(stationId, stationName) {
  track("radio_station_play", {
    station_id: String(stationId || "").substring(0, 50),
    station_name: String(stationName || "").substring(0, 50),
  });
}

function radioStop() {
  track("radio_stop");
}

function quranLoadRetry() {
  track("quran_load_retry");
}

function quranFullscreen(isFullscreen) {
  track("quran_fullscreen_toggle", {
    is_fullscreen: isFullscreen ? "on" : "off",
  });
}

function tasbihCompleted(dhikrName) {
  track("tasbih_dhikr_completed", {
    dhikr_name: String(dhikrName || "custom").substring(0, 50),
  });
}

function tasbihTap(dhikrName, newCount, targetCount) {
  track("tasbih_tap", {
    dhikr_name: String(dhikrName || "").substring(0, 50),
    count: newCount,
    target: targetCount,
  });
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

function asmaCopied() {
  track("asma_name_copied");
}

function playlistTrackPlay(albumName) {
  track("playlist_track_play", {
    album_name: String(albumName || "").substring(0, 50),
  });
}


function locationAction(action, loc = {}) {
  const params = {
    action: action,
    location_name: String(loc.name || "").substring(0, 50),
    location_city: String(loc.city || "").substring(0, 50),
    location_country: String(loc.country || "").substring(0, 50),
    is_favorite: loc.isFavorite ? "yes" : "no",
  };

  if (action === "edited" && loc.prev) {
    params.prev_name = String(loc.prev.name || "").substring(0, 50);
    params.prev_city = String(loc.prev.city || "").substring(0, 50);
    params.prev_country = String(loc.prev.country || "").substring(0, 50);
    params.prev_favorite = loc.prev.isFavorite ? "yes" : "no";
  }

  track("location_action", params);
}

module.exports = {
  track,
  featureOpen,
  settingsSaved,
  navigation,
  error,

  radioStationPlay,
  radioStop,

  quranLoadRetry,
  quranFullscreen,

  tasbihCompleted,
  tasbihTap,

  athkarCategoryView,
  athkarCategoryCompleted,

  livestreamSwitch,

  qiblaLocationResolved,

  ramadanTabSwitch,
  ramadanDayTracked,

  calendarMonthNavigated,

  asmaCopied,

  playlistTrackPlay,

  locationAction,
};
