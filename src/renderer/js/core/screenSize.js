"use strict";
const { ipcRenderer } = require("electron");
const { state } = require("./globalStore");

// Size constants — single source of truth.
const SIZES = {
  small: { width: 320, height: 575 },
  big: { width: 850, height: 600 },
};

class ScreenSizeManager {
  constructor() {
    this._size = "small";
  }

  // Sync from already-loaded settings — zero IPC, zero cost.
  // Call this instead of applyScreenSize() when the window was already
  // created at the correct size by the main process.
  syncFromSettings() {
    this._size = state.settings?.bigScreen ? "big" : "small";
  }

  // Apply size via IPC only when the size actually changed.
  async applyScreenSize() {
    const target = state.settings?.bigScreen ? "big" : "small";
    if (this._size !== target) {
      this._size = target;
      const { width, height } = SIZES[target];
      await ipcRenderer.invoke("resize-window", width, height);
    }
    return this._size === "big";
  }

  // Initialise body classes for a page — no IPC.
  initPageScreenSize(containerClass = "") {
    this.syncFromSettings();
    this._applyBodyClasses(containerClass);
    this._updateButton();
  }

  async toggleScreenSize(containerClass = "") {
    const next = this._size === "big" ? "small" : "big";
    this._size = next;
    state.settings.bigScreen = next === "big";
    const { width, height } = SIZES[next];
    await ipcRenderer.invoke("resize-window", width, height);
    this._applyBodyClasses(containerClass);
    this._updateButton();
    return next;
  }

  getWindowSize() {
    return { ...SIZES[this._size] };
  }
  getCurrentWidth() {
    return SIZES[this._size].width;
  }
  getCurrentSize() {
    return this._size;
  }
  isBigScreen() {
    return this._size === "big";
  }

  _applyBodyClasses(containerClass = "") {
    const isBig = this._size === "big";
    document.body.setAttribute("data-screen-size", this._size);
    document.body.classList.toggle("big-screen", isBig);
    document.body.classList.toggle("small-screen", !isBig);
    if (containerClass) {
      const el = document.querySelector(`.${containerClass}`);
      if (el) {
        el.classList.toggle("big-screen", isBig);
        el.classList.toggle("small-screen", !isBig);
      }
    }
  }

  _updateButton() {
    const btn = document.getElementById("fullscreenBtn");
    if (!btn) return;
    const isBig = this._size === "big";
    btn.setAttribute(
      "aria-label",
      isBig ? "Switch to Small Screen" : "Switch to Big Screen",
    );
    btn.setAttribute(
      "data-tooltip",
      isBig ? "tooltipCompress" : "tooltipExpand",
    );
    btn.setAttribute(
      "data-tip",
      window._t?.(isBig ? "tooltipCompress" : "tooltipExpand") ??
        (isBig ? "Compress" : "Expand"),
    );
    const icon = btn.querySelector("i");
    if (icon) icon.className = `fas fa-${isBig ? "compress" : "expand"}`;
  }
}

module.exports = new ScreenSizeManager();
