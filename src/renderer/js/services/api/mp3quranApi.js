"use strict";

const { t, getLanguage } = require("../../core/i18n/translations");

/**
 * Client for the free, key-less mp3quran.net API (v3).
 * Docs: https://mp3quran.net/eng/api
 *
 * Used by the Audio Archive to browse and stream Quran recitations from
 * 200+ reciters, replacing the previous small hand-picked archive.org list.
 */

const BASE_URL = "https://mp3quran.net/api/v3";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — this catalog barely changes
const FETCH_TIMEOUT_MS = 15000;

// Bumping this prefix invalidates every previously-cached entry at once —
// needed here because an earlier bug could have cached *empty* results
// (see isMeaningful below), and those would otherwise keep being served
// for up to 24h even after the parsing bug that caused them was fixed.
const CACHE_PREFIX = "mp3quranv3";

/** An empty object/array is truthy in JS, so a plain `!data` check treats
 *  a broken "found nothing" result as valid cached data — this is what
 *  silently kept serving stale empty Tafsir/Tadabor results even after
 *  the underlying parsing bug was fixed. Only cache (and accept from
 *  cache) results that actually contain something. */
function isMeaningful(data) {
  if (data == null) return false;
  if (Array.isArray(data)) return data.length > 0;
  if (typeof data === "object") return Object.keys(data).length > 0;
  return Boolean(data);
}

function cacheGet(key) {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}:${key}`);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    return isMeaningful(data) ? data : null;
  } catch {
    return null;
  }
}

function cacheSet(key, data) {
  if (!isMeaningful(data)) return; // never persist an empty/broken result
  try {
    localStorage.setItem(
      `${CACHE_PREFIX}:${key}`,
      JSON.stringify({ data, ts: Date.now() }),
    );
  } catch {
    // Storage full/unavailable — caching is an optimization, not required.
  }
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (err.name === "AbortError") throw new Error("Request timed out");
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * All reciters for a language. Each reciter has one or more `moshaf`
 * entries (a specific recitation — e.g. "Hafs A'n Assem - Murattal") with
 * its own audio server and list of covered surahs.
 */
async function getReciters(language = "eng") {
  const key = `mp3quran:reciters:${language}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const data = await fetchJson(`${BASE_URL}/reciters?language=${language}`);
  const reciters = data.reciters || [];
  cacheSet(key, reciters);
  return reciters;
}

/** All 114 surah names, used to label a reciter's tracks. */
async function getSurahNames(language = "eng") {
  const key = `mp3quran:suwar:${language}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const data = await fetchJson(`${BASE_URL}/suwar?language=${language}`);
  const list = data.suwar || data.Suras_Name || [];
  cacheSet(key, list);
  return list;
}

/**
 * Build a playable track list for one reciter's moshaf (a specific
 * recitation), in the shape the player already expects:
 * { title, artist, url, filename }.
 */
async function getReciterTracks(reciterName, moshaf, language = "eng") {
  const surahs = await getSurahNames(language);
  const surahMap = {};
  surahs.forEach((s) => {
    surahMap[s.id] = (s.name || "").trim();
  });

  const server = moshaf.server || moshaf.Server || "";
  const base = server.endsWith("/") ? server : `${server}/`;
  const surahListRaw = moshaf.surah_list || moshaf.suras || "";
  const ids = surahListRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return ids.map((idStr) => {
    const id = parseInt(idStr, 10);
    const padded = String(id).padStart(3, "0");
    return {
      title: surahMap[id] || `Surah ${id}`,
      artist: reciterName,
      url: `${base}${padded}.mp3`,
      filename: `${padded}.mp3`,
    };
  });
}

/**
 * All "Tadabor" (reflective pause) audio clips, grouped by surah.
 * Docs: https://mp3quran.net/eng/api — GET /tadabor?language=xx
 * Response shape: { tadabor: { "<suraId>": [ { id, audio_url, image_url,
 * text, sora_name, rewaya_name, reciter_name }, ... ], ... } }
 * Fetched once (no `sura` filter) and cached — the whole catalog is small.
 *
 * This commentary only has Arabic metadata on mp3quran.net — requesting
 * language=eng/fr comes back empty even though the feature itself works,
 * so a non-Arabic request that returns nothing falls back to Arabic
 * instead of leaving the page blank.
 */
async function getTadabor(language = "eng") {
  const key = `mp3quran:tadabor:${language}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const fetchRaw = async (lang) => {
    const data = await fetchJson(`${BASE_URL}/tadabor?language=${lang}`);
    return data.tadabor || {};
  };

  let raw = await fetchRaw(language);
  if (!isMeaningful(raw) && language !== "ar") {
    raw = await fetchRaw("ar");
  }

  // Normalize into { suraId: [entries] } regardless of whether the API
  // handed back an object keyed by sura id or (for a single-sura request)
  // a flat array — the docs' own example was inconsistent about this.
  const bySura = {};
  if (Array.isArray(raw)) {
    raw.forEach((entry) => {
      const sid = String(entry.sura_id || entry.sora_id || "0");
      if (!bySura[sid]) bySura[sid] = [];
      bySura[sid].push(entry);
    });
  } else {
    Object.entries(raw).forEach(([sid, entries]) => {
      bySura[sid] = Array.isArray(entries) ? entries : [];
    });
  }

  cacheSet(key, bySura);
  return bySura;
}

