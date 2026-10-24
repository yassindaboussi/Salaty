"use strict";

// The Sunnah fasting days and the days not to fast, from the 1st of this Hijri month to about
// three months ahead (shared/fasting-rules.js). Hijri dates from islamic-calendar.js: cached
// Aladhan, calculated offline, with the Settings correction. Used by the Sunnah fasting page
// (IPC "get-fasting-days") and by the reminders (fasting-reminders.js).
const secureIpc = require("../ipc/secure-ipc");
const islamicCalendar = require("./islamic-calendar");
const { reasonsOn, forbiddenOn } = require("../../shared/fasting-rules");
const log = require("./logger").logger("Fasting");

/**
 * @typedef {object} FastingDay
 * @property {string} iso         Gregorian date, "YYYY-MM-DD"
 * @property {number} weekday     Date#getDay (0 = Sunday)
 * @property {{ day: number, month: number, year: number }} hijri
 * @property {import("../../shared/fasting-rules").FastType[]} reasons
 * @property {import("../../shared/fasting-rules").Forbidden | null} forbidden
 * @property {boolean} calculated  the Hijri date was calculated offline (may differ by a day)
 */

const MONTHS = 4; // this month and the next three

/** @type {(() => any) | null} */
let getSettings = null;
/** @type {FastingDay[]} */
let days = [];
/** @type {Promise<FastingDay[]> | null} */
let loading = null;
let registered = false;

/** "DD-MM-YYYY" → "YYYY-MM-DD" @param {string} dmy */
const isoOf = (dmy) => dmy.split("-").reverse().join("-");

async function build() {
  const settings = getSettings?.() ?? {};
  const adjustment = islamicCalendar.adjustmentOf(settings);
  const now = new Date();
  const today = await islamicCalendar.gregorianToHijri(
    now.getDate(),
    now.getMonth() + 1,
    now.getFullYear(),
    adjustment,
  );
  if (!today?.hijri) throw new Error("no Hijri date for today");
  const startMonth = Number(today.hijri.month.number);
  const startYear = Number(today.hijri.year);

  /** @type {FastingDay[]} */
  const result = [];
  for (let i = 0; i < MONTHS; i++) {
    const month = ((startMonth - 1 + i) % 12) + 1;
    const year = startYear + Math.floor((startMonth - 1 + i) / 12);
    const entries =
      (await islamicCalendar.hijriMonthCalendar(month, year, adjustment)) ?? [];
    for (const entry of entries) {
      const iso = isoOf(String(entry.gregorian.date));
      const [y, m, d] = iso.split("-").map(Number);
      const weekday = new Date(y, m - 1, d).getDay();
      const day = Number(entry.hijri.day);
      const reasons = reasonsOn(month, day, weekday);
      const forbidden = forbiddenOn(month, day);
      if (!reasons.length && !forbidden) continue;
      result.push({
        iso,
        weekday,
        hijri: { day, month, year },
        reasons,
        forbidden,
        calculated: entry.hijri.method === "calculated",
      });
    }
  }
  return result;
}

const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
};
let builtFor = "";

/** Builds the list again (new day, Hijri correction, back online). */
function reload() {
  builtFor = today();
  loading = build()
    .then((list) => {
      days = list;
      return days;
    })
    .catch((err) => {
      log.warn("loading the fasting days failed:", err.message);
      return days; // keep the previous list
    });
  return loading;
}

/** The days, once loaded (built again on a new day). @returns {Promise<FastingDay[]>} */
function getDays() {
  return loading && builtFor === today() ? loading : reload();
}

/** @param {() => any} settingsFn returns the current settings */
function init(settingsFn) {
  getSettings = settingsFn;
  if (!registered) {
    registered = true;
    secureIpc.handle("get-fasting-days", () => getDays());
  }
  return reload();
}

module.exports = { init, reload, getDays };
