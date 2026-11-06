"use strict";

// What the page tells the user: the copy toast, and the progress for screen readers (a polite
// live region).
const { t } = require("../../core/i18n");
const { showToast } = require("../../core/toast");
const { copyText } = require("../../core/clipboard");

/** @param {string} text */
async function copyAthkar(text) {
  const ok = await copyText(text);
  // the app's toast, the same as the Quran reader's
  showToast(
    t(ok ? "copiedToClipboard" : "failedToCopy"),
    ok ? "success" : "error",
  );
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
