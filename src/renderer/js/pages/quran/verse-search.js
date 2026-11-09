"use strict";

// Finding the ayahs that contain a word, in the Arabic text or a translation.
//
// Words are compared as search-text.js writes them (no tashkeel, one alif, ة = ه, no case or
// accents). A query word matches a word of the ayah that BEGINS with it, never one that only
// has it inside. Arabic words may carry و ف ب ك ل and ال in front: they are skipped, so "صبر"
// finds "الصبر", "بالصبر", "فاصبر", "الصابرين".
// The Quran's (Uthmani) spelling is not the one people type: "ٱلصَّلَوٰةَ" has a و where we
// write ا, "ٱلۡكِتَٰبِ" a small alif above a letter, "إِبۡرَٰهِـۧمَ" a small ي. The small letters
// are read as full ones (و + small alif = ا), and an Arabic word is compared without its
// alifs, so "الصلاة", "كتاب", "ابراهيم" and "الرحمن" all find their words.
// Several words: the ayah must have them all, in any order (as Tanzil does).
//
// Where the text comes from:
//   Arabic letters typed      the bundled Hafs text (offline)
//   Latin, French interface   AlQuran Cloud's Hamidullah translation (online); offline, the
//                             bundled English one, and the page says so
//   Latin, other interfaces   the bundled Sahih International translation (offline)
const { normalizeForSearch } = require("../../utils/search-text");
const {
  allVerses,
  searchTranslation,
} = require("../../services/api/alquran-cloud");

/** @typedef {{ surah: number, ayah: number, text: string, lang: "ar" | "en" | "fr" }} VerseHit */

const ARABIC = /[؀-ۿ]/;
const PREFIXES = [
  "وال",
  "فال",
  "بال",
  "كال",
  "ال",
  "ول",
  "فل",
  "وب",
  "فب",
  "وك",
  "و",
  "ف",
  "ب",
  "ك",
  "ل",
];

/** A word as compared: the Uthmani small letters as full ones, then search-text.js.
 * @param {string} word */
const keyOf = (word) =>
  normalizeForSearch(
    word
      .replace(/وٰ/g, "ا") // و + small alif = ا (صلوٰة)
      .replace(/ٰ/g, "ا") // small alif = ا (كتٰب)
      .replace(/ۦ|ۧ/g, "ي"), // small ي = ي (إبرٰهـۧم)
  );

/** The words of a text as compared. @param {string} text */
const wordsOf = (text) => text.split(/\s+/u).map(keyOf).filter(Boolean);

/** @param {string} s */
const noAlif = (s) => s.replace(/ا/g, "");

/** Does an ayah's word begin with the query word? (Arabic: after its prefixes; a final ة also
 * matches its ت form: "رحمة" finds "رحمته".) @param {string} word @param {string} q */
function wordMatches(word, q) {
  if (!ARABIC.test(q)) return word.startsWith(q);
  const wanted = [noAlif(q)];
  if (q.endsWith("ه")) wanted.push(noAlif(`${q.slice(0, -1)}ت`));
  const starts = [
    word,
    ...PREFIXES.filter((p) => word.length > p.length && word.startsWith(p)).map(
      (p) => word.slice(p.length),
    ),
  ].map(noAlif);
  return starts.some((s) => wanted.some((w) => w && s.startsWith(w)));
}

/** @param {string[]} words @param {string[]} query */
const hasAll = (words, query) =>
  query.every((q) => words.some((w) => wordMatches(w, q)));

/** The query as words to find; [] when too short to search (under 2 letters). @param {string} query */
function queryWords(query) {
  const words = wordsOf(query);
  return words.join("").length >= 2 && !/^\d+$/.test(words.join(""))
    ? words
    : [];
}

/** Is this query searched in the Arabic text? @param {string} query */
const isArabicQuery = (query) => ARABIC.test(query);

/**
 * Splits a text into parts, the matching words marked, for highlighting.
 * @param {string} text @param {string[]} query from queryWords
 * @returns {{ text: string, hit: boolean }[]}
 */
function markWords(text, query) {
  return text
    .split(/(\s+)/u)
    .filter(Boolean)
    .map((part) => {
      const w = keyOf(part);
      return {
        text: part,
        hit: Boolean(w) && query.some((q) => wordMatches(w, q)),
      };
    });
}

/** @type {Promise<{ surah: number, ayah: number, ar: string, en: string, arWords: string[], enWords: string[] }[]> | null} */
let index = null;

/** The bundled ayahs with their words ready to compare (built once, on the first search). */
function getIndex() {
  index ??= allVerses().then((verses) =>
    verses.map((v) => ({
      ...v,
      arWords: wordsOf(v.ar),
      enWords: wordsOf(v.en),
    })),
  );
  index.catch(() => {
    index = null; // try again next time
  });
  return index;
}

/**
 * The ayahs containing the words, in Quran order.
 * @param {string} query what was typed
 * @param {string} uiLang the interface language
 * @returns {Promise<{ hits: VerseHit[], words: string[], fellBack: boolean }>}
 *   fellBack: French was wanted but offline, so the English translation was searched
 */
async function findVerses(query, uiLang) {
  const words = queryWords(query);
  if (!words.length) return { hits: [], words, fellBack: false };

  if (isArabicQuery(query)) {
    const all = await getIndex();
    const hits = all
      .filter((v) => hasAll(v.arWords, words))
      .map((v) => ({
        surah: v.surah,
        ayah: v.ayah,
        text: v.ar,
        lang: /** @type {const} */ ("ar"),
      }));
    return { hits, words, fellBack: false };
  }

  if (uiLang === "fr") {
    const found = await searchTranslation(query.trim(), "fr.hamidullah");
    if (found) {
      const hits = found
        .filter((m) => hasAll(wordsOf(m.text), words))
        .map((m) => ({ ...m, lang: /** @type {const} */ ("fr") }));
      return { hits, words, fellBack: false };
    }
  }
  const all = await getIndex();
  const hits = all
    .filter((v) => hasAll(v.enWords, words))
    .map((v) => ({
      surah: v.surah,
      ayah: v.ayah,
      text: v.en,
      lang: /** @type {const} */ ("en"),
    }));
  return { hits, words, fellBack: uiLang === "fr" };
}

module.exports = { findVerses, markWords, queryWords, wordMatches };
