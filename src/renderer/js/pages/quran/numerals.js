"use strict";

const { t, getLanguage } = require("../../core/i18n");
const { queryAll } = require("../../core/dom");
const { state } = require("./state");

// ---- Numerals: Arabic-Indic (٠١٢٣) or Western (0123) digits ----
// Default follows the app language (Arabic app -> Arabic digits). Once the user picks one in
// the settings panel, that choice is remembered and wins over the language default.
//
// The remembered choice is stored per app language, and only when it differs from that
// language's default. (An earlier version kept one global value written on every click, so a
// click in Arabic made Arabic digits stick in English and French too; that old key is removed.)
const NUMERALS_KEY_PREFIX = "quranNumerals.";

const LEGACY_NUMERALS_KEY = "quranNumerals";

const defaultNumerals = () => (getLanguage() === "ar" ? "arabic" : "latin");

const numeralsKey = () => NUMERALS_KEY_PREFIX + getLanguage();

function resolveNumerals() {
  try {
    localStorage.removeItem(LEGACY_NUMERALS_KEY);
    const saved = localStorage.getItem(numeralsKey());
    if (saved === "arabic" || saved === "latin") return saved;
  } catch {
    /* storage unavailable: use the language default */
  }
  return defaultNumerals();
}

function updateNumeralsUI() {
  document.body.classList.toggle(
    "numerals-arabic",
    state.numerals === "arabic",
  );
  queryAll(".numerals-btn", HTMLElement).forEach((btn) => {
    const active = btn.dataset.numerals === state.numerals;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", String(active));
    btn.setAttribute(
      "aria-label",
      t(btn.dataset.numerals === "arabic" ? "numeralsArabic" : "numeralsLatin"),
    );
  });
  document
    .getElementById("numeralsGroup")
    ?.setAttribute("aria-label", t("numeralsLabel"));
}

/**
 * Remembers the digit style chosen with the buttons (mode: "arabic" or "latin").
 * @param {() => void} onChange re-draws what shows numbers
 */
function setNumerals(mode, onChange) {
  try {
    // Only a deviation from the language default is worth remembering.
    if (mode === defaultNumerals()) localStorage.removeItem(numeralsKey());
    else localStorage.setItem(numeralsKey(), mode);
  } catch {
    /* storage unavailable: the choice just won't be remembered */
  }
  if (mode === state.numerals) return;
  state.numerals = mode;
  updateNumeralsUI();
  onChange();
}

module.exports = { resolveNumerals, updateNumeralsUI, setNumerals };
