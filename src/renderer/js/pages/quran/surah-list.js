"use strict";

// The list view: the 114 surahs (searchable) and the 30 juz.
const { t } = require("../../core/i18n");
const { toWestern } = require("../../utils/numerals");
const { byId, queryAll } = require("../../core/dom");
const {
  state,
  fmt,
  revelationPlace,
  SURAH_META,
  JUZ_META,
} = require("./state");
const { openSurah } = require("./reader");

function switchTab(tab) {
  state.activeTab = tab;
  byId("tabSurah", HTMLElement).classList.toggle("active", tab === "surah");
  byId("tabJuz", HTMLElement).classList.toggle("active", tab === "juz");
  byId("surahGrid", HTMLElement).style.display = tab === "surah" ? "" : "none";
  byId("juzList", HTMLElement).style.display = tab === "juz" ? "" : "none";
  byId("surahSearchInput", HTMLElement).style.display =
    tab === "surah" ? "" : "none";
}

function onSearch(e) {
  // Accept Arabic-Indic digits too, so typing ٢ finds surah 2.
  const q = toWestern(e.target.value).trim().toLowerCase();
  if (!q) {
    state.filteredSurahs = [...SURAH_META];
  } else {
    state.filteredSurahs = SURAH_META.filter(
      (s) =>
        s.en.toLowerCase().includes(q) ||
        s.ar.includes(q) ||
        String(s.n).startsWith(q),
    );
  }
  renderSurahGrid(state.filteredSurahs);
}

function renderSurahGrid(surahs) {
  const grid = byId("surahGrid", HTMLElement);
  const loading = document.getElementById("surahLoading");

  if (loading) loading.style.display = "none";

  if (!surahs.length) {
    grid.innerHTML = `<div class="no-results" style="grid-column:1/-1">${t("noResults")}</div>`;
    return;
  }

  grid.innerHTML = surahs
    .map(
      (s) => `
    <div class="surah-card" data-surah="${s.n}" role="button" tabindex="0">
      <div class="surah-number-badge">${fmt(s.n)}</div>
      <div class="surah-card-info">
        <div class="surah-arabic-name">${s.ar}</div>
        <div class="surah-transliteration">${s.en}</div>
        <div class="surah-ayah-count">${fmt(s.count)} ${t("verses")} · ${revelationPlace(s)}</div>
      </div>
    </div>
  `,
    )
    .join("");

  queryAll(".surah-card", HTMLElement, grid).forEach((card) => {
    card.addEventListener("click", () => openSurah(Number(card.dataset.surah)));
  });
}

function renderJuzList() {
  const list = byId("juzList", HTMLElement);
  list.innerHTML = JUZ_META.map(
    (j) => `
    <div class="juz-card" data-juz="${j.n}" role="button" tabindex="0">
      <div class="juz-badge">${fmt(j.n)}</div>
      <div class="juz-info">
        <div class="juz-title">${t("juz")} ${fmt(j.n)}</div>
        <div class="juz-subtitle">${t("startingFrom")}: ${fmt(j.start)}</div>
      </div>
      <i class="fas fa-chevron-left juz-arrow" aria-hidden="true"></i>
    </div>
  `,
  ).join("");

  const JUZ_TO_SURAH = [
    1, 2, 2, 3, 4, 4, 5, 6, 7, 8, 9, 11, 12, 15, 17, 18, 21, 23, 25, 27, 29, 33,
    36, 39, 41, 46, 51, 58, 67, 78,
  ];
  queryAll(".juz-card", HTMLElement, list).forEach((card) => {
    card.addEventListener("click", () => {
      const juzN = Number(card.dataset.juz);
      const surahN = JUZ_TO_SURAH[juzN - 1] || 1;
      openSurah(surahN);
    });
  });
}

module.exports = { switchTab, onSearch, renderSurahGrid, renderJuzList };
