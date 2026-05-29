/**
 * analytics.js  ─  Renderer Process Analytics Client
 * =====================================================
 * Salaty Time
 *
 * This is the ONLY analytics file that renderer processes import.
 * It sends events to the main process via IPC (fire-and-forget).
 * All actual GA4 sending happens in analytics-manager.js (main process).
 *
 * USAGE IN ANY RENDERER FILE:
 * ─────────────────────────────
 *   const analytics = require('./analytics');
 *
 *   // At the top of every initXxxPage():
 *   analytics.featureOpen('quran');
 *
 *   // For custom events:
 *   analytics.track('radio_station_play', { station_id: 'quran_fm' });
 *
 * NAMING CONVENTIONS (GA4 requirements):
 * ─────────────────────────────────────────
 *  - Event names  : snake_case, max 40 chars
 *  - Param names  : snake_case, max 40 chars
 *  - Param values : string max 100 chars, number max 1,000,000
 */

"use strict";

const { ipcRenderer } = require("electron");

// ─── CORE SENDERS ────────────────────────────────────────────────────────────

/**
 * Send any named event with optional parameters.
 * This is the lowest-level function — prefer the helpers below.
 *
 * @param {string} eventName  GA4 event name (snake_case)
 * @param {object} [params]   Key-value parameters
 */
function track(eventName, params = {}) {
  try {
    ipcRenderer.send("analytics:track", eventName, params);
  } catch (e) {
    // Never let analytics crash the app
    console.warn("[Analytics] track() failed:", e.message);
  }
}

/**
 * Record that a feature page was opened.
 * Call this at the START of every initXxxPage() function.
 *
 * Valid feature names (must match GA4 custom dimension config):
 *   'quran' | 'athkar' | 'tasbih' | 'asma' | 'calendar' |
 *   'playlist' | 'ramadan' | 'qibla' | 'radio' | 'livestreams'
 *
 * @param {string} featureName
 */
function featureOpen(featureName) {
  try {
    ipcRenderer.send("analytics:feature-open", featureName);
  } catch (e) {
    console.warn("[Analytics] featureOpen() failed:", e.message);
  }
}

/**
 * Record that settings were saved.
 * The full settings object may include city/country and various alert
 * preferences; the helper strips down and renames fields to snake_case
 * before sending to the main process.
 *
 * @param {object} settings  Full settings object
 */
function settingsSaved(settings) {
  // send a snapshot of every user preference we care about
  // GA4 custom dimensions will need to be defined for any new keys below
  try {
    ipcRenderer.send("analytics:settings-saved", {
      language: settings.language,
      theme: settings.theme,
      screen_size: settings.bigScreen ? "big" : "small",
      // location fields added per user request
      city: settings.city || "",
      country: settings.country || "",
      // notification/alert settings
      athkar_alert_enabled: !!settings.athkarAlertEnabled,
      athkar_alert_interval: parseInt(settings.athkarAlertInterval) || 0,
      pre_adhan_enabled: !!settings.preAdhanNotificationEnabled,
      pre_adhan_minutes: parseInt(settings.preAdhanMinutes) || 0,
    });
  } catch (e) {
    console.warn("[Analytics] settingsSaved() failed:", e.message);
  }
}

/**
 * Record a page navigation (from → to).
 * @param {string} fromPage
 * @param {string} toPage
 */
function navigation(fromPage, toPage) {
  try {
    ipcRenderer.send("analytics:navigation", fromPage, toPage);
  } catch (e) {
    console.warn("[Analytics] navigation() failed:", e.message);
  }
}

/**
 * Record a non-fatal error for debugging in GA4.
 * @param {string} context  Where it happened, e.g. 'radio_playback'
 * @param {string} message  Error message
 */
function error(context, message) {
  try {
    ipcRenderer.send("analytics:error", context, message);
  } catch (e) {
    console.warn("[Analytics] error() failed:", e.message);
  }
}

// ─── FEATURE-SPECIFIC HELPERS ────────────────────────────────────────────────
// Granular events for deeper insights per feature.

/** Radio: a station started playing */
function radioStationPlay(stationId, stationName) {
  track("radio_station_play", {
    station_id: String(stationId || "").substring(0, 50),
    station_name: String(stationName || "").substring(0, 50),
  });
}

/** Radio: playback stopped */
function radioStop() {
  track("radio_stop");
}

/** Quran: user retried after load failure */
function quranLoadRetry() {
  track("quran_load_retry");
}

/** Quran: toggled fullscreen */
function quranFullscreen(isFullscreen) {
  track("quran_fullscreen_toggle", {
    is_fullscreen: isFullscreen ? "on" : "off",
  });
}

