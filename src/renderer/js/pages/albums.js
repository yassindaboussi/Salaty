"use strict";

const { ipcRenderer } = require("electron");
const mp3quranApi = require("../services/api/mp3quran");
const { t, getLanguage } = require("../core/i18n");
const { escapeHtml, asButton } = require("../utils/html");

const mp3quranLang = mp3quranApi.apiLanguage;

const ARABIC_ALPHABET = [
  "ا",
  "ب",
  "ت",
  "ث",
  "ج",
  "ح",
  "خ",
  "د",
  "ذ",
  "ر",
  "ز",
  "س",
  "ش",
  "ص",
  "ض",
  "ط",
  "ظ",
  "ع",
  "غ",
  "ف",
  "ق",
  "ك",
  "ل",
  "م",
  "ن",
  "ه",
  "و",
  "ي",
];
const LATIN_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function groupingLetter(name) {
  const raw = (name || "#").trim();
  if (!raw) return "#";
  const first = raw
    .normalize("NFKD")
    .replace(/[\u0617-\u061A\u064B-\u0652]/g, "")
    .charAt(0);
  if (/[\u0621-\u064A]/.test(first)) {
    return first.replace(/[إأآ]/, "ا");
  }
  if (/[A-Za-z]/.test(first)) return first.toUpperCase();
  return "#";
}

