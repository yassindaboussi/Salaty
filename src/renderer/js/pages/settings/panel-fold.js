"use strict";

// Folding the menu to the window's edge (left; right in Arabic), as on the Tasbih and Athkar
// pages: it becomes a thin strip of icons and the settings get the room. A category's icon
// opens it with the menu still folded; the search icon unfolds the menu on the search box.
// The choice is remembered (localStorage). A narrow window has one column: nothing folds (CSS).
const { byId } = require("../../core/dom");
const { updateTooltip } = require("../../core/tooltips");
const { showPane } = require("./nav");
const { clearSearch } = require("./search");

const KEY = "settingsPanelFolded";

/** @param {boolean} folded */
function setFolded(folded) {
  byId("stLayout", HTMLElement).classList.toggle("is-panel-folded", folded);
  const toggle = byId("stPanelToggle", HTMLButtonElement);
  toggle.setAttribute("aria-expanded", String(!folded));
  toggle.dataset.tooltip = folded ? "stPanelShow" : "stPanelHide";
  updateTooltip(toggle);
  try {
    localStorage.setItem(KEY, folded ? "1" : "0");
  } catch {
    // storage unavailable: the choice lasts until the page closes
  }
}

const isFolded = () =>
  byId("stLayout", HTMLElement).classList.contains("is-panel-folded");

function bindPanelFold() {
  let saved = false;
  try {
    saved = localStorage.getItem(KEY) === "1";
  } catch {
    // storage unavailable: open
  }
  setFolded(saved);

  const toggle = byId("stPanelToggle", HTMLButtonElement);
  toggle.addEventListener("click", () => {
    setFolded(!isFolded());
    toggle.focus(); // it stays in place in both states
  });

  byId("stRail", HTMLElement).addEventListener("click", (e) => {
    const button = /** @type {Element} */ (e.target).closest(".st-rail-btn");
    if (!(button instanceof HTMLButtonElement)) return;
    if (button.dataset.rail === "search") {
      setFolded(false);
      byId("stSearch", HTMLInputElement).focus();
    } else if (button.dataset.pane) {
      clearSearch(); // a search hidden behind the strip would leave settings missing
      showPane(button.dataset.pane);
    }
  });
}

module.exports = { bindPanelFold };
