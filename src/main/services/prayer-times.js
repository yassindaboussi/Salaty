"use strict";

// Prayer timetables for the saved location (Aladhan, through the cached client in
// aladhan.js), so the adhan and every page keep working without internet (e.g. the app
// starting with Windows before Wi-Fi is up, travelling).
//
// Monthly calendars are the unit: the same data and calculation method as Aladhan's
// single-day endpoint. Refreshed in the background once a day; from the 20th the next month
// is downloaded ahead of time, so offline the cache covers the rest of the month and the next
// one (~5 weeks).
const aladhan = require("./aladhan");
const { locationQuery } = require("../../shared/aladhan");

/**
 * One day for the location, in the shape of Aladhan's single-day endpoint.
 * @typedef {{ timings: Record<string, string>, date: any, meta: any }} PrayerDay
 * @typedef {{ city?: string, country?: string }} LocationSettings the saved settings (city, country)
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const PREFETCH_FROM_DAY = 20;

/** @type {Set<() => void>} */
const listeners = new Set();

/**
 * "05:12 (CET)" -> "05:12": the format of Aladhan's single-day endpoint, used everywhere.
 * @param {any} day a day of an Aladhan calendar
 * @returns {PrayerDay}
 */
function cleanDay(day) {
  /** @type {Record<string, string>} */
  const timings = {};
  for (const [name, value] of Object.entries(day.timings)) {
    timings[name] = String(value).split(" ")[0];
  }
  return { timings, date: day.date, meta: day.meta };
}

/** @param {any} data */
const isTimetable = (data) =>
  Array.isArray(data) &&
  data.length >= 28 &&
  data.every(
    (d) => typeof d?.timings?.Fajr === "string" && d?.date?.gregorian?.date,
  );

const notify = () => {
  for (const listener of listeners) listener();
};

/**
 * @param {string} key
 * @returns {Promise<PrayerDay[] | null>}
 */
async function timetable(key) {
  const days = await aladhan.get(key, {
    maxAgeMs: DAY_MS,
    validate: isTimetable,
    onRefresh: notify,
  });
  return days ? days.map(cleanDay) : null;
}

/**
 * @param {LocationSettings} settings
 * @param {number} year
 * @param {number} month
 */
const monthKey = (settings, year, month) =>
  `/calendarByCity?${locationQuery(settings)}&month=${month}&year=${year}`;

/**
 * The days of one Gregorian month for the location.
 * @param {LocationSettings} settings
 * @param {number} year
 * @param {number} month 1-12
 * @returns {Promise<PrayerDay[] | null>} null when offline with nothing cached
 */
function getMonth(settings, year, month) {
  if (!settings?.city || !settings?.country) return Promise.resolve(null);
  return timetable(monthKey(settings, year, month));
}

/**
 * The days of one Hijri month for the location (the Ramadan page: month 9).
 * @param {LocationSettings} settings
 * @param {number} hijriYear
 * @param {number} hijriMonth 1-12
 * @returns {Promise<PrayerDay[] | null>} null when offline with nothing cached
 */
function getHijriMonth(settings, hijriYear, hijriMonth) {
  if (!settings?.city || !settings?.country) return Promise.resolve(null);
  return timetable(
    `/hijriCalendarByCity/${hijriYear}/${hijriMonth}?${locationQuery(settings)}`,
  );
}

/**
 * { year, month, iso: "DD-MM-YYYY" } of a moment in a time zone (the PC's if it is unknown).
 * @param {string | undefined} timeZone IANA name, e.g. "Africa/Tunis"
 * @param {Date} [at]
 */
function dateIn(timeZone, at = new Date()) {
  /** @type {Intl.DateTimeFormatOptions} */
  const options = { day: "2-digit", month: "2-digit", year: "numeric" };
  let parts;
  try {
    parts = new Intl.DateTimeFormat("en-GB", {
      ...options,
      timeZone,
    }).formatToParts(at);
  } catch {
    parts = new Intl.DateTimeFormat("en-GB", options).formatToParts(at);
  }
  /** @param {Intl.DateTimeFormatPartTypes} type */
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    iso: `${get("day")}-${get("month")}-${get("year")}`,
  };
}

/**
 * Today's times, date and meta for the location, in the shape of Aladhan's single-day
 * endpoint. "Today" is the location's own date (its time zone), like Aladhan's.
 * @param {LocationSettings} settings
 * @param {Date} [at]
 * @returns {Promise<PrayerDay | null>} null when offline with nothing cached
 */
async function getToday(settings, at = new Date()) {
  const local = dateIn(undefined, at);
  let days = await getMonth(settings, local.year, local.month);
  if (!days) return null;

  const today = dateIn(days[0]?.meta?.timezone, at);
  if (today.year !== local.year || today.month !== local.month) {
    // the location is already in another month than the PC (time zones)
    days = (await getMonth(settings, today.year, today.month)) ?? days;
  }
  const day = days.find((d) => d.date.gregorian.date === today.iso) ?? null;

  // download next month ahead, so the first days of next month also work offline
  if (Number(today.iso.slice(0, 2)) >= PREFETCH_FROM_DAY) {
    const nextYear = today.month === 12 ? today.year + 1 : today.year;
    const nextMonth = today.month === 12 ? 1 : today.month + 1;
    if (!aladhan.has(monthKey(settings, nextYear, nextMonth))) {
      getMonth(settings, nextYear, nextMonth).catch(() => {});
    }
  }
  return day;
}

/**
 * Called when a background refresh brought different times (e.g. a corrected calendar), so
 * the adhan timer can re-read today.
 * @param {() => void} listener
 */
function onChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

module.exports = { getMonth, getHijriMonth, getToday, onChange };
