"use strict";

// The Athkar page. Its parts:
//   panel.js       the search and the categories, with today's progress of each
//   panel-fold.js  the panel folded to a strip of icons (remembered)
//   list.js        the open category (or the search results): its progress and its cards
//   counter.js     counting, undo, reset of a category, moving on to the next dhikr
//   opening.js     the category the page opens on (by the time of day)
//   categories.js  the categories' sections, icons and names
//   references.js  the sources as links (sunnah.com, the Quran page)
//   feedback.js    the copy toast, screen-reader announcements
//   state.js       the adhkar (data/adkar.json), what is shown, today's counts
// Everything is bundled, so there is nothing to reload when the connection returns.
const { ipcRenderer } = require("electron");
const { initSelectionCopy } = require("../../components/selection-copy");
const { byId } = require("../../core/dom");
const {
  state,
  loadData,
  loadCounts,
  rememberCategory,
  RETURN_KEY,
} = require("./state");
const { openingCategory } = require("./opening");
const { renderPanel } = require("./panel");
const { bindPanelFold } = require("./panel-fold");
const { renderList } = require("./list");
const { count, undo, resetCategory, checkNewDay } = require("./counter");
const { copyAthkar } = require("./feedback");

/** @param {string} category */
function openCategory(category) {
  state.category = category;
  rememberCategory(category);
  clearSearch(false);
  renderPanel();
  renderList();
}

/** @param {boolean} focus */
function clearSearch(focus) {
  const input = byId("akSearch", HTMLInputElement);
  input.value = "";
  state.query = "";
  byId("akSearchClear", HTMLButtonElement).hidden = true;
  if (focus) {
    renderPanel();
    renderList();
    input.focus();
  }
}

function bindSearch() {
  const input = byId("akSearch", HTMLInputElement);
  input.addEventListener("input", () => {
    state.query = input.value;
    byId("akSearchClear", HTMLButtonElement).hidden = !input.value;
    renderPanel(); // no category is marked open while searching
    renderList();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && input.value) {
      e.preventDefault();
      clearSearch(true);
    }
  });
  byId("akSearchClear", HTMLButtonElement).addEventListener("click", () =>
    clearSearch(true),
  );
}

// A hadith opens on sunnah.com; a verse opens the Quran page at that ayah, whose back button
// returns here, on the same category (sessionStorage, read by opening.js).
/** @param {HTMLButtonElement} source */
function openSource(source) {
  const { href, surah, ayah } = source.dataset;
  if (href) {
    ipcRenderer.invoke("open-external", href);
    return;
  }
  try {
    sessionStorage.setItem(
      "quranOpenAyah",
      JSON.stringify({
        surah: Number(surah),
        ayah: Number(ayah),
        back: "athkar",
      }),
    );
    if (!state.query.trim()) sessionStorage.setItem(RETURN_KEY, state.category);
  } catch {
    // storage unavailable: the Quran page opens on its list
  }
  ipcRenderer.invoke("navigate-to", "quran");
}

function bindActions() {
  byId("akNav", HTMLElement).addEventListener("click", (e) => {
    const row = /** @type {Element} */ (e.target).closest(".ak-cat");
    if (row instanceof HTMLButtonElement && row.dataset.category) {
      openCategory(row.dataset.category);
    }
  });

  byId("akList", HTMLElement).addEventListener("click", (e) => {
    const source = /** @type {Element} */ (e.target).closest(".ak-source");
    if (source instanceof HTMLButtonElement) {
      openSource(source);
      return;
    }
    const button = /** @type {Element} */ (e.target).closest("[data-action]");
    if (!(button instanceof HTMLButtonElement)) {
      // a click anywhere on a card counts too, but not when the user selects text to copy
      const card = /** @type {Element} */ (e.target).closest(".ak-card");
      const selecting = Boolean(window.getSelection()?.toString());
      if (card instanceof HTMLElement && card.dataset.id && !selecting)
        count(card.dataset.id);
      return;
    }
    const { action, id = "" } = button.dataset;
    if (action === "count") count(id);
    else if (action === "undo") undo(id);
    else if (action === "copy") {
      const card = button.closest(".ak-card");
      const text = card?.querySelector(".ak-text")?.textContent ?? "";
      const ref = card?.querySelector(".ak-ref bdi")?.textContent ?? "";
      copyAthkar(ref ? `${text}\n${ref}` : text);
    }
  });

  byId("akReset", HTMLButtonElement).addEventListener("click", resetCategory);
  // back to the page after midnight: the new day starts from 0
  window.addEventListener("focus", checkNewDay);
  document.addEventListener("visibilitychange", checkNewDay);
}

async function initAthkarPage() {
  await loadData();
  loadCounts();
  state.category = await openingCategory();

  bindSearch();
  bindActions();
  bindPanelFold(openCategory);
  // Ctrl/Cmd+C or right-click > Copy on highlighted text of a dhikr
  initSelectionCopy(byId("akList", HTMLElement), copyAthkar);

  renderPanel();
  renderList();
}

module.exports = { initAthkarPage };
