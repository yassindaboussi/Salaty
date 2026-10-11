"use strict";

// The Tadabor section: reflections grouped by surah, searchable; opening a surah goes to the
// playlist page.
const { ipcRenderer } = require("electron");
const mp3quranApi = require("../../services/api/mp3quran");
const { t } = require("../../core/i18n");
const { escapeHtml, asButton } = require("../../utils/html");
/** @typedef {import("./index").AlbumsPage} AlbumsPage */

const mp3quranLang = mp3quranApi.apiLanguage;

/** @param {AlbumsPage} page */
async function ensureTadaborLoaded(page) {
  if (page.tadaborBySura) return;
  page.tadaborGrid.innerHTML = `<div class="loading"><i class="fas fa-spinner" aria-hidden="true"></i>${t("loadingTadabor")}</div>`;
  try {
    const [bySura, surahs] = await Promise.all([
      mp3quranApi.getTadabor(mp3quranLang()),
      mp3quranApi.getSurahNames(mp3quranLang()),
    ]);
    page.tadaborBySura = bySura;
    page.surahNames = surahs;
    page.renderTadabor();
  } catch (error) {
    console.error("Failed to load tadabor:", error);
    page.tadaborGrid.innerHTML = `
        <div class="error-message">
          <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
          <div>${t("errorLoadingTadabor")}</div>
          <button type="button" class="retry-button" id="retryLoadTadabor">${t("retry")}</button>
        </div>`;
    document
      .getElementById("retryLoadTadabor")
      ?.addEventListener("click", () => {
        page.tadaborBySura = null;
        page.ensureTadaborLoaded();
      });
  }
}

/** @param {AlbumsPage} page */
function renderTadabor(page, query = "") {
  const surahNameMap = {};
  (page.surahNames || []).forEach((s) => {
    surahNameMap[s.id] = (s.name || "").trim();
  });

  let suraIds = Object.keys(page.tadaborBySura || {})
    .filter((id) => (page.tadaborBySura[id] || []).length > 0)
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

  if (query) {
    const lower = query.toLowerCase();
    suraIds = suraIds.filter((id) =>
      (surahNameMap[id] || `Surah ${id}`).toLowerCase().includes(lower),
    );
  }

  page.tadaborGrid.innerHTML = "";

  if (suraIds.length === 0) {
    page.tadaborGrid.innerHTML = `<div class="empty-state"><i class="fas fa-search" aria-hidden="true"></i><p>${t("noTracksFound")}</p></div>`;
    return;
  }

  const grid = document.createElement("div");
  grid.className = "reciter-grid";

  suraIds.forEach((id) => {
    const entries = page.tadaborBySura[id] || [];
    const suraName = surahNameMap[id] || `${t("surah")} ${id}`;
    grid.appendChild(page.createTadaborCard(id, suraName, entries));
  });

  page.tadaborGrid.appendChild(grid);
}

/** @param {AlbumsPage} page */
function createTadaborCard(page, suraId, suraName, entries) {
  const card = asButton(document.createElement("div"));
  card.className = "reciter-card";
  card.innerHTML = `
      <span class="reciter-card-badge">${entries.length}</span>
      <div class="reciter-card-avatar"><i class="fas fa-lightbulb" aria-hidden="true"></i></div>
      <span class="reciter-card-name">${escapeHtml(suraName)}</span>
      <span class="reciter-card-meta">${t("reflections").replace("{count}", entries.length)}</span>
    `;

  card.addEventListener("click", () => page.openTadabor(suraName, entries));
  return card;
}

/** @param {AlbumsPage} page */
async function openTadabor(page, suraName, entries) {
  const tracks = mp3quranApi.getTadaborTracksForSura(entries, suraName);
  const album = {
    source: "mp3quran-tracks",
    id: `tadabor-${suraName}`,
    title: suraName,
    artist: t("tadabor"),
    icon: "fas fa-lightbulb",
    tracks,
  };
  page.saveArchiveState({ group: "tadabor" });
  localStorage.setItem("selectedAlbum", JSON.stringify(album));
  await ipcRenderer.invoke("navigate-to", "playlist");
}

module.exports = {
  ensureTadaborLoaded,
  renderTadabor,
  createTadaborCard,
  openTadabor,
};
