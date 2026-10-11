"use strict";

// The page's short toast messages, and copying a dhikr's text to the clipboard.
const { t } = require("../../core/i18n");
const { renderToast } = require("../../core/toast");
const { html } = require("../../utils/html");

function copyAthkar(text) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      showSuccessToast(t("copiedToClipboard"));
    })
    .catch((err) => {
      console.error("Failed to copy:", err);
      showSuccessToast(t("failedToCopy"), true);
    });
}

function showSuccessToast(message, isError = false) {
  renderToast(
    `success-toast ${isError ? "error" : ""}`,
    html`<i class="fas fa-${isError ? "exclamation-circle" : "check-circle"}" aria-hidden="true"></i><span>${message}</span>`,
    { duration: 2000, removeDelay: 200 },
  );
}

module.exports = { copyAthkar, showSuccessToast };
