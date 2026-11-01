"use strict";

// The 99 Names of Allah page. Its parts:
//   grid.js     the search, the grid of the names (keyboard: arrows, Home, End)
//   detail.js   the chosen name in full, its verses (open the Quran page), copy, previous / next
//   state.js    the names (data/99_Names_Of_Allah.json), the search
// The page opens on the first name; the name chosen last is kept for this session (sessionStorage),
// so coming back from a verse in the Quran page shows the same name.
// Everything is bundled, so there is nothing to reload when the connection returns.
const { ipcRenderer } = require("electron");
const { t } = require("../../core/i18n");
const { byId } = require("../../core/dom");
const { initSelectionCopy } = require("../../components/selection-copy");
const { pageState, loadNames } = require("./state");
const grid = require("./grid");
const { renderDetail, bindDetail, copy } = require("./detail");

const SELECTED_KEY = "asmaSelected";

/** @param {number} number */
function choose(number) {
  if (number < 1 || number > 99) return;
  pageState.selected = number;
  try {
    sessionStorage.setItem(SELECTED_KEY, String(number));
  } catch {
    // storage unavailable: the page opens on the first name next time
  }
  grid.markSelected();
  renderDetail();
  // one column (narrow window): the chosen name is above the grid, so show it
  if (window.matchMedia("(width <= 700px)").matches) {
    byId("anDetail", HTMLElement).scrollIntoView({ block: "start" });
  } else {
    grid.tileOf(number)?.scrollIntoView({ block: "nearest" });
  }
}

function savedSelection() {
  try {
    const saved = Number(sessionStorage.getItem(SELECTED_KEY));
    if (saved >= 1 && saved <= 99) return saved;
  } catch {
    // storage unavailable
  }
  return 1;
}

async function initAsmaPage() {
  await loadNames(document.documentElement.lang || "en");
  pageState.selected = savedSelection();

  grid.bindGrid(choose);
  bindDetail(choose);
  // hadith sources open sunnah.com in the browser
  for (const source of document.querySelectorAll("[data-source]")) {
    source.setAttribute(
      "aria-label",
      t("anSourceLabel").replace("{ref}", source.textContent?.trim() ?? ""),
    );
  }
  byId("anLayout", HTMLElement).addEventListener("click", (e) => {
    const source = /** @type {Element} */ (e.target).closest("[data-source]");
    if (source instanceof HTMLElement && source.dataset.source) {
      ipcRenderer.invoke("open-external", source.dataset.source);
    }
  });
  // Ctrl/Cmd+C or right-click > Copy on highlighted text of the chosen name
  initSelectionCopy(byId("anDetail", HTMLElement), copy);

  grid.renderGrid();
  renderDetail();
  grid.tileOf(pageState.selected)?.scrollIntoView({ block: "center" });
}

module.exports = { initAsmaPage };
