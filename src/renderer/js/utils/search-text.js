"use strict";

// Text as a search compares it: no tashkeel or tatweel and every alif written the same, so
// "الرحمن" finds "الرَّحْمَنُ"; Latin without accents, case or punctuation, and doubled letters
// once, so "ar-rahman" finds "Ar Rahmaan". The usual spellings of the same long vowel are one:
// ee = i, oo / ou = u ("Yassin" finds "Yaseen", "Younous" finds "Yunus").
/** @param {string} text */
function normalizeForSearch(text) {
  return text
    .toLowerCase()
    .replace(/ee/g, "i")
    .replace(/o[ou]/g, "u")
    .normalize("NFD")
    .replace(/[̀-ًͯ-ٰٟۡـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ء/g, "")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .replace(/(\p{L})\1+/gu, "$1");
}

module.exports = { normalizeForSearch };
