"use strict";

require("../core/error-watch"); // first: errors while the page starts are logged too
const { ipcRenderer } = require("electron");
const { t } = require("../core/i18n");
const { loadSettings } = require("../core/bootstrap");
const { initTooltipSystem } = require("../core/tooltips");
const { setThemeClass } = require("../core/theme");
const { byId } = require("../core/dom");

const CLOSE_DELAY_MS = 10000;
const UPDATE_CLOSE_DELAY_MS = 30000; // time to read it and press "Update"

const app = byId("app", HTMLElement);
const athkarText = byId("athkarText", HTMLElement);
const closeBtn = byId("closeBtn", HTMLButtonElement);
const titleEl = byId("popupTitle", HTMLElement);
const iconEl = document.querySelector(".popup-icon i");
const openAppBtn = document.getElementById("openAppBtn");

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
  const { theme, content, title, icon, type, button } = data;

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

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const neededHeight = Math.ceil(document.body.scrollHeight) + 2;
      ipcRenderer.send("show-themed-popup-ready", { height: neededHeight });

      const autoCloseTimer = setTimeout(
        closePopup,
        type === "update" ? UPDATE_CLOSE_DELAY_MS : CLOSE_DELAY_MS,
      );

      closeBtn.addEventListener("click", () => {
        clearTimeout(autoCloseTimer);
        closePopup();
      });
    });
  });
});
