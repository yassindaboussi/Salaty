"use strict";

// The end of each prayer's time, and the parts of the morning, for the home page's
// "current prayer" card (components/prayer-times.js).

const { secondsFromTime } = require("../../../shared/prayerUtils");

// When each prayer's time ends (Sahih Muslim 612; the four schools):
//   Fajr ends at sunrise (not at Dhuhr). From sunrise to Dhuhr no prayer is due, in 3 parts
//   (Sahih Muslim 831; Ibn Uthaymeen, IslamQA 22389): the sun rising (no voluntary prayer
//   until it is a spear's length up, ~15 min to be safe), Duha, and the sun at its height
//   (no voluntary prayer, ~10 min before Dhuhr).
//   Isha is best prayed before the middle of the night: halfway from sunset to Fajr (IslamQA
//   9940; not Aladhan's "Midnight", which halves sunset to sunrise); after it, most scholars hold it is still valid until Fajr for someone with an
//   excuse, so the card then shows Fajr as the end.
//   Dhuhr, Asr (sunset) and Maghrib (red twilight = Isha) end when the next prayer starts.
/**
 * @param {string} key the current prayer
 * @param {number} nowSec
 * @param {Record<string, string>} tm today's timings
 * @returns {"" | "sunrise" | "duha" | "zawal" | "ishaLate"}
 */
function prayerPhase(key, nowSec, tm) {
  if (key === "Fajr" && tm.Sunrise && nowSec >= secondsFromTime(tm.Sunrise)) {
    if (nowSec < secondsFromTime(tm.Sunrise) + AFTER_SUNRISE_SEC)
      return "sunrise";
    if (tm.Dhuhr && nowSec >= secondsFromTime(tm.Dhuhr) - BEFORE_DHUHR_SEC)
      return "zawal";
    return "duha";
  }
  const midnight = nightMiddle(tm);
  if (key === "Isha" && midnight && tm.Isha) {
    const isha = secondsFromTime(tm.Isha);
    const since = (nowSec - isha + 86400) % 86400;
    const toMidnight = (secondsFromTime(midnight) - isha + 86400) % 86400;
    if (since >= toMidnight) return "ishaLate";
  }
  return "";
}

const AFTER_SUNRISE_SEC = 15 * 60; // the sun a spear's length up (Ibn Uthaymeen: 12-15 min)
const BEFORE_DHUHR_SEC = 10 * 60; // the sun at its height, before Dhuhr (5-10 min)

/** `time` ("HH:MM") moved by `sec` seconds, "HH:MM" */
function shiftTime(time, sec) {
  const m = Math.round((secondsFromTime(time) + sec) / 60);
  const mm = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(mm / 60)).padStart(2, "0")}:${String(mm % 60).padStart(2, "0")}`;
}

/** The middle of the night, "HH:MM": halfway from sunset to Fajr (today's Fajr stands in for
 * tomorrow's, a minute apart at most). "" when a time is missing. */
/** @param {Record<string, string>} tm */
function nightMiddle(tm) {
  const sunset = tm.Sunset ?? tm.Maghrib;
  if (!sunset || !tm.Fajr) return "";
  const start = secondsFromTime(sunset);
  const night = (secondsFromTime(tm.Fajr) - start + 86400) % 86400;
  const mid = Math.round((start + night / 2) / 60) % 1440;
  return `${String(Math.floor(mid / 60)).padStart(2, "0")}:${String(mid % 60).padStart(2, "0")}`;
}

module.exports = {
  AFTER_SUNRISE_SEC,
  BEFORE_DHUHR_SEC,
  prayerPhase,
  nightMiddle,
  shiftTime,
};
