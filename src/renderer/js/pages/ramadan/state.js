"use strict";

// What the Ramadan page shows.
const view = {
  /** the Hijri year of the Ramadan shown (this one, or the next after Ramadan) */
  year: 0,
  /** @type {import("./data").RamadanDay[]} */
  days: [],
  /** "YYYY-MM-DD" of the day drawn as today (it changes at midnight) */
  todayIso: "",
  /** today is 1 Shawwal (Eid al-Fitr), from today's Hijri date */
  eidToday: false,
  /** the Ramadan day shown in the side panel (1-30) */
  selectedDay: 1,
};

module.exports = { view };
