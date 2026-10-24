"use strict";

// What the tasbih page's modules share.
//
// The dhikr from the Sunnah live in data/tasbih.json (Arabic text, count, hadith references,
// the keys of their translated meaning and source in locales/<lang>/worship/tasbih.json). Counts
// are those of authentic hadith; "noFixedCount" ones start on "no limit" and their count is only
// the size of a lap. The user's own dhikr are saved with the counts (storage.js).

/**
 * @typedef {object} Dhikr
 * @property {string} id
 * @property {string} name          the words (Arabic for the Sunnah ones)
 * @property {number} count         the target, or one lap's size when there is no limit
 * @property {boolean} [noFixedCount]
 * @property {string} [meaningKey]  Sunnah ones: the translated meaning
 * @property {string} [sourceKey]   Sunnah ones: where the count comes from
 * @property {string[]} [references] Sunnah ones: "muslim:596" (sunnah.com)
 * @property {string} [meaning]     the user's own: the meaning they wrote
 * @property {boolean} [custom]     written by the user
 */

/** @type {Dhikr[]} */
const SUNNAH_DHIKR = require("../../../data/tasbih.json").dhikrList;

/**
 * After every obligatory prayer: 33 SubhanAllah, 33 Alhamdulillah, 34 Allahu Akbar
 * (Muslim 596), one after the other.
 */
const AFTER_PRAYER = [
  { id: "subhanallah", count: 33 },
  { id: "alhamdulillah", count: 33 },
  { id: "allahuakbar", count: 34 },
];

const pageState = {
  /** @type {Dhikr[]} the user's own dhikr */
  custom: [],
  /** the dhikr counted when no sequence runs */
  currentId: SUNNAH_DHIKR[0].id,
  /** @type {Record<string, number>} each dhikr's count */
  counts: {},
  /** @type {Record<string, boolean>} "no limit" per dhikr */
  unlimited: {},
  /** @type {{ step: number, counts: number[], done: boolean } | null} the after-prayer tasbih */
  sequence: null,
};

/** @param {string} id @returns {Dhikr | undefined} */
const findDhikr = (id) =>
  SUNNAH_DHIKR.find((d) => d.id === id) ??
  pageState.custom.find((d) => d.id === id);

/**
 * What the counter counts now: the sequence's step, else the chosen dhikr.
 * @returns {{ dhikr: Dhikr, target: number, current: number, unlimited: boolean }}
 */
function counting() {
  const seq = pageState.sequence;
  if (seq) {
    const step = AFTER_PRAYER[seq.step];
    return {
      dhikr: /** @type {Dhikr} */ (findDhikr(step.id)),
      target: step.count,
      current: seq.counts[seq.step],
      unlimited: false,
    };
  }
  const dhikr = findDhikr(pageState.currentId) ?? SUNNAH_DHIKR[0];
  return {
    dhikr,
    target: dhikr.count,
    current: pageState.counts[dhikr.id] ?? 0,
    unlimited: Boolean(pageState.unlimited[dhikr.id]),
  };
}

module.exports = { pageState, SUNNAH_DHIKR, AFTER_PRAYER, findDhikr, counting };
