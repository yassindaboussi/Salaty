"use strict";

// What the page tells the user: a short toast, and the same for screen readers (a polite live
// region, used only at a target, never on every count).
const { renderToast } = require("../../core/toast");
const { html } = require("../../utils/html");

function showSuccessToast(message, isError = false, duration = 2000) {
  renderToast(
    `success-toast ${isError ? "error" : ""}`,
    html`<i class="fas fa-${isError ? "exclamation-circle" : "check-circle"}" aria-hidden="true"></i><span>${message}</span>`,
    { duration, removeDelay: 200 },
  );
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
