"use strict";

// The Ramadan fasts the user marked (Ramadan page) and the missed ones still to make up (also
// on the Sunnah fasting page), in this computer's page storage (localStorage, kept across
// updates; storage-migration.js moved it to app://): per Ramadan, each day fasted or missed,
// and how many of the missed fasts were made up (qada) since. A missed fast is owed until it
// is made up, normally before the next Ramadan, so the count carries over to the next years.
//
// Before: "ramadanTracker_<year>" = the fasted days only, as Aladhan's day strings ("01").

/** @typedef {"fasted" | "missed"} FastStatus */
/** @typedef {{ days: Record<string, FastStatus>, madeUp: number }} YearRecord */

const KEY = "ramadanFasts_";
const OLD_KEY = "ramadanTracker_";
const STATUSES = new Set(["fasted", "missed"]);

/** @param {YearRecord} record */
const missedOf = (record) =>
  Object.values(record.days).filter((s) => s === "missed").length;

/**
 * A record read back, with anything unexpected dropped.
 * @param {any} value
 * @returns {YearRecord}
 */
function clean(value) {
  /** @type {Record<string, FastStatus>} */
  const days = {};
  for (const [day, status] of Object.entries(value?.days ?? {})) {
    const n = Number(day);
    if (Number.isInteger(n) && n >= 1 && n <= 30 && STATUSES.has(status)) {
      days[n] = status;
    }
  }
  const record = { days, madeUp: 0 };
  const madeUp = Number(value?.madeUp);
  record.madeUp = Number.isInteger(madeUp)
    ? Math.max(0, Math.min(madeUp, missedOf(record)))
    : 0;
  return record;
}

/** @param {number} year @returns {YearRecord} */
function read(year) {
  try {
    const saved = localStorage.getItem(KEY + year);
    if (saved) return clean(JSON.parse(saved));
    const old = localStorage.getItem(OLD_KEY + year);
    if (old) {
      const fasted = JSON.parse(old);
      return clean({
        days: Object.fromEntries(
          (Array.isArray(fasted) ? fasted : []).map((d) => [
            Number(d),
            "fasted",
          ]),
        ),
      });
    }
  } catch (err) {
    console.error("Error reading the Ramadan tracker:", err);
  }
  return { days: {}, madeUp: 0 };
}

/** @param {number} year @param {YearRecord} record */
function write(year, record) {
  try {
    localStorage.setItem(KEY + year, JSON.stringify(record));
  } catch (err) {
    console.error("Error saving the Ramadan tracker:", err);
  }
}

/**
 * Marks a day (or clears it with null).
 * @param {number} year @param {number} day @param {FastStatus | null} status
 */
function setStatus(year, day, status) {
  const record = read(year);
  if (status) record.days[day] = status;
  else delete record.days[day];
  write(year, clean(record));
}

/** Every saved Ramadan up to `year`, oldest first, with what is still owed. @param {number} year */
function savedYears(year) {
  /** @type {Set<number>} */
  const years = new Set();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const match = /^ramadanFasts_(\d{4})$/.exec(localStorage.key(i) ?? "");
      if (match && Number(match[1]) <= year) years.add(Number(match[1]));
    }
  } catch {
    // storage unavailable: nothing saved
  }
  return [...years]
    .sort((a, b) => a - b)
    .map((y) => {
      const record = read(y);
      return { year: y, record, owed: missedOf(record) - record.madeUp };
    });
}

/**
 * Fasts still to make up, from every Ramadan up to `year`.
 * @param {number} year
 */
function makeUpTotals(year) {
  const years = savedYears(year);
  return {
    owed: years.reduce((sum, y) => sum + y.owed, 0),
    madeUp: years.reduce((sum, y) => sum + y.record.madeUp, 0),
  };
}

/**
 * One more made up (+1, the oldest Ramadan first) or one less (-1, the latest first).
 * @param {number} year @param {1 | -1} by
 */
function changeMadeUp(year, by) {
  const years = savedYears(year);
  const target =
    by > 0
      ? years.find((y) => y.owed > 0)
      : years.reverse().find((y) => y.record.madeUp > 0);
  if (!target) return;
  target.record.madeUp += by;
  write(target.year, target.record);
}

module.exports = { read, setStatus, makeUpTotals, changeMadeUp };
