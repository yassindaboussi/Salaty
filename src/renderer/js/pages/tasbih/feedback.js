"use strict";

// What the page tells the user: a short toast, and the same for screen readers (a polite live
// region, used only at a target, never on every count).
const { showToast } = require("../../core/toast");

/** The app's toast (the same look as on every page), shown for `duration` ms. */
function showSuccessToast(message, isError = false, duration = 2000) {
  showToast(message, isError ? "error" : "success", { duration });
}

/** @param {string} message */
function announce(message) {
  const live = document.getElementById("tbLive");
  if (!live) return;
  live.textContent = "";
  setTimeout(() => {
    live.textContent = message;
  }, 50);
}

module.exports = { showSuccessToast, announce };
