
const { ipcRenderer } = require("electron");
const { t, setLanguage, whenReady } = require("../core/i18n/translations");
const { initTooltipSystem } = require("../core/tooltipSystem");

const CLOSE_DELAY_MS = 10000;

const app = document.getElementById("app");
const athkarText = document.getElementById("athkarText");
const closeBtn = document.getElementById("closeBtn");
const titleEl = document.getElementById("popupTitle");
const iconEl = document.querySelector(".popup-icon i");
const openAppBtn = document.getElementById("openAppBtn");
const stopAdhanBtn = document.getElementById("stopAdhanBtn");
const stopAdhanLabel = document.getElementById("stopAdhanLabel");

Promise.all([ipcRenderer.invoke("get-settings"), whenReady()])
  .then(([settings]) => {
    if (settings?.language) setLanguage(settings.language);
    if (stopAdhanLabel) stopAdhanLabel.textContent = t("stopAdhan");
    initTooltipSystem();
  })
  .catch(() => initTooltipSystem());

const THEME_CLASSES = [
  "theme-dark",
  "theme-blue",
  "theme-green",
  "theme-brown",
  "theme-gold",
  "theme-pink",
  "theme-purple",
  "theme-emerald",
  "theme-ocean",
  "theme-royal",
  "theme-indigo",
  "theme-classic",
  "theme-navy",
  "theme-ramadan",
];

function applyTheme(theme) {
  if (!theme) return;
  app.classList.remove(...THEME_CLASSES);
  app.classList.add(`theme-${theme}`);
}

function closePopup() {
  app.classList.add("closing");
  setTimeout(() => {
    ipcRenderer.send("close-themed-popup");
  }, 380);
}

function showStopAdhanBtn(show) {
  if (!stopAdhanBtn) return;
  if (show) {
    stopAdhanBtn.classList.remove("hidden");
  } else {
    stopAdhanBtn.classList.add("hidden");
  }
}

ipcRenderer.once("init-themed-popup", (_event, data) => {
  const { theme, content, title, icon, type } = data;

  applyTheme(theme);

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

  if (type === "adhan" && stopAdhanBtn) {
    stopAdhanBtn.addEventListener("click", () => {
      ipcRenderer.send("stop-adhan-from-popup");
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

ipcRenderer.on("show-adhan-stop-btn", (_event, { show }) => {
  showStopAdhanBtn(show);
});
