"use strict";

// The Quran page. Its parts:
//   surah-list.js           "Continue reading", the 114 surahs (searchable), the 30 juz, the tabs
//   bookmarks.js            bookmarked ayahs: toggling them, the Bookmarks tab
//   reader.js               one surah: opening it, its title, footer, size and keys
//   reader-text.js          its text: running text, or ayah cards with a translation
//   reading-position.js     where the reader stopped (for "Continue reading")
//   panel-fold.js           folding the reader's display panel to a strip
//   reader-find.js          "Find in this surah": the words marked, from one to the next
//   title-align.js          the reader's title centred over the text, like the Bismillah
//   translation-picker.js   the translation combobox
//   riwaya.js               Hafs, Qalun or Warsh (text, font, ayah numbers)
//   numerals.js             Arabic-Indic or Western digits
//   open-request.js         opened at one ayah by another page (99 Names, Athkar)
//   recitation*.js          listening: the background player, the ayah marked, the player bar
//   recitation-volume.js    the volume in the player bar (the app's one volume)
//   reciter-dialog.js       the reciter list
//   ayah-menu.js            the menu of an ayah's number ﴿n﴾: play from here, bookmark, copy
//   storage.js              what the page remembers (localStorage)
//   state.js                what is shown now, the surah/juz tables, numbers and names
// The Arabic text is bundled (data/Quran.json for Hafs, quran-qalun.json, quran-warsh.json);
// translations other than Sahih International come from services/api/alquran-cloud.js.
const { t } = require("../../core/i18n");
const screenSizeManager = require("../../core/screen-size");
const { showToast } = require("../../core/toast");
const { copyText } = require("../../core/clipboard");
const {
  setupConnectionRecovery,
} = require("../../services/connection-recovery");
const { byId } = require("../../core/dom");
const { state, SURAH_META, surahMeta, surahCount } = require("./state");
const {
  loadFontSize,
  loadTranslation,
  loadRiwaya,
  loadLastRead,
} = require("./storage");
const { updateRiwayaUI, setRiwaya, bindRiwaya } = require("./riwaya");
const {
  resolveNumerals,
  updateNumeralsUI,
  setNumerals,
} = require("./numerals");
const { renderLists, renderContinue, bindSurahList } = require("./surah-list");
const {
  toggleBookmark,
  onBookmarksChange,
  renderBookmarkCount,
  renderBookmarkList,
  bindBookmarkList,
} = require("./bookmarks");
const {
  updateReaderMeta,
  openSurah,
  loadAyahs,
  renderAyahs,
  showSurahList,
  changeFontSize,
  applyFontSize,
  ayahCopyText,
  updateBookmarkIcons,
  bindReader,
} = require("./reader");
const { bindPinchSize } = require("./pinch-size");
const {
  bindTranslationCombo,
  updateTranslationUI,
} = require("./translation-picker");
const { bindPanelFold, unfoldPanel } = require("./panel-fold");
const { bindPageStyle } = require("./page-style");
const { bindReaderFind } = require("./reader-find");
const { bindSelectionBar } = require("./selection-bar");
const { handleOpenRequest } = require("./open-request");
const { bindTitleAlign } = require("./title-align");
const { bindRecitation, followRiwaya } = require("./recitation");
const { mapAyah } = require("../../services/quran-ayah-map");
const { bindFollow } = require("./recitation-follow");
const { bindRecitationBar, listenFrom } = require("./recitation-bar");
const { bindReciterDialog } = require("./reciter-dialog");
const { bindRecitationVolume } = require("./recitation-volume");
const { openAyahMenu, bindAyahMenu } = require("./ayah-menu");

const { TRANSLATIONS } = require("../../services/api/alquran-cloud");

// Re-draws everything that shows a number after the user switches digit style.
function refreshNumbers() {
  renderLists();
  renderBookmarkCount();
  if (state.currentSurah) {
    updateReaderMeta();
    applyFontSize();
    if (state.currentAyahs.length) renderAyahs();
  }
}

/** @param {string} text */
async function copyAndTell(text) {
  const ok = await copyText(text);
  showToast(
    t(ok ? "copiedToClipboard" : "failedToCopy"),
    ok ? "success" : "error",
  );
}

/** @param {number} ayah */
function bookmarkAndTell(ayah) {
  if (!state.currentSurah) return;
  const on = toggleBookmark(state.currentSurah.n, ayah);
  showToast(t(on ? "quranBookmarkAdded" : "quranBookmarkRemoved"), "success");
}

/** What an ayah offers: play from it, bookmark it, copy it. */
const AYAH_ACTIONS = {
  play: (/** @type {number} */ ayah) => listenFrom(ayah),
  bookmark: bookmarkAndTell,
  copy: (/** @type {number} */ ayah) => copyAndTell(ayahCopyText(ayah)),
};

