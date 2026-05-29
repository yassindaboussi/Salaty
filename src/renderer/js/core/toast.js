"use strict";

const ICONS = {
  success: "check-circle",
  error: "exclamation-circle",
  info: "info-circle",
};
const ERROR_BG = "rgba(244,67,54,0.92)";

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  // Only override background for error — success/info use the CSS accent variable.
  if (type === "error") toast.style.background = ERROR_BG;

  toast.innerHTML = `<i class="fas fa-${ICONS[type] ?? ICONS.info}"></i><span>${message}</span>`;
  document.body.appendChild(toast);

  // Trigger CSS transition on next frame
  requestAnimationFrame(() => toast.classList.add("show"));

  setTimeout(() => {
    toast.classList.remove("show");
    toast.addEventListener("transitionend", () => toast.remove(), {
      once: true,
    });
  }, 2500);
}

module.exports = { showToast };
