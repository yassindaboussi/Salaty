"use strict";

// The Tafasir tab: the tafsir books, then one book's surahs (with a back row), filtered by the
// search; a surah opens its recordings in the playlist page. The open book is remembered.
const mp3quranApi = require("../../services/api/mp3quran");
const { t } = require("../../core/i18n");
const { byId } = require("../../core/dom");
const { html, setHtml } = require("../../utils/html");
const { normalizeForSearch } = require("../../utils/search-text");
const { state, surahName } = require("./state");
const { openAlbum } = require("./open-album");
const { messageHtml } = require("./messages");

const lang = () => mp3quranApi.apiLanguage();
const box = () => byId("acTafsir", HTMLElement);

async function loadTafsirBooks() {
  if (state.tafsirBooks) {
    renderTafsir();
    return;
  }
  setHtml(box(), messageHtml("loading", t("loadingTafasir")));
  try {
    const books = await mp3quranApi.getTafasirBooks(lang());
    state.tafsirBooks = books;
    const saved = books.find(
      (b) => String(b.id) === String(state.tafsirBookId),
    );
    if (saved) await openTafsirBook(saved);
    else renderTafsir();
  } catch (error) {
    console.error("Failed to load tafsir books:", error);
    setHtml(box(), messageHtml("error", t("errorLoadingTafasir"), "tafsir"));
  }
}

async function openTafsirBook(book) {
  setHtml(box(), messageHtml("loading", t("loadingTafasir")));
  try {
    const { bookName, bySura } = await mp3quranApi.getTafsirSurahs(
      book.id,
      lang(),
    );
    if (!state.surahNames)
      state.surahNames = await mp3quranApi.getSurahNames(lang());
    state.tafsirBook = {
      id: book.id,
      name: book.displayName || bookName || book.name,
      bySura,
    };
    renderTafsir();
  } catch (error) {
    console.error("Failed to load tafsir surahs:", error);
    setHtml(box(), messageHtml("error", t("errorLoadingTafasir"), "tafsir"));
  }
}

function closeTafsirBook() {
  state.tafsirBook = null;
  state.tafsirBookId = null;
  renderTafsir();
}

/** @param {string} icon @param {string} title @param {string} meta @param {import("../../utils/html").HtmlFragment} attrs */
const rowHtml = (icon, title, meta, attrs) =>
  html`<li><button type="button" class="ac-row" ${attrs}><i class="fas ${icon} ac-row-icon" aria-hidden="true"></i><span class="ac-row-title">${title}</span><span class="ac-row-meta">${meta}</span><i class="fas fa-chevron-right ac-row-go" aria-hidden="true"></i></button></li>`;

function renderTafsir() {
  if (!state.tafsirBooks) return;
  const query = normalizeForSearch(state.query);
  const has = (/** @type {string} */ text) =>
    !query || normalizeForSearch(text).includes(query);

  if (!state.tafsirBook) {
    const books = state.tafsirBooks.filter((b) =>
      has(b.displayName || b.name || ""),
    );
    setHtml(
      box(),
      books.length
        ? html`<ul class="ac-rows">${books.map((b) => rowHtml("fa-book-open", b.displayName || b.name, "", html`data-book="${b.id}"`))}</ul>`
        : messageHtml("empty", t("noTracksFound")),
    );
    return;
  }

  const { bySura, name } = state.tafsirBook;
  const ids = Object.keys(bySura)
    .filter((id) => (bySura[id] ?? []).length && has(surahName(id)))
    .sort((a, b) => Number(a) - Number(b));
  setHtml(
    box(),
    html`<button type="button" class="ac-back" data-action="tafsir-back"><i class="fas fa-arrow-left ac-back-icon" aria-hidden="true"></i><span>${name}</span></button>${
      ids.length
        ? html`<ul class="ac-rows">${ids.map((id) => rowHtml("fa-book-open", `${id}. ${surahName(id)}`, String(bySura[id].length), html`data-sura="${id}"`))}</ul>`
        : messageHtml("empty", t("noTracksFound"))
    }`,
  );
}

/** @param {HTMLButtonElement} button */
function onTafsirAction(button) {
  if (button.dataset.action === "tafsir-back") {
    closeTafsirBook();
    return;
  }
  if (button.dataset.book) {
    const book = state.tafsirBooks?.find(
      (b) => String(b.id) === button.dataset.book,
    );
    if (book) openTafsirBook(book);
    return;
  }
  const id = button.dataset.sura;
  if (!id || !state.tafsirBook) return;
  const name = surahName(id);
  openAlbum({
    source: "mp3quran-tracks",
    id: `tafsir-${state.tafsirBook.id}-${id}`,
    title: name,
    artist: state.tafsirBook.name,
    icon: "fas fa-book-open",
    tracks: mp3quranApi.getTafsirTracksForSura(
      state.tafsirBook.bySura[id],
      name,
      state.tafsirBook.name,
    ),
  });
}

module.exports = { loadTafsirBooks, renderTafsir, onTafsirAction };
