"use strict";

// The saved state, in this computer's page storage (localStorage):
//   tasbihState         each dhikr's count               (since the first version)
//   tasbihUnlimitedMap  the "no limit" choices
//   lastDhikrId         the dhikr counted last
//   tasbihCustom        the user's own dhikr: [{ id, name, meaning, count }]
//   tasbihSequence      the after-prayer tasbih in progress
// Counts saved by old versions under the dhikr's Arabic text move to its id.
const { pageState, SUNNAH_DHIKR, AFTER_PRAYER, findDhikr } = require("./state");

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

const MAX_CUSTOM = 100;

/** @param {string} key @param {any} fallback */
function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) ?? fallback);
  } catch {
    return fallback;
  }
}

/** @param {string} key @param {any} value */
function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Error saving ${key}:`, err);
  }
}

/** A whole number in a range, or the fallback. */
const whole = (/** @type {any} */ v, min, max, fallback) =>
  Number.isInteger(v) && v >= min && v <= max ? v : fallback;

/** @param {any} list */
function cleanCustom(list) {
  return (Array.isArray(list) ? list : [])
    .filter(
      (d) =>
        d &&
        typeof d.id === "string" &&
        typeof d.name === "string" &&
        d.name.trim(),
    )
    .slice(0, MAX_CUSTOM)
    .map((d) => ({
      id: d.id,
      name: d.name.trim().slice(0, 300),
      meaning:
        typeof d.meaning === "string" ? d.meaning.trim().slice(0, 300) : "",
      count: whole(d.count, 1, 100_000, 33),
      custom: true,
    }));
}

function loadState() {
  const counts = {};
  for (const [key, value] of Object.entries(readJson("tasbihState", {}))) {
    counts[LEGACY_NAME_TO_ID[key] ?? key] = whole(value, 0, 10_000_000, 0);
  }
  pageState.counts = counts;
  pageState.custom = cleanCustom(readJson("tasbihCustom", []));

  const unlimited = readJson("tasbihUnlimitedMap", null);
  if (unlimited && typeof unlimited === "object") {
    pageState.unlimited = unlimited;
  } else {
    // first time: the dhikr with no count fixed in a hadith start on "no limit"
    pageState.unlimited = Object.fromEntries(
      SUNNAH_DHIKR.filter((d) => d.noFixedCount).map((d) => [d.id, true]),
    );
    writeJson("tasbihUnlimitedMap", pageState.unlimited);
  }

  const last = localStorage.getItem("lastDhikrId");
  pageState.currentId = last && findDhikr(last) ? last : SUNNAH_DHIKR[0].id;

  const seq = readJson("tasbihSequence", null);
  pageState.sequence =
    seq &&
    Array.isArray(seq.counts) &&
    seq.counts.length === AFTER_PRAYER.length
      ? {
          step: whole(seq.step, 0, AFTER_PRAYER.length - 1, 0),
          counts: seq.counts.map((c, i) =>
            whole(c, 0, AFTER_PRAYER[i].count, 0),
          ),
          done: seq.done === true,
        }
      : null;
}

function saveCounts() {
  writeJson("tasbihState", pageState.counts);
  try {
    localStorage.setItem("lastDhikrId", pageState.currentId);
  } catch {
    // storage unavailable: nothing to do
  }
}

const saveUnlimited = () =>
  writeJson("tasbihUnlimitedMap", pageState.unlimited);
const saveCustom = () => writeJson("tasbihCustom", pageState.custom);
const saveSequence = () => writeJson("tasbihSequence", pageState.sequence);

module.exports = {
  loadState,
  saveCounts,
  saveUnlimited,
  saveCustom,
  saveSequence,
};
