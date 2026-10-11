"use strict";

// Reciter letters: the letter a name is listed under, the alphabet order of the letter sections,
// and the A–Z index beside the grid that jumps to them.
const { getLanguage } = require("../../core/i18n");
/** @typedef {import("./index").AlbumsPage} AlbumsPage */

const ARABIC_ALPHABET = [
  "ا",
  "ب",
  "ت",
  "ث",
  "ج",
  "ح",
  "خ",
  "د",
  "ذ",
  "ر",
  "ز",
  "س",
  "ش",
  "ص",
  "ض",
  "ط",
  "ظ",
  "ع",
  "غ",
  "ف",
  "ق",
  "ك",
  "ل",
  "م",
  "ن",
  "ه",
  "و",
  "ي",
];
const LATIN_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function groupingLetter(name) {
  const raw = (name || "#").trim();
  if (!raw) return "#";
  const first = raw
    .normalize("NFKD")
    .replace(/[\u0617-\u061A\u064B-\u0652]/g, "")
    .charAt(0);
  if (/[\u0621-\u064A]/.test(first)) {
    return first.replace(/[إأآ]/, "ا");
  }
  if (/[A-Za-z]/.test(first)) return first.toUpperCase();
  return "#";
}

/** @param {AlbumsPage} page */
function buildAzIndex(page, availableLetters) {
  const alphabet = [
    ...(getLanguage() === "ar" ? ARABIC_ALPHABET : LATIN_ALPHABET),
    "#",
  ];
  const available = new Set(availableLetters);

  alphabet.forEach((letter) => {
    const el = document.createElement("span");
    el.className = "az-index-letter";
    el.textContent = letter;
    if (available.has(letter)) {
      el.classList.add("has-entries");
      el.addEventListener("click", () => {
        document
          .getElementById(`reciter-section-${letter}`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    page.azIndex.appendChild(el);
  });
}

module.exports = {
  ARABIC_ALPHABET,
  LATIN_ALPHABET,
  groupingLetter,
  buildAzIndex,
};
