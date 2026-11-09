"use strict";

// Searching the settings: while there is text in the box, every category shows only its
// settings whose text matches (label, description, choices), so a setting is found without
// knowing its category. Clearing the box (✕ or Escape) goes back to the open category.
const { byId, queryAll } = require("../../core/dom");
const { t } = require("../../core/i18n");
const { normalizeForSearch } = require("../../utils/search-text");
const { showPane, currentPane, markCurrent } = require("./nav");

/** @param {HTMLElement} item */
function itemText(item) {
  const names = queryAll("[aria-label]", HTMLElement, item).map(
    (el) => el.getAttribute("aria-label") || "",
  );
  // lists: only the chosen option counts, not every country or method in them
  const clone = /** @type {HTMLElement} */ (item.cloneNode(true));
  clone.querySelectorAll("select, .ts-dropdown").forEach((el) => el.remove());
  return normalizeForSearch(`${clone.textContent} ${names.join(" ")}`);
}

function runSearch() {
  const input = byId("stSearch", HTMLInputElement);
  const query = normalizeForSearch(input.value);
  const layout = byId("stLayout", HTMLElement);
  const empty = byId("stEmpty", HTMLElement);
  const items = queryAll(".st-item", HTMLElement);

  if (!query) {
    layout.classList.remove("is-searching");
    items.forEach((item) => (item.hidden = false));
    empty.hidden = true;
    showPane(currentPane());
    return;
  }

  layout.classList.add("is-searching");
  markCurrent("");
  let found = 0;
  queryAll(".st-pane", HTMLElement).forEach((pane) => {
    let inPane = 0;
    // the category's name matches: all of its settings show
    const title = pane.querySelector(".section-title")?.textContent || "";
    const wholePane = normalizeForSearch(title).includes(query);
    queryAll(".st-item", HTMLElement, pane).forEach((item) => {
      const match = wholePane || itemText(item).includes(query);
      item.hidden = !match;
      if (match) inPane++;
    });
    pane.hidden = inPane === 0;
    found += inPane;
  });
  empty.hidden = found > 0;
  byId("stEmptyText", HTMLElement).textContent = t("stNoResults").replace(
    "{query}",
    input.value.trim(),
  );
}

function clearSearch() {
  const input = byId("stSearch", HTMLInputElement);
  if (!input.value) return;
  input.value = "";
  runSearch();
}

function initSettingsSearch() {
  const input = byId("stSearch", HTMLInputElement);
  input.addEventListener("input", runSearch);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && input.value) {
      e.preventDefault();
      e.stopPropagation(); // here Escape empties the box, it does not leave the page
      clearSearch();
    }
  });
  // Ctrl+F goes to the box, as in a browser and in Windows Settings
  document.addEventListener("keydown", (e) => {
    const onePage = byId("stLayout", HTMLElement).classList.contains(
      "is-one-page",
    ); // no search box in the one-page view
    if (e.ctrlKey && !e.altKey && e.key.toLowerCase() === "f" && !onePage) {
      e.preventDefault();
      input.focus();
      input.select();
    }
  });
}

module.exports = { initSettingsSearch, clearSearch, runSearch };
