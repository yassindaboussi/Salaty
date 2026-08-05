"use strict";

const { PRELOAD_ENTRY, icons } = require("./paths");

function createMainWindowOptions(settings = {}) {
  return {
    width: 850,
    height: 560,
    minWidth: 400,
    minHeight: 400,
    frame: false,
    transparent: false,
    backgroundColor: "#060c18",
    resizable: true,
    alwaysOnTop: false,
    x: settings.position?.x ?? 100,
    y: settings.position?.y ?? 100,
    icon: icons.app,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: PRELOAD_ENTRY,
      webviewTag: false,
      webSecurity: true,
      backgroundThrottling: false,
      spellcheck: false,
      enableWebSQL: false,
      v8CacheOptions: "bypassHeatCheck",
    },
  };
}

function createBackgroundPlayerOptions() {
  return {
    width: 300,
    height: 120,
    frame: false,
    transparent: true,
    show: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: PRELOAD_ENTRY,
      webSecurity: true,
      backgroundThrottling: false,
      spellcheck: false,
      enableWebSQL: false,
    },
  };
}

module.exports = {
  createMainWindowOptions,
  createBackgroundPlayerOptions,
};
