"use strict";

// What the Quran page shows right now (shared by its modules), the surah/juz tables, and how the
// page writes numbers and surah names.
const { t, getLanguage } = require("../../core/i18n");
const { formatNumerals } = require("../../utils/numerals");
const quranIndex = require("../../../data/quran-index.json");

/** @typedef {{ n: number, ar: string, en: string, count: number, type: string }} SurahMeta */
/** @typedef {{ n: number, surah: number, ayah: number }} JuzStart */

/** @type {SurahMeta[]} */
const SURAH_META = quranIndex.surahs;

/** The 30 juz and the ayah each starts at ("Al-Baqara 2:142" in the data). @type {JuzStart[]} */
const JUZ_META = quranIndex.juz.map(
  (/** @type {{ n: number, start: string }} */ j) => {
    const [surah, ayah] = String(j.start.split(" ").at(-1))
      .split(":")
      .map(Number);
    return { n: j.n, surah, ayah };
  },
);

const state = {
  /** @type {SurahMeta[]} */
  filteredSurahs: [],
  /** @type {SurahMeta | null} */
  currentSurah: null,
  /** @type {import("../../services/api/alquran-cloud").Ayah[]} */
  currentAyahs: [],
  fontSize: 28,
  translationId: "none",
  activeTab: "surah",
  numerals: "latin", // "arabic" (٠١٢٣) or "latin" (0123); resolved in initQuranPage
};

/** @param {number | string} value */
const fmt = (value) => formatNumerals(value, state.numerals);

/** @param {number} n */
const surahMeta = (n) => SURAH_META.find((s) => s.n === n) ?? null;

/** The surah's name for the UI: Arabic in the Arabic UI, else the transliteration. @param {SurahMeta} s */
const surahName = (s) => (getLanguage() === "ar" ? s.ar : s.en);

/** Between the parts of a line: "·" reads like the Arabic zero (٠), so a comma in Arabic. */
const sep = () => (getLanguage() === "ar" ? "، " : " · ");

/** "Meccan" / "Medinan" in the UI language. @param {SurahMeta} surah */
function revelationPlace(surah) {
  return t(surah.type === "Meccan" ? "meccan" : "medinan");
}

/** "Ayahs: 286" (a label, so no plural forms are needed in any language). @param {number} n */
const ayahCount = (n) => t("quranAyahCount").replace("{count}", fmt(n));

/** "Al-Baqara 2:255" with the page's digits. @param {number} surah @param {number} ayah */
function ayahPlace(surah, ayah) {
  const meta = surahMeta(surah);
  return `${meta ? surahName(meta) : ""} ${fmt(surah)}:${fmt(ayah)}`.trim();
}

module.exports = {
  state,
  fmt,
  surahMeta,
  surahName,
  sep,
  revelationPlace,
  ayahCount,
  ayahPlace,
  SURAH_META,
  JUZ_META,
};
