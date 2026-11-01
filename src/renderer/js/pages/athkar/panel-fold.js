"use strict";

// Folding the side panel to the window's edge (right; left in Arabic), as on the Tasbih page, so
// the athkar get the room: it becomes a thin strip of icons. A category's icon opens it with the
// panel still folded; the search icon unfolds the panel on the search box. The choice is
// remembered (localStorage). A narrow window has one column, where nothing folds (CSS).
const { byId } = require("../../core/dom");
const { updateTooltip } = require("../../core/tooltips");

const KEY = "athkarPanelFolded";

/** @param {boolean} folded */
function setFolded(folded) {
  byId("akLayout", HTMLElement).classList.toggle("is-panel-folded", folded);
  const toggle = byId("akPanelToggle", HTMLButtonElement);
  toggle.setAttribute("aria-expanded", String(!folded));
  toggle.dataset.tooltip = folded ? "akPanelShow" : "akPanelHide";
  updateTooltip(toggle); // its tooltip and name
  try {
    localStorage.setItem(KEY, folded ? "1" : "0");
  } catch {
    // storage unavailable: the choice lasts until the page closes
  }
}

const isFolded = () =>
  byId("akLayout", HTMLElement).classList.contains("is-panel-folded");

/** @param {(category: string) => void} openCategory */
function bindPanelFold(openCategory) {
  let saved = false;
  try {
    saved = localStorage.getItem(KEY) === "1";
  } catch {
    // storage unavailable: open
  }
  setFolded(saved);

  const toggle = byId("akPanelToggle", HTMLButtonElement);
  toggle.addEventListener("click", () => {
    setFolded(!isFolded());
    toggle.focus(); // it stays in place in both states
  });

  byId("akRail", HTMLElement).addEventListener("click", (e) => {
    const button = /** @type {Element} */ (e.target).closest(".ak-rail-btn");
    if (!(button instanceof HTMLButtonElement)) return;
    if (button.dataset.rail === "search") {
      setFolded(false);
      byId("akSearch", HTMLInputElement).focus();
    } else if (button.dataset.category) {
      const { category } = button.dataset;
      openCategory(category);
      // the strip was redrawn: keep the focus on the same icon
      const again = document.querySelector(
        `.ak-rail-btn[data-category="${CSS.escape(category)}"]`,
      );
      if (again instanceof HTMLElement) again.focus();
    }
  });
}

module.exports = { bindPanelFold };
