"use strict";

const { t } = require("../../core/i18n");
const { queryAll } = require("../../core/dom");

// ---- Page: the reading area in the app's colours, or as paper (cream, like a printed Mushaf) ----
// Only the colours of the reading area change: never the text, its font or its marks, in every
// riwaya. A plain colour, no texture or picture. The choice is remembered on this computer.
const PAGE_KEY = "quranPage";

/** @typedef {"app" | "paper"} PageStyle */

/** @returns {PageStyle} */
function loadPageStyle() {
  try {
    return localStorage.getItem(PAGE_KEY) === "paper" ? "paper" : "app";
  } catch {
    return "app";
  }
}

/** @param {PageStyle} style */
function applyPageStyle(style) {
  document
    .getElementById("readerContent")
    ?.classList.toggle("is-paper", style === "paper");
  queryAll(".page-style-btn", HTMLButtonElement).forEach((btn) => {
    const active = btn.dataset.page === style;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
  document
    .getElementById("pageStyleGroup")
    ?.setAttribute("aria-label", t("quranPageLabel"));
}

/** The App / Paper buttons in the display panel. */
function bindPageStyle() {
  applyPageStyle(loadPageStyle());
  queryAll(".page-style-btn", HTMLButtonElement).forEach((btn) => {
    btn.addEventListener("click", () => {
      const style = btn.dataset.page === "paper" ? "paper" : "app";
      try {
        if (style === "paper") localStorage.setItem(PAGE_KEY, style);
        else localStorage.removeItem(PAGE_KEY);
      } catch {
        /* storage unavailable: the choice just won't be remembered */
      }
      applyPageStyle(style);
    });
  });
}

module.exports = { bindPageStyle, applyPageStyle, loadPageStyle };
