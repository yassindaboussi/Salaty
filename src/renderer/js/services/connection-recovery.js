"use strict";
const { ipcRenderer } = require("electron");

const activeHandlers = new Map();

function setupConnectionRecovery(onRestore, label = "Page") {
  const previous = activeHandlers.get(label);
  if (previous) {
    ipcRenderer.removeListener("connection-restored", previous);
  }

  const handler = () => {
    try {
      onRestore();
    } catch (err) {
      console.error(`[${label}] connection-restored error:`, err);
    }
  };
  activeHandlers.set(label, handler);
  ipcRenderer.on("connection-restored", handler);
  return () => {
    ipcRenderer.removeListener("connection-restored", handler);
    if (activeHandlers.get(label) === handler) activeHandlers.delete(label);
  };
}

module.exports = { setupConnectionRecovery };
