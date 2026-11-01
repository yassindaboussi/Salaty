"use strict";

// The main column: the search and the grid of the 99 names. A tile chooses its
// name; the arrow keys move between the tiles (and choose), Home / End jump to the first / last.
const { t } = require("../../core/i18n");
const { byId, queryAll } = require("../../core/dom");
const { html, setHtml } = require("../../utils/html");
const { pageState, visibleNames } = require("./state");

const isArabic = () => document.documentElement.lang === "ar";

function renderGrid() {
  const names = visibleNames();
  const arabic = isArabic();
  setHtml(
    byId("anGrid", HTMLElement),
    html`${names.map(
      (n) =>
        html`<button type="button" class="an-tile" data-number="${n.number}" aria-pressed="${String(n.number === pageState.selected)}"><span class="an-tile-num">${n.number}</span><span class="an-tile-name" lang="ar" dir="rtl">${n.name}</span>${arabic ? "" : html`<span class="an-tile-translit">${n.translit}</span>`}<span class="an-tile-meaning">${n.meaning}</span></button>`,
    )}`,
  );

  const searching = pageState.query.trim() !== "";
  byId("anSearchClear", HTMLButtonElement).hidden = !searching;
  byId("anCount", HTMLElement).textContent = searching
    ? t("anShown").replace("{shown}", String(names.length))
    : "";
  const empty = byId("anEmpty", HTMLElement);
  empty.hidden = names.length > 0;
  byId("anGrid", HTMLElement).hidden = names.length === 0; // the message right under the search
  empty.textContent = t("anNoMatch").replace("{query}", pageState.query.trim());
}

// Only the pressed state changes when another name is chosen: the grid is not redrawn.
function markSelected() {
  for (const tile of queryAll(".an-tile", HTMLButtonElement)) {
    tile.setAttribute(
      "aria-pressed",
      String(Number(tile.dataset.number) === pageState.selected),
    );
  }
}

/** @param {number} number */
function tileOf(number) {
  return document.querySelector(`.an-tile[data-number="${number}"]`);
}

// How many tiles a row holds now (the grid is responsive).
function columns(tiles) {
  const top = tiles[0].offsetTop;
  const index = tiles.findIndex((tile) => tile.offsetTop !== top);
  return index === -1 ? tiles.length : index;
}

/** @param {(number: number) => void} choose */
function bindGrid(choose) {
  const grid = byId("anGrid", HTMLElement);
  grid.addEventListener("click", (e) => {
    const tile = /** @type {Element} */ (e.target).closest(".an-tile");
    if (tile instanceof HTMLButtonElement) choose(Number(tile.dataset.number));
  });

  grid.addEventListener("keydown", (e) => {
    const tiles = queryAll(".an-tile", HTMLButtonElement);
    const from = tiles.indexOf(/** @type {HTMLButtonElement} */ (e.target));
    if (from === -1) return;
    const forward = isArabic() ? -1 : 1; // the grid is mirrored in Arabic
    const steps = {
      ArrowRight: forward,
      ArrowLeft: -forward,
      ArrowDown: columns(tiles),
      ArrowUp: -columns(tiles),
      Home: -from,
      End: tiles.length - 1 - from,
    };
    if (!(e.key in steps)) return;
    e.preventDefault();
    const to =
      tiles[Math.min(tiles.length - 1, Math.max(0, from + steps[e.key]))];
    to.focus();
    choose(Number(to.dataset.number));
  });

  const input = byId("anSearch", HTMLInputElement);
  input.addEventListener("input", () => {
    pageState.query = input.value;
    renderGrid();
  });
  input.addEventListener("keydown", (e) => {
    // Enter opens the first match; Escape empties the search
    if (e.key === "Enter") {
      const first = grid.querySelector(".an-tile");
      if (first instanceof HTMLButtonElement) {
        choose(Number(first.dataset.number));
        first.focus();
      }
    } else if (e.key === "Escape" && input.value) {
      e.preventDefault();
      clearSearch();
    }
  });
  byId("anSearchClear", HTMLButtonElement).addEventListener(
    "click",
    clearSearch,
  );
}

function clearSearch() {
  const input = byId("anSearch", HTMLInputElement);
  input.value = "";
  pageState.query = "";
  renderGrid();
  input.focus();
  tileOf(pageState.selected)?.scrollIntoView({ block: "nearest" });
}

module.exports = { renderGrid, markSelected, bindGrid, tileOf };
