// src/renderer/js/offline-banner.js
/**
 * Offline Banner - Minimal, working version
 */

let bannerInstance = null;

class OfflineBanner {
  constructor() {
    this.isOnline = true;
    this.bannerElement = null;
    this.checkInterval = null;
    this.langInterval = null;
    this.lastLanguage = null;
  }

  init() {
    this.createBannerHTML();
    this.listenForConnectionChanges();
    this.checkConnectionPeriodically();
    this.setupEventListeners();
    this.setupThemeLanguageListener();
  }

  createBannerHTML() {
    const oldBanner = document.getElementById("offline-banner");
    if (oldBanner) oldBanner.remove();

    const banner = document.createElement("div");
    banner.id = "offline-banner";
    banner.className = "offline-banner offline-banner-hidden";
    banner.innerHTML = `
      <div class="offline-banner-content">
        <div class="offline-banner-left">
          <i class="fas fa-wifi-slash offline-banner-icon"></i>
          <span class="offline-banner-text" id="offlineBannerText">No internet connection</span>
        </div>
        <button class="offline-banner-retry" id="offlineBannerRetry">Retry</button>
        <button class="offline-banner-close" id="offlineBannerClose">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;

    document.body.insertBefore(banner, document.body.firstChild);
    this.bannerElement = banner;

    this.updateBannerText();
    this.applyThemeColors();
  }

  updateBannerText() {
    try {
      const { t, getLanguage } = require("../../js/core/i18n/translations");
      const lang = getLanguage();

      const textEl = document.getElementById("offlineBannerText");
      const retryBtn = document.getElementById("offlineBannerRetry");

      if (textEl) {
        textEl.textContent = t("noInternetConnection", "offline");
      }
      if (retryBtn) {
        retryBtn.textContent = t("retry", "ui");
      }

      this.lastLanguage = lang;
    } catch (error) {}
  }

  applyThemeColors() {
    try {
      const app = document.getElementById("app");
      if (!app || !this.bannerElement) return;

      const themeClass = Array.from(app.classList).find((cls) =>
        cls.startsWith("theme-"),
      );
      if (!themeClass) return;

      // Remove all themes
      [
        "theme-navy",
        "theme-dark",
        "theme-purple",
        "theme-pink",
        "theme-blue",
        "theme-green",
        "theme-orange",
        "theme-brown",
        "theme-gold",
        "theme-ramadan",
        "theme-emerald",
        "theme-ocean",
        "theme-royal",
        "theme-indigo",
        "theme-classic",
      ].forEach((t) => this.bannerElement.classList.remove(t));

      // Add current theme
      this.bannerElement.classList.add(themeClass);
    } catch (error) {
      // Ignore
    }
  }

  setupThemeLanguageListener() {
    try {
      const { ipcRenderer } = require("electron");
      ipcRenderer.on("theme-changed", (event, theme) => {
        this.applyThemeColors();
      });
    } catch (error) {
      // Ignore
    }

    const app = document.getElementById("app");
    if (app) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (
            mutation.type === "attributes" &&
            mutation.attributeName === "class"
          ) {
            this.applyThemeColors();
          }
        });
      });
      observer.observe(app, { attributes: true, attributeFilter: ["class"] });
    }

    this.langInterval = setInterval(() => {
      try {
        const { getLanguage } = require("../../js/core/i18n/translations");
        const lang = getLanguage();
        if (lang !== this.lastLanguage) {
          this.lastLanguage = lang;
          this.updateBannerText();
        }
      } catch (error) {
        // Ignore
      }
    }, 1000);
  }

  showBanner() {
    if (!this.bannerElement) return;
    this.bannerElement.classList.remove("offline-banner-hidden");
    this.bannerElement.classList.add("offline-banner-visible");
  }

  hideBanner() {
    if (!this.bannerElement) return;
    this.bannerElement.classList.remove("offline-banner-visible");
    this.bannerElement.classList.add("offline-banner-hidden");
  }

  async checkConnection() {
    try {
      await fetch("https://www.google.com", {
        method: "HEAD",
        mode: "no-cors",
        cache: "no-store",
        timeout: 5000,
      });
      return true;
    } catch {
      return false;
    }
  }

  checkConnectionPeriodically() {
    this.checkInterval = setInterval(async () => {
      const online = await this.checkConnection();
      if (online !== this.isOnline) {
        this.isOnline = online;
        this.updateBannerStatus();
      }
    }, 10000);
  }

  updateBannerStatus() {
    if (this.isOnline) {
      this.hideBanner();
    } else {
      this.showBanner();
    }
  }

  setupEventListeners() {
    const retryBtn = document.getElementById("offlineBannerRetry");
    const closeBtn = document.getElementById("offlineBannerClose");

    if (retryBtn) {
      retryBtn.addEventListener("click", async () => {
        retryBtn.disabled = true;
        retryBtn.innerHTML = '<div class="spinner-small"></div>';
        const online = await this.checkConnection();
        if (online) {
          this.isOnline = true;
          this.hideBanner();
          window.dispatchEvent(new CustomEvent("connection-restored"));
        } else {
          retryBtn.disabled = false;
          this.updateBannerText();
        }
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener("click", () => this.hideBanner());
    }
  }

  listenForConnectionChanges() {
    try {
      const { ipcRenderer } = require("electron");
      ipcRenderer.on("connection-lost", () => {
        this.isOnline = false;
        this.updateBannerStatus();
      });
      ipcRenderer.on("connection-restored", () => {
        this.isOnline = true;
        this.updateBannerStatus();
        window.dispatchEvent(new CustomEvent("connection-restored"));
      });
    } catch (error) {
      // Ignore
    }
  }

  destroy() {
    if (this.checkInterval) clearInterval(this.checkInterval);
    if (this.langInterval) clearInterval(this.langInterval);
  }
}

function reinitializeOfflineBanner() {
  if (bannerInstance) bannerInstance.destroy();
  bannerInstance = new OfflineBanner();
  bannerInstance.init();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    bannerInstance = new OfflineBanner();
    bannerInstance.init();
  });
} else {
  bannerInstance = new OfflineBanner();
  bannerInstance.init();
}

window.reinitializeOfflineBanner = reinitializeOfflineBanner;
module.exports = { OfflineBanner, reinitializeOfflineBanner };
