"use strict";

// Surah text for the Quran reader: Arabic and an optional translation from AlQuran Cloud, or the
// bundled offline data (Arabic + Sahih International) when offline or when the request fails.

const ALQURAN_CLOUD_API = "https://api.alquran.cloud/v1";

const TRANSLATION_EDITIONS = {
  "en.sahih": "en.sahih",
  "en.asad": "en.asad",
  "fr.hamidullah": "fr.hamidullah",
};

async function fetchQuranSurah(surahNum, translationEdition) {
  if (!navigator.onLine) {
    return getLocalQuranSurah(surahNum, translationEdition);
  }

  try {
    const editions = ["quran-uthmani"];
    if (
      translationEdition !== "none" &&
      TRANSLATION_EDITIONS[translationEdition]
    ) {
      editions.push(TRANSLATION_EDITIONS[translationEdition]);
    }
    const url = `${ALQURAN_CLOUD_API}/surah/${surahNum}/editions/${editions.join(",")}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`alquran.cloud ${res.status}`);
    const data = await res.json();
    return normalizeAlquranCloudResponse(data, translationEdition);
  } catch (e) {
    console.warn(
      "AlQuran Cloud request failed, using offline data:",
      e.message,
    );
    return getLocalQuranSurah(surahNum, translationEdition);
  }
}

function normalizeAlquranCloudResponse(data, translationEdition) {
  const editions = data.data || [];
  const arabicEdition = Array.isArray(editions) ? editions[0] : editions;
  const transEdition =
    Array.isArray(editions) && editions.length > 1 ? editions[1] : null;
  const ayahs = arabicEdition.ayahs || [];
  return ayahs.map((a, i) => ({
    number: a.numberInSurah,
    arabic: a.text,
    translation:
      transEdition && translationEdition !== "none"
        ? stripHtmlTags(transEdition.ayahs[i]?.text || "")
        : null,
  }));
}

/** @type {Promise<any[]> | null} */
let _localQuranDataPromise = null;

function getLocalQuranData() {
  if (!_localQuranDataPromise) {
    _localQuranDataPromise = fetch("../../data/Quran.json").then((res) => {
      if (!res.ok)
        throw new Error(`Failed to load offline Quran data (${res.status})`);
      return res.json();
    });
  }
  return _localQuranDataPromise;
}

async function getLocalQuranSurah(surahNum, translationEdition) {
  const data = await getLocalQuranData();
  const entry = data.find((s) => s.Number === surahNum);
  if (!entry) throw new Error(`Surah ${surahNum} not found in offline data`);

  const verses = (entry.Array_Verses && entry.Array_Verses[0]) || [];
  return verses.map((v) => ({
    number: v.id,
    arabic: v.ar,
    translation: translationEdition !== "none" ? v.en || null : null,
  }));
}

function stripHtmlTags(str) {
  return str
    ? str
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim()
    : "";
}

module.exports = { fetchQuranSurah };
