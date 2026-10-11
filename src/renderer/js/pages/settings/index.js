"use strict";

// The settings page. Its parts:
//   steppers.js     the − / + buttons of the number inputs
//   appearance.js   theme, language and window size (and the page text after a language switch)
//   alerts.js       athkar alerts and the notification before the adhan
//   toggles.js      travel mode and usage statistics (opt-in)
//   about.js        app version, contact, update check and install
//   persist.js      saving the settings (right away or after a short pause)
//   state.js        the theme picked on the page
// The location settings are components/location-picker.js and components/location-manager.js.
const {
  setupConnectionRecovery,
} = require("../../services/connection-recovery");
const { initSelectLocation } = require("../../components/location-picker");
const { state } = require("../../core/store");
const {
  initLocationManagementUI,
} = require("../../components/location-manager");
const { pageState } = require("./state");
const { persistSettings } = require("./persist");
const { initNumberSteppers } = require("./steppers");
const {
  updateAllText,
  initThemeSelection,
  initLanguageSelection,
  initScreenSizeSetting,
} = require("./appearance");
const { initAthkarAlerts, initPreAdhanNotification } = require("./alerts");
const { initTravelModeToggle, initAnalyticsToggle } = require("./toggles");
const { initAboutSection } = require("./about");

function initSettingsPage() {
  initNumberSteppers();

  const locationPicker = initSelectLocation((location) => {
    if (!location?.country || !location?.city) return;
    state.settings.country = location.country;
    state.settings.city = location.city;
    persistSettings();
  });
  // Only the country/city lists come from the network. Re-running the whole init here would
  // add every listener twice and fail on the already-created Tom Select pickers.
  setupConnectionRecovery(async () => {
    const picker = await locationPicker;
    await picker?.reloadIfEmpty();
  }, "Settings");
  initLocationManagementUI();
  initAboutSection();

  pageState.pendingTheme = state.settings.theme || "navy";

  updateAllText();
  initThemeSelection();
  initLanguageSelection();
  initAthkarAlerts();
  initPreAdhanNotification();
  initTravelModeToggle();
  initAnalyticsToggle();
  initScreenSizeSetting();
}

module.exports = {
  initSettingsPage,
};
