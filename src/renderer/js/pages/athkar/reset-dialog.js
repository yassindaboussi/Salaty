"use strict";

// The "reset all counts" confirmation dialog.
const { t } = require("../../core/i18n");
const { state, saveAthkarState } = require("./state");
const { renderAthkarList } = require("./athkar-list");
const { showSuccessToast } = require("./feedback");

function showResetConfirm() {
  const dialog = document.createElement("div");
  dialog.className = "athkar-confirm-dialog";
  dialog.innerHTML = `
    <div class="athkar-confirm-box">
      <div class="athkar-confirm-title">${t("resetAllConfirmTitle")}</div>
      <div class="athkar-confirm-message">${t("resetAllConfirmMessage")}</div>
      <div class="athkar-confirm-buttons">
        <button type="button" class="athkar-confirm-btn athkar-confirm-cancel">${t("cancel")}</button>
        <button type="button" class="athkar-confirm-btn athkar-confirm-reset">${t("resetAllConfirm")}</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  const cancelBtn = dialog.querySelector(".athkar-confirm-cancel");
  const resetBtn = dialog.querySelector(".athkar-confirm-reset");

  if (cancelBtn) {
    cancelBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      dialog.remove();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      state.athkarState = {};
      saveAthkarState();
      renderAthkarList();
      showSuccessToast(t("allCountsReset"));
      dialog.remove();
    });
  }

  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) {
      dialog.remove();
    }
  });
}

module.exports = { showResetConfirm };
