"use strict";

// The list view: "Continue reading", and three tabs: the 114 surahs (searchable), the 30 juz
// (each opens the reader at the ayah it starts with) and the bookmarks.
const { t } = require("../../core/i18n");
const { findSurahs } = require("./surah-search");
const { byId, queryAll } = require("../../core/dom");
const { html, setHtml } = require("../../utils/html");
const {
  state,
  fmt,
  surahMeta,
  surahName,
  sep,
  revelationPlace,
  ayahCount,
  ayahPlace,
  SURAH_META,
  surahCount,
  juzStarts,
  riwayaName,
  isRiwaya,
} = require("./state");
const { loadLastRead } = require("./storage");
const { renderBookmarkList } = require("./bookmarks");

/** @param {string} tab "surah" | "juz" | "bookmarks" */
function switchTab(tab) {
  state.activeTab = tab;
  for (const button of queryAll(".q-tab", HTMLButtonElement)) {
    const on = button.dataset.tab === tab;
    button.setAttribute("aria-selected", String(on));
    button.tabIndex = on ? 0 : -1;
  }
  byId("surahGrid", HTMLElement).hidden = tab !== "surah";
  byId("juzList", HTMLElement).hidden = tab !== "juz";
  byId("bookmarkList", HTMLElement).hidden = tab !== "bookmarks";
  byId("surahSearch", HTMLElement).hidden = tab !== "surah";
  if (tab === "bookmarks") renderBookmarkList();
}

/** @param {string} query */
const filterSurahs = (query) => findSurahs(SURAH_META, query);

function onSearch() {
  state.filteredSurahs = filterSurahs(
    byId("surahSearchInput", HTMLInputElement).value,
  );
  renderSurahGrid();
}

function renderSurahGrid() {
  const grid = byId("surahGrid", HTMLElement);
  const surahs = state.filteredSurahs;
  if (!surahs.length) {
    setHtml(grid, html`<p class="q-empty-line">${t("noResults")}</p>`);
    return;
  }
  setHtml(
    grid,
    html`${surahs.map(
      (s) => html`<button type="button" class="surah-row" data-surah="${s.n}">
        <span class="q-num">${fmt(s.n)}</span>
        <span class="surah-row-text">
          <span class="surah-row-name">${surahName(s)}</span>
          <span class="surah-row-meta">${ayahCount(surahCount(s))}${sep()}${revelationPlace(s)}</span>
        </span>
        ${surahName(s) === s.ar ? "" : html`<span class="surah-row-ar" lang="ar" dir="rtl">${s.ar}</span>`}
      </button>`,
    )}`,
  );
}

function renderJuzList() {
  setHtml(
    byId("juzList", HTMLElement),
    html`${juzStarts().map(
      (
        j,
      ) => html`<button type="button" class="surah-row juz-row" data-surah="${j.surah}" data-ayah="${j.ayah}">
        <span class="q-num">${fmt(j.n)}</span>
        <span class="surah-row-text">
          <span class="surah-row-name">${t("juz")} ${fmt(j.n)}</span>
          <span class="surah-row-meta">${ayahPlace(j.surah, j.ayah)}</span>
        </span>
        <i class="fas fa-chevron-right q-forward" aria-hidden="true"></i>
      </button>`,
    )}`,
  );
}

/** The "Continue reading" card, from where the reader stopped last. */
function renderContinue() {
  const last = loadLastRead();
  const card = byId("qContinue", HTMLButtonElement);
  const meta = last && surahMeta(last.surah);
  card.hidden = !meta;
  if (!last || !meta) return;
  card.dataset.surah = String(last.surah);
  card.dataset.ayah = String(last.ayah);
  card.dataset.riwaya = last.riwaya;
  byId("qContinuePlace", HTMLElement).textContent = [
    surahName(meta),
    `${t("quranAyah")} ${fmt(last.ayah)}`,
    last.riwaya === "hafs" ? "" : riwayaName(last.riwaya),
  ]
    .filter(Boolean)
    .join(sep());
}

/** Re-draws what shows numbers or names (digits or language changed). */
function renderLists() {
  renderSurahGrid();
  renderJuzList();
  renderContinue();
  if (state.activeTab === "bookmarks") renderBookmarkList();
}

/** @param {(surah: number, ayah?: number, riwaya?: import("./state").Riwaya) => void} openAt */
function bindSurahList(openAt) {
  /** @param {Event} e */
  const openRow = (e) => {
    const row = /** @type {Element} */ (e.target).closest("[data-surah]");
    if (!(row instanceof HTMLElement) || row.closest(".bookmark-list")) return;
    const riwaya = isRiwaya(row.dataset.riwaya)
      ? row.dataset.riwaya
      : undefined;
    openAt(
      Number(row.dataset.surah),
      Number(row.dataset.ayah) || undefined,
      riwaya,
    );
  };
  byId("surahGrid", HTMLElement).addEventListener("click", openRow);
  byId("juzList", HTMLElement).addEventListener("click", openRow);
  byId("qContinue", HTMLButtonElement).addEventListener("click", openRow);
  byId("surahSearchInput", HTMLInputElement).addEventListener(
    "input",
    onSearch,
  );

  // tabs: click, or the arrow keys along them (one tab in the Tab order)
  const tabs = queryAll(".q-tab", HTMLButtonElement);
  for (const tab of tabs) {
    tab.addEventListener("click", () => switchTab(String(tab.dataset.tab)));
    tab.addEventListener("keydown", (e) => {
      const at = tabs.indexOf(tab);
      const rtl = document.dir === "rtl";
      const step = {
        ArrowRight: rtl ? -1 : 1,
        ArrowLeft: rtl ? 1 : -1,
        Home: -at,
        End: tabs.length - 1 - at,
      }[e.key];
      if (step === undefined) return;
      e.preventDefault();
      const next = tabs[(at + step + tabs.length) % tabs.length];
      switchTab(String(next.dataset.tab));
      next.focus();
    });
  }
}

module.exports = { switchTab, renderLists, renderContinue, bindSurahList };
