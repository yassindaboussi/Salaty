"use strict";

// The fasting days, from the main process (services/fasting-days.js: the rules of
// shared/fasting-rules.js on the corrected Hijri dates), the prayer times of a day, and the
// seasons (White Days, Ashura, Dhul-Hijjah, Shawwal, Eid…) made of consecutive days.
const { ipcRenderer } = require("electron");
const { cleanTime } = require("../../../../shared/prayerUtils");

/**
 * @typedef {import("../../../../shared/fasting-rules").FastType} FastType
 * @typedef {object} FastDay
 * @property {string} iso         "YYYY-MM-DD"
 * @property {Date} date          that day, local midnight
 * @property {number} weekday     Date#getDay
 * @property {{ day: number, month: number, year: number }} hijri
 * @property {FastType[]} reasons
 * @property {"eidFitr" | "eidAdha" | "tashreeq" | null} forbidden
 * @property {boolean} calculated  Hijri date calculated offline (may differ by a day)
 *
 * @typedef {object} Season
 * @property {string} kind   a FastType (not monThu), or eidFitr / eidAdha / tashreeq
 * @property {FastDay} first
 * @property {FastDay} last
 */

/** @returns {Promise<FastDay[]>} */
async function loadDays() {
  const list = await ipcRenderer.invoke("get-fasting-days");
  if (!Array.isArray(list)) throw new Error("no fasting days");
  return list.map((d) => {
    const [y, m, day] = String(d.iso).split("-").map(Number);
    return { ...d, date: new Date(y, m - 1, day) };
  });
}

/** @type {Map<string, Promise<any[] | null>>} */
const months = new Map();

/**
 * Suhoor end (Fajr) and iftar (Maghrib) of a day, or null when not known (offline, never loaded).
 * @param {string} iso
 * @returns {Promise<{ fajr: string, maghrib: string } | null>}
 */
async function timesOn(iso) {
  const [y, m] = iso.split("-").map(Number);
  const key = `${y}-${m}`;
  if (!months.has(key)) {
    months.set(
      key,
      ipcRenderer.invoke("get-prayer-month", y, m).catch(() => null),
    );
  }
  const days = await months.get(key);
  const dmy = iso.split("-").reverse().join("-");
  const day = days?.find((d) => d?.date?.gregorian?.date === dmy);
  return day
    ? {
        fajr: cleanTime(day.timings.Fajr),
        maghrib: cleanTime(day.timings.Maghrib),
      }
    : null;
}

/**
 * A day's reasons to show: on Arafah the "first nine days" go without saying.
 * @param {FastDay} day
 */
const shownReasons = (day) =>
  day.reasons.filter(
    (r) => !(r === "dhulHijjah" && day.reasons.includes("arafah")),
  );

/**
 * The seasons: runs of consecutive days sharing a reason (Mondays and Thursdays are not one) or
 * a ban, in date order.
 * @param {FastDay[]} days
 * @returns {Season[]}
 */
function seasonsOf(days) {
  /** @type {Season[]} */
  const seasons = [];
  /** @type {Map<string, Season>} the open run of each kind */
  const open = new Map();
  for (const day of days) {
    // the first nine days of Dhul-Hijjah include Arafah, so all the reasons here
    const kinds = [
      ...day.reasons.filter((r) => r !== "monThu"),
      ...(day.forbidden ? [day.forbidden] : []),
    ];
    for (const kind of kinds) {
      const run = open.get(kind);
      const next =
        run &&
        run.last.hijri.month === day.hijri.month &&
        run.last.hijri.day + 1 === day.hijri.day;
      if (next) {
        run.last = day;
      } else {
        const season = { kind, first: day, last: day };
        seasons.push(season);
        open.set(kind, season);
      }
    }
  }
  return seasons.sort((a, b) => a.first.iso.localeCompare(b.first.iso));
}

module.exports = { loadDays, timesOn, shownReasons, seasonsOf };
