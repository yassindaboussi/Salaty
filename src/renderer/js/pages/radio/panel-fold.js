"use strict";

// Folding the panel to the window's edge (right; left in Arabic), as on the Tasbih, Athkar and
// Monthly pages, so the list gets the room: it becomes a thin strip with play / pause and stop.
// The choice is remembered (localStorage). A narrow window has one column, where nothing folds
// (CSS).
const { byId } = require("../../core/dom");
const { updateTooltip } = require("../../core/tooltips");

const KEY = "radioPanelFolded";

/** @param {boolean} folded */
function setFolded(folded) {
  byId("rdLayout", HTMLElement).classList.toggle("is-panel-folded", folded);
  const toggle = byId("rdPanelToggle", HTMLButtonElement);
  toggle.setAttribute("aria-expanded", String(!folded));
  toggle.dataset.tooltip = folded ? "rdPanelShow" : "rdPanelHide";
  updateTooltip(toggle); // its tooltip and name
  try {
    localStorage.setItem(KEY, folded ? "1" : "0");
  } catch {
    // storage unavailable: the choice lasts until the page closes
  }
}

const isFolded = () =>
  byId("rdLayout", HTMLElement).classList.contains("is-panel-folded");

/** @param {{ togglePlay: () => void, stop: () => void }} actions */
function bindPanelFold({ togglePlay, stop }) {
  let saved = false;
  try {
    saved = localStorage.getItem(KEY) === "1";
  } catch {
    // storage unavailable: open
  }
  setFolded(saved);

  const toggle = byId("rdPanelToggle", HTMLButtonElement);
  toggle.addEventListener("click", () => {
    setFolded(!isFolded());
    toggle.focus(); // it stays in place in both states
  });

  byId("rdRail", HTMLElement).addEventListener("click", (e) => {
    const button = /** @type {Element} */ (e.target).closest("[data-rail]");
    if (!(button instanceof HTMLButtonElement)) return;
    if (button.dataset.rail === "play") togglePlay();
    else stop();
  });
}

module.exports = { bindPanelFold };
