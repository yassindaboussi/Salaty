/**
 * prayer-timer-manager.js
 * Runs entirely in the main process — immune to page navigation.
 * Uses shared prayerUtils for calculations (no duplication with renderer).
 *
 * Data flow:
 *   1. On init/location-change → fetches prayer data from aladhan.com.
 *   2. Renderer may also push fresh data via 'prayer-data-updated' IPC —
 *      this is accepted and replaces stale data without re-triggering a full reload.
 *   3. The 1-second tick fires adhan events and pre-adhan notifications only.
 *      The renderer does its own countdown calculation locally (no IPC spam).
 */
"use strict";

const { ipcMain } = require("electron");
const {
  PRAYER_KEYS,
  secondsFromTime,
  getCurrentAndNext,
} = require("../../shared/prayerUtils");

let mainWindow = null;
let getSettingsData = null;
let prayerData = null;

let tickInterval = null;
let midnightTimer = null;

let currentPrayerKey = null;
let isFirstTick = true;
let adhanIsPlaying = false;
let activeAdhanSession = null;

let lastAdhanPrayer = null;
let lastPreAdhanKey = null;

const ADHAN_TOLERANCE_SEC = 900; // 15 min

// ── Public API ────────────────────────────────────────────────────────────────

function init(window, settingsFn) {
  mainWindow = window;
  getSettingsData = settingsFn;
  _registerIpcHandlers();
  _loadPrayerData().then(() => {
    _startTickLoop();
    _scheduleMidnightReload();
  });
}

function reloadPrayerData() {
  return _loadPrayerData();
}
function getPrayerData() {
  return prayerData;
}

function cleanup() {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
  if (midnightTimer) {
    clearTimeout(midnightTimer);
    midnightTimer = null;
  }
}

// ── IPC ───────────────────────────────────────────────────────────────────────

function _registerIpcHandlers() {
  // Renderer pushed fresh data — accept it without resetting lastAdhanPrayer
  ipcMain.on("prayer-data-updated", (_ev, data) => {
    if (data) {
      prayerData = data;
      currentPrayerKey = null;
      lastPreAdhanKey = null;
    }
  });

  ipcMain.on("stop-adhan", () => _clearAdhanSession());
  ipcMain.on("stop-adhan-from-popup", () => _clearAdhanSession());

  ipcMain.handle("get-adhan-state", () => ({
    isPlaying: adhanIsPlaying,
    session: activeAdhanSession,
  }));

  ipcMain.on("reload-prayer-data", () => _loadPrayerData());
}

function _clearAdhanSession() {
  adhanIsPlaying = false;
  activeAdhanSession = null;
  _sendToMain("force-stop-adhan", {});
}

// ── Data loading ──────────────────────────────────────────────────────────────

async function _loadPrayerData() {
  const settings = getSettingsData?.();
  const city = settings?.city;
  const country = settings?.country;

  try {
    const url = `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json?.code === 200) {
      prayerData = json.data;
      currentPrayerKey = null;
      lastAdhanPrayer = null;
      lastPreAdhanKey = null;
    } else {
      throw new Error("Invalid API response");
    }
  } catch (_err) {
    /* silent — caller handles missing data gracefully */
  }
}

// ── Tick loop — adhan + pre-adhan only, NO clock IPC ─────────────────────────

function _startTickLoop() {
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = setInterval(() => {
    if (!prayerData || !mainWindow || mainWindow.isDestroyed()) return;
    try {
      const now = new Date();
      const nowSec =
        now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
      const { currentPrayer, nextPrayer, timeRemaining } = getCurrentAndNext(
        nowSec,
        prayerData.timings,
        PRAYER_KEYS,
      );

      if (!currentPrayer || !nextPrayer) return;

      // 1. Detect prayer change → maybe fire adhan
      if (currentPrayerKey !== currentPrayer.key) {
        currentPrayerKey = currentPrayer.key;
        if (isFirstTick) {
          isFirstTick = false;
          return;
        }
        _maybeFireAdhan(currentPrayer, nowSec);
      }

      // 2. Pre-adhan notification
      const settings = getSettingsData?.() || {};
      const preEnabled = settings.preAdhanNotificationEnabled !== false;
      const preMinutes = settings.preAdhanMinutes || 5;
      if (preEnabled && timeRemaining > 0 && timeRemaining <= preMinutes * 60) {
        if (lastPreAdhanKey !== nextPrayer.key) {
          lastPreAdhanKey = nextPrayer.key;
          _sendToMain("show-pre-adhan-notification", {
            prayer: nextPrayer,
            minutes: preMinutes,
          });
        }
      }
    } catch (_err) {
      /* silent tick error */
    }
  }, 1000);
}

// ── Adhan firing ──────────────────────────────────────────────────────────────

function _maybeFireAdhan(prayer, nowSec) {
  if (lastAdhanPrayer === prayer.key) return;

  const prayerSec = secondsFromTime(prayer.time);
  let diff = nowSec - prayerSec;
  if (diff < -43200) diff += 86400;

  if (diff < 0 || diff > ADHAN_TOLERANCE_SEC) {
    return;
  }

  const settings = getSettingsData?.() || {};
  const adhanByPrayer = settings.adhanEnabledByPrayer || {};
  let adhanState = adhanByPrayer[prayer.key];
  if (adhanState === undefined) adhanState = true;

  lastAdhanPrayer = prayer.key;
  adhanIsPlaying = adhanState !== "silent";
  activeAdhanSession = {
    prayer,
    mode: adhanState,
    theme: settings.theme || "navy",
    startedAt: Date.now(),
  };

  _sendToMain("trigger-adhan", activeAdhanSession);
}

// ── Midnight reload ───────────────────────────────────────────────────────────

function _scheduleMidnightReload() {
  if (midnightTimer) clearTimeout(midnightTimer);
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 30, 0);
  const msLeft = midnight - now;
  midnightTimer = setTimeout(() => {
    _loadPrayerData().then(_scheduleMidnightReload);
  }, msLeft);
}

// ── Utility ───────────────────────────────────────────────────────────────────

function _sendToMain(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed())
    mainWindow.webContents.send(channel, payload);
}

module.exports = { init, cleanup, reloadPrayerData, getPrayerData };
