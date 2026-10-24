"use strict";

// What the Hijri calendar page shows.
const view = {
  /** the Hijri month shown */
  month: 1,
  year: 1448,
  /** the grid's first column, a Date#getDay number (core/week.js) */
  firstDay: 1,
  /** "YYYY-MM-DD" of the selected day */
  selectedIso: "",
  /** "YYYY-MM-DD" of the day drawn as today (it changes at midnight) */
  todayIso: "",
  /** @type {import("./month-data").MonthData | null} the month shown */
  data: null,
};

module.exports = { view };
