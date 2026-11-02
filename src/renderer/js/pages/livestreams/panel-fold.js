"use strict";

// Folding the panel to the window's edge (right; left in Arabic), as on the other redesigned
// pages, so the video gets the room: it becomes a strip with one icon per mosque. The choice is
// remembered (localStorage). A narrow window has one column, where nothing folds (CSS).
const { byId } = require("../../core/dom");
const { updateTooltip } = require("../../core/tooltips");

const KEY = "livestreamsPanelFolded";

/** @param {boolean} folded */
function setFolded(folded) {
  byId("lvLayout", HTMLElement).classList.toggle("is-panel-folded", folded);
  const toggle = byId("lvPanelToggle", HTMLButtonElement);
  toggle.setAttribute("aria-expanded", String(!folded));
  toggle.dataset.tooltip = folded ? "lvPanelShow" : "lvPanelHide";
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
  const toggle = byId("lvPanelToggle", HTMLButtonElement);
  toggle.addEventListener("click", () => {
    setFolded(
      !byId("lvLayout", HTMLElement).classList.contains("is-panel-folded"),
    );
    toggle.focus(); // it stays in place in both states
  });
}

module.exports = { bindPanelFold };
