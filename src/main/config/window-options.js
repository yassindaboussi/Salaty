"use strict";

const { PRELOAD_ENTRY, icons } = require("./paths");

function createMainWindowOptions(settings = {}) {
  // bigScreen:true = 850px wide, bigScreen:false = maximized fullscreen
  const useBigScreen = settings.bigScreen !== false; // default to big

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