class AlbumsManager {
  constructor() {
    this.reciters = [];
    this.tadaborBySura = null;
    this.surahNames = null;
    this.tafsirBooks = null;
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
    this.albumsGrid = document.getElementById("albumsGrid");
    this.azIndex = document.getElementById("azIndex");

    this.tadaborGroup = document.getElementById("tadaborGroup");
    this.tadaborGroupHeader = document.getElementById("tadaborGroupHeader");
    this.tadaborSearchInput = document.getElementById("tadaborSearchInput");
    this.tadaborGrid = document.getElementById("tadaborGrid");

    this.tafsirGroup = document.getElementById("tafsirGroup");
    this.tafsirGroupHeader = document.getElementById("tafsirGroupHeader");
    this.tafsirSearchInput = document.getElementById("tafsirSearchInput");
    this.tafsirGrid = document.getElementById("tafsirGrid");
    this.tafsirBackBtn = document.getElementById("tafsirBackBtn");
    this.tafsirBackBtnLabel = document.getElementById("tafsirBackBtnLabel");

    this.moshafModal = document.getElementById("moshafModal");
    this.moshafModalTitle = document.getElementById("moshafModalTitle");
    this.moshafModalList = document.getElementById("moshafModalList");
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
      this.renderReciters(this.searchInput.value.trim());
    });
    this.tadaborSearchInput?.addEventListener("input", () => {
      this.renderTadabor(this.tadaborSearchInput.value.trim());
    });
    this.tafsirSearchInput?.addEventListener("input", () => {
      this.renderTafsir(this.tafsirSearchInput.value.trim());
    });

    this.tafsirBackBtn?.addEventListener("click", () => {
      this.currentTafsirBook = null;
      if (this.tafsirSearchInput) this.tafsirSearchInput.value = "";
      this.renderTafsir();
    });

    this.moshafModalClose?.addEventListener("click", () =>
      this.closeMoshafPicker(),
    );
    this.moshafModal?.addEventListener("click", (e) => {
      if (e.target === this.moshafModal) this.closeMoshafPicker();
    });
  }

  activateGroup(groupEl, headerEl) {
    [this.reciteGroup, this.tafsirGroup, this.tadaborGroup].forEach((g) => {
      g?.classList.remove("expanded", "content-visible");
    });
    [
      this.reciteGroupHeader,
      this.tafsirGroupHeader,
      this.tadaborGroupHeader,
    ].forEach((h) => {
      h?.setAttribute("aria-expanded", "false");
    });

    groupEl.classList.add("expanded");
    headerEl.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        groupEl.classList.add("content-visible");
      });
    });
  }

  toggleGroup(groupEl, headerEl, onFirstExpand) {
    const alreadyExpanded = groupEl.classList.contains("expanded");
    if (alreadyExpanded) {
      groupEl.classList.remove("expanded", "content-visible");
      headerEl.setAttribute("aria-expanded", "false");
      return;
    }
    this.activateGroup(groupEl, headerEl);
    onFirstExpand();
  }

  saveArchiveState(state) {
    try {
      localStorage.setItem("archiveState", JSON.stringify(state));
    } catch {}
  }

  async restoreArchiveState() {
    let saved;
    try {
      saved = JSON.parse(localStorage.getItem("archiveState") || "null");
    } catch {
      saved = null;
    }

    if (!saved || !saved.group) {
      if (this.reciteGroup) {
        this.activateGroup(this.reciteGroup, this.reciteGroupHeader);
        await this.ensureRecitersLoaded();
      }
      return;
    }

    if (saved.group === "recite" && this.reciteGroup) {
      this.activateGroup(this.reciteGroup, this.reciteGroupHeader);
      await this.ensureRecitersLoaded();
    } else if (saved.group === "tadabor" && this.tadaborGroup) {
      this.activateGroup(this.tadaborGroup, this.tadaborGroupHeader);
      await this.ensureTadaborLoaded();
    } else if (saved.group === "tafsir" && this.tafsirGroup) {
      this.activateGroup(this.tafsirGroup, this.tafsirGroupHeader);
      await this.ensureTafsirBooksLoaded();
      if (saved.tafsirBookId != null) {
        const book = (this.tafsirBooks || []).find(
          (b) => String(b.id) === String(saved.tafsirBookId),
        );
        if (book) await this.openTafsirBook(book);
      }
    }
  }

  async ensureRecitersLoaded() {
    if (this.reciters.length > 0) return;
    this.albumsGrid.innerHTML = `<div class="loading"><i class="fas fa-spinner" aria-hidden="true"></i>${t("loadingReciters")}</div>`;
    try {
      const reciters = await mp3quranApi.getReciters(mp3quranLang());
      this.reciters = reciters
        .filter((r) => Array.isArray(r.moshaf) && r.moshaf.length > 0)
        .sort((a, b) => a.name.localeCompare(b.name));
      this.renderReciters();
    } catch (error) {
      console.error("Failed to load reciters:", error);
      this.albumsGrid.innerHTML = `
        <div class="error-message">
          <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
          <div>${t("errorLoadingReciters")}</div>
          <button type="button" class="retry-button" id="retryLoadReciters">${t("retry")}</button>
        </div>`;
      document
        .getElementById("retryLoadReciters")
        ?.addEventListener("click", () => {
          this.reciters = [];
          this.ensureRecitersLoaded();
        });
    }
  }

  renderReciters(query = "") {
    const list = query
      ? this.reciters.filter((r) =>
          r.name.toLowerCase().includes(query.toLowerCase()),
        )
      : this.reciters;

    this.albumsGrid.innerHTML = "";
    this.azIndex.innerHTML = "";

    if (list.length === 0) {
      this.albumsGrid.innerHTML = `<div class="empty-state"><i class="fas fa-search" aria-hidden="true"></i><p>${t("noTracksFound")}</p></div>`;
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
      const ai = orderIndex.has(a) ? orderIndex.get(a) : 999;
      const bi = orderIndex.has(b) ? orderIndex.get(b) : 999;
      return ai - bi;
    });

    sortedLetters.forEach((letter) => {
      const header = document.createElement("div");
      header.className = "reciter-section-header";
      header.id = `reciter-section-${letter}`;
      header.textContent = letter;
      grid.appendChild(header);

      groups[letter].forEach((reciter) => {
        grid.appendChild(this.createReciterCard(reciter));
      });
    });

    this.albumsGrid.appendChild(grid);

    this.azIndex.style.display = query ? "none" : "flex";
    if (!query) this.buildAzIndex(sortedLetters);
  }

  buildAzIndex(availableLetters) {
    const alphabet = [
      ...(getLanguage() === "ar" ? ARABIC_ALPHABET : LATIN_ALPHABET),
      "#",
    ];
    const available = new Set(availableLetters);

    alphabet.forEach((letter) => {
      const el = document.createElement("span");
      el.className = "az-index-letter";
      el.textContent = letter;
      if (available.has(letter)) {
        el.classList.add("has-entries");
        el.addEventListener("click", () => {
          document
            .getElementById(`reciter-section-${letter}`)
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
      this.azIndex.appendChild(el);
    });
  }

  createReciterCard(reciter) {
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
        this.openReciter(reciter, reciter.moshaf[0]);
      } else {
        this.openMoshafPicker(reciter);
      }
    });

    return card;
  }

  openMoshafPicker(reciter) {
    this.moshafModalTitle.textContent = reciter.name;
    this.moshafModalList.innerHTML = "";

    reciter.moshaf.forEach((moshaf) => {
      const item = asButton(document.createElement("div"));
      item.className = "moshaf-item";
      item.innerHTML = `<i class="fas fa-play-circle" aria-hidden="true"></i><span>${escapeHtml(moshaf.name)}</span>`;
      item.addEventListener("click", () => {
        this.closeMoshafPicker();
        this.openReciter(reciter, moshaf);
      });
      this.moshafModalList.appendChild(item);
    });

    this.moshafModal.classList.add("show");
  }

  closeMoshafPicker() {
    this.moshafModal.classList.remove("show");
  }

  async openReciter(reciter, moshaf) {
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
    this.saveArchiveState({ group: "recite" });
    localStorage.setItem("selectedAlbum", JSON.stringify(album));
    await ipcRenderer.invoke("navigate-to", "playlist");
  }

  async ensureTadaborLoaded() {
    if (this.tadaborBySura) return;
    this.tadaborGrid.innerHTML = `<div class="loading"><i class="fas fa-spinner" aria-hidden="true"></i>${t("loadingTadabor")}</div>`;
    try {
      const [bySura, surahs] = await Promise.all([
        mp3quranApi.getTadabor(mp3quranLang()),
        mp3quranApi.getSurahNames(mp3quranLang()),
      ]);
      this.tadaborBySura = bySura;
      this.surahNames = surahs;
      this.renderTadabor();
    } catch (error) {
      console.error("Failed to load tadabor:", error);
      this.tadaborGrid.innerHTML = `
        <div class="error-message">
          <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
          <div>${t("errorLoadingTadabor")}</div>
          <button type="button" class="retry-button" id="retryLoadTadabor">${t("retry")}</button>
        </div>`;
      document
        .getElementById("retryLoadTadabor")
        ?.addEventListener("click", () => {
          this.tadaborBySura = null;
          this.ensureTadaborLoaded();
        });
    }
  }

  renderTadabor(query = "") {
    const surahNameMap = {};
    (this.surahNames || []).forEach((s) => {
      surahNameMap[s.id] = (s.name || "").trim();
    });

    let suraIds = Object.keys(this.tadaborBySura || {})
      .filter((id) => (this.tadaborBySura[id] || []).length > 0)
      .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

    if (query) {
      const lower = query.toLowerCase();
      suraIds = suraIds.filter((id) =>
        (surahNameMap[id] || `Surah ${id}`).toLowerCase().includes(lower),
      );
    }

    this.tadaborGrid.innerHTML = "";

    if (suraIds.length === 0) {
      this.tadaborGrid.innerHTML = `<div class="empty-state"><i class="fas fa-search" aria-hidden="true"></i><p>${t("noTracksFound")}</p></div>`;
      return;
    }

    const grid = document.createElement("div");
    grid.className = "reciter-grid";

    suraIds.forEach((id) => {
      const entries = this.tadaborBySura[id] || [];
      const suraName = surahNameMap[id] || `${t("surah")} ${id}`;
      grid.appendChild(this.createTadaborCard(id, suraName, entries));
    });

    this.tadaborGrid.appendChild(grid);
  }

  createTadaborCard(suraId, suraName, entries) {
    const card = asButton(document.createElement("div"));
    card.className = "reciter-card";
    card.innerHTML = `
      <span class="reciter-card-badge">${entries.length}</span>
      <div class="reciter-card-avatar"><i class="fas fa-lightbulb" aria-hidden="true"></i></div>
      <span class="reciter-card-name">${escapeHtml(suraName)}</span>
      <span class="reciter-card-meta">${t("reflections").replace("{count}", entries.length)}</span>
    `;

    card.addEventListener("click", () => this.openTadabor(suraName, entries));
    return card;
  }

  async openTadabor(suraName, entries) {
    const tracks = mp3quranApi.getTadaborTracksForSura(entries, suraName);
    const album = {
      source: "mp3quran-tracks",
      id: `tadabor-${suraName}`,
      title: suraName,
      artist: t("tadabor"),
      icon: "fas fa-lightbulb",
      tracks,
    };
    this.saveArchiveState({ group: "tadabor" });
    localStorage.setItem("selectedAlbum", JSON.stringify(album));
    await ipcRenderer.invoke("navigate-to", "playlist");
  }

  async ensureTafsirBooksLoaded() {
    if (this.tafsirBooks) {
      this.renderTafsir();
      return;
    }
    this.tafsirGrid.innerHTML = `<div class="loading"><i class="fas fa-spinner" aria-hidden="true"></i>${t("loadingTafasir")}</div>`;
    try {
      this.tafsirBooks = await mp3quranApi.getTafasirBooks(mp3quranLang());
      this.renderTafsir();
    } catch (error) {
      console.error("Failed to load tafsir books:", error);
      this.tafsirGrid.innerHTML = `
        <div class="error-message">
          <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
          <div>${t("errorLoadingTafasir")}</div>
          <button type="button" class="retry-button" id="retryLoadTafsir">${t("retry")}</button>
        </div>`;
      document
        .getElementById("retryLoadTafsir")
        ?.addEventListener("click", () => {
          this.tafsirBooks = null;
          this.ensureTafsirBooksLoaded();
        });
    }
  }

  async openTafsirBook(book) {
    this.tafsirGrid.innerHTML = `<div class="loading"><i class="fas fa-spinner" aria-hidden="true"></i>${t("loadingTafasir")}</div>`;
    try {
      const { bookName, bySura } = await mp3quranApi.getTafsirSurahs(
        book.id,
        mp3quranLang(),
      );
      if (!this.surahNames) {
        this.surahNames = await mp3quranApi.getSurahNames(mp3quranLang());
      }
      this.currentTafsirBook = {
        id: book.id,
        name: book.displayName || bookName || book.name,
        bySura,
      };
      if (this.tafsirSearchInput) this.tafsirSearchInput.value = "";
      this.renderTafsir();
    } catch (error) {
      console.error("Failed to load tafsir surahs:", error);
      this.tafsirGrid.innerHTML = `
        <div class="error-message">
          <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
          <div>${t("errorLoadingTafasir")}</div>
          <button type="button" class="retry-button" id="retryLoadTafsirBook">${t("retry")}</button>
        </div>`;
      document
        .getElementById("retryLoadTafsirBook")
        ?.addEventListener("click", () => this.openTafsirBook(book));
    }
  }

  renderTafsir(query = "") {
    if (this.tafsirBackBtn) {
      this.tafsirBackBtn.style.display = this.currentTafsirBook
        ? "flex"
        : "none";
    }

    if (this.currentTafsirBook) {
      this.renderTafsirSurahs(query);
    } else {
      this.renderTafsirBooks(query);
    }
  }

  renderTafsirBooks(query) {
    let books = this.tafsirBooks || [];
    if (query) {
      const lower = query.toLowerCase();
      books = books.filter((b) =>
        (b.displayName || b.name || "").toLowerCase().includes(lower),
      );
    }

    this.tafsirGrid.innerHTML = "";
    if (books.length === 0) {
      this.tafsirGrid.innerHTML = `<div class="empty-state"><i class="fas fa-search" aria-hidden="true"></i><p>${t("noTracksFound")}</p></div>`;
      return;
    }

    const grid = document.createElement("div");
    grid.className = "reciter-grid";
    books.forEach((book) => {
      const card = asButton(document.createElement("div"));
      card.className = "reciter-card";
      card.innerHTML = `
        <div class="reciter-card-avatar"><i class="fas fa-book-open" aria-hidden="true"></i></div>
        <span class="reciter-card-name">${escapeHtml(book.displayName || book.name)}</span>
      `;
      card.addEventListener("click", () => this.openTafsirBook(book));
      grid.appendChild(card);
    });
    this.tafsirGrid.appendChild(grid);
  }

  renderTafsirSurahs(query) {
    const surahNameMap = {};
    (this.surahNames || []).forEach((s) => {
      surahNameMap[s.id] = (s.name || "").trim();
    });

    const bySura = this.currentTafsirBook.bySura || {};
    let suraIds = Object.keys(bySura)
      .filter((id) => (bySura[id] || []).length > 0)
      .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

    if (query) {
      const lower = query.toLowerCase();
      suraIds = suraIds.filter((id) =>
        (surahNameMap[id] || `Surah ${id}`).toLowerCase().includes(lower),
      );
    }

    this.tafsirGrid.innerHTML = "";
    if (suraIds.length === 0) {
      this.tafsirGrid.innerHTML = `<div class="empty-state"><i class="fas fa-search" aria-hidden="true"></i><p>${t("noTracksFound")}</p></div>`;
      return;
    }

    const grid = document.createElement("div");
    grid.className = "reciter-grid";
    suraIds.forEach((id) => {
      const entries = bySura[id] || [];
      const suraName = surahNameMap[id] || `${t("surah")} ${id}`;
      const card = asButton(document.createElement("div"));
      card.className = "reciter-card";
      card.innerHTML = `
        <span class="reciter-card-badge">${entries.length}</span>
        <div class="reciter-card-avatar"><i class="fas fa-book-open" aria-hidden="true"></i></div>
        <span class="reciter-card-name">${escapeHtml(suraName)}</span>
      `;
      card.addEventListener("click", () =>
        this.openTafsirSurah(suraName, entries),
      );
      grid.appendChild(card);
    });
    this.tafsirGrid.appendChild(grid);
  }

  async openTafsirSurah(suraName, entries) {
    const tracks = mp3quranApi.getTafsirTracksForSura(
      entries,
      suraName,
      this.currentTafsirBook?.name,
    );
    const album = {
      source: "mp3quran-tracks",
      id: `tafsir-${this.currentTafsirBook?.id}-${suraName}`,
      title: suraName,
      artist: this.currentTafsirBook?.name || t("tafasir"),
      icon: "fas fa-book-open",
      tracks,
    };
    this.saveArchiveState({
      group: "tafsir",
      tafsirBookId: this.currentTafsirBook?.id,
    });
    localStorage.setItem("selectedAlbum", JSON.stringify(album));
    await ipcRenderer.invoke("navigate-to", "playlist");
  }
}

// Settings, theme, window buttons, the fullscreen toggle and tooltips: core/app-shell.js.
function initAlbumsPage() {
  return new AlbumsManager().init();
}

module.exports = { initAlbumsPage };
