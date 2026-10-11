"use strict";

const secureIpc = require("../ipc/secure-ipc");
const {
  PRAYER_KEYS,
  secondsFromTime,
  secondsSinceMidnight,
  getCurrentAndNext,
  isFridayIn,
  displayPrayerKey,
} = require("../../shared/prayerUtils");
const prayerTimes = require("./prayer-times");
const log = require("./logger").logger("Prayer");
const { bringToFrontForAdhan } = require("../windows/main-window");

/**
 * @import { BrowserWindow } from "electron"
 * @import { PrayerDay } from "./prayer-times"
 * @typedef {{ prayer: object, mode: true | "silent", theme: string, startedAt: number }} AdhanSession
 */

/** @type {() => BrowserWindow | null} */
let getMainWindow = () => null;
/** @type {(() => any) | null} returns the current settings */
let getSettingsData = null;
/** @type {PrayerDay | null} today's times for the saved location */
let prayerData = null;

/** @type {ReturnType<typeof setInterval> | null} */
let tickInterval = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let midnightTimer = null;

/** @type {string | null} */
let currentPrayerKey = null;
let isFirstTick = true;
let adhanIsPlaying = false;
/** @type {AdhanSession | null} */
let activeAdhanSession = null;

/** @type {string | null} */
let lastAdhanPrayer = null;
/** @type {string | null} */
let lastPreAdhanKey = null;

/** @type {Promise<void> | null} the load in progress, shared by everyone who asks meanwhile */
let loading = null;
// Without today's times (offline, server down, a first download that timed out) try again:
// 30 s, 1, 2, 5 min, then every 10 min until they arrive.
const RETRY_DELAYS_MS = [30_000, 60_000, 120_000, 300_000, 600_000];
/** @type {ReturnType<typeof setTimeout> | null} */
let retryTimer = null;
let retryCount = 0;
/** @type {Set<(data: PrayerDay) => void>} */
const dataListeners = new Set();

const ADHAN_TOLERANCE_SEC = 900;

/**
 * @param {() => BrowserWindow | null} getMainWindowFn returns the main window (or null)
 * @param {() => any} settingsFn returns the current settings
 */
function init(getMainWindowFn, settingsFn) {
  getMainWindow = getMainWindowFn;
  getSettingsData = settingsFn;
  _registerIpcHandlers();
  // a corrected calendar downloaded in the background: re-read today
  prayerTimes.onChange(() => _loadPrayerData());
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
// Today's data once the current load has finished; tries again when there is none yet
// (offline at start-up with an empty cache).
async function getPrayerDataWhenReady() {
  if (loading) await loading;
  if (!prayerData) await _loadPrayerData();
  return prayerData;
}
/**
 * Called with the new data whenever today's times change (new day, location, correction).
 * @param {(data: PrayerDay) => void} listener
 */
function onDataChange(listener) {
  dataListeners.add(listener);
  return () => dataListeners.delete(listener);
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
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
}

function _scheduleRetry() {
  if (retryTimer) return;
  const delay =
    RETRY_DELAYS_MS[Math.min(retryCount, RETRY_DELAYS_MS.length - 1)];
  retryCount++;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    _loadPrayerData();
  }, delay);
}

function _registerIpcHandlers() {
  secureIpc.on("stop-adhan", () => _clearAdhanSession());

  secureIpc.handle("get-adhan-state", () => ({
    isPlaying: adhanIsPlaying,
    session: activeAdhanSession,
  }));
}

function _clearAdhanSession() {
  adhanIsPlaying = false;
  activeAdhanSession = null;
  _mainWindow()?.flashFrame(false);
  _sendToMain("force-stop-adhan", {});
}

/**
 * Today's times from services/prayer-times.js (disk cache, so this works offline). Loads
 * asked for while one is running share it.
 * @returns {Promise<void>}
 */
function _loadPrayerData() {
  if (!loading) {
    loading = _load().finally(() => {
      loading = null;
    });
  }
  return loading;
}

