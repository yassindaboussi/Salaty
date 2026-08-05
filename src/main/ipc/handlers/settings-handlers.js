"use strict";

const { ipcMain, app } = require("electron");
const fs = require("fs");
const path = require("path");
const { ROOT_DIR } = require("../../config/paths");


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
};


function getSettingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function generateLocationId() {
  return (
    "loc_" + Date.now() + "_" + Math.random().toString(36).substring(2, 11)
  );
}

function syncActiveLocation() {
  if (settingsData.locations?.length) {
    const active = settingsData.locations.find((l) => l.isActive);
    if (active) {
      settingsData.city = active.city;
      settingsData.country = active.country;
    }
  }
}


function saveSettings() {
  try {
    fs.writeFileSync(getSettingsPath(), JSON.stringify(settingsData, null, 2));
  } catch (err) {
    console.error("[Settings] Error saving:", err);
  }
}

function loadSettings() {
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
      saveSettings();
    }

    _migrateToMultiLocation();
  } catch (err) {
    console.error("[Settings] Error loading:", err);
  }
}

function _migrateToMultiLocation() {
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
    saveSettings();
  }
  syncActiveLocation();
}

function getSettingsData() {
  return settingsData;
}
function savePosition(x, y) {
  settingsData.position = { x, y };
  saveSettings();
}


let _handlersRegistered = false;

function setupHandlers(mainWindow, { onLocationChange, onThemeChange }) {
  if (_handlersRegistered) return;
  _handlersRegistered = true;

  ipcMain.handle("get-settings", () => settingsData);

  ipcMain.handle("save-settings", (_e, newSettings) => {
    const oldTheme = settingsData.theme;
    const oldCity = settingsData.city;
    const oldCountry = settingsData.country;

    settingsData = { ...settingsData, ...newSettings };
    syncActiveLocation();
    saveSettings();

    app.setLoginItemSettings({
      openAtLogin: settingsData.openAtLogin !== false,
    });

    if (settingsData.city !== oldCity || settingsData.country !== oldCountry) {
      onLocationChange?.();
    }
    if (newSettings.theme && newSettings.theme !== oldTheme) {
      onThemeChange?.(newSettings.theme);
    }
    return settingsData;
  });


  ipcMain.handle("get-locations", () => settingsData.locations || []);

  ipcMain.handle(
    "get-active-location",
    () => settingsData.locations?.find((l) => l.isActive) || null,
  );

  ipcMain.handle("add-location", (_e, data) => {
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
    saveSettings();
    return loc;
  });

  ipcMain.handle("update-location", (_e, locationId, updates) => {
    const idx = settingsData.locations?.findIndex((l) => l.id === locationId);
    if (idx == null || idx === -1) return null;
    settingsData.locations[idx] = {
      ...settingsData.locations[idx],
      ...updates,
    };
    saveSettings();
    return settingsData.locations[idx];
  });

  ipcMain.handle("delete-location", (_e, locationId) => {
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
    saveSettings();
    return true;
  });

  ipcMain.handle("set-active-location", (_e, locationId) => {
    if (!settingsData.locations) return false;
    settingsData.locations.forEach((l) => {
      l.isActive = false;
    });
    const loc = settingsData.locations.find((l) => l.id === locationId);
    if (!loc) return false;
    loc.isActive = true;
    syncActiveLocation();
    saveSettings();
    onLocationChange?.();
    return true;
  });


  ipcMain.handle("detect-location", async () => {
    const http = require("http");
    return new Promise((resolve, reject) => {
      const req = http.get(
        "http://ip-api.com/json",
        { timeout: 8000 },
        (res) => {
          let raw = "";
          res.on("data", (c) => {
            raw += c;
          });
          res.on("end", () => {
            try {
              const d = JSON.parse(raw);
              if (d?.status === "success")
                resolve({ city: d.city, country: d.country });
              else reject(new Error(d.message || "Detection failed"));
            } catch (e) {
              reject(e);
            }
          });
        },
      );
      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Timeout"));
      });
    });
  });


  ipcMain.handle("toggle-travel-mode", (_e, enabled) => {
    settingsData.travelMode = enabled;
    saveSettings();
    return enabled;
  });
}

module.exports = {
  loadSettings,
  saveSettings,
  getSettingsData,
  savePosition,
  setupHandlers,
};
