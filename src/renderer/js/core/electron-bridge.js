"use strict";
if (!window.electron) {
  throw new Error(
    "window.electron is not available — the preload script did not run " +
      "or contextIsolation/preload is misconfigured for this window.",
  );
}

module.exports = window.electron;
