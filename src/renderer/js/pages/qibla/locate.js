"use strict";

// Where the user is: the saved location's city, placed on the map by Photon (OpenStreetMap
// data, https://photon.komoot.io). A city found once is kept (localStorage), so the page then
// opens at once and works offline. Where the user dragged the marker is kept the same way, per
// city, until they go back to the city's centre.

const CACHE_KEY = "qiblaPlaces";
const TIMEOUT_MS = 8000;

/** @typedef {{ lat: number, lon: number, moved?: boolean }} Place */

/** @returns {Record<string, Place>} */
function readCache() {
  try {
    const saved = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}");
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {}; // storage unavailable or damaged: find it again
  }
}

/** @param {string} key @param {Place | undefined} place undefined forgets it */
function remember(key, place) {
  const places = readCache();
  if (place) places[key] = place;
  else delete places[key];
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(places));
  } catch {
    // storage unavailable: found again next time
  }
}

const keyOf = (/** @type {string} */ city, /** @type {string} */ country) =>
  `${city}|${country}`.toLowerCase();

const isPlace = (/** @type {any} */ p) =>
  Number.isFinite(p?.lat) &&
  Number.isFinite(p?.lon) &&
  Math.abs(p.lat) <= 90 &&
  Math.abs(p.lon) <= 180;

/** @param {string} city @param {string} country @returns {Promise<Place | null>} */
async function geocode(city, country) {
  const q = encodeURIComponent(`${city}, ${country}`);
  const res = await fetch(`https://photon.komoot.io/api/?q=${q}&limit=1`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Photon HTTP ${res.status}`);
  const data = await res.json();
  const [lon, lat] = data?.features?.[0]?.geometry?.coordinates ?? [];
  return isPlace({ lat, lon }) ? { lat, lon } : null;
}

/**
 * The city's coordinates; null when Photon doesn't know it. Throws when it can't be reached.
 * @param {string} city @param {string} country
 * @returns {Promise<{ place: Place | null, source: "cache" | "geocode" }>}
 */
async function locate(city, country) {
  const key = keyOf(city, country);
  const moved = readCache()[`${key}#moved`];
  if (isPlace(moved))
    return { place: { ...moved, moved: true }, source: "cache" };
  const saved = readCache()[key];
  if (isPlace(saved)) return { place: saved, source: "cache" };
  const place = await geocode(city, country);
  if (place) remember(key, place);
  return { place, source: "geocode" };
}

/** Where the user dropped the marker. @param {string} city @param {string} country @param {number} lat @param {number} lon */
function rememberMoved(city, country, lat, lon) {
  remember(`${keyOf(city, country)}#moved`, { lat, lon });
}

/** Back to the city's centre. @param {string} city @param {string} country */
function forgetMoved(city, country) {
  remember(`${keyOf(city, country)}#moved`, undefined);
}

module.exports = { locate, rememberMoved, forgetMoved };
