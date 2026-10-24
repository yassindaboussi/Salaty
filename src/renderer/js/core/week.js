"use strict";

// The first day of the week. "auto" follows the saved location's country, from the week data
// built into the browser (Unicode CLDR, Intl.Locale#getWeekInfo), as the calendars of Windows,
// macOS and Android do: Tunisia, Morocco, France, Türkiye → Monday; Saudi Arabia, Pakistan,
// the US → Sunday; Egypt, Algeria, Iraq → Saturday. Settings can choose one of those instead.

/** Date#getDay numbers: 0 = Sunday … 6 = Saturday */
const CHOSEN = { sat: 6, sun: 0, mon: 1 };
const MONDAY = 1; // ISO 8601, and CLDR's default for the countries it has no rule for

// Names the location lists use (countriesnow.space, freeipapi.com) that Intl spells otherwise
/** @type {Record<string, string>} */
const ALIASES = {
  turkey: "TR",
  czechrepublic: "CZ",
  swaziland: "SZ",
  congo: "CG",
  macau: "MO",
  vaticancitystate: "VA",
  pitcairn: "PN",
  palestine: "PS",
  unitedstatesofamerica: "US",
  usa: "US",
  uk: "GB",
  russianfederation: "RU",
};

/**
 * Letters only, lower case, no accents: "Côte d’Ivoire" and "Cote d'Ivoire" compare equal.
 * @param {string} name
 */
const normalize = (name) =>
  name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\(.*?\)/g, "") // "Myanmar (Burma)"
    .replace(/ - .*$/, "") // "Congo - Brazzaville"
    .replace(/\bsar china\b/, "") // "Hong Kong SAR China"
    .replace(/\bsaint\b/g, "st")
    .replace(/[^\p{L}]/gu, "");

/** @type {Map<string, string | null>} */
const regions = new Map();

/**
 * The ISO 3166 code of a country name in English, French or Arabic; null when unknown.
 * @param {string} country
 */
function regionOf(country) {
  const key = normalize(country);
  if (!key) return null;
  if (Object.hasOwn(ALIASES, key)) return ALIASES[key];
  if (!regions.has(key)) regions.set(key, findRegion(key));
  return regions.get(key) ?? null;
}

/** @param {string} key a normalized name */
function findRegion(key) {
  const names = ["en", "fr", "ar"].map(
    (lang) =>
      new Intl.DisplayNames([lang], { type: "region", fallback: "none" }),
  );
  // in A-Z order, so a current code wins over an old one with the same name (FR before FX)
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      if (names.some((dn) => normalize(dn.of(code) ?? "") === key)) return code;
    }
  }
  return null;
}

/**
 * CLDR's first day of the week in a country, as a Date#getDay number; null when unknown.
 * @param {string} region ISO 3166 code
 */
function regionFirstDay(region) {
  try {
    /** @type {any} getWeekInfo is newer than TypeScript's lib */
    const locale = new Intl.Locale(`und-${region}`);
    const info = locale.getWeekInfo?.() ?? locale.weekInfo;
    return Number.isInteger(info?.firstDay) ? info.firstDay % 7 : null;
  } catch {
    return null;
  }
}

/**
 * The first day of the week for the saved settings, as a Date#getDay number (0 = Sunday).
 * @param {{ weekStart?: string, country?: string }} settings
 */
function firstDayOfWeek(settings) {
  const chosen = settings?.weekStart;
  if (chosen === "sat" || chosen === "sun" || chosen === "mon") {
    return CHOSEN[chosen];
  }
  const region = settings?.country ? regionOf(settings.country) : null;
  const day = region ? regionFirstDay(region) : null;
  return day ?? MONDAY;
}

module.exports = { firstDayOfWeek };
