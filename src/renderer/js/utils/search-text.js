"use strict";

// Text as a search compares it: no tashkeel or tatweel and every alif written the same, so
// "الرحمن" finds "الرَّحْمَنُ"; Latin without accents, case or punctuation, and doubled letters
// once, so "ar-rahman" finds "Ar Rahmaan".
/** @param {string} text */
function normalizeForSearch(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ًͯ-ٰٟۡـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .replace(/(\p{L})\1+/gu, "$1");
}

module.exports = { normalizeForSearch };
