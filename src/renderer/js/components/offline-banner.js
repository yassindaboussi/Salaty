"use strict";

// "No internet connection" banner of the home page. The main process owns the connection
// state (services/connection-manager.js checks it every 10 s): the banner asks for it on load,
// follows the connection-lost / connection-restored events, and asks main to re-check on Retry.
const { ipcRenderer } = require("electron");
const { t } = require("../core/i18n");
const { setThemeClass } = require("../core/theme");

let bannerEl = null;

function _create() {
  document.getElementById("offline-banner")?.remove();

  bannerEl = document.createElement("div");
  bannerEl.id = "offline-banner";
  bannerEl.className = "offline-banner offline-banner-hidden";
  bannerEl.innerHTML = `
    <div class="offline-banner-content">
      <div class="offline-banner-left">
        <i class="fas fa-wifi-slash offline-banner-icon" aria-hidden="true"></i>
        <span class="offline-banner-text" id="offlineBannerText">No internet connection</span>
      </div>
      <button type="button" class="offline-banner-retry" id="offlineBannerRetry">Retry</button>
      <button type="button" class="offline-banner-close" id="offlineBannerClose">
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>
  `;
  document.body.insertBefore(bannerEl, document.body.firstChild);

  const retryBtn = document.getElementById("offlineBannerRetry");
  retryBtn.addEventListener("click", async () => {
    retryBtn.disabled = true;
    retryBtn.innerHTML = '<div class="spinner-small"></div>';
    let online = false;
    try {
      online = await ipcRenderer.invoke("check-connection");
    } catch {
      /* main unavailable: stay offline */
    }
    // When it is back, main also sends "connection-restored" so the page reloads its data.
    _setVisible(!online);
    retryBtn.disabled = false;
    _applyText();
  });
  document
    .getElementById("offlineBannerClose")
    .addEventListener("click", () => _setVisible(false));
}

function _setVisible(visible) {
  bannerEl?.classList.toggle("offline-banner-visible", visible);
  bannerEl?.classList.toggle("offline-banner-hidden", !visible);
}

function _applyText() {
  const textEl = document.getElementById("offlineBannerText");
  const retryBtn = document.getElementById("offlineBannerRetry");
  if (textEl) textEl.textContent = t("noInternetConnection", "offline");
  if (retryBtn) retryBtn.textContent = t("retry", "ui");
}

// The banner carries the page's theme class for its own colours (offline-banner.css).
function _applyTheme() {
  const app = document.getElementById("app");
  const themeClass =
    app && [...app.classList].find((c) => c.startsWith("theme-"));
  if (themeClass) setThemeClass([bannerEl], themeClass.slice("theme-".length));
}

function initOfflineBanner() {
  _create();
  _applyText();
  _applyTheme();

  const app = document.getElementById("app");
  if (app)
    new MutationObserver(_applyTheme).observe(app, {
      attributeFilter: ["class"],
    });

  ipcRenderer.on("connection-lost", () => _setVisible(true));
  ipcRenderer.on("connection-restored", () => _setVisible(false));
  ipcRenderer
    .invoke("get-connection-status")
    .then((online) => _setVisible(online === false))
    .catch(() => {});
}

module.exports = { initOfflineBanner };