/** Tasbih: user completed a dhikr (hit target count) */
function tasbihCompleted(dhikrName) {
  track("tasbih_dhikr_completed", {
    dhikr_name: String(dhikrName || "custom").substring(0, 50),
  });
}

/** Tasbih: user tapped the counter */
function tasbihTap(dhikrName, newCount, targetCount) {
  track("tasbih_tap", {
    dhikr_name: String(dhikrName || "").substring(0, 50),
    count: newCount,
    target: targetCount,
  });
}

/** Athkar: user viewed a category */
function athkarCategoryView(categoryName) {
  track("athkar_category_view", {
    category_name: String(categoryName || "").substring(0, 50),
  });
}

/** Athkar: user completed all recitations in a category */
function athkarCategoryCompleted(categoryName) {
  track("athkar_category_completed", {
    category_name: String(categoryName || "").substring(0, 50),
  });
}

/** Livestreams: user switched streams */
function livestreamSwitch(streamKey) {
  track("livestream_switch", { stream: streamKey }); // 'makkah' | 'madina'
}

/** Qibla: location was resolved successfully */
function qiblaLocationResolved(source) {
  // source: 'settings' | 'ip-api' | 'photon' | 'approx'
  track("qibla_location_resolved", { source });
}

/** Ramadan: user switched between Tracker and Timetable tabs */
function ramadanTabSwitch(tabName) {
  track("ramadan_tab_switch", { tab_name: tabName });
}

/** Ramadan: user marked/unmarked a fasting day */
function ramadanDayTracked(hijriDay, action) {
  track("ramadan_day_tracked", {
    hijri_day: String(hijriDay),
    action, // 'mark' | 'unmark'
  });
}

/** Hijri Calendar: user navigated to a different month */
function calendarMonthNavigated(direction) {
  track("calendar_month_navigated", { direction }); // 'prev' | 'next' | 'today'
}

/** Asma: user copied a name */
function asmaCopied() {
  track("asma_name_copied");
}

/** Playlist: user started playing a track */
function playlistTrackPlay(albumName) {
  track("playlist_track_play", {
    album_name: String(albumName || "").substring(0, 50),
  });
}

// ─── LOCATION MANAGEMENT HELPER ──────────────────────────────────────────────

/**
 * Record any location management action as a single unified GA4 event.
 *
 * GA4 event name: location_action
 *
 * Parameters always sent:
 *   action           — 'added' | 'edited' | 'deleted' | 'activated'
 *   location_name    — label the user gave the location (e.g. "Home", "Work")
 *   location_city    — city name
 *   location_country — country name
 *   is_favorite      — 'yes' | 'no'
 *
 * Extra parameters sent only for 'edited':
 *   prev_name        — location name before the edit
 *   prev_city        — city before the edit
 *   prev_country     — country before the edit
 *   prev_favorite    — 'yes' | 'no' before the edit
 *
 * @param {'added'|'edited'|'deleted'|'activated'} action
 * @param {{
 *   name       : string,
 *   city       : string,
 *   country    : string,
 *   isFavorite : boolean,
 *   prev      ?: { name:string, city:string, country:string, isFavorite:boolean }
 * }} loc
 */
function locationAction(action, loc = {}) {
  const params = {
    action: action,
    location_name: String(loc.name || "").substring(0, 50),
    location_city: String(loc.city || "").substring(0, 50),
    location_country: String(loc.country || "").substring(0, 50),
    is_favorite: loc.isFavorite ? "yes" : "no",
  };

  // For edits: attach the previous values so you can see exactly what changed
  if (action === "edited" && loc.prev) {
    params.prev_name = String(loc.prev.name || "").substring(0, 50);
    params.prev_city = String(loc.prev.city || "").substring(0, 50);
    params.prev_country = String(loc.prev.country || "").substring(0, 50);
    params.prev_favorite = loc.prev.isFavorite ? "yes" : "no";
  }

  track("location_action", params);
}

// ─── EXPORTS ─────────────────────────────────────────────────────────────────
module.exports = {
  // Core
  track,
  featureOpen,
  settingsSaved,
  navigation,
  error,

  // Radio
  radioStationPlay,
  radioStop,

  // Quran
  quranLoadRetry,
  quranFullscreen,

  // Tasbih
  tasbihCompleted,
  tasbihTap,

  // Athkar
  athkarCategoryView,
  athkarCategoryCompleted,

  // Livestreams
  livestreamSwitch,

  // Qibla
  qiblaLocationResolved,

  // Ramadan
  ramadanTabSwitch,
  ramadanDayTracked,

  // Calendar
  calendarMonthNavigated,

  // Asma
  asmaCopied,

  // Playlist
  playlistTrackPlay,

  // Location management
  locationAction,
};
