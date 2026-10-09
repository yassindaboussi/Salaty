/**
 * aladhan.js — shared between main process and renderer.
 *
 * The single place that builds the location part of every Aladhan prayer-time request
 * (home page, adhan timer, widget, monthly table, Ramadan page), so all of them ask for
 * the same calculation method and therefore show the same Fajr/Isha times.
 *
 * No `method` is sent on purpose: the API then uses the calculation method of the
 * authority closest to the location (e.g. Tunisia → method 18, France → UOIF,
 * Egypt → Egyptian General Authority, Saudi Arabia → Umm al-Qura).
 */

"use strict";

const ALADHAN_API = "https://api.aladhan.com/v1";

/** "city=…&country=…" for the saved location. */
function locationQuery(settings) {
  return (
    `city=${encodeURIComponent(settings?.city ?? "")}` +
    `&country=${encodeURIComponent(settings?.country ?? "")}`
  );
}

module.exports = { ALADHAN_API, locationQuery };
