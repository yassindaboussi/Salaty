"use strict";

// What the page tells the user: the copy toast, and the progress for screen readers (a polite
// live region).
const { t } = require("../../core/i18n");
const { renderToast } = require("../../core/toast");
const { html } = require("../../utils/html");
const { copyText } = require("../../core/clipboard");

function showToast(message, isError = false) {
  renderToast(
    `success-toast ${isError ? "error" : ""}`,
    html`<i class="fas fa-${isError ? "exclamation-circle" : "check-circle"}" aria-hidden="true"></i><span>${message}</span>`,
    { duration: 2000, removeDelay: 200 },
  );
}

/** @param {string} text */
async function copyAthkar(text) {
  const ok = await copyText(text);
  showToast(t(ok ? "copiedToClipboard" : "failedToCopy"), !ok);
}

/** @param {string} message */
function announce(message) {
  const live = document.getElementById("akLive");
  if (!live) return;
  live.textContent = "";
  setTimeout(() => {
    live.textContent = message;
  }, 50);
}

module.exports = { copyAthkar, announce };
