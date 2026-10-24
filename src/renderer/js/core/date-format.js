"use strict";

// Dates, times and durations as the pages write them: in the UI language, with Western digits
// like the rest of the app (Intl, "-u-nu-latn"). Days are local dates (midnight).
const { t, getLocaleTag } = require("./i18n");
const { hijriMonthName } = require("./dates");

const pad2 = (/** @type {number} */ n) => String(n).padStart(2, "0");
const locale = () => `${getLocaleTag()}-u-nu-latn`;

/** "YYYY-MM-DD" of a local date. @param {Date} date */
const isoOf = (date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const todayIso = () => isoOf(new Date());

/** @param {Date} date @param {number} days */
const addDays = (date, days) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/**
 * Aladhan's "DD-MM-YYYY" as a local date.
 * @param {string} text
 */
function parseDmy(text) {
  const [d, m, y] = String(text).split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * The moment a "HH:MM" time happens on a day.
 * @param {Date} day
 * @param {string} time
 */
function timeOn(day, time) {
  const [h, m] = String(time).split(":").map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
}

/**
 * Whole days from one date to another (calendar days: a daylight-saving change in between
 * does not add or remove one).
 * @param {Date} from @param {Date} to
 */
const daysBetween = (from, to) =>
  Math.round(
    (Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) -
      Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) /
      86_400_000,
  );

/** @param {Intl.DateTimeFormatOptions} options */
const formatter = (options) => new Intl.DateTimeFormat(locale(), options);

/** @param {Date} date @param {Intl.DateTimeFormatOptions} options */
const gregorian = (date, options) => formatter(options).format(date);

/** "12 Oct – 10 Nov 2026" @param {Date} first @param {Date} last */
const gregorianRange = (first, last, options = {}) =>
  formatter({
    day: "numeric",
    month: "short",
    year: "numeric",
    ...options,
  }).formatRange(first, last);

/** "8 Jumada al-Awwal 1448 AH" @param {number} day @param {number} month @param {number} year */
const hijriDate = (day, month, year) =>
  `${day} ${hijriMonthName(month)} ${year} ${t("ah")}`;

/**
 * A weekday's name.
 * @param {number} day Date#getDay number
 * @param {"long" | "short" | "narrow"} style
 */
const weekdayName = (day, style) =>
  gregorian(new Date(1970, 0, 4 + day), { weekday: style }); // 4 Jan 1970 was a Sunday

/**
 * A duration in the UI language, with its plural forms: "112 days", "12 h 4 min", "3:05:12".
 * @param {{ days?: number, hours?: number, minutes?: number, seconds?: number }} parts
 * @param {"long" | "short" | "narrow" | "digital"} style
 */
function duration(parts, style) {
  /** @type {any} Intl.DurationFormat is newer than TypeScript's lib */
  const Format = /** @type {any} */ (Intl).DurationFormat;
  if (typeof Format === "function") {
    return new Format(locale(), { style }).format(parts);
  }
  const { days = 0, hours = 0, minutes = 0, seconds = 0 } = parts;
  return style === "digital"
    ? `${hours}:${pad2(minutes)}:${pad2(seconds)}`
    : [days && `${days} d`, hours && `${hours} h`, minutes && `${minutes} min`]
        .filter(Boolean)
        .join(" ");
}

/**
 * "today", "tomorrow", "in 3 days", "2 days ago" in the UI language (Intl.RelativeTimeFormat:
 * correct plurals in Arabic and French too).
 * @param {number} days from today
 */
const relativeDays = (days) =>
  new Intl.RelativeTimeFormat(locale(), { numeric: "auto" }).format(
    days,
    "day",
  );

module.exports = {
  relativeDays,
  isoOf,
  todayIso,
  addDays,
  parseDmy,
  timeOn,
  daysBetween,
  gregorian,
  gregorianRange,
  hijriDate,
  weekdayName,
  duration,
};
