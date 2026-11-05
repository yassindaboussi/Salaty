"use strict";

// What the Monthly Prayer Times page shows now (shared by its modules).

/**
 * @typedef {"Fajr" | "Sunrise" | "Dhuhr" | "Asr" | "Maghrib" | "Isha"} TimeKey
 *
 * @typedef {object} MonthDay
 * @property {string} iso      the Gregorian date, "YYYY-MM-DD"
 * @property {Date} date       that day, local midnight
 * @property {boolean} friday
 * @property {{ day: number, month: number, year: number }} hijri  with the Settings correction
 * @property {Record<TimeKey, string>} times  "HH:MM"
 *
 * @typedef {object} MonthMethod  how the times were calculated (Aladhan picks it for the place)
 * @property {number | null} id    Aladhan's method id, null when unknown
 * @property {string} name         Aladhan's English name (used when the id has no translation)
 * @property {boolean} hanafi      Asr when a shadow is twice its length (else once: the majority)
 *
 * @typedef {object} Month
 * @property {MonthDay[]} days
 * @property {MonthMethod | null} method
 */

/** The columns of the timetable, in order (Sunrise: when Fajr's time ends). */
const TIME_KEYS = /** @type {TimeKey[]} */ ([
  "Fajr",
  "Sunrise",
  "Dhuhr",
  "Asr",
  "Maghrib",
  "Isha",
]);

const view = {
  year: 0,
  month: 0, // 1-12
  todayIso: "",
  selectedIso: "",
  /** @type {MonthDay[]} */
  days: [],
  /** @type {MonthMethod | null} */
  method: null,
};

module.exports = { view, TIME_KEYS };
