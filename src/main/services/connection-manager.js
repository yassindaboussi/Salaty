"use strict";
const secureIpc = require("../ipc/secure-ipc");
const { isReachable } = require("./http");

/** @import { BrowserWindow } from "electron" */

let isOnline = true;
/** @type {() => BrowserWindow | null} */
let getMainWindow = () => null;
/** @type {ReturnType<typeof setInterval> | null} */
let checkInterval = null;
let handlersRegistered = false;
/** @type {Set<() => void>} */
const restoredListeners = new Set();

const CHECK_URL = "https://api.aladhan.com";
const CHECK_MS = 10_000;
const TIMEOUT_MS = 5_000;

function checkConnection() {
  return isReachable(CHECK_URL, { timeoutMs: TIMEOUT_MS });
}

// Checks now and tells the main window when the state flips; pages reload their network
// data on "connection-restored" and the home page shows/hides its offline banner.
async function refresh() {
  const wasOnline = isOnline;
  isOnline = await checkConnection();
  const mainWindow = getMainWindow();
  if (wasOnline !== isOnline && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(
      isOnline ? "connection-restored" : "connection-lost",
    );
  }
  if (!wasOnline && isOnline)
    for (const listener of restoredListeners) listener();
  return isOnline;
}

/** @param {() => BrowserWindow | null} getMainWindowFn returns the main window (or null) */
function initializeConnectionManager(getMainWindowFn) {
  getMainWindow = getMainWindowFn;

  if (!handlersRegistered) {
    handlersRegistered = true;
    // The offline banner asks for the current state when a page loads, and re-checks on "Retry".
    secureIpc.handle("get-connection-status", () => isOnline);
    secureIpc.handle("check-connection", () => refresh());
  }

  if (checkInterval) clearInterval(checkInterval);
  refresh();
  checkInterval = setInterval(refresh, CHECK_MS);
}

function cleanup() {
  if (checkInterval) clearInterval(checkInterval);
}

/**
 * Called when the connection comes back after being lost.
 * @param {() => void} listener
 */
function onRestored(listener) {
  restoredListeners.add(listener);
  return () => restoredListeners.delete(listener);
}

module.exports = {
  initializeConnectionManager,
  cleanup,
  onRestored,
  isOnline: () => isOnline,
};
