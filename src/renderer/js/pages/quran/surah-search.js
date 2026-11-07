"use strict";

// Finding a surah by any name people type for it.
//
// Every surah's names come from data/surah-search-names.json: the usual spellings (quran.com,
// AlQuran.cloud, Tanzil), the English and French meanings ("The Cow", "La Vache"), the other
// names in use (براءة, بني إسرائيل, المؤمن, حم السجدة, تبارك, عم, الدهر, تبت…), how the surahs
// named after letters are said (يس = ياسين, طه = طاها, ص = صاد, ق = قاف, ن = نون) and common
// French spellings (Youssouf, Myriam, Loqmane). Three steps, the first that finds anything wins:
//   1. the number (٣٦ too)
//   2. the name, compared without tashkeel, accents, case, alif / hamza forms (search-text.js);
//      "سورة" / "surah" / "sourate" typed before it is left out
//   3. a Latin spelling not in the list: its consonants only (Loqmane = l-q-m-n = Luqman), from
//      3 consonants up so a short word doesn't match everything
const { toWestern } = require("../../utils/numerals");
const { normalizeForSearch } = require("../../utils/search-text");
const NAMES = require("../../../data/surah-search-names.json");

/** @typedef {{ n: number, en: string, ar: string }} Surah */

/** @type {Record<string, string[] | undefined>} */
const ALL_NAMES = NAMES;

const SURAH_WORD =
  /^\s*(?:سورة|سوره|surah?|surat|sourate?|sourat|soura)(?:[\s.:-]+|$)/iu;

/** Latin consonants only, the sounds written in several ways made one. */
const skeleton = (/** @type {string} */ text) =>
  normalizeForSearch(text)
    .replace(/ch/g, "sh")
    .replace(/dh/g, "z")
    .replace(/q/g, "k")
    .replace(/[^a-z]/g, "")
    .replace(/[aeiouyw]/g, "")
    .replace(/(.)\1+/g, "$1");

/**
 * A name as searched: its words written together ("al kahf" -> "alkahf", so a query typed
 * with or without spaces finds it) and where each word starts. A match must begin at a word
 * start, never inside a word or across two ("ياس" is in "بني إسرائيل" written together, but
 * not at a word start: no match). "ال" counts as its own word: "بقرة" finds "البقرة".
 * @typedef {{ joined: string, starts: Set<number> }} Name
 */

/** @param {string} raw @returns {Name} */
function nameOf(raw) {
  const words = raw
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .map(normalizeForSearch)
    .filter(Boolean);
  const starts = new Set();
  let joined = "";
  for (const word of words) {
    starts.add(joined.length);
    if (word.startsWith("ال") && word.length > 2) starts.add(joined.length + 2);
    joined += word;
  }
  return { joined, starts };
}

/** @param {Name} name @param {string} q */
function matches(name, q) {
  for (
    let i = name.joined.indexOf(q);
    i !== -1;
    i = name.joined.indexOf(q, i + 1)
  )
    if (name.starts.has(i)) return true;
  return false;
}

/** @type {{ names: Map<number, Name[]>, bones: Map<number, string> } | null} */
let index = null;

/** @param {Surah[]} surahs */
function buildIndex(surahs) {
  /** @param {Surah} s */
  const namesOf = (s) => [s.en, s.ar, ...(ALL_NAMES[String(s.n)] ?? [])];
  return {
    names: new Map(surahs.map((s) => [s.n, namesOf(s).map(nameOf)])),
    bones: new Map(
      surahs.map((s) => [s.n, namesOf(s).map(skeleton).join(" ")]),
    ),
  };
}

/**
 * @template {Surah} T
 * @param {T[]} surahs all of them, in order
 * @param {string} query what was typed
 * @returns {T[]}
 */
function findSurahs(surahs, query) {
  const typed = toWestern(query).replace(SURAH_WORD, "").trim();
  const q = nameOf(typed).joined; // word by word, as the names are
  if (!q) return [...surahs];
  if (/^\d+$/.test(q)) return surahs.filter((s) => String(s.n) === q);

  index ??= buildIndex(surahs);
  const found = surahs.filter((s) =>
    index?.names.get(s.n)?.some((name) => matches(name, q)),
  );
  if (found.length) return found;

  const bones = skeleton(typed);
  if (bones.length < 3) return [];
  return surahs.filter((s) => index?.bones.get(s.n)?.includes(bones));
}

module.exports = { findSurahs };
