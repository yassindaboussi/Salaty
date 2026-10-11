"use strict";

// The archive page (albums.html): three sections of mp3quran.net audio. Its parts:
//   sections.js        the collapsible sections and the one remembered for the next visit
//   reciter-grid.js    the reciters by letter, searchable
//   az-index.js        the letter of a reciter and the A–Z index
//   moshaf-picker.js   the dialog to pick one of a reciter's recitations
//   tadabor.js         reflections by surah
//   tafsir.js          tafsir books, then one book's surahs
// The page is the AlbumsManager class below: it finds the elements and wires the listeners; its
// other methods delegate to the parts above, which take the page as their first argument.
// The mp3quran.net requests are in services/api/mp3quran.js.
const { byId } = require("../../core/dom");
const sections = require("./sections");
const reciterGrid = require("./reciter-grid");
const azIndex = require("./az-index");
const moshafPicker = require("./moshaf-picker");
const tadabor = require("./tadabor");
const tafsir = require("./tafsir");

// The page object the parts receive.
/** @typedef {AlbumsManager} AlbumsPage */

class AlbumsManager {
  constructor() {
    this.reciters = [];
    this.tadaborBySura = null;
    this.surahNames = null;
    this.tafsirBooks = null;
    /** @type {{ id: any, name: any, bySura: any } | null} */
    this.currentTafsirBook = null;
    this.initElements();
    this.initListeners();
  }

  async init() {
    this.updateTranslations();
    await this.restoreArchiveState();
    return this;
  }

  updateTranslations() {}

  initElements() {
    this.minimizeBtn = document.getElementById("minimizeBtn");
    this.fullscreenBtn = document.getElementById("fullscreenBtn");
    this.closeBtn = document.getElementById("closeBtn");

    this.reciteGroup = document.getElementById("reciteGroup");
    this.reciteGroupHeader = document.getElementById("reciteGroupHeader");
    this.searchInput = document.getElementById("searchInput");
    // typed here: set in a method rather than the constructor, so the checker would add undefined
    /** @type {HTMLElement} */
    this.albumsGrid = byId("albumsGrid", HTMLElement);
    /** @type {HTMLElement} */
    this.azIndex = byId("azIndex", HTMLElement);

    this.tadaborGroup = document.getElementById("tadaborGroup");
    this.tadaborGroupHeader = document.getElementById("tadaborGroupHeader");
    this.tadaborSearchInput = document.getElementById("tadaborSearchInput");
    /** @type {HTMLElement} */
    this.tadaborGrid = byId("tadaborGrid", HTMLElement);

    this.tafsirGroup = document.getElementById("tafsirGroup");
    this.tafsirGroupHeader = document.getElementById("tafsirGroupHeader");
    this.tafsirSearchInput = document.getElementById("tafsirSearchInput");
    /** @type {HTMLElement} */
    this.tafsirGrid = byId("tafsirGrid", HTMLElement);
    this.tafsirBackBtn = document.getElementById("tafsirBackBtn");
    this.tafsirBackBtnLabel = document.getElementById("tafsirBackBtnLabel");

    /** @type {HTMLElement} */
    this.moshafModal = byId("moshafModal", HTMLElement);
    /** @type {HTMLElement} */
    this.moshafModalTitle = byId("moshafModalTitle", HTMLElement);
    /** @type {HTMLElement} */
    this.moshafModalList = byId("moshafModalList", HTMLElement);
    this.moshafModalClose = document.getElementById("moshafModalClose");
  }

