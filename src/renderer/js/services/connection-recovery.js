"use strict";
const { ipcRenderer } = require("electron");

/**
 * Register a one-time reload handler for when the connection is restored.
 * Returns a cleanup function — call it to deregister.
 */
function setupConnectionRecovery(onRestore, label = "Page") {
  const handler = () => {
    try {
      onRestore();
    } catch (err) {
      console.error(`[${label}] connection-restored error:`, err);
    }
  };
  ipcRenderer.on("connection-restored", handler);
  return () => ipcRenderer.removeListener("connection-restored", handler);
}

module.exports = { setupConnectionRecovery };
