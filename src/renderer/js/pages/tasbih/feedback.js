"use strict";

// What the page tells the user: the success toast and the reset confirmation dialog.
const { t } = require("../../core/i18n");
const { renderToast } = require("../../core/toast");
const { html } = require("../../utils/html");
const { query } = require("../../core/dom");

function showResetConfirm(callback) {
  _showConfirmDialog({
    title: t("resetConfirmTitle"),
    message: t("resetConfirmMessage"),
    cancelLabel: t("cancel"),
    confirmLabel: t("reset"),
    onConfirm: callback,
  });
}

function _showConfirmDialog({
  title,
  message,
  cancelLabel,
  confirmLabel,
  onConfirm,
}) {
  const dialog = document.createElement("div");
  dialog.className = "tasbih-confirm-dialog";
  dialog.innerHTML = `<div class="tasbih-confirm-box">
    <div class="tasbih-confirm-title"></div>
    <div class="tasbih-confirm-message"></div>
    <div class="tasbih-confirm-buttons">
      <button type="button" class="tasbih-confirm-btn tasbih-confirm-cancel"></button>
      <button type="button" class="tasbih-confirm-btn tasbih-confirm-reset"></button>
    </div></div>`;
  query(".tasbih-confirm-title", HTMLElement, dialog).textContent = title || "";
  query(".tasbih-confirm-message", HTMLElement, dialog).textContent =
    message || "";
  query(".tasbih-confirm-cancel", HTMLButtonElement, dialog).textContent =
    cancelLabel || "";
  query(".tasbih-confirm-reset", HTMLButtonElement, dialog).textContent =
    confirmLabel || "";

  document.body.appendChild(dialog);
  query(".tasbih-confirm-cancel", HTMLButtonElement, dialog).addEventListener(
    "click",
    () => dialog.remove(),
  );
  query(".tasbih-confirm-reset", HTMLButtonElement, dialog).addEventListener(
    "click",
    () => {
      onConfirm?.();
      dialog.remove();
    },
  );
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.remove();
  });
}

function showSuccessToast(message, isError = false, duration = 2000) {
  renderToast(
    `success-toast ${isError ? "error" : ""}`,
    html`<i class="fas fa-${isError ? "exclamation-circle" : "check-circle"}" aria-hidden="true"></i><span>${message}</span>`,
    { duration, removeDelay: 200 },
  );
}

module.exports = { showResetConfirm, showSuccessToast };
