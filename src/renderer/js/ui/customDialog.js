const { t } = require("../core/i18n/translations");

function _showDialog(message, { icon, iconClass = "", buttons }) {
  return new Promise((resolve) => {
    const previouslyFocused = document.activeElement;

    const overlay = document.createElement("div");
    overlay.className = "custom-dialog-overlay";

    const dialog = document.createElement("div");
    dialog.className = "custom-dialog-container";
    dialog.setAttribute("role", "alertdialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-describedby", "customDialogMessage");
    dialog.setAttribute("tabindex", "-1");

    const buttonsHtml = buttons
      .map(
        (b) =>
          `<button class="custom-dialog-btn ${b.className}" data-action="${b.action}">${b.text}</button>`,
      )
      .join("\n");

    dialog.innerHTML = `
      <div class="custom-dialog-icon ${iconClass}">
        <i class="fas ${icon}"></i>
      </div>
      <div class="custom-dialog-message" id="customDialogMessage">${message}</div>
      <div class="custom-dialog-actions">
        ${buttonsHtml}
      </div>
    `;

    overlay.appendChild(dialog);
    const parent = document.getElementById("app") || document.body;
    parent.appendChild(overlay);

    requestAnimationFrame(() => {
      overlay.classList.add("active");
    });

    const primaryBtn = dialog.querySelector(
      '[data-action]:last-of-type',
    );
    (primaryBtn || dialog).focus();

    const getFocusable = () =>
      Array.from(
        dialog.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.disabled);

    const handleAction = (action) => {
      overlay.classList.remove("active");
      document.removeEventListener("keydown", handleKeydown);

      setTimeout(() => {
        const p = document.getElementById("app") || document.body;
        if (p.contains(overlay)) p.removeChild(overlay);
      }, 300);

      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }

      resolve(action);
    };

    const handleKeydown = (e) => {
      if (e.key === "Escape") {
        handleAction("cancel");
        return;
      }
      if (e.key === "Tab") {
        const focusable = getFocusable();
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeydown);

    dialog.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => handleAction(btn.dataset.action));
    });

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) handleAction("cancel");
    });
  });
}

async function showConfirmDialog(message, options = {}) {
  const {
    confirmText = t("confirm") || "Confirm",
    cancelText = t("cancel") || "Cancel",
    confirmClass = "btn-primary",
  } = options;

  const action = await _showDialog(message, {
    icon: "fa-question-circle",
    buttons: [
      { action: "cancel", text: cancelText, className: "btn-secondary" },
      { action: "confirm", text: confirmText, className: confirmClass },
    ],
  });
  return action === "confirm";
}

async function showAlertDialog(message, options = {}) {
  const { okText = t("ok") || "OK" } = options;

  await _showDialog(message, {
    icon: "fa-info-circle",
    iconClass: "alert-icon",
    buttons: [{ action: "ok", text: okText, className: "btn-primary" }],
  });
}

module.exports = {
  showConfirmDialog,
  showAlertDialog,
};
