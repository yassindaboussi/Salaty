"use strict";

// What the Quran page shows right now (shared by its modules), the surah/juz tables, and how the
// page writes numbers and surah names.
const { t, getLanguage } = require("../../core/i18n");
const { formatNumerals } = require("../../utils/numerals");
const quranIndex = require("../../../data/quran-index.json");
const madaniIndex = require("../../../data/quran-madani-index.json");

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

/** @typedef {"hafs" | "qalun" | "warsh"} Riwaya */

/** The riwayat the reader offers: Hafs (Kufan count) and the two of Nafi' (Madani count, read in
 * North Africa: Qalun in Tunisia and Libya, Warsh in the Maghreb and West Africa). */
const RIWAYAT = /** @type {const} */ (["hafs", "qalun", "warsh"]);

/** @param {unknown} v @returns {v is Riwaya} */
const isRiwaya = (v) => RIWAYAT.includes(/** @type {any} */ (v));

/** Where each juz starts in the Madani count. @type {JuzStart[]} */
const MADANI_JUZ = madaniIndex.juz.map(
  (/** @type {number[]} */ start, /** @type {number} */ i) => ({
    n: i + 1,
    surah: start[0],
    ayah: start[1],
  }),
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
  /** @type {Riwaya} */
  riwaya: "hafs",
  activeTab: "surah",
  numerals: "latin", // "arabic" (٠١٢٣) or "latin" (0123); resolved in initQuranPage
};

/** The ayah count of a surah in a riwaya. @param {SurahMeta} s @param {Riwaya} [riwaya] */
const surahCount = (s, riwaya = state.riwaya) =>
  riwaya === "hafs" ? s.count : madaniIndex.counts[s.n - 1];

/** The 30 juz starts in a riwaya. @param {Riwaya} [riwaya] */
const juzStarts = (riwaya = state.riwaya) =>
  riwaya === "hafs" ? JUZ_META : MADANI_JUZ;

/** "Qalun" in the UI language. @param {Riwaya} riwaya */
const riwayaName = (riwaya) =>
  t(`quranRiwaya${riwaya[0].toUpperCase()}${riwaya.slice(1)}`);

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

/**
 * "Al-Baqara 2:255" with the page's digits, and the riwaya after it when it is not Hafs (the
 * numbers differ): "Al-Baqara 2:254 · Qalun".
 * @param {number} surah @param {number} ayah @param {Riwaya} [riwaya]
 */
function ayahPlace(surah, ayah, riwaya = "hafs") {
  const meta = surahMeta(surah);
  const place =
    `${meta ? surahName(meta) : ""} ${fmt(surah)}:${fmt(ayah)}`.trim();
  return riwaya === "hafs" ? place : `${place}${sep()}${riwayaName(riwaya)}`;
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
  surahCount,
  juzStarts,
  riwayaName,
  isRiwaya,
  RIWAYAT,
  SURAH_META,
  JUZ_META,
};
