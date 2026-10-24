"use strict";

// Folding the whole side panel to the window's edge (right; left in Arabic), so the counter gets
// the room: it becomes a thin strip of the groups' icons, like the Athkar page's sidebar. An
// icon opens the panel on its group. The choice is remembered (localStorage). A narrow window
// has one column, where nothing folds (CSS).
const { byId, queryAll } = require("../../core/dom");
const { updateTooltip } = require("../../core/tooltips");
const { openGroup } = require("./groups");

const KEY = "tasbihPanelFolded";

/** @param {boolean} folded */
function setFolded(folded) {
  byId("tbLayout", HTMLElement).classList.toggle("is-panel-folded", folded);
  const toggle = byId("tbPanelToggle", HTMLButtonElement);
  toggle.setAttribute("aria-expanded", String(!folded));
  toggle.dataset.tooltip = folded ? "tbPanelShow" : "tbPanelHide";
  updateTooltip(toggle); // its tooltip and name
  try {
    localStorage.setItem(KEY, folded ? "1" : "0");
  } catch {
    // storage unavailable: the choice lasts until the page closes
  }
}

const isFolded = () =>
  byId("tbLayout", HTMLElement).classList.contains("is-panel-folded");

function bindPanelFold() {
  let saved = false;
  try {
    saved = localStorage.getItem(KEY) === "1";
  } catch {
    // storage unavailable: open
  }
  setFolded(saved);

  const toggle = byId("tbPanelToggle", HTMLButtonElement);
  toggle.addEventListener("click", () => {
    setFolded(!isFolded());
    toggle.focus(); // it stays in place in both states
  });

  for (const button of queryAll(".tb-rail-btn", HTMLButtonElement)) {
    button.addEventListener("click", () => {
      const key = button.dataset.rail ?? "";
      setFolded(false);
      openGroup(key);
      const header = document.querySelector(
        `.tb-group[data-group="${key}"] .tb-group-header`,
      );
      if (header instanceof HTMLElement) {
        header.scrollIntoView({ block: "nearest" });
        header.focus();
      }
    });
  }
}

module.exports = { bindPanelFold };
