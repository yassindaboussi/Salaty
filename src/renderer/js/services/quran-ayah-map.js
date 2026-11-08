"use strict";

// The same place of a surah in another riwaya. Hafs counts the ayahs the Kufan way, Qalun and
// Warsh the later Madani way: in some places one count ends an ayah where the other goes on
// (Al-Fatiha: the Bismillah is ayah 1 in Hafs only; Maryam: كهيعص is an ayah in Hafs only;
// Al-Baqara 200-201 are one ayah in the Madani count), so the same number is not always the
// same words. The place is found by the words: where the ayah's first word is, counted from
// the start of the surah, gives an estimate; the ayah of the other text starting with that same
// word near it is the answer (the spellings differ, and in 7 surahs by a joined word or two,
// so the count alone can be off by an ayah). When no ayah starts there (the other count joins
// it to the one before), it is the ayah that holds that word.
const { surahArabic } = require("./api/alquran-cloud");

/** Words with Arabic letters (not the stop marks written between words). */
const ARABIC_LETTER = /[ء-يٱ-ۓ]/;
/** @param {string} text */
const wordsOf = (text) =>
  text.split(/\s+/).filter((w) => ARABIC_LETTER.test(w));

/** The first consonants of a word, spelling aside (no marks, alifs, hamzas, waw / ya letters).
 * @param {string} word */
const skeleton = (word) =>
  word
    .replace(/[ئيىےیؤو]/g, "")
    .replace(/ة/g, "ه")
    .replace(/[^ب-غف-ي]/g, "")
    .slice(0, 3);

/** How far (in words) the estimate may be from the ayah looked for. */
const WINDOW = 8;

/** Ayahs not in the other count's words: Al-Fatiha's Bismillah in Hafs.
 * @param {number} surah @param {string} riwaya */
const skipped = (surah, riwaya) => (surah === 1 && riwaya === "hafs" ? 1 : 0);

/**
 * Whether an ayah starts with the same word: spelling aside, also with a qira'a's letter in
 * front (تكاد / يكاد, وتوكل / فتوكل) or the word written joined or apart (ومالي / وما لي).
 * @param {string[]} words  the ayah's words @param {string[]} from  the words looked for
 */
function startsAlike(words, from) {
  const a1 = skeleton(words[0] ?? "");
  const a2 = skeleton(words.slice(0, 2).join(""));
  const b1 = skeleton(from[0] ?? "");
  const b2 = skeleton(from.slice(0, 2).join(""));
  return (
    a1 === b1 ||
    (b1.length >= 2 && a1.slice(1) === b1.slice(1)) ||
    a2 === b2 ||
    a2.slice(0, 3) === b1 ||
    a1 === b2.slice(0, 3)
  );
}

/**
 * The ayah of `to` that holds the start of `ayah` in `from`.
 * @param {number} surah @param {number} ayah @param {string} from @param {string} to
 * @returns {Promise<number>}
 */
async function mapAyah(surah, ayah, from, to) {
  if (from === to || ayah < 1) return ayah;
  const [source, target] = await Promise.all([
    surahArabic(surah, from),
    surahArabic(surah, to),
  ]);
  const skipFrom = skipped(surah, from);
  if (ayah <= skipFrom || !source[ayah - 1])
    return Math.max(1, Math.min(ayah, target.length));

  let estimate = 0;
  for (let i = skipFrom; i < ayah - 1; i++)
    estimate += wordsOf(source[i]).length;
  const looked = wordsOf(source[ayah - 1]);

  let best = 0;
  let bestGap = Infinity;
  let holding = skipped(surah, to) + 1;
  let position = 0;
  for (let i = skipped(surah, to); i < target.length; i++) {
    const words = wordsOf(target[i]);
    const gap = Math.abs(position - estimate);
    if (gap <= WINDOW && gap < bestGap && startsAlike(words, looked)) {
      best = i + 1;
      bestGap = gap;
    }
    if (position <= estimate) holding = i + 1;
    position += words.length;
  }
  return best || holding;
}

module.exports = { mapAyah };