async function _load() {
  const settings = getSettingsData?.();
  try {
    const data = await prayerTimes.getToday(settings);
    if (!data) {
      // offline with nothing cached: keep what we have and try again a bit later
      log.warn("no prayer times available yet");
      _scheduleRetry();
      return;
    }
    retryCount = 0;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    if (JSON.stringify(data) === JSON.stringify(prayerData)) return;
    // A new day or different times: forget which adhan/reminder already played. Not on an
    // identical reload, which would play the current prayer's adhan a second time.
    prayerData = data;
    currentPrayerKey = null;
    lastAdhanPrayer = null;
    lastPreAdhanKey = null;
    for (const listener of dataListeners) listener(prayerData);
  } catch (err) {
    log.warn("loading prayer times failed:", err.message);
  }
}

function _startTickLoop() {
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = setInterval(() => {
    if (!prayerData || !_mainWindow()) return;
    try {
      const nowSec = secondsSinceMidnight();
      const { currentPrayer, nextPrayer, timeRemaining } = getCurrentAndNext(
        nowSec,
        prayerData.timings,
        PRAYER_KEYS,
      );

      if (!currentPrayer || !nextPrayer) return;

      if (currentPrayerKey !== currentPrayer.key) {
        currentPrayerKey = currentPrayer.key;
        if (isFirstTick) {
          isFirstTick = false;
          return;
        }
        _maybeFireAdhan(currentPrayer, nowSec);
      }

      const settings = getSettingsData?.() || {};
      const preEnabled = settings.preAdhanNotificationEnabled !== false;
      const preMinutes = settings.preAdhanMinutes || 5;
      if (preEnabled && timeRemaining > 0 && timeRemaining <= preMinutes * 60) {
        if (lastPreAdhanKey !== nextPrayer.key) {
          lastPreAdhanKey = nextPrayer.key;
          const actualMinutesRemaining = Math.max(
            1,
            Math.round(timeRemaining / 60),
          );
          _sendToMain("show-pre-adhan-notification", {
            prayer: _withDisplayKey(nextPrayer),
            minutes: actualMinutesRemaining,
          });
        }
      }
    } catch (err) {
      log.error("prayer tick failed:", err);
    }
  }, 1000);
}

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

  if (adhanState === false) {
    return;
  }

  adhanIsPlaying = adhanState !== "silent";
  activeAdhanSession = {
    prayer: _withDisplayKey(prayer),
    mode: adhanState,
    theme: settings.theme || "navy",
    startedAt: Date.now(),
  };

  if (adhanIsPlaying) {
    bringToFrontForAdhan(_mainWindow());
  }

  _sendToMain("trigger-adhan", activeAdhanSession);
}

// Adds the key the renderer should use for the prayer's *name*: on Fridays (in the prayer
// location's own time zone) Dhuhr is announced as Jumu'ah. `key` itself is left as-is
// because the adhan settings are keyed by it.
function _withDisplayKey(prayer) {
  return {
    ...prayer,
    displayKey: displayPrayerKey(prayer.key, {
      isFriday: isFridayIn(prayerData?.meta?.timezone),
    }),
  };
}

function _scheduleMidnightReload() {
  if (midnightTimer) clearTimeout(midnightTimer);
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 30, 0);
  const msLeft = midnight.getTime() - now.getTime();
  midnightTimer = setTimeout(() => {
    _loadPrayerData().then(_scheduleMidnightReload);
  }, msLeft);
}

/** @returns {BrowserWindow | null} the main window while it exists */
function _mainWindow() {
  const w = getMainWindow();
  return w && !w.isDestroyed() ? w : null;
}

/**
 * @param {string} channel
 * @param {unknown} payload
 */
function _sendToMain(channel, payload) {
  _mainWindow()?.webContents.send(channel, payload);
}

module.exports = {
  init,
  cleanup,
  reloadPrayerData,
  getPrayerData,
  getPrayerDataWhenReady,
  onDataChange,
};
