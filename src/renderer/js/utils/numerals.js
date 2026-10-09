"use strict";

// Digit conversion between Western (0-9) and Arabic-Indic (٠-٩) numerals.
// Only digits are touched; letters, punctuation and separators such as "2:142" keep their shape.

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";

/** "Al-Baqara 2:142" -> "Al-Baqara ٢:١٤٢" */
function toArabicIndic(value) {
  return String(value).replace(/[0-9]/g, (d) => ARABIC_INDIC[Number(d)]);
}

/** Accepts Arabic-Indic (٠-٩) and Persian (۰-۹) digits, e.g. from a search box. */
function toWestern(value) {
  return String(value)
    .replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/** mode: "arabic" for ٠١٢٣, anything else for 0123. */
function formatNumerals(value, mode) {
  return mode === "arabic" ? toArabicIndic(value) : String(value);
}

module.exports = { toArabicIndic, toWestern, formatNumerals };
