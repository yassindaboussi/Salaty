"use strict";

// Surah text for the Quran reader. The Arabic (Hafs) always comes from the bundled data: it works
// offline, matches the bundled Quran font, and has the Bismillah only where it is an ayah (1:1).
// (AlQuran Cloud's text puts it at the start of ayah 1 of every surah, which doubled it under
// the page's own Bismillah line.) Translations come from AlQuran Cloud; Sahih International is
// also bundled, so it works offline too.

const ALQURAN_CLOUD_API = "https://api.alquran.cloud/v1";

/** The translations offered (AlQuran Cloud edition ids). */
const TRANSLATIONS = new Set(["en.sahih", "en.asad", "fr.hamidullah"]);
const BUNDLED_TRANSLATION = "en.sahih";

/**
 * @typedef {object} Ayah
 * @property {number} number          in the surah
 * @property {string} arabic
 * @property {string | null} translation
 *
 * @typedef {object} SurahText
 * @property {Ayah[]} ayahs
 * @property {boolean} translationMissing  a translation was asked for but could not be loaded
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
 * @param {string} translationId  an edition id, or "none"
 * @returns {Promise<SurahText>}
 */
async function fetchQuranSurah(surahNum, translationId) {
  const verses = await localVerses(surahNum);
  /** @type {(string | null)[] | null} */
  let translations = null;
  if (TRANSLATIONS.has(translationId)) {
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
    translationMissing: TRANSLATIONS.has(translationId) && !translations,
  };
}

/** The Arabic of one ayah (bookmarks list), "" when it can't be read. */
async function ayahArabic(surahNum, ayahNum) {
  try {
    const verses = await localVerses(surahNum);
    return verses.find((v) => v.id === ayahNum)?.ar ?? "";
  } catch {
    return "";
  }
}

/** @param {string} str */
function stripHtmlTags(str) {
  return str
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

module.exports = { fetchQuranSurah, ayahArabic };
