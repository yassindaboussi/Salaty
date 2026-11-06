"use strict";

// The live lines on three tiles, each shown in place of the tile's description only when it is
// known (otherwise the description stays):
//   Quran           "Continue: Al-Baqara 2:12" (where the reader stopped, saved by the Quran page)
//   Hijri calendar  "Today: 15 Jumada al-Awwal 1448 AH" (with the user's Hijri adjustment)
//   Ramadan         "Ramadan in 98 days", or "Day 12 of Ramadan" during it
// The dates come from the main process (its calendar cache works offline).
const { ipcRenderer } = require("electron");
const { t, getLanguage } = require("../../core/i18n");
const {
  hijriDate,
  daysBetween,
  parseDmy,
  relativeDays,
} = require("../../core/date-format");
const quranIndex = require("../../../data/quran-index.json");

/** @param {string} name @param {string} text */
function setHint(name, text) {
  const hint = document.querySelector(`.feature-hint[data-hint="${name}"]`);
  const desc = hint?.parentElement?.querySelector(".feature-description");
  if (!(hint instanceof HTMLElement) || !(desc instanceof HTMLElement)) return;
  hint.textContent = text;
  hint.hidden = !text;
  desc.hidden = Boolean(text);
}

function quranHint() {
  try {
    const last = JSON.parse(localStorage.getItem("quranLastRead") ?? "null");
    const surah = quranIndex.surahs.find(
      (/** @type {{ n: number }} */ s) => s.n === last?.surah,
    );
    if (!surah || !Number.isInteger(last.ayah)) return;
    const name = getLanguage() === "ar" ? surah.ar : surah.en;
    setHint(
      "quran",
      t("featHintContinue").replace(
        "{place}",
        `${name} ${surah.n}:${last.ayah}`,
      ),
    );
  } catch {
    // nothing saved, or storage blocked: the description stays
  }
}

/** @param {{ day: number, month: number, year: number }} today */
async function ramadanHint(today) {
  if (today.month === 9) {
    setHint(
      "ramadhan",
      t("featHintRamadanDay").replace("{day}", String(today.day)),
    );
    return;
  }
  const year = today.month > 9 ? today.year + 1 : today.year;
  const start = await ipcRenderer.invoke("hijri-to-gregorian", 1, 9, year);
  if (!start?.gregorian?.date) return;
  const days = daysBetween(new Date(), parseDmy(start.gregorian.date));
  if (days > 0)
    setHint(
      "ramadhan",
      t("featHintRamadanIn").replace("{when}", relativeDays(days)),
    );
}

async function dateHints() {
  try {
    const now = new Date();
    const data = await ipcRenderer.invoke(
      "gregorian-to-hijri",
      now.getDate(),
      now.getMonth() + 1,
      now.getFullYear(),
    );
    const h = data?.hijri;
    if (!h) return;
    const today = {
      day: Number(h.day),
      month: Number(h.month?.number),
      year: Number(h.year),
    };
    if (!today.day || !today.month || !today.year) return;
    setHint(
      "calendar",
      t("featHintToday").replace(
        "{date}",
        hijriDate(today.day, today.month, today.year),
      ),
    );
    await ramadanHint(today);
  } catch (e) {
    console.warn("Features: no Hijri date for the hints", e);
  }
}

function showHints() {
  quranHint();
  dateHints();
}

module.exports = { showHints };
