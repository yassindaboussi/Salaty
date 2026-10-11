"use strict";

// The recitations section: the reciters (mp3quran.net) by letter, searchable; opening a recitation
// goes to the playlist page.
const { ipcRenderer } = require("electron");
const mp3quranApi = require("../../services/api/mp3quran");
const { t, getLanguage } = require("../../core/i18n");
const { escapeHtml, asButton } = require("../../utils/html");
const {
  ARABIC_ALPHABET,
  LATIN_ALPHABET,
  groupingLetter,
} = require("./az-index");
/** @typedef {import("./index").AlbumsPage} AlbumsPage */

const mp3quranLang = mp3quranApi.apiLanguage;

/** @param {AlbumsPage} page */
async function ensureRecitersLoaded(page) {
  if (page.reciters.length > 0) return;
  page.albumsGrid.innerHTML = `<div class="loading"><i class="fas fa-spinner" aria-hidden="true"></i>${t("loadingReciters")}</div>`;
  try {
    const reciters = await mp3quranApi.getReciters(mp3quranLang());
    page.reciters = reciters
      .filter((r) => Array.isArray(r.moshaf) && r.moshaf.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
    page.renderReciters();
  } catch (error) {
    console.error("Failed to load reciters:", error);
    page.albumsGrid.innerHTML = `
        <div class="error-message">
          <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
          <div>${t("errorLoadingReciters")}</div>
          <button type="button" class="retry-button" id="retryLoadReciters">${t("retry")}</button>
        </div>`;
    document
      .getElementById("retryLoadReciters")
      ?.addEventListener("click", () => {
        page.reciters = [];
        page.ensureRecitersLoaded();
      });
  }
}

/** @param {AlbumsPage} page */
function renderReciters(page, query = "") {
  const list = query
    ? page.reciters.filter((r) =>
        r.name.toLowerCase().includes(query.toLowerCase()),
      )
    : page.reciters;

  page.albumsGrid.innerHTML = "";
  page.azIndex.innerHTML = "";

  if (list.length === 0) {
    page.albumsGrid.innerHTML = `<div class="empty-state"><i class="fas fa-search" aria-hidden="true"></i><p>${t("noTracksFound")}</p></div>`;
    return;
  }

  const groups = {};
  list.forEach((reciter) => {
    const letter = groupingLetter(reciter.name);
    if (!groups[letter]) groups[letter] = [];
    groups[letter].push(reciter);
  });

  const grid = document.createElement("div");
  grid.className = "reciter-grid";

  const alphabet = getLanguage() === "ar" ? ARABIC_ALPHABET : LATIN_ALPHABET;
  const orderIndex = new Map(alphabet.map((l, i) => [l, i]));
  const sortedLetters = Object.keys(groups).sort((a, b) => {
    if (a === "#") return 1;
    if (b === "#") return -1;
    const ai = orderIndex.get(a) ?? 999;
    const bi = orderIndex.get(b) ?? 999;
    return ai - bi;
  });

  sortedLetters.forEach((letter) => {
    const header = document.createElement("div");
    header.className = "reciter-section-header";
    header.id = `reciter-section-${letter}`;
    header.textContent = letter;
    grid.appendChild(header);

    groups[letter].forEach((reciter) => {
      grid.appendChild(page.createReciterCard(reciter));
    });
  });

  page.albumsGrid.appendChild(grid);

  page.azIndex.style.display = query ? "none" : "flex";
  if (!query) page.buildAzIndex(sortedLetters);
}

/** @param {AlbumsPage} page */
function createReciterCard(page, reciter) {
  const card = asButton(document.createElement("div"));
  card.className = "reciter-card";

  const singleMoshaf = reciter.moshaf.length === 1;
  const subtitle = singleMoshaf
    ? escapeHtml(reciter.moshaf[0].name)
    : t("recitationsAvailable").replace("{count}", reciter.moshaf.length);

  card.innerHTML = `
      ${
        singleMoshaf
          ? ""
          : `<span class="reciter-card-badge">${reciter.moshaf.length}</span>`
      }
      <div class="reciter-card-avatar"><i class="fas fa-microphone-lines" aria-hidden="true"></i></div>
      <span class="reciter-card-name">${escapeHtml(reciter.name)}</span>
      <span class="reciter-card-meta">${subtitle}</span>
    `;

  card.addEventListener("click", () => {
    if (singleMoshaf) {
      page.openReciter(reciter, reciter.moshaf[0]);
    } else {
      page.openMoshafPicker(reciter);
    }
  });

  return card;
}

/** @param {AlbumsPage} page */
async function openReciter(page, reciter, moshaf) {
  const album = {
    source: "mp3quran",
    id: `${reciter.id}-${moshaf.id}`,
    title: reciter.name,
    artist: moshaf.name,
    icon: "fas fa-microphone-lines",
    reciterName: reciter.name,
    server: moshaf.server || moshaf.Server || "",
    surahList: moshaf.surah_list || moshaf.suras || "",
  };
  page.saveArchiveState({ group: "recite" });
  localStorage.setItem("selectedAlbum", JSON.stringify(album));
  await ipcRenderer.invoke("navigate-to", "playlist");
}

module.exports = {
  ensureRecitersLoaded,
  renderReciters,
  createReciterCard,
  openReciter,
};
