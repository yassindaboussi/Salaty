"use strict";

// The reader's text, as markup: without a translation the ayahs run on like a Mushaf page, each
// ending with its number (a button: it opens the ayah's menu). The number is written in
// Arabic-Indic digits in the riwaya's Quran font, which draws them as the riwaya's own ayah mark
// (round for Hafs, a star for Qalun, a pendant for Warsh) sized for one to three digits, as in a
// printed Mushaf; with Western digits the font would leave them bare, so the mark keeps
// Arabic-Indic digits whatever the digits setting (its spoken name follows the setting); with a translation each ayah
// is a card (its number, play, copy and bookmark icons, the Arabic, the translation under it).
const { t } = require("../../core/i18n");
const { html } = require("../../utils/html");
const { formatNumerals } = require("../../utils/numerals");
const { state, fmt, sep } = require("./state");
const { isBookmarked } = require("./bookmarks");

/** The language of the chosen translation, for its `lang` attribute. */
const translationLang = () => state.translationId.split(".")[0] || "en";

/** @param {number} n */
function bookmarkButton(n) {
  const on = isBookmarked(state.currentSurah?.n ?? 0, n);
  const label = t(on ? "quranRemoveBookmark" : "quranAddBookmark");
  return html`<button type="button" class="q-icon-btn ayah-bookmark${on ? " is-on" : ""}" data-action="bookmark" data-ayah="${n}" aria-pressed="${String(on)}" aria-label="${label}" data-tip="${label}"><i class="${on ? "fas" : "far"} fa-bookmark" aria-hidden="true"></i></button>`;
}

/** "Ayah 5" (and "Bookmarked"): the name of an ayah's number in the running text.
 * @param {number} n @param {boolean} bookmarked */
const ayahEndLabel = (n, bookmarked) =>
  [
    t("quranAyahActions").replace("{n}", fmt(n)),
    bookmarked ? t("quranBookmarked") : "",
  ]
    .filter(Boolean)
    .join(sep());

/** The running text of the surah (no translation). */
function flowHtml() {
  return html`<div class="surah-flow" lang="ar" dir="rtl">${state.currentAyahs.map(
    (a) => {
      const on = isBookmarked(state.currentSurah?.n ?? 0, a.number);
      const label = ayahEndLabel(a.number, on);
      return html`<span class="ayah-text" id="ayah-${a.number}" data-ayah="${a.number}">${a.arabic}</span> <button type="button" class="ayah-end${on ? " is-on" : ""}" data-action="menu" data-ayah="${a.number}" aria-haspopup="menu" aria-expanded="false" aria-label="${label}" data-tip="${label}"><span class="ayah-end-mark" aria-hidden="true">${formatNumerals(a.number, "arabic")}</span></button> `;
    },
  )}</div>`;
}

/** One card per ayah: Arabic, then the translation. */
function cardsHtml() {
  const surah = state.currentSurah?.n ?? 0;
  const lang = translationLang();
  return html`${state.currentAyahs.map(
    (
      a,
    ) => html`<article class="ayah-card" id="ayah-${a.number}" data-ayah="${a.number}">
      <div class="ayah-card-head">
        <span class="ayah-card-num">${fmt(surah)}:${fmt(a.number)}</span>
        <span class="ayah-card-actions">
          <button type="button" class="q-icon-btn" data-action="play" data-ayah="${a.number}" aria-label="${t("quranPlayFromHere")}" data-tip="${t("quranPlayFromHere")}"><i class="fas fa-play" aria-hidden="true"></i></button>
          <button type="button" class="q-icon-btn" data-action="copy" data-ayah="${a.number}" aria-label="${t("quranCopyAyah")}" data-tip="${t("quranCopyAyah")}"><i class="far fa-copy" aria-hidden="true"></i></button>
          ${bookmarkButton(a.number)}
        </span>
      </div>
      <p class="ayah-card-ar" lang="ar" dir="rtl">${a.arabic}</p>
      ${a.translation ? html`<p class="ayah-card-tr" lang="${lang}" dir="auto">${a.translation}</p>` : ""}
    </article>`,
  )}`;
}

module.exports = { flowHtml, cardsHtml, ayahEndLabel };
