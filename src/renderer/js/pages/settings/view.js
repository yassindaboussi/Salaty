"use strict";

// How the page is laid out, chosen in Appearance (like the "View by" menu of the Windows
// Control Panel): "menu" shows one category at a time beside the menu; "page" hides the menu
// and shows every category one under the other. Only CSS changes (.is-one-page), the settings
// are the same. Remembered in localStorage: it only concerns this page on this computer.
const { byId, queryAll } = require("../../core/dom");
const { clearSearch } = require("./search");

const KEY = "settingsView";

function savedView() {
  try {
    return localStorage.getItem(KEY) === "page" ? "page" : "menu";
  } catch {
    return "menu"; // storage unavailable: the menu
  }
}

/** @param {string} view */
function applyView(view) {
  if (view === "page") clearSearch(); // the search box is hidden in this view
  byId("stLayout", HTMLElement).classList.toggle(
    "is-one-page",
    view === "page",
  );
}

const isOnePage = () =>
  byId("stLayout", HTMLElement).classList.contains("is-one-page");

function initViewSetting() {
  const view = savedView();
  applyView(view);
  const radios = queryAll('input[name="settingsView"]', HTMLInputElement);
  radios.forEach((radio) => {
    radio.checked = radio.value === view;
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      applyView(radio.value);
      try {
        localStorage.setItem(KEY, radio.value);
      } catch {
        // storage unavailable: the choice lasts until the page closes
      }
      radio.focus(); // the row moved: keep the focus on it, and show it
      radio.closest(".st-item")?.scrollIntoView({ block: "center" });
    });
  });
}

module.exports = { initViewSetting, isOnePage };
