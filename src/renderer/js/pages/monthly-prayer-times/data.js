"use strict";

// A month's prayer times from the main process, which keeps the months on disk (works
// offline once loaded). Each day also gets its Hijri date with the Settings correction
// (-2…+2 days): the Hijri date of a day is Aladhan's Hijri date of `adjustment` days later.
const { ipcRenderer } = require("electron");
const { state } = require("../../core/store");
const { isoOf } = require("../../core/date-format");
const { cleanTime } = require("../../../../shared/prayerUtils");
const { locationQuery } = require("../../../../shared/aladhan");
const { TIME_KEYS } = require("./state");

/** @type {Map<string, import("./state").Month>} */
const cache = new Map();

/** The saved correction in days (0 when unset or not valid), as in the main process. */
function adjustment() {
  const n = state.settings.hijriAdjustment;
  return typeof n === "number" && Number.isInteger(n) && Math.abs(n) <= 2
    ? n
    : 0;
}

/** @param {any} hijri Aladhan's hijri object */
const hijriOf = (hijri) => ({
  day: Number(hijri.day),
  month: Number(hijri.month.number),
  year: Number(hijri.year),
});

/**
 * The corrected Hijri date of the day at `index`: from the same month when the shifted day is in
 * it, else asked from the main process (one or two days at the month's edges).
 * @param {any[]} entries @param {number} index
 */
async function correctedHijri(entries, index) {
  const shift = adjustment();
  const other = entries[index + shift];
  if (other) return hijriOf(other.date.hijri);
  const [d, m, y] = String(entries[index].date.gregorian.date)
    .split("-")
    .map(Number);
  const data = await ipcRenderer.invoke("gregorian-to-hijri", d, m, y);
  return data?.hijri ? hijriOf(data.hijri) : hijriOf(entries[index].date.hijri);
}

/**
 * @param {number} year @param {number} month 1-12
 * @returns {Promise<import("./state").Month | null>} null when offline with nothing saved
 */
async function loadMonth(year, month) {
  // the location and the correction are part of the key: a change never reuses another's month
  const key = `${year}-${month}|${locationQuery(state.settings)}|${adjustment()}`;
  const known = cache.get(key);
  if (known) return known;

  const entries = await ipcRenderer.invoke("get-prayer-month", year, month);
  if (!Array.isArray(entries) || !entries.length) return null;

  const days = await Promise.all(
    entries.map(async (entry, i) => {
      const [d, m, y] = String(entry.date.gregorian.date)
        .split("-")
        .map(Number);
      const date = new Date(y, m - 1, d);
      // Aladhan's weekday is for the calendar date (no time-zone question)
      const weekday = entry.date.gregorian.weekday?.en;
      const times = /** @type {Record<import("./state").TimeKey, string>} */ (
        Object.fromEntries(
          TIME_KEYS.map((k) => [k, cleanTime(entry.timings[k])]),
        )
      );
      return {
        iso: isoOf(date),
        date,
        friday: weekday ? weekday === "Friday" : date.getDay() === 5,
        hijri: await correctedHijri(entries, i),
        times,
      };
    }),
  );
  const result = { days, method: methodOf(entries[0]?.meta) };
  cache.set(key, result);
  return result;
}

/** @param {any} meta Aladhan's meta of a day @returns {import("./state").MonthMethod | null} */
function methodOf(meta) {
  const method = meta?.method;
  if (!method) return null;
  return {
    id: Number.isInteger(method.id) ? method.id : null,
    name: String(method.name ?? ""),
    hanafi: String(meta.school ?? "").toUpperCase() === "HANAFI",
  };
}

module.exports = { loadMonth };
