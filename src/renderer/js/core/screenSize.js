"use strict";
const { ipcRenderer } = require("electron");
const { state } = require("./globalStore");

const WIDTHS = { big: 850, fullscreen: null }; // fullscreen = maximize
const BANNER_EXTRA_HEIGHT = 72;

class ScreenSizeManager {
  constructor() {
    this._size          = "big";
    this._bannerVisible = false;
    this._baseHeight    = null;
  }

  syncFromSettings() {
    // bigScreen:true → big (850px), bigScreen:false → fullscreen (maximized)
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
    // Persist BEFORE resize so main process reads correct bigScreen value
    // when the "unmaximize" event fires inside our resize-window handler.
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
    // In fullscreen mode window manages its own size; only resize in big mode
    if (this._size === "big" && this._baseHeight) {
      await this._sendResize();
    }
  }

  /**
   * Fit the OS window to the actual rendered content.
   * Uses a setTimeout so the browser has completed layout before we measure.
   */
  async forceApplyScreenSize() {
    if (this._size === "fullscreen") {
      await ipcRenderer.invoke("maximize-window");
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
    await this._fitToContent();
  }

  /**
   * Core measurement: reads prayerList's real layout height.
   * prayerList is the innermost element — its offsetHeight after layout
   * is the ground truth for how tall the prayer rows are.
   */
  async _fitToContent() {
    const prayerList = document.getElementById("prayerList");
    const header     = document.querySelector(".header");
    const banner     = document.getElementById("eventsBanner");
    const cards      = document.getElementById("prayerCards");

    if (!prayerList || !header || !cards) {
      await this._sendResize();
      return;
    }

    // Each of these uses offsetHeight — the CSS layout height, 
    // not clipped by parent overflow. Always reflects real rendered size.
    let h = 0;

    // 1. Header
    h += header.offsetHeight;

    // 2. Banner (if showing) — offsetHeight + 10px CSS margin-top
    if (banner && banner.style.display !== "none") {
      h += 10 + banner.offsetHeight;
    }

    // 3. Prayer cards container
    h += cards.offsetHeight;

    // 4. Prayer list wrapper padding-top (0) + prayerList content
    //    prayerList is inside .prayer-times which has padding 0 16px 16px
    //    prayerList.offsetHeight = sum of all prayer-item rows + their margins
    const prayerTimes = document.getElementById("prayerTimes");
    if (prayerTimes) {
      // Get computed padding of the wrapper
      const cs = window.getComputedStyle(prayerTimes);
      const padTop    = parseFloat(cs.paddingTop)    || 0;
      const padBottom = parseFloat(cs.paddingBottom) || 16;
      h += padTop + prayerList.offsetHeight + padBottom;
    } else {
      h += prayerList.offsetHeight + 16;
    }

    // 5. Small safety margin
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
