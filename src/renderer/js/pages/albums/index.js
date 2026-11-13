"use strict";

// The Audio Archive page (albums.html): mp3quran.net audio in three tabs. Its parts:
//   reciters.js       Recitations: reciter cards with photos, favourites first
//   filters.js        the riwaya chips and "complete Quran only" (riwaya.js: the groups)
//   moshaf-dialog.js  a reciter's recitations, to pick one
//   tafsir.js         Tafasir: the surahs as cards, a surah's parts in the side panel
//   tadabor.js        Tadabor: reflection videos by surah (tadabor-video.js: the dialog)
//   continue.js       "Continue listening" on each tab (recite-continue.js: Recitations)
//   open-album.js     opening something in the playlist page
//   messages.js       loading / nothing found / error + retry
//   state.js          what is shown, what is remembered (tab, filters, favourites)
// The requests are in services/api/mp3quran.js (cached a day); the reciters' photos are bundled
// (components/reciter-photo.js).
const { t } = require("../../core/i18n");
const { byId, queryAll } = require("../../core/dom");
const { state, loadPrefs, savePrefs } = require("./state");
const { bindFilters } = require("./filters");
const { bindMoshafDialog } = require("./moshaf-dialog");
const reciters = require("./reciters");
const tafsir = require("./tafsir");
const tadabor = require("./tadabor");
const { bindVideoDialog } = require("./tadabor-video");
const { followPlayer, onPlayingChange } = require("./continue");
const {
  renderReciteContinue,
  continueRecitation,
  openReciteList,
} = require("./recite-continue");

const TABS = {
  recite: {
    panel: "acPanelRecite",
    load: reciters.loadReciters,
    render: reciters.renderReciters,
  },
  tafsir: {
    panel: "acPanelTafsir",
    load: tafsir.loadTafsirBooks,
    render: tafsir.renderTafsir,
  },
  tadabor: {
    panel: "acPanelTadabor",
    load: tadabor.loadTadabor,
    render: tadabor.renderTadabor,
  },
};

/** @param {string} tab  shows it (and loads it the first time); the search starts empty */
function showTab(tab, focus = false) {
  state.tab = tab;
  savePrefs();
  for (const button of queryAll(".ac-tab", HTMLButtonElement)) {
    const on = button.dataset.tab === tab;
    button.setAttribute("aria-selected", String(on));
    button.tabIndex = on ? 0 : -1;
    if (on && focus) button.focus();
  }
  for (const [key, { panel }] of Object.entries(TABS)) {
    byId(panel, HTMLElement).hidden = key !== tab;
  }
  const search = byId("acSearch", HTMLInputElement);
  search.value = "";
  state.query = "";
  search.placeholder = t(`acSearch_${tab}`);
  search.setAttribute("aria-label", search.placeholder);
  const loaded = TABS[tab].load();
  if (tab === "recite") {
    renderReciteContinue();
    // again with the reciters loaded: the reciter's name in the app language
    Promise.resolve(loaded).then(renderReciteContinue);
  }
}

// The tabs follow the ARIA tabs pattern: arrows move between them (mirrored in Arabic),
// Home/End to the first/last. https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
function bindTabs() {
  const list = byId("acTabs", HTMLElement);
  list.addEventListener("click", (e) => {
    const tab = /** @type {Element} */ (e.target).closest(".ac-tab");
    if (tab instanceof HTMLButtonElement && tab.dataset.tab)
      showTab(tab.dataset.tab);
  });
  list.addEventListener("keydown", (e) => {
    const keys = Object.keys(TABS);
    const at = keys.indexOf(state.tab);
    const rtl = document.documentElement.dir === "rtl";
    const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[e.key];
    let next = -1;
    if (step) next = (at + step + keys.length) % keys.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = keys.length - 1;
    if (next === -1) return;
    e.preventDefault();
    showTab(keys[next], true);
  });
}

function bindSearch() {
  const search = byId("acSearch", HTMLInputElement);
  search.addEventListener("input", () => {
    state.query = search.value;
    TABS[state.tab].render();
  });
  search.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && search.value) {
      e.preventDefault();
      search.value = "";
      state.query = "";
      TABS[state.tab].render();
    }
  });
}

function bindLists() {
  byId("acMain", HTMLElement).addEventListener("click", (e) => {
    const button = /** @type {Element} */ (e.target).closest("button");
    if (!(button instanceof HTMLButtonElement)) return;
    const retry = button.dataset.retry;
    if (button.dataset.action === "recite-continue") {
      continueRecitation();
    } else if (button.dataset.action === "recite-open") {
      openReciteList();
    } else if (retry) {
      const tab = retry === "reciters" ? "recite" : retry;
      TABS[tab].load();
    } else if (button.closest("#acReciters")) {
      reciters.onCardAction(button);
    } else if (button.closest("#acTafsir")) {
      tafsir.onTafsirAction(button);
    } else if (button.closest("#acTadabor, #acTadaborContinue")) {
      tadabor.onTadaborAction(button);
    }
  });
}

function initAlbumsPage() {
  loadPrefs();
  bindTabs();
  bindSearch();
  bindFilters(reciters.renderReciters);
  bindMoshafDialog();
  bindVideoDialog(tadabor.onTadaborChange);
  onPlayingChange(tafsir.onPlaying);
  onPlayingChange(tadabor.onTadaborChange);
  onPlayingChange(() => {
    if (state.tab === "recite") renderReciteContinue();
  });
  followPlayer();
  bindLists();
  showTab(state.tab);
}

module.exports = { initAlbumsPage };
