"use strict";

// What the Athkar page shows now (shared by its modules) and the saved counts. Athkar are said
// every day, so the counts belong to one day: a new day starts from 0 by itself.
const { todayIso } = require("../../core/date-format");
const { getAdkar } = require("../../services/content");

/**
 * @typedef {{ category: string, count: string | null, content: string, description?: string,
 *   reference?: string, grade?: string }} Dhikr  one entry of data/adkar.json
 */

const COUNTS_KEY = "athkarCounts"; // { day: "2026-11-02", counts: { id: number } }
const LAST_KEY = "athkarLastCategory";
// the category to show again on coming back from a verse in the Quran page (this session)
const RETURN_KEY = "athkarReturnTo";

const state = {
  /** @type {Record<string, Dhikr[]>} */
  data: {},
  /** @type {string} */
  category: "",
  query: "",
  day: "",
  /** @type {Record<string, number>} */
  counts: {},
};

async function loadData() {
  state.data = /** @type {Record<string, Dhikr[]>} */ (
    /** @type {unknown} */ (await getAdkar())
  );
}

/** @param {string} category @param {number} index  a dhikr's id in the saved counts */
const dhikrId = (category, index) => `${category}::${index}`;

/** @param {Dhikr} item  how many times it is said; null = no fixed number */
function targetOf(item) {
  if (item.count === null || item.count === undefined) return null;
  return parseInt(item.count, 10) || 1;
}

/** @param {string} id */
const countOf = (id) => state.counts[id] ?? 0;

function loadCounts() {
  state.day = todayIso();
  state.counts = {};
  try {
    localStorage.removeItem("athkarState"); // an older version's counts, never reset
    const saved = JSON.parse(localStorage.getItem(COUNTS_KEY) ?? "null");
    if (saved && saved.day === state.day && saved.counts) {
      state.counts = saved.counts;
    }
  } catch {
    // unreadable or no storage: start from 0
  }
}

// Past midnight with the page open: the new day starts from 0.
function startNewDayIfNeeded() {
  if (todayIso() === state.day) return false;
  loadCounts();
  saveCounts();
  return true;
}

function saveCounts() {
  try {
    localStorage.setItem(
      COUNTS_KEY,
      JSON.stringify({ day: state.day, counts: state.counts }),
    );
  } catch {
    // storage unavailable: the counts last until the page closes
  }
}

/** @param {string} category */
function progressOf(category) {
  const items = state.data[category] ?? [];
  const counted = items
    .map((item, i) => ({ target: targetOf(item), id: dhikrId(category, i) }))
    .filter((x) => x.target !== null);
  const done = counted.filter((x) => countOf(x.id) >= (x.target ?? 0)).length;
  return { done, total: counted.length };
}

function lastCategory() {
  try {
    return localStorage.getItem(LAST_KEY) ?? "";
  } catch {
    return "";
  }
}

/** @param {string} category */
function rememberCategory(category) {
  try {
    localStorage.setItem(LAST_KEY, category);
  } catch {
    // storage unavailable
  }
}

module.exports = {
  RETURN_KEY,
  state,
  loadData,
  dhikrId,
  targetOf,
  countOf,
  loadCounts,
  saveCounts,
  startNewDayIfNeeded,
  progressOf,
  lastCategory,
  rememberCategory,
};
