"use strict";

// Checks for the data that pages send over IPC (Electron security checklist: "validate the
// sender and the arguments of every IPC message"). Main never trusts the shape of a message:
// a check returns the cleaned value, or `undefined` when the value is not acceptable.
const log = require("../services/logger").logger("IPC");

const THEMES = new Set([
  "brown",
  "classic",
  "emerald",
  "gold",
  "green",
  "indigo",
  "navy",
  "ocean",
  "pink",
  "purple",
  "ramadan",
  "royal",
]);
const LANGUAGES = new Set(["en", "ar", "fr"]);
const PRAYERS = new Set(["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"]);

const MAX_TEXT = 200; // a city, a country, a location name
const MAX_CLIPBOARD = 10_000;

// ── Basic checks ─────────────────────────────────────────────────────────────

const bool = (v) => (typeof v === "boolean" ? v : undefined);

function text(v, max = MAX_TEXT) {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s.length > 0 && s.length <= max ? s : undefined;
}

function int(v, min, max) {
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isInteger(n) && n >= min && n <= max ? n : undefined;
}

const oneOf = (set) => (v) => (set.has(v) ? v : undefined);

const isPlainObject = (v) =>
  v !== null &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  Object.getPrototypeOf(v) === Object.prototype;

// ── Settings ─────────────────────────────────────────────────────────────────

function adhanByPrayer(v) {
  if (!isPlainObject(v)) return undefined;
  const out = {};
  for (const [key, mode] of Object.entries(v)) {
    if (PRAYERS.has(key) && (typeof mode === "boolean" || mode === "silent"))
      out[key] = mode;
  }
  return out;
}

function fastingReminders(v) {
  if (!isPlainObject(v)) return undefined;
  const occasions = Array.isArray(v.occasions)
    ? v.occasions.map((id) => text(id, 100)).filter(Boolean)
    : [];
  return {
    occasions: occasions.slice(0, 500),
    weeklyMonThu: v.weeklyMonThu === true,
    leadDays: int(v.leadDays, 1, 30) ?? 1,
  };
}

function position(v) {
  if (!isPlainObject(v)) return undefined;
  const x = int(Math.round(v.x), -100_000, 100_000);
  const y = int(Math.round(v.y), -100_000, 100_000);
  return x === undefined || y === undefined ? undefined : { x, y };
}

// A saved location as the pages send it back (the whole list comes with "save-settings").
function savedLocation(v) {
  if (!isPlainObject(v)) return undefined;
  const id = text(v.id, 100);
  const city = text(v.city);
  const country = text(v.country);
  if (!id || !city || !country) return undefined;
  return {
    id,
    name: text(v.name) ?? city,
    city,
    country,
    isActive: v.isActive === true,
    isFavorite: v.isFavorite === true,
    createdAt: text(v.createdAt, 40) ?? new Date().toISOString(),
  };
}

function locations(v) {
  if (!Array.isArray(v) || v.length === 0 || v.length > 100) return undefined;
  const list = v.map(savedLocation);
  return list.every(Boolean) ? list : undefined;
}

// Every setting a page may change, and how to check it. Anything else is dropped.
const SETTINGS_SCHEMA = {
  theme: oneOf(THEMES),
  themeChosen: bool,
  language: oneOf(LANGUAGES),
  city: text,
  country: text,
  bigScreen: bool,
  travelMode: bool,
  openAtLogin: bool,
  analyticsEnabled: bool,
  athkarAlertEnabled: bool,
  athkarAlertInterval: (v) => int(v, 1, 1440),
  preAdhanNotificationEnabled: bool,
  preAdhanMinutes: (v) => int(v, 1, 60),
  adhanEnabledByPrayer: adhanByPrayer,
  fastingReminders,
  position,
  locations,
};

// Keeps the known settings with valid values; logs (once per call) what was dropped.
// `current`: the saved settings. Pages send the whole settings object back, so keys main
// already has with the same value (old, no longer used ones too) are dropped quietly.
function settingsChanges(changes, current = {}) {
  if (!isPlainObject(changes)) return {};
  const clean = {};
  const dropped = [];
  for (const [key, value] of Object.entries(changes)) {
    const check = Object.hasOwn(SETTINGS_SCHEMA, key)
      ? SETTINGS_SCHEMA[key]
      : null;
    const ok = check ? check(value) : undefined;
    if (ok === undefined) {
      const echoed =
        value == null || JSON.stringify(current[key]) === JSON.stringify(value);
      if (!echoed) dropped.push(key);
    } else {
      clean[key] = ok;
    }
  }
  if (dropped.length) log.warn("save-settings: ignored", dropped.join(", "));
  return clean;
}

// ── Saved locations ──────────────────────────────────────────────────────────

// "add-location": { name?, city, country, isFavorite? }
function newLocation(v) {
  if (!isPlainObject(v)) return undefined;
  const city = text(v.city);
  const country = text(v.country);
  if (!city || !country) return undefined;
  return {
    name: text(v.name),
    city,
    country,
    isFavorite: v.isFavorite === true,
  };
}

// "update-location": only the fields a user can edit.
function locationUpdates(v) {
  if (!isPlainObject(v)) return undefined;
  const out = {};
  for (const key of ["name", "city", "country"]) {
    if (v[key] === undefined) continue;
    const s = text(v[key]);
    if (s === undefined) return undefined;
    out[key] = s;
  }
  if (v.isFavorite !== undefined) {
    if (typeof v.isFavorite !== "boolean") return undefined;
    out.isFavorite = v.isFavorite;
  }
  return out;
}

const locationId = (v) => text(v, 100);

// ── Windows ──────────────────────────────────────────────────────────────────

// Window size asked for by a page; null when it is not a sane size.
function windowSize(width, height) {
  const w = int(Math.round(width), 200, 10_000);
  const h = int(Math.round(height), 150, 10_000);
  return w === undefined || h === undefined ? null : { width: w, height: h };
}

// Data for the athkar / adhan / fasting popups (shown with textContent, never as HTML).
function popupData(v) {
  if (!isPlainObject(v)) return undefined;
  const icon =
    typeof v.icon === "string" && /^fa-[a-z0-9-]{1,40}$/.test(v.icon)
      ? v.icon
      : undefined;
  return {
    theme: THEMES.has(v.theme) ? v.theme : "navy",
    title: text(v.title, 300) ?? "",
    content: text(v.content, 5000) ?? "",
    ...(icon && { icon }),
  };
}

// ── Analytics ────────────────────────────────────────────────────────────────

// GA4 limits (https://support.google.com/analytics/answer/9267744): names of up to 40
// letters/digits/underscores, at most 25 parameters, text values of up to 100 characters.
const GA_NAME = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
const analyticsName = (v) =>
  typeof v === "string" && GA_NAME.test(v) ? v : undefined;

function analyticsParams(v) {
  if (!isPlainObject(v)) return {};
  const out = {};
  for (const [key, value] of Object.entries(v).slice(0, 25)) {
    if (!GA_NAME.test(key)) continue;
    if (typeof value === "string") out[key] = value.slice(0, 100);
    else if (typeof value === "number" && Number.isFinite(value))
      out[key] = value;
    else if (typeof value === "boolean") out[key] = value ? 1 : 0;
  }
  return out;
}

function clipboardText(v) {
  return typeof v === "string" && v.length <= MAX_CLIPBOARD ? v : undefined;
}

module.exports = {
  bool,
  text,
  int,
  isPlainObject,
  settingsChanges,
  newLocation,
  locationUpdates,
  locationId,
  windowSize,
  popupData,
  analyticsName,
  analyticsParams,
  clipboardText,
  THEMES,
};
