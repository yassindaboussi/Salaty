"use strict";

// What the Quran page remembers on this computer (localStorage): the text size, the translation,
// where the reader stopped, and the bookmarked ayahs. Every read and write survives a storage
// that is full or blocked (the page then simply forgets).

/** An ayah, numbered as its riwaya counts (Qalun and Warsh number some ayahs differently).
 * @typedef {{ surah: number, ayah: number, riwaya: import("./state").Riwaya }} AyahRef */
const { isRiwaya } = require("./state");

const KEYS = {
  fontSize: "quranFontSize",
  translation: "quranTranslation",
  lastRead: "quranLastRead",
  bookmarks: "quranBookmarks",
  riwaya: "quranRiwaya",
};

const FONT_MIN = 18;
const FONT_MAX = 48;
const FONT_DEFAULT = 28;

/** @param {string} key */
function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

/** @param {string} key @param {unknown} value */
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // full or blocked: forgotten when the page closes
  }
}

/** @param {any} v @returns {v is AyahRef} */
const isRef = (v) =>
  Number.isInteger(v?.surah) &&
  v.surah >= 1 &&
  v.surah <= 114 &&
  Number.isInteger(v?.ayah) &&
  v.ayah >= 1 &&
  v.ayah <= 286;

/** A saved ayah; one saved before riwayat existed is Hafs. @param {any} v @returns {AyahRef} */
const toRef = (v) => ({
  surah: v.surah,
  ayah: v.ayah,
  riwaya: isRiwaya(v.riwaya) ? v.riwaya : "hafs",
});

/** @param {number} n */
const clampFont = (n) => Math.max(FONT_MIN, Math.min(FONT_MAX, n));

function loadFontSize() {
  const n = read(KEYS.fontSize);
  return typeof n === "number" ? clampFont(Math.round(n)) : FONT_DEFAULT;
}

/** @param {number} n */
const saveFontSize = (n) => write(KEYS.fontSize, n);

/** @param {Set<string>} allowed */
function loadTranslation(allowed) {
  const id = read(KEYS.translation);
  return typeof id === "string" && allowed.has(id) ? id : "none";
}

/** @param {string} id */
const saveTranslation = (id) => write(KEYS.translation, id);

/** @returns {AyahRef | null} */
function loadLastRead() {
  const v = read(KEYS.lastRead);
  return isRef(v) ? toRef(v) : null;
}

/** @param {AyahRef} ref */
const saveLastRead = (ref) => write(KEYS.lastRead, ref);

/** Newest first. @returns {AyahRef[]} */
function loadBookmarks() {
  const list = read(KEYS.bookmarks);
  return Array.isArray(list) ? list.filter(isRef).map(toRef) : [];
}

/** @param {AyahRef[]} list */
const saveBookmarks = (list) => write(KEYS.bookmarks, list);

/** @returns {import("./state").Riwaya} */
function loadRiwaya() {
  const v = read(KEYS.riwaya);
  return isRiwaya(v) ? v : "hafs";
}

/** @param {import("./state").Riwaya} riwaya */
const saveRiwaya = (riwaya) => write(KEYS.riwaya, riwaya);

module.exports = {
  loadRiwaya,
  saveRiwaya,
  FONT_MIN,
  FONT_MAX,
  clampFont,
  loadFontSize,
  saveFontSize,
  loadTranslation,
  saveTranslation,
  loadLastRead,
  saveLastRead,
  loadBookmarks,
  saveBookmarks,
};
