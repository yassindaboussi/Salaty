"use strict";

require("../core/error-watch"); // first: errors while the page starts are logged too
const { ipcRenderer } = require("electron");
const { t } = require("../core/i18n");
const { loadSettings } = require("../core/bootstrap");
const { initTooltipSystem } = require("../core/tooltips");
const { setThemeClass } = require("../core/theme");
const { byId } = require("../core/dom");

const CLOSE_DELAY_MS = 10000;

const app = byId("app", HTMLElement);
const athkarText = byId("athkarText", HTMLElement);
const closeBtn = byId("closeBtn", HTMLButtonElement);
const titleEl = byId("popupTitle", HTMLElement);
const iconEl = document.querySelector(".popup-icon i");
const openAppBtn = document.getElementById("openAppBtn");

loadSettings()
  .then(() => {
    const openAppLabel = document.getElementById("openAppLabel");
    if (openAppLabel) openAppLabel.textContent = t("openApp");
  })
  .finally(initTooltipSystem);

function closePopup() {
  app.classList.add("closing");
  setTimeout(() => {
    ipcRenderer.send("close-themed-popup");
  }, 380);
}

ipcRenderer.once("init-themed-popup", (_event, data) => {
  const { theme, content, title, icon, type } = data;

  setThemeClass([app], theme);

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

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const neededHeight = Math.ceil(document.body.scrollHeight) + 2;
      ipcRenderer.send("show-themed-popup-ready", { height: neededHeight });

      const autoCloseTimer = setTimeout(closePopup, CLOSE_DELAY_MS);

      closeBtn.addEventListener("click", () => {
        clearTimeout(autoCloseTimer);
        closePopup();
      });
    });
  });
});
