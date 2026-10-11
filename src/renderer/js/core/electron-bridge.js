"use strict";

// The API the preload exposes (see src/shared/ipc-channels.d.ts); "electron" in the pages
// means this file (scripts/build-renderer.js).
function getBridge() {
  const bridge = window.electron;
  if (!bridge) {
    throw new Error(
      "window.electron is not available — the preload script did not run " +
        "or contextIsolation/preload is misconfigured for this window.",
    );
  }
  return bridge;
}

module.exports = getBridge();
