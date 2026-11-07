"use strict";

// The backup for prayer times: when Aladhan can't be reached (offline, down, blocked) and the
// month isn't cached, the month is calculated here with the same settings Aladhan used
// (prayer-calc.js). Two things are kept for that, in <userData>/prayer-offline.json:
//   - each location's coordinates (Aladhan's city answers don't include real ones): looked up
//     once, online, with Open-Meteo's geocoding (GeoNames data, free, no key)
//   - the last Aladhan `meta` of each location + method + Asr choice (angles, high-latitude
//     rule, offsets, time zone)
// Without both, nothing is calculated: the pages show "no connection" as before.
const { app } = require("electron");
const fs = require("fs");
const path = require("path");
const { fetchJson } = require("./http");
const { locationQuery } = require("../../shared/aladhan");
const { calculateMonth, isCoords, isUsableMeta } = require("./prayer-calc");
const log = require("./logger").logger("OfflinePrayerTimes");

/**
 * @typedef {{ city?: string, country?: string }} LocationSettings
 * @typedef {{ lat: number, lng: number }} Coords
 * @typedef {{ version: number, places: Record<string, Coords>, profiles: Record<string, any> }} Store
 */

const VERSION = 1;
const MAX_PROFILES = 20;
const GEOCODING_API = "https://geocoding-api.open-meteo.com/v1/search";

/** @type {Store | null} */
let store = null;
/** @type {Set<string>} places looked up this run (one try per run) */
const lookedUp = new Set();

const storeFile = () =>
  path.join(app.getPath("userData"), "prayer-offline.json");

/** @returns {Store} */
function load() {
  if (store) return store;
  try {
    const data = JSON.parse(fs.readFileSync(storeFile(), "utf8"));
    if (data?.version === VERSION && data.places && data.profiles) store = data;
  } catch {
    // nothing saved yet, or unreadable: start empty
  }
  store ??= { version: VERSION, places: {}, profiles: {} };
  return store;
}

// Written to a temporary file and renamed, so a crash mid-write never leaves a broken file.
function save() {
  const file = storeFile();
  try {
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(store));
    fs.renameSync(`${file}.tmp`, file);
  } catch (err) {
    log.warn("saving failed:", err.message);
  }
}

/** @param {LocationSettings} settings */
const placeKey = (settings) =>
  `${settings.city ?? ""}|${settings.country ?? ""}`.toLowerCase();

const same = (/** @type {unknown} */ a, /** @type {unknown} */ b) =>
  String(a ?? "").toLowerCase() === String(b ?? "").toLowerCase();

/**
 * The town that matches: a populated place (not the country itself), in Aladhan's time zone,
 * named in the right country; the biggest when several match.
 * @param {any[]} results Open-Meteo's answer
 * @param {string} country @param {string} timeZone
 * @returns {Coords | null}
 */
function pickPlace(results, country, timeZone) {
  const places = results
    .filter((r) => String(r?.feature_code ?? "").startsWith("PPL"))
    .sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
  const best =
    places.find((r) => same(r.country, country) && r.timezone === timeZone) ??
    places.find((r) => same(r.country, country)) ??
    places.find((r) => r.timezone === timeZone);
  const coords = best ? { lat: best.latitude, lng: best.longitude } : null;
  return isCoords(coords) ? coords : null;
}

/**
 * Looks the location's coordinates up once (in the background, online).
 * @param {LocationSettings} settings @param {string} timeZone
 */
async function lookUp(settings, timeZone) {
  const key = placeKey(settings);
  if (lookedUp.has(key) || load().places[key]) return;
  lookedUp.add(key);
  const url = `${GEOCODING_API}?name=${encodeURIComponent(settings.city ?? "")}&count=10&language=en&format=json`;
  try {
    const json = await fetchJson(url);
    const results = Array.isArray(json?.results) ? json.results : [];
    const coords = pickPlace(results, settings.country ?? "", timeZone);
    if (!coords) {
      log.info(`no coordinates found for ${key}`);
      return;
    }
    load().places[key] = coords;
    save();
  } catch (err) {
    lookedUp.delete(key); // try again on a later call
    log.info(`looking up ${key} failed:`, err.message);
  }
}

/**
 * Keeps what's needed to calculate this location's times later. Called with every month
 * Aladhan gave (downloaded or cached).
 * @param {LocationSettings} settings
 * @param {{ meta: any }[]} days
 */
function remember(settings, days) {
  const meta = days[0]?.meta;
  if (!settings?.city || !settings?.country || !isUsableMeta(meta)) return;
  const data = load();
  const key = locationQuery(settings);
  if (JSON.stringify(data.profiles[key]) !== JSON.stringify(meta)) {
    delete data.profiles[key]; // re-added last: the oldest are dropped first
    data.profiles[key] = meta;
    const keys = Object.keys(data.profiles);
    for (const old of keys.slice(0, Math.max(0, keys.length - MAX_PROFILES)))
      delete data.profiles[old];
    save();
  }
  lookUp(settings, meta.timezone).catch(() => {});
}

/**
 * The month calculated on this computer, or null when the location's coordinates or
 * Aladhan's settings for it were never saved.
 * @param {LocationSettings} settings
 * @param {number} year @param {number} month 1-12
 */
function calculate(settings, year, month) {
  const data = load();
  const meta = data.profiles[locationQuery(settings)];
  const coords = data.places[placeKey(settings)];
  if (!meta || !coords) return null;
  const days = calculateMonth(meta, coords, year, month);
  if (days) log.info(`calculated ${year}-${month} offline`);
  return days;
}

module.exports = { remember, calculate, pickPlace };
