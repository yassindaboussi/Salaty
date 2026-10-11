"use strict";

// The app's only Aladhan client (https://aladhan.com/prayer-times-api), with a disk cache so
// every feature keeps working offline: prayer timetables, the Ramadan calendar, Hijri dates,
// fasting days. Pages never call Aladhan themselves; they ask the main process.
//
// Cache rules:
//   - stale-while-revalidate: a cached answer is returned at once; when it is older than its
//     maxAgeMs it is downloaded again in the background (RFC 5861)
//   - the key is the full request (path + query), so every parameter is part of it
//   - only valid answers (code 200, passing the caller's check) are stored, never failures
//   - one download per key at a time; the least recently used entries are dropped
const { app } = require("electron");
const fs = require("fs");
const path = require("path");
const { ALADHAN_API } = require("../../shared/aladhan");
const { fetchJson } = require("./http");
const log = require("./logger").logger("Aladhan");

const CACHE_VERSION = 1;
const MAX_ENTRIES = 60; // the biggest answers (month timetables) are ~40 KB

/**
 * @typedef {{ fetchedAt: number, usedAt: number, data: any }} CacheEntry
 * @typedef {{ version: number, entries: Record<string, CacheEntry> }} Cache
 * @typedef {object} GetOptions
 * @property {number} maxAgeMs older answers are refreshed in the background
 * @property {(data: any) => boolean} [validate] extra check of the answer's data
 * @property {(data: any) => void} [onRefresh] a background refresh brought new data
 */

/** @type {Cache | null} */
let cache = null;
/** @type {Map<string, Promise<any>>} key -> the download in progress */
const inFlight = new Map();

const cacheFile = () =>
  path.join(app.getPath("userData"), "aladhan-cache.json");

/** @returns {Cache} */
function loadCache() {
  if (cache) return cache;
  try {
    const data = JSON.parse(fs.readFileSync(cacheFile(), "utf8"));
    if (data?.version === CACHE_VERSION && data.entries) cache = data;
  } catch {
    // no cache yet, or unreadable: start empty
  }
  cache ??= { version: CACHE_VERSION, entries: {} };
  return cache;
}

// Written to a temporary file and renamed, so a crash mid-write never leaves a broken cache.
function saveCache() {
  const file = cacheFile();
  try {
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(cache));
    fs.renameSync(`${file}.tmp`, file);
  } catch (err) {
    log.warn("saving the cache failed:", err.message);
  }
}

/** @param {Cache} store */
function prune(store) {
  const keys = Object.keys(store.entries);
  if (keys.length <= MAX_ENTRIES) return;
  keys
    .sort((a, b) => store.entries[a].usedAt - store.entries[b].usedAt)
    .slice(0, keys.length - MAX_ENTRIES)
    .forEach((key) => delete store.entries[key]);
}

/**
 * Downloads and stores one answer. Rejects when offline or when the answer is not valid.
 * @param {string} key
 * @param {(data: any) => boolean} validate
 * @param {((data: any) => void) | undefined} onRefresh
 * @returns {Promise<any>}
 */
function refresh(key, validate, onRefresh) {
  const pending = inFlight.get(key);
  if (pending) return pending;
  const job = fetchJson(`${ALADHAN_API}${key}`)
    .then((json) => {
      if (json?.code !== 200 || json.data == null || !validate(json.data)) {
        throw new Error("unexpected answer");
      }
      const store = loadCache();
      const old = store.entries[key];
      const changed = JSON.stringify(old?.data) !== JSON.stringify(json.data);
      store.entries[key] = {
        fetchedAt: Date.now(),
        usedAt: Date.now(),
        data: json.data,
      };
      prune(store);
      saveCache();
      if (changed && old) onRefresh?.(json.data);
      return json.data;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, job);
  return job;
}

/**
 * The `data` of an Aladhan answer: cached if possible, downloaded otherwise.
 * @param {string} key path + query after /v1, e.g. "/gToH/10-10-2026"
 * @param {GetOptions} options
 * @returns {Promise<any>} null when offline with nothing cached
 */
async function get(key, { maxAgeMs, validate = () => true, onRefresh }) {
  const entry = loadCache().entries[key];
  if (entry) {
    entry.usedAt = Date.now();
    if (Date.now() - entry.fetchedAt > maxAgeMs) {
      refresh(key, validate, onRefresh).catch((err) =>
        log.info(`keeping the cached ${key}:`, err.message),
      );
    }
    return entry.data;
  }
  try {
    return await refresh(key, validate, onRefresh);
  } catch (err) {
    log.warn(`no data for ${key}:`, err.message);
    return null;
  }
}

/**
 * True when the key is cached (whatever its age).
 * @param {string} key
 */
function has(key) {
  return Boolean(loadCache().entries[key]);
}

module.exports = { get, has };
