"use strict";

// The saved state (localStorage): each dhikr's count, the last dhikr used and the "no limit"
// choices, and the move of counts saved under the old keys (dhikr names) to ids.
const { pageState, DEFAULT_DHIKR_LIST } = require("./state");

const DEFAULT_UNLIMITED_IDS = DEFAULT_DHIKR_LIST.filter(
  (d) => d.noFixedCount,
).map((d) => d.id);

const LEGACY_NAME_TO_ID = {
  "سُبْحَانَ اللَّهِ": "subhanallah",
  "الْحَمْدُ لِلَّهِ": "alhamdulillah",
  "اللَّهُ أَكْبَرُ": "allahuakbar",
  "لا إله إلا الله": "laIlahaIllallah",
  "لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير":
    "laIlahaIllallah",
  "أستغفر الله": "astaghfirullah",
  "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ": "subhanallahiWaBihamdihi",
};

function loadTasbihState() {
  try {
    const saved = localStorage.getItem("tasbihState");
    if (saved) {
      const parsed = JSON.parse(saved);
      pageState.tasbihHistory = _migrateLegacyKeys(parsed);
    }
    const savedUnlimited = localStorage.getItem("tasbihUnlimitedMap");
    if (savedUnlimited) {
      pageState.unlimitedMap = JSON.parse(savedUnlimited) || {};
    } else {
      // First run: default the dhikr with no fixed hadith count to "no limit"
      DEFAULT_UNLIMITED_IDS.forEach((id) => {
        pageState.unlimitedMap[id] = true;
      });
      saveUnlimitedMap();
    }

    const lastDhikrId = localStorage.getItem("lastDhikrId");
    const found = DEFAULT_DHIKR_LIST.find((d) => d.id === lastDhikrId);
    const dhikr = found || DEFAULT_DHIKR_LIST[0];
    pageState.currentDhikr = {
      id: dhikr.id,
      name: dhikr.name,
      count: dhikr.count,
      current: pageState.tasbihHistory[dhikr.id] || 0,
    };
  } catch (err) {
    console.error("Error loading tasbih state:", err);
    pageState.tasbihHistory = {};
    pageState.unlimitedMap = {};
  }
}

function _migrateLegacyKeys(parsed) {
  const migrated = {};
  for (const [key, value] of Object.entries(parsed || {})) {
    const mappedId = LEGACY_NAME_TO_ID[key];
    migrated[mappedId || key] = value;
  }
  return migrated;
}

function saveTasbihState() {
  try {
    pageState.tasbihHistory[pageState.currentDhikr.id] =
      pageState.currentDhikr.current;
    localStorage.setItem(
      "tasbihState",
      JSON.stringify(pageState.tasbihHistory),
    );
    localStorage.setItem("lastDhikrId", pageState.currentDhikr.id);
  } catch (err) {
    console.error("Error saving tasbih state:", err);
  }
}

function saveUnlimitedMap() {
  try {
    localStorage.setItem(
      "tasbihUnlimitedMap",
      JSON.stringify(pageState.unlimitedMap),
    );
  } catch (err) {
    console.error("Error saving unlimited map:", err);
  }
}

module.exports = { loadTasbihState, saveTasbihState, saveUnlimitedMap };
