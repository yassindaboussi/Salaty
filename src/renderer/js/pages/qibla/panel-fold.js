"use strict";

// Folding the panel to the window's edge (right; left in Arabic), as on the other redesigned
// pages, so the map gets the room: it becomes a strip showing the Qibla's degrees. The choice
// is remembered (localStorage). A narrow window has one column, where nothing folds (CSS).
const { byId } = require("../../core/dom");
const { updateTooltip } = require("../../core/tooltips");

const KEY = "qiblaPanelFolded";

/** @param {boolean} folded */
function setFolded(folded) {
  byId("qbLayout", HTMLElement).classList.toggle("is-panel-folded", folded);
  const toggle = byId("qbPanelToggle", HTMLButtonElement);
  toggle.setAttribute("aria-expanded", String(!folded));
  toggle.dataset.tooltip = folded ? "qbPanelShow" : "qbPanelHide";
  updateTooltip(toggle); // its tooltip and name
  try {
    localStorage.setItem(KEY, folded ? "1" : "0");
  } catch {
    // storage unavailable: the choice lasts until the page closes
  }
}

function bindPanelFold() {
  let saved = false;
  try {
    saved = localStorage.getItem(KEY) === "1";
  } catch {
    // storage unavailable: open
  }
  setFolded(saved);
  const toggle = byId("qbPanelToggle", HTMLButtonElement);
  toggle.addEventListener("click", () => {
    setFolded(
      !byId("qbLayout", HTMLElement).classList.contains("is-panel-folded"),
    );
    toggle.focus(); // it stays in place in both states
  });
}

module.exports = { bindPanelFold };
