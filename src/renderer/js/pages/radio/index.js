"use strict";

// The radio page: the national Quran stations and the reciter radios of mp3quran.net in two
// tabs, searchable, favourites first; the panel shows what is playing. Its parts:
//   state.js       what is shown now, the favourites
//   catalog.js     the two lists of radios
//   list.js        the open tab's list
//   player.js      playing (in the background player, so it goes on after the page closes)
//   panel-fold.js  folding the panel to a strip
const {
  setupConnectionRecovery,
} = require("../../services/connection-recovery");
const { byId, queryAll } = require("../../core/dom");
const { view, loadFavourites, toggleFavourite } = require("./state");
const { stationItems, loadReciterItems } = require("./catalog");
const { renderList } = require("./list");
const player = require("./player");
const { bindPanelFold } = require("./panel-fold");

const TAB_KEY = "radioTab";

async function loadReciters() {
  if (view.reciters) return;
  view.recitersFailed = false;
  renderList();
  try {
    view.reciters = await loadReciterItems();
  } catch (err) {
    console.warn("[Radio] the reciter radios could not be loaded:", err);
    view.recitersFailed = true;
  }
  player.render();
}

/** @param {"stations" | "reciters"} tab @param {boolean} [focus] */
function openTab(tab, focus = false) {
  view.tab = tab;
  for (const button of queryAll(".rd-tab", HTMLButtonElement)) {
    const on = button.dataset.tab === tab;
    button.setAttribute("aria-selected", String(on));
    button.tabIndex = on ? 0 : -1;
    if (on && focus) button.focus();
  }
  byId("rdList", HTMLElement).setAttribute(
    "aria-labelledby",
    tab === "stations" ? "rdTabStations" : "rdTabReciters",
  );
  try {
    localStorage.setItem(TAB_KEY, tab);
  } catch {
    // storage unavailable: the tab is not remembered
  }
  renderList();
  if (tab === "reciters") loadReciters();
}

function bindTabs() {
  const tabs = byId("rdTabStations", HTMLButtonElement).parentElement;
  tabs?.addEventListener("click", (e) => {
    const tab = /** @type {Element} */ (e.target).closest(".rd-tab");
    if (tab instanceof HTMLButtonElement)
      openTab(tab.dataset.tab === "reciters" ? "reciters" : "stations");
  });
  // arrow keys move between the tabs (ARIA tabs pattern)
  tabs?.addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    openTab(view.tab === "stations" ? "reciters" : "stations", true);
  });
}

function bindList() {
  byId("rdList", HTMLElement).addEventListener("click", (e) => {
    const button = /** @type {Element} */ (e.target).closest("[data-action]");
    if (!(button instanceof HTMLButtonElement)) return;
    if (button.dataset.action === "retry") {
      loadReciters();
      return;
    }
    const key = button.closest(".rd-row")?.getAttribute("data-key");
    if (!key) return;
    if (button.dataset.action === "play") player.playItem(key);
    else if (button.dataset.action === "favourite") {
      toggleFavourite(key);
      player.render();
    }
  });
  const search = byId("rdSearch", HTMLInputElement);
  search.addEventListener("input", () => {
    view.query = search.value;
    renderList();
  });
  search.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && search.value) {
      e.preventDefault();
      search.value = view.query = "";
      renderList();
    }
  });
}

function initRadioPage() {
  loadFavourites();
  view.stations = stationItems();
  bindTabs();
  bindList();
  player.bindControls();
  bindPanelFold(player);

  let tab = "stations";
  try {
    tab =
      localStorage.getItem(TAB_KEY) === "reciters" ? "reciters" : "stations";
  } catch {
    // storage unavailable: the stations
  }
  openTab(/** @type {"stations" | "reciters"} */ (tab));
  player.renderPanel();
  // what is playing already (the radio goes on between pages)
  player.bindPlayerUpdates();
  // back online: the reciter radios that failed to load
  setupConnectionRecovery(() => {
    if (view.recitersFailed) loadReciters();
  }, "Radio");
}

module.exports = { initRadioPage };
