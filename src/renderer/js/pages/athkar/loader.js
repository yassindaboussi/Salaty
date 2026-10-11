"use strict";

// Loads the bundled adhkar (data/adkar.json), fills the sidebar and opens the first category; on
// failure shows an error with a retry button.
const { t } = require("../../core/i18n");
const { getAdkar } = require("../../services/content");
const analytics = require("../../services/analytics");
const { state } = require("./state");
const { CATEGORY_GROUPS } = require("./categories");
const { populateCategoryNav, setActiveCategory } = require("./category-nav");

async function loadAthkarData() {
  const athkarLoading = document.getElementById("athkarLoading");

  if (athkarLoading) {
    athkarLoading.style.display = "flex";
  }

  try {
    state.athkarData = await getAdkar();

    populateCategoryNav();

    if (!state.currentCategory) {
      const firstAvailable = CATEGORY_GROUPS.flatMap((g) => g.categories).find(
        (c) => state.athkarData[c],
      );
      const fallback = Object.keys(state.athkarData)[0];
      state.currentCategory = firstAvailable || fallback;
      if (state.currentCategory) setActiveCategory(state.currentCategory);
    }

    if (athkarLoading) {
      athkarLoading.style.display = "none";
    }
  } catch (error) {
    console.error("Error loading athkar data:", error);
    analytics.error("athkar_load", error.message || String(error));
    if (athkarLoading) {
      athkarLoading.innerHTML = `
        <div class="athkar-loading-content">
          <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
          <span>${t("athkarError")}</span>
          <button type="button" class="retry-button" id="retryAthkarBtn">
            <i class="fas fa-sync-alt" aria-hidden="true"></i> ${t("retry")}
          </button>
        </div>
      `;

      const retryBtn = document.getElementById("retryAthkarBtn");
      if (retryBtn) {
        retryBtn.addEventListener("click", loadAthkarData);
      }
    }
  }
}

module.exports = { loadAthkarData };
