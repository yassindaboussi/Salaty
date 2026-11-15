"use strict";

// The Tafasir side panel folded to a thin strip (remembered in localStorage).
const { byId } = require("../../core/dom");
const { updateTooltip } = require("../../core/tooltips");

const FOLD_KEY = "tafsirPanelFolded";

function isFolded() {
  try {
    return localStorage.getItem(FOLD_KEY) === "1";
  } catch {
    return false;
  }
}

/** @param {boolean} folded */
function setFolded(folded) {
  byId("tfLayout", HTMLElement).classList.toggle("is-panel-folded", folded);
  const toggle = byId("tfPanelToggle", HTMLButtonElement);
  toggle.setAttribute("aria-expanded", String(!folded));
  toggle.dataset.tooltip = folded ? "tafsirPanelShow" : "tafsirPanelHide";
  updateTooltip(toggle);
  try {
    localStorage.setItem(FOLD_KEY, folded ? "1" : "0");
  } catch {
    // storage unavailable: the choice lasts until the page closes
  }
}

module.exports = { isFolded, setFolded };
