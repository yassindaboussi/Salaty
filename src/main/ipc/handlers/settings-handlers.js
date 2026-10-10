"use strict";

// IPC for the settings and saved locations (data: services/settings-store.js).
const secureIpc = require("../secure-ipc");
const check = require("../validate");
const store = require("../../services/settings-store");
const { detectLocation } = require("../../services/location-detect");

let registered = false;

/**
 * @param {object} callbacks  what to do when a saved setting changes
 * @param {Function} [callbacks.onLocationChange]
 * @param {Function} [callbacks.onThemeChange]     (theme)
 * @param {Function} [callbacks.onLanguageChange]  (language)
 * @param {Function} [callbacks.onAnalyticsChange] (enabled)
 */
function registerSettingsHandlers({
  onLocationChange,
  onThemeChange,
  onLanguageChange,
  onAnalyticsChange,
}) {
  if (registered) return;
  registered = true;

  secureIpc.handle("get-settings", () => store.get());

  secureIpc.handle("save-settings", (_e, changes) => {
    const changed = store.update(check.settingsChanges(changes, store.get()));
    const settings = store.get();
    if (changed.location) onLocationChange?.();
    if (changed.theme) onThemeChange?.(settings.theme);
    if (changed.language) onLanguageChange?.(settings.language);
    if (changed.analytics)
      onAnalyticsChange?.(settings.analyticsEnabled === true);
    return settings;
  });

  secureIpc.handle("get-locations", () => store.getLocations());
  secureIpc.handle("add-location", (_e, data) => {
    const loc = check.newLocation(data);
    return loc ? store.addLocation(loc) : null;
  });
  secureIpc.handle("update-location", (_e, id, updates) => {
    const locId = check.locationId(id);
    const clean = check.locationUpdates(updates);
    return locId && clean ? store.updateLocation(locId, clean) : null;
  });
  secureIpc.handle("delete-location", (_e, id) => {
    const locId = check.locationId(id);
    return locId ? store.deleteLocation(locId) : false;
  });
  secureIpc.handle("set-active-location", (_e, id) => {
    const locId = check.locationId(id);
    const ok = locId ? store.setActiveLocation(locId) : false;
    if (ok) onLocationChange?.();
    return ok;
  });

  secureIpc.handle("detect-location", () => detectLocation());
  secureIpc.handle("toggle-travel-mode", (_e, enabled) =>
    store.setTravelMode(enabled === true),
  );
}

module.exports = { registerSettingsHandlers };
