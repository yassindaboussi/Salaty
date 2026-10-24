"use strict";

// The Ramadan days with their times, from the main process (same location and method as the
// home page and the adhan, so suhoor always ends at the Fajr the app shows elsewhere; cached on
// disk, so it works offline). The Settings Hijri correction is already applied there.
const { ipcRenderer } = require("electron");
const { cleanTime } = require("../../../../shared/prayerUtils");
const { isoOf, parseDmy } = require("../../core/date-format");

/**
 * @typedef {object} RamadanDay
 * @property {number} day         1-30
 * @property {string} iso         the Gregorian date, "YYYY-MM-DD"
 * @property {Date} date          that day, local midnight
 * @property {string} imsak       "HH:MM": 10 minutes before Fajr, a margin to stop eating
 * @property {string} fajr        when suhoor ends and the fast begins
 * @property {string} maghrib     iftar
 *
 * @typedef {{ year: number, days: RamadanDay[], eidToday: boolean }} RamadanData
 */

/** Minutes from midnight of a "HH:MM" time. @param {string} time */
const minutesOf = (time) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

/** How long the fast lasts, Fajr to Maghrib, in minutes. @param {RamadanDay} day */
const fastMinutes = (day) => minutesOf(day.maghrib) - minutesOf(day.fajr);

/**
 * The Ramadan to show: this year's until its last day, the next one from Shawwal on.
 * @returns {Promise<RamadanData>}
 * @throws when the times are not available (offline and never loaded)
 */
async function loadRamadan() {
  const today = await ipcRenderer.invoke("get-prayer-data");
  const hijri = today?.date?.hijri;
  if (!hijri) throw new Error("no prayer times yet (offline, nothing saved)");
  const month = Number(hijri.month?.number);
  const year = Number(hijri.year) + (month > 9 ? 1 : 0);

  const entries = await ipcRenderer.invoke("get-ramadan-calendar", year);
  if (!Array.isArray(entries) || !entries.length) {
    throw new Error("no Ramadan calendar (offline, nothing saved)");
  }
  const days = entries.map((entry) => {
    const date = parseDmy(entry.date.gregorian.date);
    return {
      day: Number(entry.date.hijri.day), // "01" (Aladhan) or "1" (calculated)
      iso: isoOf(date),
      date,
      imsak: cleanTime(entry.timings.Imsak ?? entry.timings.Fajr),
      fajr: cleanTime(entry.timings.Fajr),
      maghrib: cleanTime(entry.timings.Maghrib),
    };
  });
  return {
    year,
    days,
    eidToday: month === 10 && Number(hijri.day) === 1,
  };
}

/**
 * The odd nights of the last ten (21, 23, 25, 27, 29), when Laylat al-Qadr is sought.
 * @param {number} day
 */
const isOddNight = (day) => day >= 21 && day % 2 === 1;

module.exports = { loadRamadan, fastMinutes, isOddNight };
