"use strict";

// Saving the settings: right away, or after a short pause while a number is being changed.
const { ipcRenderer } = require("electron");
const { t } = require("../../core/i18n");
const { state } = require("../../core/store");
const { showToast } = require("../../core/toast");
const analytics = require("../../services/analytics");

async function persistSettings() {
  try {
    await ipcRenderer.invoke("save-settings", state.settings);
    analytics.settingsSaved(state.settings);
  } catch (err) {
    console.error("Error auto-saving settings:", err);
    analytics.error("settings_autosave", err.message || String(err));
    showToast(t("errorSaving"), "error");
  }
}

/** @type {ReturnType<typeof setTimeout> | null} */
let autoSaveDebounceTimer = null;
function scheduleAutoSave(delay = 500) {
  if (autoSaveDebounceTimer) clearTimeout(autoSaveDebounceTimer);
  autoSaveDebounceTimer = setTimeout(persistSettings, delay);
}

module.exports = { persistSettings, scheduleAutoSave };
