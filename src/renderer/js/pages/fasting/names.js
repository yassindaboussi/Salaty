"use strict";

// The names, reasons and hadith sources of the fasts, in the UI language
// (locales/<lang>/worship/fasting.json; the rules: shared/fasting-rules.js).
const { t } = require("../../core/i18n");
const { html } = require("../../utils/html");
const {
  reasonName,
  SOURCES,
  sourceUrl,
} = require("../../../../shared/fasting-rules");

/** a reason on its day: "Thursday", "Tasu'a", "White Day"… */
/** @type {Record<string, string>} */
const DAY_KEYS = {
  monday: "fastChipMonday",
  thursday: "fastChipThursday",
  whiteDays: "fastChipWhiteDay",
  tasua: "fastChipTasua",
  ashura: "fastChipAshura",
  arafah: "fastChipArafah",
  dhulHijjah: "fastChipDhulHijjah",
  shawwal6: "fastChipShawwal",
};

/** a kind of fast, or a day not to fast */
/** @type {Record<string, string>} */
const KIND_KEYS = {
  monThu: "fastNameMonThu",
  whiteDays: "fastNameWhiteDays",
  ashura: "fastNameAshura",
  arafah: "fastNameArafah",
  dhulHijjah: "fastNameDhulHijjah",
  shawwal6: "fastNameShawwal6",
  eidFitr: "fastEidFitr",
  eidAdha: "fastEidAdha",
  tashreeq: "fastTashreeq",
};

/** @type {Record<string, string>} */
const ICONS = {
  monThu: "calendar-week",
  whiteDays: "moon",
  ashura: "star",
  arafah: "mountain-sun",
  dhulHijjah: "kaaba",
  shawwal6: "calendar-check",
  eidFitr: "ban",
  eidAdha: "ban",
  tashreeq: "ban",
};

/**
 * @param {import("../../../../shared/fasting-rules").FastType} type
 * @param {import("./data").FastDay} day
 */
const dayName = (type, day) =>
  t(DAY_KEYS[reasonName(type, day.hijri.day, day.weekday)]);

/** @param {string} kind */
const kindName = (kind) => t(KIND_KEYS[kind]);

/** @param {string} kind */
const iconOf = (kind) => ICONS[kind] ?? "calendar";

/** One line on why (fasting.json "fastWhy<Kind>"). @param {string} kind */
const whyOf = (kind) =>
  t(`fastWhy${kind.charAt(0).toUpperCase()}${kind.slice(1)}`);

/**
 * The hadith references as buttons opening sunnah.com (index.js handles data-source).
 * @param {keyof typeof SOURCES} key
 */
const sourceLinks = (key) =>
  html`<span class="vf-sources">${(SOURCES[key] ?? []).map(
    (ref) =>
      html`<button type="button" class="vf-source" data-source="${sourceUrl(ref) ?? ""}" aria-label="${t("fastSourceLabel").replace("{ref}", ref)}">${ref}</button>`,
  )}</span>`;

module.exports = { dayName, kindName, iconOf, whyOf, sourceLinks };
