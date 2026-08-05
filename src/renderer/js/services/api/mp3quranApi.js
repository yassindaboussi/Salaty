"use strict";

const { t, getLanguage } = require("../../core/i18n/translations");


const BASE_URL = "https://mp3quran.net/api/v3";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15000;

const CACHE_PREFIX = "mp3quranv3";

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
  if (!isMeaningful(data)) return;
  try {
    localStorage.setItem(
      `${CACHE_PREFIX}:${key}`,
      JSON.stringify({ data, ts: Date.now() }),
    );
  } catch {
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

async function getReciters(language = "eng") {
  const key = `mp3quran:reciters:${language}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const data = await fetchJson(`${BASE_URL}/reciters?language=${language}`);
  const reciters = data.reciters || [];
  cacheSet(key, reciters);
  return reciters;
}

async function getSurahNames(language = "eng") {
  const key = `mp3quran:suwar:${language}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const data = await fetchJson(`${BASE_URL}/suwar?language=${language}`);
  const list = data.suwar || data.Suras_Name || [];
  cacheSet(key, list);
  return list;
}

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

  const appLang = getLanguage();
  list = list.map((book) => ({
    ...book,
    displayName: localizedTafsirBookName(book, appLang),
  }));

  cacheSet(key, list);
  return list;
}

async function getTafsirSurahs(tafsirId, language = "eng") {
  // Cache key includes a version tag (v2) so this fix — grouping tafsir
  // entries by their real sura_id instead of raw array position — takes
  // effect immediately for everyone, rather than leaving anyone stuck
  // with a stale pre-fix cached result (e.g. if a particular language
  // was tested before this fix shipped) for up to the full 24h TTL.
  const key = `mp3quran:tafsir:v2:${tafsirId}:${language}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const fetchFor = async (lang) => {
    const data = await fetchJson(
      `${BASE_URL}/tafsir?tafsir=${tafsirId}&language=${lang}`,
    );
    const raw = data.tafasir || {};
    return { bookName: raw.name || "", soar: raw.soar || {} };
  };

  let result = await fetchFor(language);
  if (Object.keys(result.soar).length === 0 && language !== "ar") {
    result = await fetchFor("ar");
  }

  const bySura = {};
  const soarData = result.soar;
  if (Array.isArray(soarData)) {
    // Real API shape: a flat array of entries, each tagged with its own
    // sura_id — group them by that field rather than by array position.
    soarData.forEach((entry) => {
      if (!entry || entry.sura_id == null) return;
      const sid = String(entry.sura_id);
      if (!bySura[sid]) bySura[sid] = [];
      bySura[sid].push(entry);
    });
  } else if (soarData && typeof soarData === "object") {
    // Defensive fallback in case some other tafsir/language combination
    // ever returns an already-grouped-by-sura-id object instead.
    Object.entries(soarData).forEach(([sid, entries]) => {
      bySura[sid] = Array.isArray(entries) ? entries : [entries].filter(Boolean);
    });
  }

  const final = { bookName: result.bookName, bySura };
  if (Object.keys(bySura).length > 0) cacheSet(key, final);
  return final;
}

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
