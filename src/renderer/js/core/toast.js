"use strict";

const ICONS = {
  success: "check-circle",
  error: "exclamation-circle",
  info: "info-circle",
};
const ERROR_BG = "rgba(244,67,54,0.92)";

function renderToast(className, innerHTML, opts = {}) {
  const { duration = 2500, removeDelay, replaceExisting = true } = opts;

  if (replaceExisting) {
    document.querySelectorAll(`.${className.split(" ")[0]}`).forEach((el) => el.remove());
  }

  const toast = document.createElement("div");
  toast.className = className;
  toast.innerHTML = innerHTML;
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));

  setTimeout(() => {
    toast.classList.remove("show");
    if (removeDelay != null) {
      setTimeout(() => toast.remove(), removeDelay);
    } else {
      toast.addEventListener("transitionend", () => toast.remove(), {
        once: true,
      });
    }
  }, duration);

  return toast;
}

function showToast(message, type = "info") {
  const toast = renderToast(
    `toast ${type}`,
    `<i class="fas fa-${ICONS[type] ?? ICONS.info}"></i><span>${message}</span>`,
    { duration: 2500 },
  );
  if (type === "error") toast.style.background = ERROR_BG;
}

module.exports = { showToast, renderToast };