/**
 * Build a playable track list for one surah's Tadabor clips, in the shape
 * the player already expects: { title, artist, url, filename }.
 *
 * Many entries have `audio_url: null` and only provide `video_url` (an
 * .mp4) — Chromium's <audio> element can still play the audio track out
 * of an mp4 container fine, so we fall back to that instead of silently
 * dropping the clip.
 */
function getTadaborTracksForSura(entries, suraName) {
  return entries
    .filter((e) => e.audio_url || e.video_url)
    .map((e, index) => {
      const snippet = (e.text || "").replace(/\s+/g, " ").trim();
      const title =
        e.title ||
        (snippet.length > 60 ? `${snippet.slice(0, 60)}…` : snippet) ||
        `${suraName} — ${index + 1}`;
      return {
        title,
        artist: e.reciter_name || e.rewaya_name || suraName,
        url: e.audio_url || e.video_url,
        filename: `tadabor-${e.id || index}.mp3`,
      };
    });
}

/**
 * List of available Tafsir "books" (e.g. "الخلاصة من تفسير الطبري") for a
 * language. Docs: https://mp3quran.net/eng/api — GET /tafasir?language=xx
 * Response shape: { tafasir: [ { id, url, name }, ... ] }
 *
 * Like Tadabor, this only has Arabic metadata — falls back to Arabic when
 * the requested language comes back empty. The book *title* itself is a
 * proper name the API never translates even then, so a small manual
 * translation table below covers the ones we know about; anything not in
 * the table just keeps its Arabic name.
 */

// mp3quran.net doesn't provide translated Tafsir book titles even when
// falling back to Arabic content for other languages — these are proper
// names, not derivable from any other field, so a short manual table is
// the only real option. Falls back to the Arabic name for any book id
// not listed here.
const TAFSIR_BOOK_NAMES = {
  1: {
    en: "Summary of Al-Tabari's Tafsir",
    fr: "Résumé du Tafsir d'Al-Tabari",
  },
};

function localizedTafsirBookName(book, language) {
  return TAFSIR_BOOK_NAMES[book.id]?.[language] || book.name;
}

