"use strict";

const LOCALES_BASE = "../../locales";

async function _fetchJSON(relativePath) {
  const res = await fetch(`${LOCALES_BASE}/${relativePath}`);
  if (!res.ok) {
    throw new Error(`Failed to load locale file: ${relativePath} (${res.status})`);
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

function t(key, section = "ui") {
  const lang = currentLanguage;
  const parts = key.split(".");
  let value = translations[lang]?.[section];
  for (const part of parts) {
    value = value?.[part];
  }
  return value ?? key;
}

function applyLanguageDirection() {
  const isRTL = currentLanguage === "ar";
  document.documentElement.dir = isRTL ? "rtl" : "ltr";
  document.documentElement.lang = currentLanguage;
  document.body.classList.toggle("rtl", isRTL);
}

module.exports = {
  translations,
  whenReady,
  setLanguage,
  getLanguage,
  t,
  applyLanguageDirection,
};
