"use strict";

// A dhikr's meaning, source and hadith links in the UI language. The Sunnah ones have
// translated texts (locales/<lang>/worship/tasbih.json); the user's own have what they wrote.
const { t, getLanguage } = require("../../core/i18n");
const { html } = require("../../utils/html");

/**
 * The meaning shown under the words: the user's own always; a Sunnah one's translation,
 * except in Arabic (the words are their own meaning there).
 * @param {import("./state").Dhikr} dhikr
 */
const meaningOf = (dhikr) =>
  dhikr.custom
    ? (dhikr.meaning ?? "")
    : getLanguage() === "ar"
      ? ""
      : t(dhikr.meaningKey ?? "");

/** "33× after each prayer — Sahih Muslim 596", or "Your dhikr". @param {import("./state").Dhikr} dhikr */
const sourceOf = (dhikr) =>
  dhikr.custom ? t("tbYourDhikr") : t(dhikr.sourceKey ?? "");

/** "muslim:596" → "Muslim 596" */
const NAMES = {
  bukhari: "Bukhari",
  muslim: "Muslim",
  tirmidhi: "Tirmidhi",
  abudawud: "Abu Dawud",
};
/** @param {string} ref */
const refName = (ref) => {
  const [book, number] = ref.split(":");
  return `${NAMES[/** @type {keyof typeof NAMES} */ (book)] ?? book} ${number}`;
};

/**
 * The hadith references as buttons opening sunnah.com (index.js handles data-source).
 * @param {import("./state").Dhikr} dhikr
 */
const referenceLinks = (dhikr) =>
  html`${(dhikr.references ?? []).map(
    (ref) =>
      html`<button type="button" class="tb-source" data-source="https://sunnah.com/${ref}" aria-label="${t("tbSourceLabel").replace("{ref}", refName(ref))}">${refName(ref)}</button>`,
  )}`;

module.exports = { meaningOf, sourceOf, referenceLinks, refName };
