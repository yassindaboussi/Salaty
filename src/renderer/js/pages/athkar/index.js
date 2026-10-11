"use strict";

// The Athkar page. Its parts:
//   category-nav.js   the grouped, searchable category list in the sidebar
//   sidebar.js        folding the sidebar into an icon rail (remembered)
//   athkar-list.js    the chosen category's adhkar, one card each
//   counter.js        counting recitations (+, −, reset) and updating a card
//   reset-dialog.js   the "reset all counts" confirmation
//   loader.js         loading the bundled adhkar, error + retry
//   categories.js     the category groups, category names in the app language
//   feedback.js       toast messages, copying a dhikr
//   state.js          what is shown now, the saved counts
const { t } = require("../../core/i18n");
const { initSelectionCopy } = require("../../components/selection-copy");
const { queryAll } = require("../../core/dom");
const { state, loadAthkarState } = require("./state");
const {
  wideScreen,
  loadSidebarPref,
  applySidebarState,
  setSidebarCollapsed,
} = require("./sidebar");
const { populateCategoryNav } = require("./category-nav");
const { loadAthkarData } = require("./loader");
const { showResetConfirm } = require("./reset-dialog");
const { copyAthkar } = require("./feedback");

// The adhkar are bundled (data/adkar.json), so nothing needs reloading when the connection returns.
function initAthkarPage() {
  const resetAllBtn = document.getElementById("resetAllBtn");
  if (resetAllBtn) {
    resetAllBtn.addEventListener("click", showResetConfirm);
  }

  const searchInput = document.getElementById("athkarSearchInput");
  if (searchInput instanceof HTMLInputElement) {
    searchInput.addEventListener("input", () => {
      state.searchQuery = searchInput.value || "";
      populateCategoryNav();
      // Keep the active card highlighted in the sidebar if it's still visible
      queryAll(".category-card", HTMLElement).forEach((card) => {
        card.classList.toggle(
          "active",
          card.dataset.category === state.currentCategory,
        );
      });
    });
  }

  state.sidebarCollapsed = loadSidebarPref();
  const sidebarToggleBtn = document.getElementById("sidebarToggleBtn");
  // initAthkarPage can run again after a connection recovery; bind only once so
  // a second listener doesn't toggle the sidebar twice per click.
  if (sidebarToggleBtn && !sidebarToggleBtn.dataset.bound) {
    sidebarToggleBtn.dataset.bound = "1";
    sidebarToggleBtn.addEventListener("click", () =>
      setSidebarCollapsed(!state.sidebarCollapsed),
    );
    wideScreen.addEventListener("change", applySidebarState);
  }

  initSelectionCopy(document.getElementById("athkarList"), copyAthkar);

  updateAthkarUI();
  applySidebarState();

  loadAthkarData();

  loadAthkarState();
}

function updateAthkarUI() {
  const resetAllBtn = document.getElementById("resetAllBtn");
  if (resetAllBtn) {
    resetAllBtn.setAttribute("aria-label", t("resetAll"));
  }
}

module.exports = { initAthkarPage };
