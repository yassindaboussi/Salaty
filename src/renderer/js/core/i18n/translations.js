// translations.js — loads locale files split by language and domain.
// The public API (t, setLanguage, getLanguage, applyLanguageDirection) is unchanged.

function _buildLocale(lang) {
  const l = (domain, file) =>
    require(`../../../locales/${lang}/${domain}/${file}.json`);
  const sys = l("system", "system");

  return {
    prayerNames: l("worship", "prayers"),
    themes: l("app", "themes"),
    islamicEvents: l("worship", "events"),
    common: sys.common,
    offline: sys.offline,
    ui: {
      ...l("app", "common"),
      ...l("worship", "prayer"),
      ...l("app", "settings"),
      ...l("app", "location"),
      ...l("worship", "quran"),
      ...l("worship", "athkar"),
      ...l("worship", "tasbih"),
      ...l("worship", "ramadan"),
      ...l("worship", "asma"),
      ...l("worship", "qibla"),
      ...l("worship", "calendar"),
      ...l("media", "media"),
      ...l("app", "features"),
      ...l("app", "updates"),
    },
  };
}

const translations = {
  en: _buildLocale("en"),
  ar: _buildLocale("ar"),
  fr: _buildLocale("fr"),
};

let currentLanguage = "en";

function setLanguage(lang) {
  currentLanguage = lang;
}
function getLanguage() {
  return currentLanguage;
}

/**
 * Translate a key.
 * @param {string} key     - flat key, e.g. 'loading' or dotted 'event.date'
 * @param {string} section - top-level section (default: 'ui')
 */
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
  setLanguage,
  getLanguage,
  t,
  applyLanguageDirection,
};
