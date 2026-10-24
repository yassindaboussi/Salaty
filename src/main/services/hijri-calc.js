"use strict";

// Hijri dates computed on this computer, without internet: the Umm al-Qura calendar built into
// the JavaScript engine (Intl / ICU "islamic-umalqura", tables for 1300-1600 AH). Aladhan's
// default method (HJCoSA) is this same calendar, except for the months where Saudi Arabia
// announced a different start, so it is only used when Aladhan cannot be reached and the answer
// was never cached. The results have the shape of Aladhan's answers (hijri + gregorian).
//
// Days are UTC midnights (ms): a calendar day, never a moment, so time zones cannot shift it.

const DAY_MS = 24 * 60 * 60 * 1000;
/** hijri.method of a calculated date (Aladhan's say e.g. "HJCoSA") */
const CALCULATED = "calculated";

// Aladhan's names, so a calculated date looks like a downloaded one
const HIJRI_MONTHS = [
  ["Muḥarram", "مُحَرَّم"],
  ["Ṣafar", "صَفَر"],
  ["Rabīʿ al-awwal", "رَبيع الأوّل"],
  ["Rabīʿ al-thānī", "رَبيع الثاني"],
  ["Jumādá al-ūlá", "جُمادى الأولى"],
  ["Jumādá al-ākhirah", "جُمادى الآخرة"],
  ["Rajab", "رَجَب"],
  ["Shaʿbān", "شَعْبان"],
  ["Ramaḍān", "رَمَضان"],
  ["Shawwāl", "شَوّال"],
  ["Dhū al-Qaʿdah", "ذوالقعدة"],
  ["Dhū al-Ḥijjah", "ذوالحجة"],
];
// [Gregorian, Hijri (en), Hijri (ar)], Sunday first like Date#getUTCDay
const WEEKDAYS = [
  ["Sunday", "Al Ahad", "الاحد"],
  ["Monday", "Al Athnayn", "الاثنين"],
  ["Tuesday", "Al Thalaata", "الثلاثاء"],
  ["Wednesday", "Al Arba'a", "الاربعاء"],
  ["Thursday", "Al Khamees", "الخميس"],
  ["Friday", "Al Juma'a", "الجمعة"],
  ["Saturday", "Al Sabt", "السبت"],
];
const GREGORIAN_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const umalqura = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const pad2 = (/** @type {number} */ n) => String(n).padStart(2, "0");
const dmy = (
  /** @type {number} */ day,
  /** @type {number} */ month,
  /** @type {number} */ year,
) => `${pad2(day)}-${pad2(month)}-${year}`;

/** @param {number} day @param {number} days */
const addDays = (day, days) => day + days * DAY_MS;

/**
 * "DD-MM-YYYY" (Aladhan's Gregorian dates) -> the day, or null.
 * @param {string} text
 */
function parseDmy(text) {
  const [d, m, y] = String(text).split("-").map(Number);
  return d && m && y ? Date.UTC(y, m - 1, d) : null;
}

/** @param {number} day */
const dmyOf = (day) => {
  const d = new Date(day);
  return dmy(d.getUTCDate(), d.getUTCMonth() + 1, d.getUTCFullYear());
};

/**
 * Aladhan's `gregorian` part for a day.
 * @param {number} day
 */
function gregorianFields(day) {
  const d = new Date(day);
  return {
    date: dmyOf(day),
    format: "DD-MM-YYYY",
    day: pad2(d.getUTCDate()),
    weekday: { en: WEEKDAYS[d.getUTCDay()][0] },
    month: {
      number: d.getUTCMonth() + 1,
      en: GREGORIAN_MONTHS[d.getUTCMonth()],
    },
    year: String(d.getUTCFullYear()),
    designation: { abbreviated: "AD", expanded: "Anno Domini" },
    lunarSighting: false,
  };
}

/**
 * The Umm al-Qura date of a day.
 * @param {number} day
 */
function hijriParts(day) {
  const parts = umalqura.formatToParts(new Date(day));
  /** @param {Intl.DateTimeFormatPartTypes} type */
  const get = (type) => Number(parts.find((p) => p.type === type)?.value);
  return { day: get("day"), month: get("month"), year: get("year") };
}

/**
 * Day 1 of a Hijri month, or null outside the calendar's range. The arithmetic (civil) Hijri
 * calendar gives the start within two days; the search around it finds Umm al-Qura's.
 * @param {number} month 1-12
 * @param {number} year
 */
function monthStart(month, year) {
  const civilDays =
    (year - 1) * 354 +
    Math.floor((3 + 11 * year) / 30) +
    Math.ceil(29.5 * (month - 1));
  const guess = (civilDays - 492148) * DAY_MS; // 1 Muharram 1 AH (civil) = 492148 days before 1970
  for (let i = -3; i <= 3; i++) {
    const day = addDays(guess, i);
    const h = hijriParts(day);
    if (h.day === 1 && h.month === month && h.year === year) return day;
  }
  return null;
}

/** @param {number} start day 1 of the month */
const monthLength = (start) =>
  hijriParts(addDays(start, 29)).day === 30 ? 30 : 29;

/**
 * An Aladhan-shaped { hijri, gregorian } for a day.
 * @param {number} day
 */
function dateEntry(day) {
  const h = hijriParts(day);
  const start = addDays(day, 1 - h.day);
  const [en, ar] = HIJRI_MONTHS[h.month - 1];
  const weekday = WEEKDAYS[new Date(day).getUTCDay()];
  return {
    hijri: {
      date: dmy(h.day, h.month, h.year),
      format: "DD-MM-YYYY",
      day: String(h.day),
      weekday: { en: weekday[1], ar: weekday[2] },
      month: { number: h.month, en, ar, days: monthLength(start) },
      year: String(h.year),
      designation: { abbreviated: "AH", expanded: "Anno Hegirae" },
      holidays: [],
      adjustedHolidays: [],
      method: CALCULATED,
    },
    gregorian: gregorianFields(day),
  };
}

/**
 * Like Aladhan's /gToH. Null outside the calendar's range.
 * @param {number} day
 */
function gregorianToHijri(day) {
  return hijriParts(day).year ? dateEntry(day) : null;
}

/**
 * Like Aladhan's /hToG (day 30 of a 29-day month is the next month's 1st, as there).
 * @param {number} day 1-30
 * @param {number} month 1-12
 * @param {number} year
 */
function hijriToGregorian(day, month, year) {
  const start = monthStart(month, year);
  return start === null ? null : dateEntry(addDays(start, day - 1));
}

/**
 * Like Aladhan's /hToGCalendar: every day of a Hijri month.
 * @param {number} month 1-12
 * @param {number} year
 */
function monthCalendar(month, year) {
  const start = monthStart(month, year);
  if (start === null) return null;
  return Array.from({ length: monthLength(start) }, (_, i) =>
    dateEntry(addDays(start, i)),
  );
}

module.exports = {
  CALCULATED,
  addDays,
  parseDmy,
  dmyOf,
  gregorianFields,
  gregorianToHijri,
  hijriToGregorian,
  monthCalendar,
};
