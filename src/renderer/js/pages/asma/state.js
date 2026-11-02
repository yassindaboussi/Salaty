"use strict";

// The 99 names (data/99_Names_Of_Allah.json, bundled) and what the page shows now.
const { getNamesOfAllah } = require("../../services/content");
const quranIndex = require("../../../data/quran-index.json");
const { normalizeForSearch: normalize } = require("../../utils/search-text");

/**
 * @typedef {{ surah: number, ayah: number, last: number }} VerseRef  a verse, or a range
 * @typedef {{ number: number, name: string, translit: string, meaning: string,
 *   desc: string, verses: VerseRef[], search: string }} Name
 */

/** @type {{ surahs: { n: number, ar: string, en: string, count: number }[] }} */
const { surahs } = quranIndex;

const pageState = {
  /** @type {Name[]} */
  names: [],
  selected: 1, // the name's number (1-99)
  query: "",
};

// "(2:163) (3:31)(82:10-12)" → verses; one that does not exist in the Mushaf is dropped.
/** @returns {VerseRef[]} */
function parseVerses(found) {
  const verses = [];
  for (const m of String(found).matchAll(
    /(\d+)\s*:\s*(\d+)(?:\s*-\s*(\d+))?/g,
  )) {
    const surah = Number(m[1]);
    const ayah = Number(m[2]);
    const last = Number(m[3] || m[2]);
    const meta = surahs[surah - 1];
    if (meta && ayah >= 1 && last >= ayah && last <= meta.count) {
      verses.push({ surah, ayah, last });
    }
  }
  return verses;
}

/** @param {string} lang  "en" | "fr" | "ar" */
async function loadNames(lang) {
  const { data } = await getNamesOfAllah();
  pageState.names = data.map((item) => {
    const texts = item[lang] || item.en;
    const meaning = String(texts.meaning || "").trim();
    return {
      number: item.number,
      name: item.name,
      translit: item.transliteration,
      meaning,
      desc: String(texts.desc || "").trim(),
      verses: parseVerses(item.found),
      search: [item.name, item.transliteration, meaning]
        .map((part) => normalize(String(part)))
        .join(" "),
    };
  });
}

/** @param {number} number */
const nameByNumber = (number) =>
  pageState.names.find((n) => n.number === number) ?? pageState.names[0];

/** @returns {Name[]} the names matching the search (a number finds that name only) */
function visibleNames() {
  const query = normalize(pageState.query);
  if (!query) return pageState.names;
  if (/^\d+$/.test(query)) {
    return pageState.names.filter((n) => n.number === Number(query));
  }
  return pageState.names.filter((n) => n.search.includes(query));
}

/** @param {number} surah  its name in the UI language */
const surahName = (surah, lang) =>
  lang === "ar" ? surahs[surah - 1].ar : surahs[surah - 1].en;

module.exports = {
  pageState,
  loadNames,
  nameByNumber,
  visibleNames,
  surahName,
};