async function getTafasirBooks(language = "eng") {
  const key = `mp3quran:tafasir-books:${language}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const fetchList = async (lang) => {
    const data = await fetchJson(`${BASE_URL}/tafasir?language=${lang}`);
    return data.tafasir || [];
  };

  let list = await fetchList(language);
  if (list.length === 0 && language !== "ar") {
    list = await fetchList("ar");
  }

  // Attach a localized display name (see TAFSIR_BOOK_NAMES) without
  // discarding the original Arabic `name` field — still needed as the
  // fallback and as the audio track "artist" elsewhere.
  const appLang = getLanguage();
  list = list.map((book) => ({
    ...book,
    displayName: localizedTafsirBookName(book, appLang),
  }));

  cacheSet(key, list);
  return list;
}

/**
 * Per-surah audio tracks for one Tafsir book.
 * GET /tafsir?tafsir=<id>&language=xx
 * Real response shape: { tafasir: { name, soar: [ { id, tafsir_id, name,
 * url, sura_id }, ... ] } } — a flat array (despite the docs page's own
 * example showing something different), so we group it by sura_id here.
 *
 * Same Arabic-only-metadata situation as the book list above: fall back
 * to language=ar if the requested language's response has no entries.
 */
async function getTafsirSurahs(tafsirId, language = "eng") {
  const key = `mp3quran:tafsir:${tafsirId}:${language}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const fetchFor = async (lang) => {
    const data = await fetchJson(
      `${BASE_URL}/tafsir?tafsir=${tafsirId}&language=${lang}`,
    );
    const raw = data.tafasir || {};
    const entries = Array.isArray(raw.soar)
      ? raw.soar
      : Array.isArray(raw.sora)
        ? raw.sora
        : [];
    return { bookName: raw.name || "", entries, rawSora: raw.sora };
  };

  let result = await fetchFor(language);
  if (result.entries.length === 0 && language !== "ar") {
    result = await fetchFor("ar");
  }

  const bySura = {};
  result.entries.forEach((entry) => {
    const sid = String(entry.sura_id ?? entry.sora_id ?? "0");
    if (!bySura[sid]) bySura[sid] = [];
    bySura[sid].push(entry);
  });

  // Defensive fallback: some responses might nest by sura id directly
  // instead of a flat array (e.g. { sora: { "1": [...] } }) — merge those
  // in too if present, without overwriting what we already parsed above.
  if (result.rawSora && !Array.isArray(result.rawSora)) {
    Object.entries(result.rawSora).forEach(([sid, entries]) => {
      if (!bySura[sid]) {
        bySura[sid] = Array.isArray(entries)
          ? entries
          : [entries].filter(Boolean);
      }
    });
  }

  const final = { bookName: result.bookName, bySura };
  if (Object.keys(bySura).length > 0) cacheSet(key, final);
  return final;
}

/**
 * Build a playable track list for one surah's Tafsir entries, in the shape
 * the player already expects: { title, artist, url, filename }.
 */
/** Parses "002-1-25.mp3" → {start:1, end:25}, or "055.mp3" → null (whole
 *  surah, no range suffix) — the file naming convention itself is just
 *  digits, so it works regardless of app language. */
function parseAyahRangeFromUrl(url) {
  const match = /\d{2,3}-(\d+)-(\d+)\.mp3(?:$|\?)/i.exec(url || "");
  if (!match) return null;
  return { start: parseInt(match[1], 10), end: parseInt(match[2], 10) };
}

function getTafsirTracksForSura(entries, suraName, bookName) {
  return entries
    .filter((e) => e.url)
    .map((e, index) => {
      const range = parseAyahRangeFromUrl(e.url);
      const title = range
        ? t("tafsirAyahRange")
            .replace("{surah}", suraName)
            .replace("{start}", range.start)
            .replace("{end}", range.end)
        : t("tafsirSurahComplete").replace("{surah}", suraName);
      return {
        title,
        artist: bookName || suraName,
        url: e.url,
        filename: `tafsir-${e.id || index}.mp3`,
      };
    });
}

module.exports = {
  getReciters,
  getSurahNames,
  getReciterTracks,
  getTadabor,
  getTadaborTracksForSura,
  getTafasirBooks,
  getTafsirSurahs,
  getTafsirTracksForSura,
};
