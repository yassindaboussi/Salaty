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
const { ALADHAN_API, locationQuery } = require("../../shared/aladhan");
const log = require("./logger").logger("Prayer");
const { bringToFrontForAdhan } = require("../windows/main-window");

let getMainWindow = () => null;
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

const ADHAN_TOLERANCE_SEC = 900;

// getMainWindowFn / settingsFn: return the main window and the settings when called.
function init(getMainWindowFn, settingsFn) {
  getMainWindow = getMainWindowFn;
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

function _registerIpcHandlers() {
  secureIpc.on("prayer-data-updated", (_ev, data) => {
    if (data) {
      prayerData = data;
      currentPrayerKey = null;
    }
  });

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

async function _loadPrayerData() {
  const settings = getSettingsData?.();

  try {
    const url = `${ALADHAN_API}/timingsByCity?${locationQuery(settings)}`;
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
  } catch (err) {
    // offline or API down: keep yesterday's data; the midnight/location reload tries again
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
  const msLeft = midnight - now;
  midnightTimer = setTimeout(() => {
    _loadPrayerData().then(_scheduleMidnightReload);
  }, msLeft);
}

function _mainWindow() {
  const w = getMainWindow();
  return w && !w.isDestroyed() ? w : null;
}

function _sendToMain(channel, payload) {
  _mainWindow()?.webContents.send(channel, payload);
}

module.exports = { init, cleanup, reloadPrayerData, getPrayerData };
