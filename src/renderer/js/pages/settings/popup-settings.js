"use strict";

// Settings → Notifications → the corner popups (adhan, reminder before the adhan, athkar,
// fasting, update): how long they stay (10 s / 30 s / until closed), their size (full or
// compact) and their corner (bottom or top right). main sends time and size to each popup and
// places it (ipc/handlers/popup-handlers.js). "Test" shows the reminder before the adhan.
const { ipcRenderer } = require("electron");
const { t } = require("../../core/i18n");
const { state } = require("../../core/store");
const { byId, queryAll } = require("../../core/dom");
const { persistSettings } = require("./persist");

/** A row of radio buttons bound to one setting. */
function initChoice(name, fallback) {
  const current = state.settings[name] ?? fallback;
  queryAll(`input[name="${name}"]`, HTMLInputElement).forEach((input) => {
    input.checked = input.value === current;
    input.addEventListener("change", () => {
      if (!input.checked) return;
      state.settings[name] = input.value;
      persistSettings();
    });
  });
}

function initPopupSettings() {
  initChoice("popupDuration", "10");
  initChoice("popupStyle", "full");
  initChoice("popupPosition", "bottom");

  byId("popupTestBtn", HTMLButtonElement).addEventListener("click", () => {
    const minutes = String(state.settings.preAdhanMinutes || 5);
    ipcRenderer.send("show-adhan-popup", {
      theme: state.settings.theme || "navy",
      title: `Salaty Time · ${t("popupTestTitle")}`,
      content: t("adhanInXmin")
        .replace("{prayer}", t("Dhuhr", "prayerNames"))
        .replace("{minutes}", minutes),
    });
  });
}

module.exports = { initPopupSettings };
