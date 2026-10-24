"use strict";

// What the Sunnah fasting page shows.
const view = {
  /** @type {import("./data").FastDay[]} the fasting days and the days not to fast */
  days: [],
  /** "YYYY-MM-DD" of the day drawn as today (it changes at midnight) */
  todayIso: "",
  /** today's Hijri date, for this month's counts */
  /** @type {{ day: number, month: number, year: number } | null} */
  todayHijri: null,
  /** the reminders: settings.fastingReminders */
  prefs: {
    types: /** @type {string[]} */ ([]),
    evening: true,
    suhoor: false,
    suhoorMinutes: 30,
  },
};

module.exports = { view };
