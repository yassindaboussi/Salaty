"use strict";
const https = require("https");
const secureIpc = require("../ipc/secure-ipc");

let isOnline = true;
let getMainWindow = () => null;
let checkInterval = null;
let handlersRegistered = false;

const CHECK_URL = "https://api.aladhan.com";
const CHECK_MS = 10_000;
const TIMEOUT_MS = 5_000;

async function checkConnection() {
  return new Promise((resolve) => {
    const req = https.get(
      CHECK_URL,
      { timeout: TIMEOUT_MS, method: "HEAD" },
      (res) => {
        resolve(res.statusCode < 500);
        res.resume();
      },
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
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
  return isOnline;
}

// getMainWindowFn: returns the main window (or null) when called.
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

module.exports = {
  initializeConnectionManager,
  cleanup,
  isOnline: () => isOnline,
};
