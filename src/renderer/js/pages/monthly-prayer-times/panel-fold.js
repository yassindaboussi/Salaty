"use strict";

// Folding the panel to the window's edge (right; left in Arabic), as on the Tasbih and Athkar
// pages, so the timetable gets the room: it becomes a thin strip of icons. The day icon unfolds
// it; the PDF icon saves the month as a PDF. The choice is remembered (localStorage). A narrow window has one
// column, where nothing folds (CSS).
const { byId } = require("../../core/dom");
const { updateTooltip } = require("../../core/tooltips");

const KEY = "monthlyPanelFolded";

/** @param {boolean} folded */
function setFolded(folded) {
  byId("mpLayout", HTMLElement).classList.toggle("is-panel-folded", folded);
  const toggle = byId("mpPanelToggle", HTMLButtonElement);
  toggle.setAttribute("aria-expanded", String(!folded));
  toggle.dataset.tooltip = folded ? "mpPanelShow" : "mpPanelHide";
  updateTooltip(toggle); // its tooltip and name
  try {
    localStorage.setItem(KEY, folded ? "1" : "0");
  } catch {
    // storage unavailable: the choice lasts until the page closes
  }
}

const isFolded = () =>
  byId("mpLayout", HTMLElement).classList.contains("is-panel-folded");

/** @param {() => void} exportPdf */
function bindPanelFold(exportPdf) {
  let saved = false;
  try {
    saved = localStorage.getItem(KEY) === "1";
  } catch {
    // storage unavailable: open
  }
  setFolded(saved);

  const toggle = byId("mpPanelToggle", HTMLButtonElement);
  toggle.addEventListener("click", () => {
    setFolded(!isFolded());
    toggle.focus(); // it stays in place in both states
  });

  byId("mpRail", HTMLElement).addEventListener("click", (e) => {
    const button = /** @type {Element} */ (e.target).closest("[data-rail]");
    if (!(button instanceof HTMLButtonElement)) return;
    if (button.dataset.rail === "pdf") exportPdf();
    else {
      setFolded(false);
      toggle.focus();
    }
  });
}

module.exports = { bindPanelFold };
