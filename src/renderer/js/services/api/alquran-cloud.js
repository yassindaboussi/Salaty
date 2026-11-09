"use strict";

// Surah text for the Quran reader. The Arabic (Hafs) always comes from the bundled data: it works
// offline, matches the bundled Quran font, and has the Bismillah only where it is an ayah (1:1).
// (AlQuran Cloud's text puts it at the start of ayah 1 of every surah, which doubled it under
// the page's own Bismillah line.) Translations come from AlQuran Cloud; Sahih International is
// also bundled, so it works offline too. Qalun and Warsh (data/quran-qalun.json, quran-warsh.json,
// from the King Fahd Complex) are bundled too; they count the ayahs the Madani way, so the
// translations (numbered like Hafs) are not offered with them.

const ALQURAN_CLOUD_API = "https://api.alquran.cloud/v1";

/** The translations offered (AlQuran Cloud edition ids). */
const TRANSLATIONS = new Set(["en.sahih", "en.asad", "fr.hamidullah"]);
const BUNDLED_TRANSLATION = "en.sahih";
// a slow or dead network gives up after this, and the reader says the translation is offline
const FETCH_TIMEOUT_MS = 15000;

/**
 * @typedef {object} Ayah
 * @property {number} number          in the surah
 * @property {string} arabic
 * @property {string | null} translation
 *
 * @typedef {object} SurahText
 * @property {Ayah[]} ayahs
 * @property {boolean} translationMissing  a translation was asked for but could not be loaded
 * @property {string | null} bismillah      the riwaya's own Bismillah (null: the page's Hafs one)
 */

/** @type {Promise<any[]> | null} */
let localData = null;

function getLocalQuranData() {
  if (!localData) {
    localData = fetch("../../data/Quran.json").then((res) => {
      if (!res.ok)
        throw new Error(`Failed to load offline Quran data (${res.status})`);
      return res.json();
    });
    localData.catch(() => {
      localData = null; // try again next time
    });
  }
  return localData;
}

/** @param {number} surahNum @returns {Promise<{ id: number, ar: string, en?: string }[]>} */
async function localVerses(surahNum) {
  const data = await getLocalQuranData();
  const entry = data.find((s) => s.Number === surahNum);
  if (!entry) throw new Error(`Surah ${surahNum} not found in offline data`);
  return (entry.Array_Verses && entry.Array_Verses[0]) || [];
}

/** @typedef {{ bismillah: string, surahs: string[][] }} RiwayaText */

/** @type {Map<string, Promise<RiwayaText>>} */
const riwayaData = new Map();

/** @param {"qalun" | "warsh"} riwaya @returns {Promise<RiwayaText>} */
function getRiwayaData(riwaya) {
  let data = riwayaData.get(riwaya);
  if (!data) {
    data = fetch(`../../data/quran-${riwaya}.json`).then((res) => {
      if (!res.ok)
        throw new Error(`Failed to load ${riwaya} text (${res.status})`);
      return res.json();
    });
    data.catch(() => riwayaData.delete(riwaya)); // try again next time
    riwayaData.set(riwaya, data);
  }
  return data;
}

/**
 * The ayahs of a surah in a riwaya, numbered from 1, and the Bismillah as that text writes it.
 * @param {number} surahNum @param {string} riwaya
 * @returns {Promise<{ verses: { id: number, ar: string, en?: string }[], bismillah: string | null }>}
 */
async function versesOf(surahNum, riwaya) {
  if (riwaya !== "qalun" && riwaya !== "warsh")
    return { verses: await localVerses(surahNum), bismillah: null };
  const data = await getRiwayaData(riwaya);
  const ayahs = data.surahs[surahNum - 1];
  if (!ayahs) throw new Error(`Surah ${surahNum} not found in ${riwaya} text`);
  return {
    verses: ayahs.map((ar, i) => ({ id: i + 1, ar })),
    bismillah: data.bismillah,
  };
}

/** @type {Map<string, string[]>} */
const translationCache = new Map();

