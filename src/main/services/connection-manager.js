"use strict";
const https = require("https");

let isOnline = true;
let mainWindow = null;
let checkInterval = null;

// Ping the actual API endpoint, not google.com (which is blocked in some regions)
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

function initializeConnectionManager(mainWin) {
  mainWindow = mainWin;

  // Initial check
  checkConnection().then((online) => {
    isOnline = online;
  });

  checkInterval = setInterval(async () => {
    const wasOnline = isOnline;
    isOnline = await checkConnection();
    if (wasOnline !== isOnline && mainWindow) {
      mainWindow.webContents.send(
        isOnline ? "connection-restored" : "connection-lost",
      );
    }
  }, CHECK_MS);
}

function cleanup() {
  if (checkInterval) clearInterval(checkInterval);
}

module.exports = {
  initializeConnectionManager,
  cleanup,
  isOnline: () => isOnline,
};
