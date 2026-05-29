"use strict";

const { PRELOAD_ENTRY, icons } = require("./paths");

function createMainWindowOptions(settings = {}) {
  const useBigScreen = settings.bigScreen || false;

  return {
    width: useBigScreen ? 850 : 320,
    height: useBigScreen ? 600 : 575,
    minWidth: 320,
    minHeight: 575,
    frame: false,
    transparent: false,
    backgroundColor: "#0b1220",
    resizable: true,
    alwaysOnTop: false,
    x: settings.position?.x ?? 100,
    y: settings.position?.y ?? 100,
    icon: icons.app,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: PRELOAD_ENTRY,
      webviewTag: true,
      webSecurity: false,
      backgroundThrottling: false,
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
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      backgroundThrottling: false,
    },
  };
}

module.exports = {
  createMainWindowOptions,
  createBackgroundPlayerOptions,
};
