"use strict";

const { app, screen } = require("electron");
const { PRELOAD_ENTRY, icons } = require("./paths");

// webPreferences shared by every window (Electron security checklist): no Node in the page,
// isolated + sandboxed preload, no <webview>, and DevTools only in development builds.
function secureWebPreferences(extra = {}) {
  return {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    preload: PRELOAD_ENTRY,
    webviewTag: false,
    webSecurity: true,
    devTools: !app.isPackaged,
    spellcheck: false,
    enableWebSQL: false,
    ...extra,
  };
}

// DevTools open on start only for `--enable-logging` in a development build.
function shouldOpenDevTools() {
  return !app.isPackaged && process.argv.includes("--enable-logging");
}

const MAIN_WIDTH = 850;

// The saved position, if the window's top edge would still be reachable there (at least
// 100px of it on a connected display). Otherwise nothing, and Electron centres the window:
// after unplugging a monitor the app must not reopen off screen.
function visiblePosition(position, width) {
  if (!Number.isFinite(position?.x) || !Number.isFinite(position?.y)) return {};
  const { x, y } = position;
  const reachable = screen.getAllDisplays().some(({ workArea: a }) => {
    const overlap = Math.min(x + width, a.x + a.width) - Math.max(x, a.x);
    return overlap >= 100 && y >= a.y && y + 40 <= a.y + a.height;
  });
  return reachable ? { x, y } : {};
}

function createMainWindowOptions(settings = {}) {
  return {
    width: MAIN_WIDTH,
    height: 560,
    minWidth: 400,
    minHeight: 400,
    frame: false,
    transparent: false,
    backgroundColor: "#060c18",
    resizable: true,
    alwaysOnTop: false,
    ...visiblePosition(settings.position, MAIN_WIDTH),
    icon: icons.app,
    show: false,
    webPreferences: secureWebPreferences({
      backgroundThrottling: false,
      v8CacheOptions: "bypassHeatCheck",
    }),
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
    webPreferences: secureWebPreferences({ backgroundThrottling: false }),
  };
}

module.exports = {
  visiblePosition,
  secureWebPreferences,
  shouldOpenDevTools,
  createMainWindowOptions,
  createBackgroundPlayerOptions,
};
