"use strict";

// The user's settings: defaults, loading from / saving to <userData>/settings.json, and the
// saved locations. Pure data — the IPC channels that expose it are in
// ipc/handlers/settings-handlers.js.
const { app } = require("electron");
const fs = require("fs");
const path = require("path");
const { ROOT_DIR } = require("../config/paths");
const log = require("./logger").logger("Settings");

let settingsData = {
  city: "Tunis",
  country: "Tunisia",
  theme: "navy",
  language: "en",
  position: { x: 100, y: 100 },
  bigScreen: true,
  locations: [],
  openAtLogin: true,
  travelMode: false,
  fastingReminders: { occasions: [], weeklyMonThu: false, leadDays: 1 },
  analyticsEnabled: false, // opt-in, see PRIVACY.md
};

function getSettingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function generateLocationId() {
  return `loc_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

// city/country always mirror the active saved location.
function syncActiveLocation() {
  const active = settingsData.locations?.find((l) => l.isActive);
  if (active) {
    settingsData.city = active.city;
    settingsData.country = active.country;
  }
}

// ── Saving ───────────────────────────────────────────────────────────────────

let pendingSaveTimer = null;

// Write to a temp file and rename it over settings.json, so a crash or power cut in the
// middle of a write can never leave a half-written (unparseable) settings file.
function save() {
  clearTimeout(pendingSaveTimer);
  pendingSaveTimer = null;
  const file = getSettingsPath();
  const tmp = `${file}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(settingsData, null, 2));
    fs.renameSync(tmp, file);
  } catch (err) {
    log.error("saving failed:", err);
  }
}

// Window moves arrive many times per drag: keep the position in memory and write it once
// the window has stopped moving.
function saveSoon(delayMs = 1000) {
  clearTimeout(pendingSaveTimer);
  pendingSaveTimer = setTimeout(save, delayMs);
}

// Writes a pending delayed save now (on quit).
function flush() {
  if (pendingSaveTimer) save();
}

// ── Loading ──────────────────────────────────────────────────────────────────

function load() {
  try {
    const userPath = getSettingsPath();
    const bundledPath = path.join(ROOT_DIR, "settings.json");

    if (fs.existsSync(userPath)) {
      settingsData = {
        ...settingsData,
        ...JSON.parse(fs.readFileSync(userPath, "utf8")),
      };
    } else if (fs.existsSync(bundledPath)) {
      settingsData = {
        ...settingsData,
        ...JSON.parse(fs.readFileSync(bundledPath, "utf8")),
      };
      save();
    }

    migrateToMultiLocation();
  } catch (err) {
    log.error("loading failed, using the defaults:", err);
  }
}

// Settings from before saved locations existed: turn city/country into a "Home" location.
function migrateToMultiLocation() {
  if (!settingsData.locations || settingsData.locations.length === 0) {
    const src =
      settingsData.city && settingsData.country
        ? {
            name: "Home",
            city: settingsData.city,
            country: settingsData.country,
          }
        : { name: "Home", city: "Tunis", country: "Tunisia" };

    settingsData.locations = [
      {
        id: generateLocationId(),
        ...src,
        isActive: true,
        isFavorite: true,
        createdAt: new Date().toISOString(),
      },
    ];
    settingsData.city = src.city;
    settingsData.country = src.country;
    save();
  }
  syncActiveLocation();
}

// ── Reading / changing ───────────────────────────────────────────────────────

function get() {
  return settingsData;
}

// Start with the OS. Only for the installed app: in development this would register the
// Electron binary itself as a login item.
function syncOpenAtLogin() {
  if (!app.isPackaged) return;
  app.setLoginItemSettings({ openAtLogin: settingsData.openAtLogin !== false });
}

// Merges `changes`, saves, and tells what changed so the caller can react.
function update(changes) {
  const before = { ...settingsData };
  settingsData = { ...settingsData, ...changes };
  syncActiveLocation();
  save();

  if (settingsData.openAtLogin !== before.openAtLogin) syncOpenAtLogin();
  return {
    location:
      settingsData.city !== before.city ||
      settingsData.country !== before.country,
    theme: Boolean(changes.theme) && changes.theme !== before.theme,
    language: Boolean(changes.language) && changes.language !== before.language,
    analytics:
      (settingsData.analyticsEnabled === true) !==
      (before.analyticsEnabled === true),
  };
}

function savePosition(x, y) {
  settingsData.position = { x, y };
  saveSoon();
}

function setTravelMode(enabled) {
  settingsData.travelMode = enabled;
  save();
  return enabled;
}

// ── Saved locations ──────────────────────────────────────────────────────────

function getLocations() {
  return settingsData.locations || [];
}

function addLocation(data) {
  const loc = {
    id: generateLocationId(),
    name: data.name || "New Location",
    city: data.city,
    country: data.country,
    isActive: false,
    isFavorite: data.isFavorite || false,
    createdAt: new Date().toISOString(),
  };
  settingsData.locations = settingsData.locations || [];
  settingsData.locations.push(loc);
  save();
  return loc;
}

function updateLocation(locationId, updates) {
  const idx = settingsData.locations?.findIndex((l) => l.id === locationId);
  if (idx == null || idx === -1) return null;
  settingsData.locations[idx] = { ...settingsData.locations[idx], ...updates };
  save();
  return settingsData.locations[idx];
}

// The last location cannot be deleted; deleting the active one activates another.
function deleteLocation(locationId) {
  const locs = settingsData.locations;
  if (!locs) return false;
  const idx = locs.findIndex((l) => l.id === locationId);
  if (idx === -1) return false;
  if (locs[idx].isActive && locs.length === 1) return false;
  if (locs[idx].isActive) {
    const next = locs.find((_, i) => i !== idx);
    if (next) next.isActive = true;
  }
  locs.splice(idx, 1);
  syncActiveLocation();
  save();
  return true;
}

function setActiveLocation(locationId) {
  if (!settingsData.locations) return false;
  settingsData.locations.forEach((l) => {
    l.isActive = false;
  });
  const loc = settingsData.locations.find((l) => l.id === locationId);
  if (!loc) return false;
  loc.isActive = true;
  syncActiveLocation();
  save();
  return true;
}

module.exports = {
  load,
  save,
  flush,
  get,
  update,
  savePosition,
  setTravelMode,
  syncOpenAtLogin,
  getLocations,
  addLocation,
  updateLocation,
  deleteLocation,
  setActiveLocation,
};
