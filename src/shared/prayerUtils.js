/**
 * prayerUtils.js — shared between main process and renderer
 * Contains prayer-time calculation logic used by both.
 */

"use strict";

const PRAYER_KEYS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

/**
 * Convert "HH:MM" → total seconds from midnight.
 */
function secondsFromTime(t) {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 3600 + m * 60;
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

module.exports = {
  PRAYER_KEYS,
  secondsFromTime,
  formatTime,
  getCurrentAndNext,
};
