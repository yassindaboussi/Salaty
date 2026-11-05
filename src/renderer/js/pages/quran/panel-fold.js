"use strict";

// Folding the display panel to the window's edge (right; left in Arabic), as on the Tasbih,
// Athkar and Monthly pages, so the text gets the room: it becomes a thin strip with one icon that
// unfolds it. The choice is remembered (localStorage). A narrow window has one column, where
// nothing folds (CSS).
const { byId } = require("../../core/dom");
const { updateTooltip } = require("../../core/tooltips");

const KEY = "quranPanelFolded";

/** @param {boolean} folded */
function setFolded(folded) {
  byId("qReaderLayout", HTMLElement).classList.toggle(
    "is-panel-folded",
    folded,
  );
  const toggle = byId("qPanelToggle", HTMLButtonElement);
  toggle.setAttribute("aria-expanded", String(!folded));
  toggle.dataset.tooltip = folded ? "quranPanelShow" : "quranPanelHide";
  updateTooltip(toggle); // its tooltip and name
  try {
    localStorage.setItem(KEY, folded ? "1" : "0");
  } catch {
    // storage unavailable: the choice lasts until the page closes
  }
}

const isFolded = () =>
  byId("qReaderLayout", HTMLElement).classList.contains("is-panel-folded");

function bindPanelFold() {
  let saved = false;
  try {
    saved = localStorage.getItem(KEY) === "1";
  } catch {
    // storage unavailable: open
  }
  setFolded(saved);

  const toggle = byId("qPanelToggle", HTMLButtonElement);
  toggle.addEventListener("click", () => {
    setFolded(!isFolded());
    toggle.focus(); // it stays in place in both states
  });

  byId("qRail", HTMLElement).addEventListener("click", (e) => {
    if (!(/** @type {Element} */ (e.target).closest("[data-rail]"))) return;
    setFolded(false);
    toggle.focus();
  });
}

module.exports = { bindPanelFold };
