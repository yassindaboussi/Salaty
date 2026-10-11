"use strict";

// Hijri <-> Gregorian conversions (Aladhan, through the cached client in aladhan.js), so the
// Hijri calendar, the Ramadan countdown and the fasting reminders also work offline.
// A conversion hardly ever changes (only when Aladhan adjusts its calendar), so a cached one
// is refreshed in the background once a week.
const aladhan = require("./aladhan");

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const pad2 = (n) => String(n).padStart(2, "0");
const dmy = (day, month, year) => `${pad2(day)}-${pad2(month)}-${year}`;
const options = (validate) => ({ maxAgeMs: WEEK_MS, validate });

/** Aladhan's { gregorian, hijri } for a Gregorian date. Null when offline and not cached. */
function gregorianToHijri(day, month, year) {
  return aladhan.get(
    `/gToH/${dmy(day, month, year)}`,
    options((d) => Boolean(d?.hijri?.month?.number)),
  );
}

/** Aladhan's { gregorian, hijri } for a Hijri date. Null when offline and not cached. */
function hijriToGregorian(day, month, year) {
  return aladhan.get(
    `/hToG/${dmy(day, month, year)}`,
    options((d) => Boolean(d?.gregorian?.date)),
  );
}

/** Every day of a Hijri month with its Gregorian date. Null when offline and not cached. */
function hijriMonthCalendar(month, year) {
  return aladhan.get(
    `/hToGCalendar/${month}/${year}`,
    options((d) => Array.isArray(d) && d.length >= 29),
  );
}

module.exports = { gregorianToHijri, hijriToGregorian, hijriMonthCalendar };
