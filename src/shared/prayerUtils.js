/**
 * prayerUtils.js — shared between main process and renderer
 * Contains prayer-time calculation logic used by both.
 */

"use strict";

const PRAYER_KEYS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

/**
 * Aladhan times can carry a time-zone suffix ("05:12 (CET)"): keep "HH:MM".
 * Missing times read "--:--".
 */
function cleanTime(raw) {
  if (!raw) return "--:--";
  return String(raw).split(" ")[0];
}

/**
 * Convert "HH:MM" (suffix allowed) → total seconds from midnight. Unreadable parts count as 0.
 */
function secondsFromTime(t) {
  if (!t) return 0;
  const [h, m] = cleanTime(t).split(":").map(Number);
  return (h || 0) * 3600 + (m || 0) * 60;
}

/**
 * Seconds elapsed since local midnight.
 */
function secondsSinceMidnight(date = new Date()) {
  return date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
}

/**
 * Format a seconds duration as "HH:MM:SS".
 */
function formatTime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/**
 * Determine the current and next prayer given the time-of-day in seconds.
 *
 * @param {number} nowSec          - current time in seconds since midnight
 * @param {object} timings         - { Fajr: "05:00", Dhuhr: "12:00", … }
 * @param {string[]} [keys]        - ordered prayer keys; defaults to PRAYER_KEYS
 * @param {Function} [nameFn]      - optional (key) => localised name
 * @returns {{ currentPrayer, nextPrayer, timeRemaining }}
 */
function getCurrentAndNext(
  nowSec,
  timings,
  keys = PRAYER_KEYS,
  nameFn = (k) => k,
) {
  const list = keys
    .filter((k) => timings[k])
    .map((k) => {
      let sec = secondsFromTime(timings[k]);
      if (sec < nowSec) sec += 86400; // wrap to next day
      return { key: k, name: nameFn(k), time: timings[k], seconds: sec };
    })
    .sort((a, b) => a.seconds - b.seconds);

  if (!list.length)
    return { currentPrayer: null, nextPrayer: null, timeRemaining: 0 };

  const nextIdx = list.findIndex((p) => p.seconds > nowSec);
  const currIdx = nextIdx - 1;
  const currentPrayer = currIdx >= 0 ? list[currIdx] : list[list.length - 1];
  const nextPrayer = list[(currIdx + 1) % list.length] ?? list[0];
  const timeRemaining = Math.max(0, nextPrayer.seconds - nowSec);

  return { currentPrayer, nextPrayer, timeRemaining };
}

// ── Friday: Jumu'ah ──────────────────────────────────────────────────────────
// On Friday, Jumu'ah takes the place of Dhuhr in the same time window, so only the
// *name* changes; the calculated Dhuhr time is kept.

const JUMUAH_KEY = "Jumuah";
const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * Weekday name ("Friday", …) of `date` in the prayer location's time zone (the IANA
 * name Aladhan returns as data.meta.timezone), so a city in another zone than the PC
 * still gets its own day. Falls back to the PC clock when the zone is missing/invalid.
 */
function weekdayIn(timeZone, date = new Date()) {
  if (timeZone) {
    try {
      return new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        timeZone,
      }).format(date);
    } catch {
      /* unknown time zone: fall back to the PC clock */
    }
  }
  return WEEKDAYS[date.getDay()];
}

function isFridayIn(timeZone, date) {
  return weekdayIn(timeZone, date) === "Friday";
}

/**
 * Key to use for the prayer's *display name* only. Anything keyed by prayer
 * (adhan toggles, stored settings, timings) must keep using the original key.
 */
/**
 * @param {string} key
 * @param {{ isFriday?: boolean }} [options]
 */
function displayPrayerKey(key, { isFriday } = {}) {
  return key === "Dhuhr" && isFriday ? JUMUAH_KEY : key;
}

// ── Extra times (Settings → Show times) ─────────────────────────────────────
// Not prayers, so no adhan: Sunrise ends Fajr's time, Sunset is when the day's fast ends,
// Midnight ends Isha's preferred time, the last third of the night is for Tahajjud.
// The five prayers are always shown.

const EXTRA_TIME_KEYS = ["Sunrise", "Sunset", "Midnight", "Lastthird"];
/** @type {Record<string, boolean>} */
const DEFAULT_EXTRA_TIMES = {
  Sunrise: true,
  Sunset: false,
  Midnight: false,
  Lastthird: false,
};
const DAY_ORDER = [
  "Fajr",
  "Sunrise",
  "Dhuhr",
  "Asr",
  "Sunset",
  "Maghrib",
  "Isha",
  "Midnight",
  "Lastthird",
];

/**
 * The times to show, in the order of the day: the five prayers and the extra times turned on.
 * @param {Record<string, boolean> | undefined} extraTimes the setting (missing keys: default)
 */
function shownTimeKeys(extraTimes) {
  const on = { ...DEFAULT_EXTRA_TIMES, ...(extraTimes ?? {}) };
  return DAY_ORDER.filter((k) => PRAYER_KEYS.includes(k) || on[k] === true);
}

function isExtraTime(key) {
  return EXTRA_TIME_KEYS.includes(key);
}

module.exports = {
  EXTRA_TIME_KEYS,
  DEFAULT_EXTRA_TIMES,
  shownTimeKeys,
  isExtraTime,
  PRAYER_KEYS,
  JUMUAH_KEY,
  cleanTime,
  secondsFromTime,
  secondsSinceMidnight,
  formatTime,
  getCurrentAndNext,
  isFridayIn,
  displayPrayerKey,
};
