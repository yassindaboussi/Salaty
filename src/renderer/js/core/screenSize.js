"use strict";
const { ipcRenderer } = require("electron");
const { state } = require("./globalStore");

const WIDTHS = { big: 850, fullscreen: null };
const BANNER_EXTRA_HEIGHT = 72;

class ScreenSizeManager {
  constructor() {
    this._size          = "big";
    this._bannerVisible = false;
    this._baseHeight    = null;
  }

  syncFromSettings() {
    this._size = state.settings?.bigScreen ? "big" : "fullscreen";
  }

  async applyScreenSize() {
    const target = state.settings?.bigScreen ? "big" : "fullscreen";
    if (this._size !== target) {
      this._size = target;
      this._baseHeight = null;
      await this._sendResize();
    }
    return this._size === "big";
  }

  initPageScreenSize(containerClass = "") {
    this.syncFromSettings();
    this._applyBodyClasses(containerClass);
    this._updateButton();
  }

  async toggleScreenSize(containerClass = "") {
    const next = this._size === "big" ? "fullscreen" : "big";
    this._size = next;
    this._baseHeight = null;
    state.settings.bigScreen = next === "big";
    await ipcRenderer.invoke("save-settings", { bigScreen: state.settings.bigScreen });
    await this._sendResize();
    this._applyBodyClasses(containerClass);
    this._updateButton();
    return next;
  }

  getWindowSize()    { return { width: WIDTHS[this._size] || 1200, height: this._baseHeight || 700 }; }
  getCurrentWidth()  { return WIDTHS[this._size] || 1200; }
  getCurrentSize()   { return this._size; }
  isBigScreen()      { return this._size === "big"; }

  async setBannerVisible(visible) {
    if (this._bannerVisible === visible) return;
    this._bannerVisible = visible;
    if (this._size === "big" && this._baseHeight) {
      await this._sendResize();
    }
  }

  async forceApplyScreenSize() {
    if (this._size === "fullscreen") {
      await ipcRenderer.invoke("maximize-window");
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
    await this._fitToContent();
  }

  async _fitToContent() {
    const prayerList = document.getElementById("prayerList");
    const header     = document.querySelector(".header");
    const banner     = document.getElementById("eventsBanner");
    const cards      = document.getElementById("prayerCards");

    if (!prayerList || !header || !cards) {
      await this._sendResize();
      return;
    }

    let h = 0;

    h += header.offsetHeight;

    if (banner && banner.style.display !== "none") {
      h += 10 + banner.offsetHeight;
    }

    h += cards.offsetHeight;

    const prayerTimes = document.getElementById("prayerTimes");
    if (prayerTimes) {
      const cs = window.getComputedStyle(prayerTimes);
      const padTop    = parseFloat(cs.paddingTop)    || 0;
      const padBottom = parseFloat(cs.paddingBottom) || 16;
      h += padTop + prayerList.offsetHeight + padBottom;
    } else {
      h += prayerList.offsetHeight + 16;
    }

    h += 4;

    const height = Math.ceil(h);
    this._baseHeight = height - (this._bannerVisible ? BANNER_EXTRA_HEIGHT : 0);

    await ipcRenderer.invoke("resize-window", WIDTHS[this._size], height);
  }

  async _sendResize() {
    if (this._size === "fullscreen") {
      await ipcRenderer.invoke("maximize-window");
      return;
    }
    const base   = this._baseHeight || 560;
    const height = base + (this._bannerVisible ? BANNER_EXTRA_HEIGHT : 0);
    await ipcRenderer.invoke("resize-window", WIDTHS[this._size], height);
  }

  _applyBodyClasses(containerClass = "") {
    const isBig = this._size === "big";
    document.body.setAttribute("data-screen-size", this._size);
    document.body.classList.toggle("big-screen", isBig);
    document.body.classList.toggle("fullscreen-mode", this._size === "fullscreen");
    if (containerClass) {
      const el = document.querySelector(`.${containerClass}`);
      if (el) {
        el.classList.toggle("big-screen", isBig);
        el.classList.toggle("fullscreen-mode", this._size === "fullscreen");
      }
    }
  }

  _updateButton() {
    const btn = document.getElementById("fullscreenBtn");
    if (!btn) return;
    const isBig = this._size === "big";
    btn.setAttribute("aria-label", isBig ? "Switch to Full Screen" : "Switch to Big Screen");
    btn.setAttribute("data-tooltip", isBig ? "tooltipExpand" : "tooltipCompress");
    btn.setAttribute("data-tip",
      window._t?.(isBig ? "tooltipExpand" : "tooltipCompress") ??
        (isBig ? "Full Screen" : "Big Screen")
    );
    const icon = btn.querySelector("i");
    if (icon) icon.className = `fas fa-${isBig ? "expand" : "compress"}`;
  }
}

module.exports = new ScreenSizeManager();
