"use strict";

// The radios: the national Quran stations (bundled, data/radioStations.json) and the reciter
// radios of mp3quran.net (one per reciter, a few on a theme), loaded when their tab first opens
// and kept for a day (services/api/mp3quran.js). A reciter radio gets the reciter's photo from
// data/radio-reciters.json (radio id → reciter id, matched once by name).
const { t, getLanguage } = require("../../core/i18n");
const mp3quranApi = require("../../services/api/mp3quran");
const { stations } = require("../../../data/radioStations.json");
const { map: reciterOfRadio } = require("../../../data/radio-reciters.json");

/** @returns {import("./state").RadioItem[]} */
function stationItems() {
  const lang = getLanguage();
  return stations.map((s) => ({
    key: `station:${s.id}`,
    kind: "station",
    name: s.name[lang] || s.name.en,
    sub: s.country[lang] || s.country.en,
    url: s.url,
    image: s.image,
  }));
}

/** "Radio Ibrahim Al-Akdar", "-Main Radio-" → "Ibrahim Al-Akdar", "Main Radio" @param {string} name */
const cleanName = (name) =>
  String(name)
    .replace(/^[\s-]+|[\s-]+$/g, "")
    .replace(/^(radio|إذاعة|اذاعة)\s+/i, "")
    .replace(/\s+-\s+radio$/i, "")
    .trim();

/** @returns {Promise<import("./state").RadioItem[]>} */
async function loadReciterItems() {
  const radios = await mp3quranApi.getRadios(mp3quranApi.apiLanguage());
  return radios.map((r) => {
    /** @type {Record<string, number>} */
    const map = reciterOfRadio;
    const reciterId = map[String(r.id)];
    return {
      key: `reciter:${r.id}`,
      kind: "reciter",
      name: cleanName(r.name),
      sub: t("rdReciterSub"),
      url: r.url,
      reciterId,
    };
  });
}

module.exports = { stationItems, loadReciterItems };
