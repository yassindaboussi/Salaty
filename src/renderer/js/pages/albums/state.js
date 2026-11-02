"use strict";

// What the archive page shows now (shared by its modules) and what it remembers: the open tab,
// the riwaya filter, "complete Quran only", the open tafsir book (localStorage "archivePrefs")
// and the favourite reciters (localStorage "favoriteReciters").

const PREFS_KEY = "archivePrefs";
const FAVORITES_KEY = "favoriteReciters";

/**
 * @typedef {{ id: number, name: string, rewaya_id: number, server: string,
 *   surah_total: number, surah_list: string }} Moshaf
 * @typedef {{ id: number, name: string, moshaf: Moshaf[] }} Reciter
 */

const state = {
  tab: "recite", // "recite" | "tafsir" | "tadabor"
  query: "",
  riwaya: "all", // a key of riwaya.js GROUPS, or "all"
  completeOnly: false,
  /** @type {Reciter[]} */
  reciters: [],
  /** @type {Set<number>} */
  favorites: new Set(),
  /** @type {any[] | null} */
  tafsirBooks: null,
  /** @type {{ id: any, name: string, bySura: Record<string, any[]> } | null} */
  tafsirBook: null,
  /** @type {any} */
  tafsirBookId: null, // the book to reopen (prefs), until the books are loaded
  /** @type {Record<string, any[]> | null} */
  tadaborBySura: null,
  /** @type {{ id: number, name: string }[] | null} */
  surahNames: null,
};

function loadPrefs() {
  try {
    const prefs = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}");
    if (["recite", "tafsir", "tadabor"].includes(prefs.tab))
      state.tab = prefs.tab;
    if (typeof prefs.riwaya === "string") state.riwaya = prefs.riwaya;
    state.completeOnly = prefs.completeOnly === true;
    state.tafsirBookId = prefs.tafsirBookId ?? null;
    // an older version's remembered section
    const old = JSON.parse(localStorage.getItem("archiveState") ?? "null");
    if (old?.group && !prefs.tab) {
      state.tab = old.group === "recite" ? "recite" : old.group;
      state.tafsirBookId = old.tafsirBookId ?? null;
    }
    localStorage.removeItem("archiveState");
    const favorites = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]");
    if (Array.isArray(favorites))
      state.favorites = new Set(favorites.map(Number));
  } catch {
    // unreadable: the defaults
  }
}

function savePrefs() {
  try {
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({
        tab: state.tab,
        riwaya: state.riwaya,
        completeOnly: state.completeOnly,
        tafsirBookId: state.tafsirBook?.id ?? null,
      }),
    );
  } catch {
    // storage unavailable: the choices last until the page closes
  }
}

/** @param {number} id */
function toggleFavorite(id) {
  if (state.favorites.has(id)) state.favorites.delete(id);
  else state.favorites.add(id);
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...state.favorites]));
  } catch {
    // storage unavailable
  }
}

/** @param {string | number} id  a surah's name in the app language */
function surahName(id) {
  const found = (state.surahNames ?? []).find(
    (s) => String(s.id) === String(id),
  );
  return (found?.name ?? "").trim() || String(id);
}

module.exports = { state, loadPrefs, savePrefs, toggleFavorite, surahName };
