"use strict";

// The Quran page. Its parts:
//   surah-list.js           the 114 surahs (searchable) and the 30 juz
//   reader.js               one surah's text, previous/next, the settings panel
//   translation-picker.js   the translation combobox
//   numerals.js             Arabic-Indic or Western digits
//   state.js                what is shown now, the surah/juz tables, number formatting
// The surah text comes from services/api/alquran-cloud.js (online, or the bundled offline data).
const { t } = require("../../core/i18n");
const screenSizeManager = require("../../core/screen-size");
const { showToast } = require("../../core/toast");
const { copyText } = require("../../core/clipboard");
const { initSelectionCopy } = require("../../components/selection-copy");
const {
  setupConnectionRecovery,
} = require("../../services/connection-recovery");
const { byId, queryAll } = require("../../core/dom");
const { state, fmt, SURAH_META } = require("./state");
const {
  resolveNumerals,
  updateNumeralsUI,
  setNumerals,
} = require("./numerals");
const {
  switchTab,
  onSearch,
  renderSurahGrid,
  renderJuzList,
} = require("./surah-list");
const {
  updateReaderMeta,
  openSurah,
  loadAyahs,
  renderAyahs,
  showSurahList,
  toggleSettings,
  closeSettings,
  changeFontSize,
} = require("./reader");
const {
  bindTranslationCombo,
  updateTranslationUI,
} = require("./translation-picker");

// Re-draws everything that shows a number after the user switches digit style.
function refreshNumbers() {
  renderSurahGrid(state.filteredSurahs);
  renderJuzList();
  const size = document.getElementById("fontSizeDisplay");
  if (size) size.textContent = fmt(state.fontSize);
  if (state.currentSurah) {
    updateReaderMeta();
    // Skip while a surah is still loading (the list is empty then and will render with the new digits).
    if (
      state.currentAyahs.length &&
      byId("ayahList", HTMLElement).children.length
    ) {
      renderAyahs(state.currentAyahs);
    }
  }
}

// Copies the part of the reader the user highlighted (Ctrl/Cmd+C or right-click > Copy).
async function copySelectedText(text) {
  const ok = await copyText(text);
  showToast(
    t(ok ? "copiedToClipboard" : "failedToCopy"),
    ok ? "success" : "error",
  );
}

function initQuranPage() {
  // The surah list is bundled; only an open surah's text comes from the network.
  setupConnectionRecovery(() => {
    if (state.currentSurah) loadAyahs(state.currentSurah.n);
  }, "Quran");
  screenSizeManager.initPageScreenSize();
  updateFullscreenButtons();
  // also when the window is maximized/restored another way (title-bar double-click, Snap…)
  screenSizeManager.onChange(updateFullscreenButtons);
  initSelectionCopy(document.getElementById("readerContent"), copySelectedText);

  // Back (list view), minimize and close are wired by the app shell from the header markup
  // (components/page-header.js); both views have their own fullscreen button.
  document
    .getElementById("fullscreenBtn")
    ?.addEventListener("click", toggleFullscreen);
  document
    .getElementById("readerFullscreenBtn")
    ?.addEventListener("click", toggleFullscreen);

  document
    .getElementById("readerBackBtn")
    ?.addEventListener("click", showSurahList);

  document
    .getElementById("tabSurah")
    ?.addEventListener("click", () => switchTab("surah"));
  document
    .getElementById("tabJuz")
    ?.addEventListener("click", () => switchTab("juz"));

  document
    .getElementById("surahSearchInput")
    ?.addEventListener("input", onSearch);

  document
    .getElementById("readerSettingsBtn")
    ?.addEventListener("click", toggleSettings);
  document
    .getElementById("settingsPanelCloseBtn")
    ?.addEventListener("click", closeSettings);

  document
    .getElementById("fontIncBtn")
    ?.addEventListener("click", () => changeFontSize(2));
  document
    .getElementById("fontDecBtn")
    ?.addEventListener("click", () => changeFontSize(-2));

  bindTranslationCombo();

  state.numerals = resolveNumerals();
  queryAll(".numerals-btn", HTMLElement).forEach((btn) => {
    btn.addEventListener("click", () =>
      setNumerals(btn.dataset.numerals, refreshNumbers),
    );
  });

  document.getElementById("prevSurahBtn")?.addEventListener("click", () => {
    if (state.currentSurah && state.currentSurah.n > 1) {
      openSurah(state.currentSurah.n - 1);
    }
  });
  document.getElementById("nextSurahBtn")?.addEventListener("click", () => {
    if (state.currentSurah && state.currentSurah.n < 114) {
      openSurah(state.currentSurah.n + 1);
    }
  });

  updateQuranText();
  updateNumeralsUI();
  updateTranslationUI();

  state.surahs = SURAH_META;
  state.filteredSurahs = [...SURAH_META];
  renderSurahGrid(state.filteredSurahs);
  renderJuzList();
}

function updateQuranText() {
  const size = document.getElementById("fontSizeDisplay");
  if (size) size.textContent = fmt(state.fontSize);
}

function updateFullscreenButtons() {
  const isBig = screenSizeManager.isBigScreen();
  const tipKey = isBig ? "tooltipExpand" : "tooltipCompress";
  const tipText = t(tipKey);
  const iconCls = isBig ? "fas fa-expand" : "fas fa-compress";

  ["fullscreenBtn", "readerFullscreenBtn"].forEach((id) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.setAttribute("aria-label", tipText);
    btn.setAttribute("data-tooltip", tipKey);
    btn.setAttribute("data-tip", tipText);
    const icon = btn.querySelector("i");
    if (icon) icon.className = iconCls;
  });
}

function toggleFullscreen() {
  screenSizeManager.toggleScreenSize(); // the buttons update through onChange
}

module.exports = { initQuranPage };
