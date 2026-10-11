"use strict";

// What the Quran page shows right now (shared by its modules), the surah/juz tables, and how the
// page writes numbers.
const { t } = require("../../core/i18n");
const { formatNumerals } = require("../../utils/numerals");
const quranIndex = require("../../../data/quran-index.json");

/** @typedef {{ n: number, ar: string, en: string, count: number, type: string }} SurahMeta */

/** @type {SurahMeta[]} */
const SURAH_META = quranIndex.surahs;
const JUZ_META = quranIndex.juz;

const state = {
  /** @type {SurahMeta[]} */
  surahs: [],
  /** @type {SurahMeta[]} */
  filteredSurahs: [],
  /** @type {SurahMeta | null} */
  currentSurah: null,
  /** @type {any[]} */
  currentAyahs: [],
  fontSize: 26,
  translationId: "none",
  settingsOpen: true,
  activeTab: "surah",
  numerals: "latin", // "arabic" (٠١٢٣) or "latin" (0123); resolved in initQuranPage
};

const fmt = (value) => formatNumerals(value, state.numerals);

// "Meccan" / "Medinan" in the UI language.
function revelationPlace(surah) {
  return t(surah.type === "Meccan" ? "meccan" : "medinan");
}

module.exports = { state, fmt, revelationPlace, SURAH_META, JUZ_META };
