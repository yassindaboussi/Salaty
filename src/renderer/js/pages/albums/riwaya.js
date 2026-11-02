"use strict";

// The riwaya filter: Hafs (most reciters), Warsh and Qalun (the next ones, read in North Africa),
// and the other riwayat together. mp3quran.net gives each recitation (moshaf) a rewaya_id
// (https://mp3quran.net/api/v3/riwayat); the variants of one riwaya (Warsh by al-Azraq…) count
// as that riwaya. "Complete Quran only" keeps the recitations with all 114 surahs.
const { state } = require("./state");

/** @type {Record<string, number[]>} */
const GROUPS = {
  hafs: [1],
  warsh: [2, 10, 18],
  qalun: [5, 8],
};
const CHIPS = ["all", "hafs", "warsh", "qalun", "other"];
const LABEL_KEYS = {
  all: "acRiwayaAll",
  hafs: "acRiwayaHafs",
  warsh: "acRiwayaWarsh",
  qalun: "acRiwayaQalun",
  other: "acRiwayaOther",
};

const KNOWN = new Set(Object.values(GROUPS).flat());

/** @param {import("./state").Moshaf} moshaf  does it pass the filters? */
function moshafMatches(moshaf) {
  if (state.completeOnly && Number(moshaf.surah_total) < 114) return false;
  const id = Number(moshaf.rewaya_id);
  if (state.riwaya === "all") return true;
  if (state.riwaya === "other") return !KNOWN.has(id);
  return (GROUPS[state.riwaya] ?? []).includes(id);
}

/** @param {import("./state").Reciter} reciter  its recitations that pass the filters, the most
 * complete first (a full Quran before a few surahs) */
const matchingMoshafs = (reciter) =>
  reciter.moshaf
    .filter(moshafMatches)
    .sort((a, b) => Number(b.surah_total) - Number(a.surah_total));

module.exports = { CHIPS, LABEL_KEYS, matchingMoshafs };