  initListeners() {
    this.reciteGroupHeader?.addEventListener("click", () =>
      this.toggleGroup(this.reciteGroup, this.reciteGroupHeader, () =>
        this.ensureRecitersLoaded(),
      ),
    );
    this.tadaborGroupHeader?.addEventListener("click", () =>
      this.toggleGroup(this.tadaborGroup, this.tadaborGroupHeader, () =>
        this.ensureTadaborLoaded(),
      ),
    );
    this.tafsirGroupHeader?.addEventListener("click", () =>
      this.toggleGroup(this.tafsirGroup, this.tafsirGroupHeader, () =>
        this.ensureTafsirBooksLoaded(),
      ),
    );

    this.searchInput?.addEventListener("input", () => {
      if (this.searchInput instanceof HTMLInputElement)
        this.renderReciters(this.searchInput.value.trim());
    });
    this.tadaborSearchInput?.addEventListener("input", () => {
      if (this.tadaborSearchInput instanceof HTMLInputElement)
        this.renderTadabor(this.tadaborSearchInput.value.trim());
    });
    this.tafsirSearchInput?.addEventListener("input", () => {
      if (this.tafsirSearchInput instanceof HTMLInputElement)
        this.renderTafsir(this.tafsirSearchInput.value.trim());
    });

    this.tafsirBackBtn?.addEventListener("click", () => {
      this.currentTafsirBook = null;
      if (this.tafsirSearchInput instanceof HTMLInputElement)
        this.tafsirSearchInput.value = "";
      this.renderTafsir();
    });

    this.moshafModalClose?.addEventListener("click", () =>
      this.closeMoshafPicker(),
    );
    this.moshafModal?.addEventListener("click", (e) => {
      if (e.target === this.moshafModal) this.closeMoshafPicker();
    });
  }

  // sections.js
  activateGroup(groupEl, headerEl) {
    return sections.activateGroup(this, groupEl, headerEl);
  }

  toggleGroup(groupEl, headerEl, onFirstExpand) {
    return sections.toggleGroup(this, groupEl, headerEl, onFirstExpand);
  }

  saveArchiveState(state) {
    return sections.saveArchiveState(this, state);
  }

  restoreArchiveState() {
    return sections.restoreArchiveState(this);
  }

  // reciter-grid.js
  ensureRecitersLoaded() {
    return reciterGrid.ensureRecitersLoaded(this);
  }

  renderReciters(query) {
    return reciterGrid.renderReciters(this, query);
  }

  createReciterCard(reciter) {
    return reciterGrid.createReciterCard(this, reciter);
  }

  openReciter(reciter, moshaf) {
    return reciterGrid.openReciter(this, reciter, moshaf);
  }

  // az-index.js
  buildAzIndex(availableLetters) {
    return azIndex.buildAzIndex(this, availableLetters);
  }

  // moshaf-picker.js
  openMoshafPicker(reciter) {
    return moshafPicker.openMoshafPicker(this, reciter);
  }

  closeMoshafPicker() {
    return moshafPicker.closeMoshafPicker(this);
  }

  // tadabor.js
  ensureTadaborLoaded() {
    return tadabor.ensureTadaborLoaded(this);
  }

  renderTadabor(query) {
    return tadabor.renderTadabor(this, query);
  }

  createTadaborCard(suraId, suraName, entries) {
    return tadabor.createTadaborCard(this, suraId, suraName, entries);
  }

  openTadabor(suraName, entries) {
    return tadabor.openTadabor(this, suraName, entries);
  }

  // tafsir.js
  ensureTafsirBooksLoaded() {
    return tafsir.ensureTafsirBooksLoaded(this);
  }

  openTafsirBook(book) {
    return tafsir.openTafsirBook(this, book);
  }

  renderTafsir(query) {
    return tafsir.renderTafsir(this, query);
  }

  renderTafsirBooks(query) {
    return tafsir.renderTafsirBooks(this, query);
  }

  renderTafsirSurahs(query) {
    return tafsir.renderTafsirSurahs(this, query);
  }

  openTafsirSurah(suraName, entries) {
    return tafsir.openTafsirSurah(this, suraName, entries);
  }
}

// Settings, theme, window buttons, the fullscreen toggle and tooltips: app/app-shell.js.
function initAlbumsPage() {
  return new AlbumsManager().init();
}

module.exports = { initAlbumsPage };
