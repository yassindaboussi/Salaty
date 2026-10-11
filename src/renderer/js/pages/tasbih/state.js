"use strict";

// What the tasbih page's modules share: the dhikr list, the dhikr being counted, the saved count
// of each dhikr and the "no limit" choices.

// The dhikr list (Arabic text, counts, hadith references) lives in data/tasbih.json so it can be
// edited and checked in one place. Counts match what is established in authentic hadith
// (Sahih al-Bukhari / Sahih Muslim), not arbitrary round numbers. Where no hadith specifies a
// fixed count the entry has "noFixedCount": true and defaults to "no limit" (∞); its "count"
// is then only the size of one lap on the counter, never presented as a requirement.
// meaningKey / sourceKey point to the translated texts in locales/<lang>/worship/tasbih.json.
const DEFAULT_DHIKR_LIST = require("../../../data/tasbih.json").dhikrList;

// The page's changing values, on one object so that every module sees the same (current) ones.
const pageState = {
  currentDhikr: {
    id: DEFAULT_DHIKR_LIST[0].id,
    name: DEFAULT_DHIKR_LIST[0].name,
    count: DEFAULT_DHIKR_LIST[0].count,
    current: 0,
  },
  tasbihHistory: {},
  unlimitedMap: {},
};

function isUnlimited(dhikrId) {
  return Boolean(pageState.unlimitedMap[dhikrId]);
}

module.exports = { pageState, DEFAULT_DHIKR_LIST, isUnlimited };
