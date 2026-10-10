"use strict";

// Shared start of every window: waits for the translations, loads the saved settings into the
// store and switches the UI language. Theme and text direction stay with the caller (popup
// windows are transparent and keep a fixed direction). Calling it again returns the same
// promise, so the settings are only requested once per page.
const { ipcRenderer } = require("electron");
const { whenReady, setLanguage } = require("./i18n");
const { state } = require("./store");

let _loading = null;

function loadSettings() {
  _loading ??= (async () => {
    await whenReady();
    try {
      const settings = await ipcRenderer.invoke("get-settings");
      if (settings) state.settings = { ...state.settings, ...settings };
    } catch (err) {
      console.error("[bootstrap] get-settings failed:", err);
    }
    setLanguage(state.settings.language || "en");
    return state.settings;
  })();
  return _loading;
}

module.exports = { loadSettings };