/** @param {number} surahNum @param {string} edition @returns {Promise<string[] | null>} */
async function onlineTranslation(surahNum, edition) {
  const key = `${edition}/${surahNum}`;
  const known = translationCache.get(key);
  if (known) return known;
  if (!navigator.onLine) return null;
  try {
    const res = await fetch(
      `${ALQURAN_CLOUD_API}/surah/${surahNum}/${edition}`,
      { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    );
    if (!res.ok) throw new Error(`alquran.cloud ${res.status}`);
    const json = await res.json();
    const ayahs = json?.data?.ayahs;
    if (!Array.isArray(ayahs)) throw new Error("alquran.cloud: no ayahs");
    const texts = ayahs.map((a) => stripHtmlTags(String(a?.text ?? "")));
    translationCache.set(key, texts);
    return texts;
  } catch (e) {
    console.warn("AlQuran Cloud translation failed:", e);
    return null;
  }
}

/**
 * @param {number} surahNum
 * @param {string} translationId  an edition id, or "none" (ignored outside Hafs)
 * @param {string} [riwaya]       "hafs" (default), "qalun" or "warsh"
 * @returns {Promise<SurahText>}
 */
async function fetchQuranSurah(surahNum, translationId, riwaya = "hafs") {
  const { verses, bismillah } = await versesOf(surahNum, riwaya);
  const wanted = riwaya === "hafs" && TRANSLATIONS.has(translationId);
  /** @type {(string | null)[] | null} */
  let translations = null;
  if (wanted) {
    // the bundled copy first for Sahih International; the network for the others
    translations =
      translationId === BUNDLED_TRANSLATION
        ? verses.map((v) => v.en || null)
        : await onlineTranslation(surahNum, translationId);
  }
  return {
    ayahs: verses.map((v, i) => ({
      number: v.id,
      arabic: v.ar,
      translation: translations?.[i] || null,
    })),
    translationMissing: wanted && !translations,
    bismillah,
  };
}

/** The Arabic of one ayah (bookmarks list), "" when it can't be read.
 * @param {number} surahNum @param {number} ayahNum @param {string} [riwaya] */
async function ayahArabic(surahNum, ayahNum, riwaya = "hafs") {
  try {
    const { verses } = await versesOf(surahNum, riwaya);
    return verses.find((v) => v.id === ayahNum)?.ar ?? "";
  } catch {
    return "";
  }
}

/** The Arabic of every ayah of a surah in a riwaya (numbered from 1).
 * @param {number} surahNum @param {string} [riwaya] @returns {Promise<string[]>} */
async function surahArabic(surahNum, riwaya = "hafs") {
  const { verses } = await versesOf(surahNum, riwaya);
  return verses.map((v) => v.ar);
}

/** @typedef {{ surah: number, ayah: number, ar: string, en: string }} BundledVerse */

/** Every Hafs ayah with its Sahih International translation (bundled, works offline).
 * @returns {Promise<BundledVerse[]>} */
async function allVerses() {
  const data = await getLocalQuranData();
  return data.flatMap((s) =>
    ((s.Array_Verses && s.Array_Verses[0]) || []).map(
      (/** @type {{ id: number, ar: string, en?: string }} */ v) => ({
        surah: s.Number,
        ayah: v.id,
        ar: v.ar,
        en: v.en ?? "",
      }),
    ),
  );
}

/**
 * The ayahs of a translation that contain a word (AlQuran Cloud's search, online only).
 * null when offline or the search failed; [] when nothing was found.
 * @param {string} keyword @param {string} edition
 * @returns {Promise<{ surah: number, ayah: number, text: string }[] | null>}
 */
async function searchTranslation(keyword, edition) {
  if (!navigator.onLine) return null;
  try {
    const res = await fetch(
      `${ALQURAN_CLOUD_API}/search/${encodeURIComponent(keyword)}/all/${edition}`,
      { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    );
    if (res.status === 404) return []; // its answer for "no match"
    if (!res.ok) throw new Error(`alquran.cloud ${res.status}`);
    const json = await res.json();
    const matches = json?.data?.matches;
    if (!Array.isArray(matches)) return [];
    return matches.map((m) => ({
      surah: Number(m?.surah?.number),
      ayah: Number(m?.numberInSurah),
      text: stripHtmlTags(String(m?.text ?? "")),
    }));
  } catch (e) {
    console.warn("AlQuran Cloud search failed:", e);
    return null;
  }
}

/** @param {string} str */
function stripHtmlTags(str) {
  return str
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

module.exports = {
  fetchQuranSurah,
  ayahArabic,
  surahArabic,
  allVerses,
  searchTranslation,
  TRANSLATIONS,
};
