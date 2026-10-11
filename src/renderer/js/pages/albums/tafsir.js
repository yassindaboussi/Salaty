"use strict";

// The Tafsir section: the tafsir books, then one book's surahs (with a back button), searchable;
// opening a surah goes to the playlist page.
const { ipcRenderer } = require("electron");
const mp3quranApi = require("../../services/api/mp3quran");
const { t } = require("../../core/i18n");
const { html, setHtml, asButton } = require("../../utils/html");
/** @typedef {import("./index").AlbumsPage} AlbumsPage */

const mp3quranLang = mp3quranApi.apiLanguage;

/** @param {AlbumsPage} page */
async function ensureTafsirBooksLoaded(page) {
  if (page.tafsirBooks) {
    page.renderTafsir();
    return;
  }
  setHtml(
    page.tafsirGrid,
    html`<div class="loading"><i class="fas fa-spinner" aria-hidden="true"></i>${t("loadingTafasir")}</div>`,
  );
  try {
    page.tafsirBooks = await mp3quranApi.getTafasirBooks(mp3quranLang());
    page.renderTafsir();
  } catch (error) {
    console.error("Failed to load tafsir books:", error);
    setHtml(
      page.tafsirGrid,
      html`
        <div class="error-message">
          <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
          <div>${t("errorLoadingTafasir")}</div>
          <button type="button" class="retry-button" id="retryLoadTafsir">${t("retry")}</button>
        </div>`,
    );
    document
      .getElementById("retryLoadTafsir")
      ?.addEventListener("click", () => {
        page.tafsirBooks = null;
        page.ensureTafsirBooksLoaded();
      });
  }
}

/** @param {AlbumsPage} page */
async function openTafsirBook(page, book) {
  setHtml(
    page.tafsirGrid,
    html`<div class="loading"><i class="fas fa-spinner" aria-hidden="true"></i>${t("loadingTafasir")}</div>`,
  );
  try {
    const { bookName, bySura } = await mp3quranApi.getTafsirSurahs(
      book.id,
      mp3quranLang(),
    );
    if (!page.surahNames) {
      page.surahNames = await mp3quranApi.getSurahNames(mp3quranLang());
    }
    page.currentTafsirBook = {
      id: book.id,
      name: book.displayName || bookName || book.name,
      bySura,
    };
    if (page.tafsirSearchInput instanceof HTMLInputElement)
      page.tafsirSearchInput.value = "";
    page.renderTafsir();
  } catch (error) {
    console.error("Failed to load tafsir surahs:", error);
    setHtml(
      page.tafsirGrid,
      html`
        <div class="error-message">
          <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
          <div>${t("errorLoadingTafasir")}</div>
          <button type="button" class="retry-button" id="retryLoadTafsirBook">${t("retry")}</button>
        </div>`,
    );
    document
      .getElementById("retryLoadTafsirBook")
      ?.addEventListener("click", () => page.openTafsirBook(book));
  }
}

/** @param {AlbumsPage} page */
function renderTafsir(page, query = "") {
  if (page.tafsirBackBtn) {
    page.tafsirBackBtn.style.display = page.currentTafsirBook ? "flex" : "none";
  }

  if (page.currentTafsirBook) {
    page.renderTafsirSurahs(query);
  } else {
    page.renderTafsirBooks(query);
  }
}

/** @param {AlbumsPage} page */
function renderTafsirBooks(page, query) {
  let books = page.tafsirBooks || [];
  if (query) {
    const lower = query.toLowerCase();
    books = books.filter((b) =>
      (b.displayName || b.name || "").toLowerCase().includes(lower),
    );
  }

  page.tafsirGrid.innerHTML = "";
  if (books.length === 0) {
    setHtml(
      page.tafsirGrid,
      html`<div class="empty-state"><i class="fas fa-search" aria-hidden="true"></i><p>${t("noTracksFound")}</p></div>`,
    );
    return;
  }

  const grid = document.createElement("div");
  grid.className = "reciter-grid";
  books.forEach((book) => {
    const card = asButton(document.createElement("div"));
    card.className = "reciter-card";
    setHtml(
      card,
      html`
        <div class="reciter-card-avatar"><i class="fas fa-book-open" aria-hidden="true"></i></div>
        <span class="reciter-card-name">${book.displayName || book.name}</span>
      `,
    );
    card.addEventListener("click", () => page.openTafsirBook(book));
    grid.appendChild(card);
  });
  page.tafsirGrid.appendChild(grid);
}

/** @param {AlbumsPage} page */
function renderTafsirSurahs(page, query) {
  const surahNameMap = {};
  (page.surahNames || []).forEach((s) => {
    surahNameMap[s.id] = (s.name || "").trim();
  });

  // renderTafsir() only calls this while a book is open
  const bySura = page.currentTafsirBook?.bySura || {};
  let suraIds = Object.keys(bySura)
    .filter((id) => (bySura[id] || []).length > 0)
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

  if (query) {
    const lower = query.toLowerCase();
    suraIds = suraIds.filter((id) =>
      (surahNameMap[id] || `Surah ${id}`).toLowerCase().includes(lower),
    );
  }

  page.tafsirGrid.innerHTML = "";
  if (suraIds.length === 0) {
    setHtml(
      page.tafsirGrid,
      html`<div class="empty-state"><i class="fas fa-search" aria-hidden="true"></i><p>${t("noTracksFound")}</p></div>`,
    );
    return;
  }

  const grid = document.createElement("div");
  grid.className = "reciter-grid";
  suraIds.forEach((id) => {
    const entries = bySura[id] || [];
    const suraName = surahNameMap[id] || `${t("surah")} ${id}`;
    const card = asButton(document.createElement("div"));
    card.className = "reciter-card";
    setHtml(
      card,
      html`
        <span class="reciter-card-badge">${entries.length}</span>
        <div class="reciter-card-avatar"><i class="fas fa-book-open" aria-hidden="true"></i></div>
        <span class="reciter-card-name">${suraName}</span>
      `,
    );
    card.addEventListener("click", () =>
      page.openTafsirSurah(suraName, entries),
    );
    grid.appendChild(card);
  });
  page.tafsirGrid.appendChild(grid);
}

/** @param {AlbumsPage} page */
async function openTafsirSurah(page, suraName, entries) {
  const tracks = mp3quranApi.getTafsirTracksForSura(
    entries,
    suraName,
    page.currentTafsirBook?.name,
  );
  const album = {
    source: "mp3quran-tracks",
    id: `tafsir-${page.currentTafsirBook?.id}-${suraName}`,
    title: suraName,
    artist: page.currentTafsirBook?.name || t("tafasir"),
    icon: "fas fa-book-open",
    tracks,
  };
  page.saveArchiveState({
    group: "tafsir",
    tafsirBookId: page.currentTafsirBook?.id,
  });
  localStorage.setItem("selectedAlbum", JSON.stringify(album));
  await ipcRenderer.invoke("navigate-to", "playlist");
}

module.exports = {
  ensureTafsirBooksLoaded,
  openTafsirBook,
  renderTafsir,
  renderTafsirBooks,
  renderTafsirSurahs,
  openTafsirSurah,
};
