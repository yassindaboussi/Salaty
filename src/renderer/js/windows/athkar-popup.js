"use strict";

require("../core/error-watch"); // first: errors while the page starts are logged too
const { ipcRenderer } = require("electron");
const { t } = require("../core/i18n");
const { loadSettings } = require("../core/bootstrap");
const { initTooltipSystem } = require("../core/tooltips");
const { setThemeClass } = require("../core/theme");
const { byId } = require("../core/dom");

// Settings → Notifications → "Popup stays": 10 s, 30 s, or until closed ("stay")
const CLOSE_DELAYS_MS = { 10: 10000, 30: 30000 };
const UPDATE_CLOSE_DELAY_MS = 30000; // at least this: time to read it and press "Update"

/** @returns {number | null} ms before the popup closes itself; null: it stays */
function closeDelay(duration, type) {
  if (duration === "stay") return null;
  const ms = CLOSE_DELAYS_MS[duration] ?? CLOSE_DELAYS_MS[10];
  return type === "update" ? Math.max(ms, UPDATE_CLOSE_DELAY_MS) : ms;
}

/** Closes the popup after `ms`; the time stops while the mouse is on it (WCAG 2.2.1). */
function startAutoClose(ms) {
  let left = ms;
  let startedAt = Date.now();
  let timer = setTimeout(closePopup, left);
  // the bar at the bottom shows the time left: same length, stops with it
  if (progressBar) progressBar.style.animationDuration = `${ms}ms`;
  app.addEventListener("mouseenter", () => {
    clearTimeout(timer);
    left = Math.max(left - (Date.now() - startedAt), 0);
    if (progressBar) progressBar.style.animationPlayState = "paused";
  });
  app.addEventListener("mouseleave", () => {
    startedAt = Date.now();
    timer = setTimeout(closePopup, left);
    if (progressBar) progressBar.style.animationPlayState = "running";
  });
  return () => clearTimeout(timer);
}

const app = byId("app", HTMLElement);
const athkarText = byId("athkarText", HTMLElement);
const closeBtn = byId("closeBtn", HTMLButtonElement);
const titleEl = byId("popupTitle", HTMLElement);
const iconEl = document.querySelector(".popup-icon i");
const openAppBtn = document.getElementById("openAppBtn");
const progressBar = document.getElementById("progressBar");

loadSettings()
  .then(() => {
    const openAppLabel = document.getElementById("openAppLabel");
    if (openAppLabel && !openAppLabel.dataset.custom)
      openAppLabel.textContent = t("openApp");
  })
  .finally(initTooltipSystem);

function closePopup() {
  app.classList.add("closing");
  setTimeout(() => {
    ipcRenderer.send("close-themed-popup");
  }, 380);
}

ipcRenderer.once("init-themed-popup", (_event, data) => {
  const { theme, content, title, icon, type, button, duration, style } = data;

  setThemeClass([app], theme);
  app.classList.toggle("compact", style === "compact"); // Settings → Notifications

  if (content) athkarText.textContent = content;
  if (title) titleEl.textContent = title;

  if (icon && iconEl) {
    iconEl.className = `fas ${icon}`;
  }

  if (type === "adhan" && openAppBtn) {
    openAppBtn.classList.remove("hidden");
    openAppBtn.addEventListener("click", () => {
      ipcRenderer.send("show-main-window");
      closePopup();
    });
  }

  // a new version: "Update" opens the app on its update dialog (main)
  if (type === "update" && openAppBtn) {
    openAppBtn.classList.remove("hidden");
    const label = document.getElementById("openAppLabel");
    if (label && button) {
      label.textContent = button;
      label.dataset.custom = "1";
    }
    openAppBtn.querySelector("i")?.setAttribute("class", "fas fa-download");
    openAppBtn.addEventListener("click", () => {
      ipcRenderer.send("open-update-dialog");
      closePopup();
    });
  }

  const ms = closeDelay(duration, type);
  // "until closed": no countdown bar (hidden before the height is measured)
  if (ms === null) progressBar?.parentElement?.classList.add("hidden");

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const neededHeight = Math.ceil(document.body.scrollHeight) + 2;
      ipcRenderer.send("show-themed-popup-ready", { height: neededHeight });

      const stopAutoClose = ms === null ? () => {} : startAutoClose(ms);

      closeBtn.addEventListener("click", () => {
        stopAutoClose();
        closePopup();
      });
    });
  });
});