/** The ayah icons in the cards (play, copy, bookmark) and the ﴿n﴾ numbers (their menu). */
function bindAyahActions() {
  byId("ayahList", HTMLElement).addEventListener("click", (e) => {
    const button = /** @type {Element} */ (e.target).closest("[data-action]");
    if (!(button instanceof HTMLButtonElement) || !state.currentSurah) return;
    const action = button.dataset.action;
    if (action === "menu") openAyahMenu(button, AYAH_ACTIONS);
    else if (action === "play" || action === "copy" || action === "bookmark")
      AYAH_ACTIONS[action](Number(button.dataset.ayah));
  });
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

/** Another riwaya was chosen: its ayah counts and juz; the surah playing goes on in it (its
 * reciter, the same words); the open surah in its text at the same words as before (the ayah at
 * the top, numbered as the riwaya before counts it). */
async function onRiwayaChange() {
  renderLists();
  followRiwaya(state.riwaya).catch((err) => {
    console.error("Following the riwaya failed:", err);
    showToast(t("quranAudioError"), "error");
  });
  const meta = state.currentSurah && surahMeta(state.currentSurah.n);
  if (!meta) return;
  const at = loadLastRead();
  const ayah =
    at?.surah === meta.n
      ? await mapAyah(meta.n, at.ayah, at.riwaya, state.riwaya).catch(() =>
          Math.min(at.ayah, surahCount(meta)),
        )
      : 1;
  openSurah(meta.n, ayah);
}

function initQuranPage() {
  state.fontSize = loadFontSize();
  state.translationId = loadTranslation(TRANSLATIONS);
  state.riwaya = loadRiwaya();
  state.numerals = resolveNumerals();
  state.filteredSurahs = [...SURAH_META];

  // translations other than the bundled one come back with the connection
  setupConnectionRecovery(() => {
    if (state.currentSurah) loadAyahs(state.currentSurah.n);
  }, "Quran");
  screenSizeManager.initPageScreenSize();
  updateFullscreenButtons();
  screenSizeManager.onChange(updateFullscreenButtons);
  for (const id of ["fullscreenBtn", "readerFullscreenBtn"]) {
    document
      .getElementById(id)
      ?.addEventListener("click", () => screenSizeManager.toggleScreenSize());
  }

  /**
   * A bookmark or "Continue reading" opens in its own riwaya (and makes it the chosen one).
   * @param {number} surah @param {number} [ayah] @param {import("./state").Riwaya} [riwaya]
   */
  const openAt = (surah, ayah, riwaya) => {
    if (riwaya && setRiwaya(riwaya)) {
      renderLists();
      followRiwaya(riwaya).catch(() => {});
    }
    return openSurah(surah, ayah);
  };
  bindSurahList(openAt);
  bindBookmarkList(openAt);
  bindReader();
  bindPinchSize();
  bindTitleAlign();
  bindAyahActions();
  bindPanelFold();
  bindPageStyle();
  bindReaderFind(unfoldPanel);
  bindSelectionBar(copyAndTell);
  bindTranslationCombo();
  bindRiwaya(onRiwayaChange);
  bindAyahMenu();
  bindReciterDialog();
  bindFollow();
  bindRecitationBar();
  bindRecitationVolume();

  byId("fontIncBtn", HTMLButtonElement).addEventListener("click", () =>
    changeFontSize(2),
  );
  byId("fontDecBtn", HTMLButtonElement).addEventListener("click", () =>
    changeFontSize(-2),
  );
  for (const btn of document.querySelectorAll(".numerals-btn")) {
    if (!(btn instanceof HTMLButtonElement)) continue;
    btn.addEventListener("click", () =>
      setNumerals(btn.dataset.numerals, refreshNumbers),
    );
  }
  // a bookmark changed: its icon in the reader, the tab's count and list
  onBookmarksChange(() => {
    renderBookmarkCount();
    if (state.activeTab === "bookmarks") renderBookmarkList();
    updateBookmarkIcons();
  });

  updateNumeralsUI();
  updateTranslationUI();
  updateRiwayaUI();
  applyFontSize();
  renderLists();
  renderBookmarkCount();
  // opened at one ayah by another page, or on the surah list; wires the reader's back button
  handleOpenRequest(openAt, setRiwaya, () => {
    showSurahList();
    renderContinue();
  });
  // the mini player's "go to" button: the reader opens on the surah playing. Opened any other
  // way (the Features page), the page starts on the surah list as always.
  // (from the floating mini player, another window: a request made in the last seconds)
  let openPlaying = false;
  try {
    const at = Number(localStorage.getItem("quranOpenPlayingAt")) || 0;
    openPlaying =
      sessionStorage.getItem("quranOpenPlaying") === "1" ||
      Date.now() - at < 15000;
    sessionStorage.removeItem("quranOpenPlaying");
    localStorage.removeItem("quranOpenPlayingAt");
  } catch {
    // storage unavailable: the surah list
  }
  bindRecitation((track) => {
    if (openPlaying && !state.currentSurah)
      openAt(track.surah, undefined, track.riwaya);
  });
}

module.exports = { initQuranPage };
