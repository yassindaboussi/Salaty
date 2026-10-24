"use strict";

// A Hijri month's days, from the main process: Aladhan's calendar (cached on disk), or, offline
// and never loaded, calculated on the computer. The Settings correction (-2…+2 days) is already
// applied there.
const { ipcRenderer } = require("electron");
const { t } = require("../../core/i18n");
const { isoOf } = require("../../core/date-format");
// the 13th-15th, not 13 Dhu al-Hijja (a day of Tashreeq)
const { isWhiteDay } = require("../../../../shared/fasting-rules");

/**
 * @typedef {object} CalendarDay
 * @property {number} hijriDay
 * @property {string} iso       the Gregorian date, "YYYY-MM-DD"
 * @property {Date} date        that day, local midnight
 * @property {string} event     the occasion's name in the UI language ("" if none)
 * @property {boolean} whiteDay one of the White Days (recommended fast)
 *
 * @typedef {object} MonthData
 * @property {number} month
 * @property {number} year
 * @property {CalendarDay[]} days
 * @property {boolean} calculated calculated offline: may differ by a day from the announcement
 */

/** @type {Map<string, MonthData>} */
const months = new Map();

/** Occasion names by "month-day" in the UI language (locales/<lang>/worship/calendar.json). */
function occasionNames() {
  const events = t("calendarEvents");
  return events && typeof events === "object" ? events : {};
}

/**
 * @param {number} month 1-12
 * @param {number} year
 * @returns {Promise<MonthData | null>} null when there is no such month (outside 1400-1600 AH)
 */
async function loadMonth(month, year) {
  const key = `${month}-${year}`;
  const known = months.get(key);
  if (known) return known;

  let entries;
  try {
    entries = await ipcRenderer.invoke("get-hijri-month", month, year);
  } catch (err) {
    console.error("Error loading the Hijri month:", err);
    return null;
  }
  if (!Array.isArray(entries) || !entries.length) return null;

  const names = occasionNames();
  const days = entries.map((entry) => {
    const [d, m, y] = String(entry.gregorian.date).split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const hijriDay = Number(entry.hijri.day);
    return {
      hijriDay,
      iso: isoOf(date),
      date,
      event: names[`${month}-${hijriDay}`] ?? "",
      whiteDay: isWhiteDay(month, hijriDay),
    };
  });
  const data = {
    month,
    year,
    days,
    calculated: entries.some((e) => e.hijri?.method === "calculated"),
  };
  months.set(key, data);
  return data;
}

/** Forgets the months calculated offline: once online they come from Aladhan. */
function forgetCalculated() {
  for (const [key, data] of months) if (data.calculated) months.delete(key);
}

/**
 * Today's Hijri month and year.
 * @returns {Promise<{ month: number, year: number } | null>}
 */
async function todaysMonth() {
  const now = new Date();
  try {
    const data = await ipcRenderer.invoke(
      "gregorian-to-hijri",
      now.getDate(),
      now.getMonth() + 1,
      now.getFullYear(),
    );
    const month = Number(data?.hijri?.month?.number);
    const year = Number(data?.hijri?.year);
    return month && year ? { month, year } : null;
  } catch (err) {
    console.error("Error loading today's Hijri date:", err);
    return null;
  }
}

/**
 * The month `by` months after (or before, when negative) a Hijri month.
 * @param {number} month @param {number} year @param {number} by
 */
function shiftMonth(month, year, by) {
  const index = year * 12 + (month - 1) + by;
  return { month: (index % 12) + 1, year: Math.floor(index / 12) };
}

module.exports = { loadMonth, forgetCalculated, todaysMonth, shiftMonth };
