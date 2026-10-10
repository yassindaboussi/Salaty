"use strict";

const LOCALES_BASE = "../../locales";

async function _fetchJSON(relativePath) {
  const res = await fetch(`${LOCALES_BASE}/${relativePath}`);
  if (!res.ok) {
    throw new Error(
      `Failed to load locale file: ${relativePath} (${res.status})`,
    );
  }
  return res.json();
}

async function _buildLocale(lang) {
  const l = (domain, file) => _fetchJSON(`${lang}/${domain}/${file}.json`);

  const [
    sys,
    prayerNames,
    themes,
    islamicEvents,
    appCommon,
    worshipPrayer,
    appSettings,
    appLocation,
    worshipQuran,
    worshipAthkar,
    worshipTasbih,
    worshipRamadan,
    worshipFasting,
    worshipAsma,
    worshipQibla,
    worshipCalendar,
    media,
    appFeatures,
    appUpdates,
  ] = await Promise.all([
    l("system", "system"),
    l("worship", "prayers"),
    l("app", "themes"),
    l("worship", "events"),
    l("app", "common"),
    l("worship", "prayer"),
    l("app", "settings"),
    l("app", "location"),
    l("worship", "quran"),
    l("worship", "athkar"),
    l("worship", "tasbih"),
    l("worship", "ramadan"),
    l("worship", "fasting"),
    l("worship", "asma"),
    l("worship", "qibla"),
    l("worship", "calendar"),
    l("media", "media"),
    l("app", "features"),
    l("app", "updates"),
  ]);

  return {
    prayerNames,
    themes,
    islamicEvents,
    common: sys.common,
    offline: sys.offline,
    ui: {
      ...appCommon,
      ...worshipPrayer,
      ...appSettings,
      ...appLocation,
      ...worshipQuran,
      ...worshipAthkar,
      ...worshipTasbih,
      ...worshipRamadan,
      ...worshipFasting,
      ...worshipAsma,
      ...worshipQibla,
      ...worshipCalendar,
      ...media,
      ...appFeatures,
      ...appUpdates,
    },
  };
}

const translations = { en: null, ar: null, fr: null };

const _readyPromise = Promise.all([
  _buildLocale("en").then((data) => (translations.en = data)),
  _buildLocale("ar").then((data) => (translations.ar = data)),
  _buildLocale("fr").then((data) => (translations.fr = data)),
]).catch((err) => {
  console.error("[i18n] Failed to load translations:", err);
});

function whenReady() {
  return _readyPromise;
}

let currentLanguage = "en";

function setLanguage(lang) {
  currentLanguage = lang;
}
function getLanguage() {
  return currentLanguage;
}

// Locale tag for Intl / toLocaleDateString (anything unexpected falls back to English).
function getLocaleTag() {
  return ["ar", "fr", "en"].includes(currentLanguage) ? currentLanguage : "en";
}

function t(key, section = "ui") {
  const lang = currentLanguage;
  const parts = key.split(".");
  let value = translations[lang]?.[section];
  for (const part of parts) {
    value = value?.[part];
  }
  return value ?? key;
}

// Static text in the HTML is marked with the key of its translation:
//   <span data-i18n="settings">Settings</span>                text content
//   <title data-i18n="tasbih">…</title>                      window title (+ " - Salaty Time")
//   <input data-i18n-placeholder="searchSurah" placeholder="…">  placeholder attribute
//   <button data-i18n-aria-label="close" aria-label="…">        accessible name
//   <iframe data-i18n-title="makkahLive" title="…">              title attribute
// A key from another section than "ui" is written "section:key" (e.g. "common:date").
// The text written in the HTML is what shows before the translations are applied.
const APP_NAME = "Salaty Time";
const I18N_ATTRIBUTES = {
  i18nPlaceholder: "placeholder",
  i18nAriaLabel: "aria-label",
  i18nTitle: "title",
};

function _translateMarked(value) {
  const sep = value.indexOf(":");
  return sep === -1 ? t(value) : t(value.slice(sep + 1), value.slice(0, sep));
}

function applyTranslations(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    const text = _translateMarked(el.dataset.i18n);
    el.textContent = el.tagName === "TITLE" ? `${text} - ${APP_NAME}` : text;
  });
  for (const [dataKey, attribute] of Object.entries(I18N_ATTRIBUTES)) {
    const selector = `[data-${dataKey.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}]`;
    root.querySelectorAll(selector).forEach((el) => {
      el.setAttribute(attribute, _translateMarked(el.dataset[dataKey]));
    });
  }
}

function applyLanguageDirection() {
  const isRTL = currentLanguage === "ar";
  document.documentElement.dir = isRTL ? "rtl" : "ltr";
  document.documentElement.lang = currentLanguage;
  document.body.classList.toggle("rtl", isRTL);
}

module.exports = {
  whenReady,
  setLanguage,
  getLanguage,
  getLocaleTag,
  t,
  applyTranslations,
  applyLanguageDirection,
};
