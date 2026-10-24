"use strict";

// The Sunnah fasts the user marked as done, in this computer's page storage (localStorage):
// { "YYYY-MM-DD": "year-month-day" (Hijri) }. The Hijri date is kept so the counts per Hijri
// month (this month, the six of Shawwal) do not depend on the dates loaded. Two years are kept.

const KEY = "sunnahFasts";
const KEEP_DAYS = 730;

/** @returns {Record<string, string>} */
function read() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  } catch {
    return {};
  }
}

/** @param {Record<string, string>} marks */
function write(marks) {
  const oldest = new Date(Date.now() - KEEP_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const kept = Object.fromEntries(
    Object.entries(marks).filter(
      ([iso, hijri]) =>
        /^\d{4}-\d{2}-\d{2}$/.test(iso) &&
        iso >= oldest &&
        typeof hijri === "string",
    ),
  );
  try {
    localStorage.setItem(KEY, JSON.stringify(kept));
  } catch (err) {
    console.error("Error saving the Sunnah fasts:", err);
  }
}

/** @param {string} iso */
const isFasted = (iso) => Object.hasOwn(read(), iso);

/**
 * Marks a day as fasted, or clears it.
 * @param {import("./data").FastDay} day @param {boolean} fasted
 */
function setFasted(day, fasted) {
  const marks = read();
  if (fasted)
    marks[day.iso] = `${day.hijri.year}-${day.hijri.month}-${day.hijri.day}`;
  else delete marks[day.iso];
  write(marks);
}

/**
 * Fasts marked in a Hijri month (from a given day: the six of Shawwal start on the 2nd).
 * @param {number} year @param {number} month @param {number} [fromDay]
 */
function countIn(year, month, fromDay = 1) {
  return Object.values(read()).filter((hijri) => {
    const [y, m, d] = hijri.split("-").map(Number);
    return y === year && m === month && d >= fromDay;
  }).length;
}

module.exports = { isFasted, setFasted, countIn };
