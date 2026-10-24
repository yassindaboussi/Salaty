"use strict";

// Hijri <-> Gregorian conversions (Aladhan, through the cached client in aladhan.js), so the
// Hijri calendar, the Ramadan countdown and the fasting reminders also work offline.
// A conversion hardly ever changes (only when Aladhan adjusts its calendar), so a cached one
// is refreshed in the background once a week. Offline with nothing cached, the date is
// calculated (hijri-calc.js, the same Umm al-Qura calendar).
//
// `adjustment` is the Settings "Hijri date" correction, -2…+2 days: where the month is seen to
// start a day earlier (+1) or later (-1) than in Saudi Arabia. The Hijri date of a day is then
// Aladhan's Hijri date of `adjustment` days later.
const aladhan = require("./aladhan");
const calc = require("./hijri-calc");

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const pad2 = (n) => String(n).padStart(2, "0");
const dmy = (day, month, year) => `${pad2(day)}-${pad2(month)}-${year}`;
const options = (validate) => ({ maxAgeMs: WEEK_MS, validate });

/**
 * The saved correction in days (0 when unset or not valid).
 * @param {{ hijriAdjustment?: unknown } | null | undefined} settings
 */
function adjustmentOf(settings) {
  const n = settings?.hijriAdjustment;
  return typeof n === "number" && Number.isInteger(n) && Math.abs(n) <= 2
    ? n
    : 0;
}

/** Moves an Aladhan-shaped date's Gregorian side by `days`. */
const moveGregorian = (entry, days) => ({
  ...entry,
  gregorian: calc.gregorianFields(
    calc.addDays(Number(calc.parseDmy(entry.gregorian.date)), days),
  ),
});

/**
 * { gregorian, hijri } for a Gregorian date. Null only outside the calendar's range.
 * @param {number} day @param {number} month @param {number} year
 * @param {number} [adjustment]
 */
async function gregorianToHijri(day, month, year, adjustment = 0) {
  const asked = Date.UTC(year, month - 1, day);
  const date = calc.addDays(asked, adjustment);
  const data =
    (await aladhan.get(
      `/gToH/${calc.dmyOf(date)}`,
      options((d) => Boolean(d?.hijri?.month?.number)),
    )) ?? calc.gregorianToHijri(date);
  return data && adjustment ? moveGregorian(data, -adjustment) : data;
}

/**
 * { gregorian, hijri } for a Hijri date. Null only outside the calendar's range.
 * @param {number} day @param {number} month @param {number} year
 * @param {number} [adjustment]
 */
async function hijriToGregorian(day, month, year, adjustment = 0) {
  const data =
    (await aladhan.get(
      `/hToG/${dmy(day, month, year)}`,
      options((d) => Boolean(d?.gregorian?.date)),
    )) ?? calc.hijriToGregorian(day, month, year);
  return data && adjustment ? moveGregorian(data, -adjustment) : data;
}

/**
 * Every day of a Hijri month with its Gregorian date. Null only outside the calendar's range.
 * @param {number} month @param {number} year
 * @param {number} [adjustment]
 */
async function hijriMonthCalendar(month, year, adjustment = 0) {
  const days =
    (await aladhan.get(
      `/hToGCalendar/${month}/${year}`,
      options((d) => Array.isArray(d) && d.length >= 29),
    )) ?? calc.monthCalendar(month, year);
  return days && adjustment
    ? days.map((d) => moveGregorian(d, -adjustment))
    : days;
}

module.exports = {
  adjustmentOf,
  gregorianToHijri,
  hijriToGregorian,
  hijriMonthCalendar,
};
