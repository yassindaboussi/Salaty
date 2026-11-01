"use strict";

// A dhikr's reference line, with its sources as links so the user can check them: a hadith opens
// on sunnah.com ("Sahih Muslim 2723" → sunnah.com/muslim:2723), a Quran verse opens the app's
// Quran page at that ayah. The rest of the line (a short note) stays plain text.
const { t, getLanguage } = require("../../core/i18n");
const { html } = require("../../utils/html");

// The hadith books as they are written in adkar.json (en, fr, ar) → sunnah.com's name
/** @type {[RegExp, string][]} */
const BOOKS = [
  [/Sahih al-B(?:u|ou)khari|صحيح البخاري/, "bukhari"],
  [/Sahih M(?:u|ou)slim|صحيح مسلم/, "muslim"],
  [/Sunan Abi Dawud|Sunan Abou Daoud|سنن أبي داود/, "abudawud"],
  [/Jami[`'] at-Tirmidhi|سنن الترمذي/, "tirmidhi"],
];
const HADITH = new RegExp(
  `(${BOOKS.map(([re]) => re.source).join("|")}) (\\d+)`,
  "g",
);

/** @param {string} book  the name as written → its sunnah.com name */
const slugOf = (book) => BOOKS.find(([re]) => re.test(book))?.[1] ?? "";

// "Al-Baqarah 2:127-128 ; Ibrahim 14:40" → the verses, in order (the English line always has the
// numbers; the Arabic one, "[البقرة - 127-128]", has only the surah's name)
const VERSE = /(\d+):(\d+)/;

/** @param {string} label @param {string} url */
const hadithLink = (label, url) =>
  html`<button type="button" class="ak-source" data-href="${url}" data-tip="${t("akOpenSunnah")}" aria-label="${t("akOpenSunnah")}: ${label}">${label}</button>`;

/** @param {string} label @param {number} surah @param {number} ayah */
const verseLink = (label, surah, ayah) =>
  html`<button type="button" class="ak-source" data-surah="${surah}" data-ayah="${ayah}" data-tip="${t("akOpenQuran")}" aria-label="${t("akOpenQuran")}: ${label}">${label}</button>`;

/** @param {import("./state").Dhikr & Record<string, any>} item */
function referenceHtml(item) {
  const lang = getLanguage();
  const text =
    (lang !== "ar" && item[`reference_${lang}`]) || item.reference || "";
  if (!text) return "";

  if (item.grade === "quran") {
    const verses = String(item.reference_en ?? "")
      .split(";")
      .map((part) => part.match(VERSE))
      .map((m) => (m ? { surah: Number(m[1]), ayah: Number(m[2]) } : null));
    // the parts as shown: "Al-Baqarah 2:201" (en, fr) or "[البقرة - 201]" (ar)
    const parts =
      lang === "ar"
        ? (text.match(/\[[^\]]+\]/g) ?? [text])
        : text.split(";").map((part) => part.trim());
    return html`${parts.map((part, i) => {
      const v = verses[i];
      return html`${i ? " " : ""}${v ? verseLink(part.replace(/^\[|\]$/g, ""), v.surah, v.ayah) : part}`;
    })}`;
  }

  // hadith: each "Book 1234" becomes a link, the text around it stays
  const pieces = [];
  let last = 0;
  for (const m of text.matchAll(HADITH)) {
    const index = m.index ?? 0;
    pieces.push(text.slice(last, index));
    pieces.push(hadithLink(m[0], `https://sunnah.com/${slugOf(m[1])}:${m[2]}`));
    last = index + m[0].length;
  }
  pieces.push(text.slice(last));
  return html`${pieces}`;
}

module.exports = { referenceHtml };
