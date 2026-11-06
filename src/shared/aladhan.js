/**
 * aladhan.js — shared between main process and renderer.
 *
 * The single place that builds the location part of every Aladhan prayer-time request
 * (home page, adhan timer, widget, monthly table, Ramadan page), so all of them ask for
 * the same calculation method and therefore show the same Fajr/Isha times.
 *
 * Calculation method (Settings, prayerMethod): "auto" (the default) sends no `method`, and the
 * API then uses the authority closest to the location (e.g. Tunisia → method 18, France →
 * UOIF, Egypt → Egyptian General Authority, Saudi Arabia → Umm al-Qura). A number picks one
 * of Aladhan's methods (https://api.aladhan.com/v1/methods).
 * Asr (Settings, asrSchool): "standard" (Shafi'i, Maliki, Hanbali: shadow = 1× the object)
 * or "hanafi" (school=1: shadow = 2×). It moves only Asr (and so the end of Dhuhr).
 * Both are part of the request, so each choice has its own cache entry.
 */

"use strict";

const ALADHAN_API = "https://api.aladhan.com/v1";

/** Aladhan's method ids the app offers (6 does not exist, 99 is "custom angles"). */
const METHOD_IDS = [
  3, 2, 5, 4, 1, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
  7, 0,
];

/** "city=…&country=…" for the saved location, then the method and Asr choices. */
function locationQuery(settings) {
  const method = settings?.prayerMethod;
  const city = encodeURIComponent(settings?.city ?? "");
  const country = encodeURIComponent(settings?.country ?? "");
  const methodPart = METHOD_IDS.includes(method) ? `&method=${method}` : "";
  const schoolPart = settings?.asrSchool === "hanafi" ? "&school=1" : "";
  return `city=${city}&country=${country}${methodPart}${schoolPart}`;
}

module.exports = { ALADHAN_API, METHOD_IDS, locationQuery };
