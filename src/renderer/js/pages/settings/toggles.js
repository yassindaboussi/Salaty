"use strict";

// The two plain on/off settings: travel mode and usage statistics.
const { ipcRenderer } = require("electron");
const { t } = require("../../core/i18n");
const { state } = require("../../core/store");
const { showToast } = require("../../core/toast");
const analytics = require("../../services/analytics");
const { persistSettings } = require("./persist");

function initTravelModeToggle() {
  const toggle = document.getElementById("travelModeToggle");
  if (!(toggle instanceof HTMLInputElement)) return;

  toggle.checked = state.settings.travelMode === true;

  toggle.addEventListener("change", async () => {
    state.settings.travelMode = toggle.checked;
    try {
      await ipcRenderer.invoke("toggle-travel-mode", toggle.checked);
      showToast(
        toggle.checked ? t("travelModeEnabled") : t("travelModeDisabled"),
        "success",
      );
    } catch (err) {
      console.error("Failed to save travel mode setting:", err);
      analytics.error("travel_mode_toggle", err.message || String(err));
    }
  });
}

// Usage statistics are opt-in (PRIVACY.md): off unless the user has turned them on here.
function initAnalyticsToggle() {
  const toggle = document.getElementById("analyticsToggle");
  if (!(toggle instanceof HTMLInputElement)) return;

  toggle.checked = state.settings.analyticsEnabled === true;
  toggle.addEventListener("change", () => {
    state.settings.analyticsEnabled = toggle.checked;
    persistSettings();
  });
}

module.exports = { initTravelModeToggle, initAnalyticsToggle };
