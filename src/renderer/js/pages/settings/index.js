"use strict";

// The settings page. Its parts:
//   nav.js          the side menu: one category shown at a time (remembered)
//   search.js       the search box over every category
//   panel-fold.js   the menu folded to a strip of icons (remembered)
//   saved-status.js the "Saved" note after each change
//   view.js         the page's layout: the menu, or every category on one page
//   steppers.js     the − / + buttons of the number inputs
//   appearance.js   theme, language and window size (and the page text after a language switch)
//   alerts.js       athkar alerts and the notification before the adhan
//   hijri.js        the Hijri calendar's first day of the week and the Hijri date correction
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
const { initHijriSettings, updateHijriText } = require("./hijri");
const {
  initCalculationSettings,
  updateCalculationText,
} = require("./calculation");
const { initTravelModeToggle, initAnalyticsToggle } = require("./toggles");
const { initAboutSection } = require("./about");
const { initPaneNav } = require("./nav");
const { initSettingsSearch, clearSearch } = require("./search");
const { bindPanelFold } = require("./panel-fold");
const { initViewSetting } = require("./view");

function initSettingsPage() {
  initPaneNav(clearSearch); // first: the About category must be open for #check-updates
  initSettingsSearch();
  bindPanelFold();
  initViewSetting();
  initNumberSteppers();

  const locationPicker = initSelectLocation((location) => {
    if (!location?.country || !location?.city) return;
    state.settings.country = location.country;
    state.settings.city = location.city;
    persistSettings();
    updateHijriText(); // the automatic first day of the week follows the country
    setTimeout(updateCalculationText, 1500); // the automatic method follows it too
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
  initHijriSettings();
  initCalculationSettings();
  initTravelModeToggle();
  initAnalyticsToggle();
  initScreenSizeSetting();
}

module.exports = {
  initSettingsPage,
};
