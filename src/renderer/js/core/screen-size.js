"use strict";
const { ipcRenderer } = require("electron");
const { state } = require("./store");
const { updateTooltip } = require("./tooltips");

const WIDTHS = { big: 850, fullscreen: null };
const BANNER_EXTRA_HEIGHT = 72;

// The window's two sizes: "big" (850px wide, fitted to the page) and "fullscreen" (the window
// is maximized). Whether the window is maximized is decided by Windows, so this class never
// sets the mode itself: it asks the main process to maximize or restore and follows
// "window-maximized-changed", which also arrives when the user double-clicks the title bar,
// drags the window, presses Win+Up/Down or uses Snap (see syncWindowState in main-window.js).
class ScreenSizeManager {
  constructor() {
    this._size = "big";
    this._bannerVisible = false;
    this._baseHeight = null;
    this._container = "";
    this._listeners = new Set();
    // set when our own button restores the window: only then is it fitted to the page again
    // (after a Windows restore, e.g. Snap to half the screen, Windows' size is kept)
    this._fitAfterRestore = false;
    ipcRenderer.on("window-maximized-changed", (_e, maximized) =>
      this._onWindowState(maximized === true),
    );
  }

  syncFromSettings() {
    this._size = state.settings?.bigScreen ? "big" : "fullscreen";
  }

  // The size chosen in Settings (state.settings.bigScreen): ask the window to match it.
  async applyScreenSize() {
    const target = state.settings?.bigScreen ? "big" : "fullscreen";
    if (this._size !== target) await this._request(target);
    return this._size === "big";
  }

  initPageScreenSize(containerClass = "") {
    this._container = containerClass;
    this.syncFromSettings();
    this._applyBodyClasses();
    this._updateButton();
  }

  // The expand/compress button.
  async toggleScreenSize(containerClass = this._container) {
    this._container = containerClass;
    const next = this._size === "big" ? "fullscreen" : "big";
    await this._request(next);
    return next;
  }

  isBigScreen() {
    return this._size === "big";
  }

  // Called with the new mode ("big" | "fullscreen") whenever it changes.
  onChange(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

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
    await this._waitForLayoutToSettle();
    await this._fitToContent();
    // Safety net: at a cold boot (especially with the app auto-launching at
    // login alongside other startup programs), the very first layout pass
    // can still land slightly off even after the settle-wait above — a late
    // web-font swap or a prayer-time re-render can nudge row heights after
    // we already measured and resized. Re-measure once more shortly after
    // and correct the window if it drifted, so the content never stays
    // clipped.
    setTimeout(() => this._fitToContent(), 400);
  }

  async _request(size) {
    if (size === "fullscreen") {
      this._fitAfterRestore = false;
      await ipcRenderer.invoke("maximize-window");
    } else {
      this._fitAfterRestore = true;
      await ipcRenderer.invoke("unmaximize-window");
    }
  }

  // The window was maximized or restored (by us or by Windows).
  _onWindowState(maximized) {
    const size = maximized ? "fullscreen" : "big";
    if (state.settings) state.settings.bigScreen = !maximized;
    const fit = !maximized && this._fitAfterRestore;
    this._fitAfterRestore = false;
    if (size !== this._size) {
      this._size = size;
      this._baseHeight = null;
      this._applyBodyClasses();
      this._updateButton();
      for (const listener of this._listeners) listener(size);
    }
    if (fit) this._fitWhenSettled();
  }

  // Fits the window once the page has its final size: coming back from the full-screen
  // layout, elements still animate to their smaller size (transition: all …), and measuring
  // during that animation would cut off the bottom of the page.
  async _fitWhenSettled() {
    await this._waitForLayoutToSettle();
    const transitions = document
      .getAnimations()
      .filter((a) => a instanceof CSSTransition);
    await Promise.race([
      Promise.allSettled(transitions.map((a) => a.finished)),
      new Promise((resolve) => setTimeout(resolve, 1000)), // never wait longer
    ]);
    await this._fitToContent();
  }

  // A flat, short delay before measuring the page's height is unreliable:
  // it works fine on a warm launch, but at boot — especially with the app
  // auto-launching at login alongside a dozen other startup programs — web
  // fonts and layout can easily take longer than that to settle. Measuring
  // too early produces an undersized window that clips content (e.g. the
  // last prayer row) until the user manually resizes it. Instead, wait for
  // fonts to actually finish loading, then give the browser a couple of
  // paint frames to apply the final layout before measuring anything.
  async _waitForLayoutToSettle() {
    try {
      if (document.fonts && document.fonts.status !== "loaded") {
        await Promise.race([
          document.fonts.ready,
          new Promise((resolve) => setTimeout(resolve, 1500)), // hard cap
        ]);
      }
    } catch {
      // document.fonts unsupported or rejected — fall through to the
      // frame-based settle below, which still helps on its own.
    }

    // A window that has not been shown yet (the app starts hidden and shows itself once the
    // page is ready) may get about one frame per second: never wait more than 50 ms for
    // frames, which a visible window delivers in ~30 ms (measured: up to 1 s lost otherwise).
    // The measurements that follow read the layout directly, which is always up to date.
    await Promise.race([
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
      new Promise((resolve) => setTimeout(resolve, 50)),
    ]);
  }

  // Fits the big window to the home page's content (other pages: the default height).
  // Nothing to fit while maximized.
  async _fitToContent() {
    if (this._size !== "big") return;
    const prayerList = document.getElementById("prayerList");
    const header = document.querySelector(".header");
    const banner = document.getElementById("eventsBanner");
    const cards = document.getElementById("prayerCards");

    if (!prayerList || !(header instanceof HTMLElement) || !cards) {
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
      const padTop = parseFloat(cs.paddingTop) || 0;
      const padBottom = parseFloat(cs.paddingBottom) || 16;
      h += padTop + prayerList.offsetHeight + padBottom;
    } else {
      h += prayerList.offsetHeight + 16;
    }

    h += 4;

    const height = Math.ceil(h);
    this._baseHeight = height - (this._bannerVisible ? BANNER_EXTRA_HEIGHT : 0);

    await ipcRenderer.invoke("resize-window", WIDTHS.big, height);
  }

  async _sendResize() {
    if (this._size !== "big") return;
    const base = this._baseHeight || 560;
    const height = base + (this._bannerVisible ? BANNER_EXTRA_HEIGHT : 0);
    await ipcRenderer.invoke("resize-window", WIDTHS.big, height);
  }

  _applyBodyClasses() {
    const isBig = this._size === "big";
    document.body.setAttribute("data-screen-size", this._size);
    document.body.classList.toggle("big-screen", isBig);
    document.body.classList.toggle(
      "fullscreen-mode",
      this._size === "fullscreen",
    );
    if (this._container) {
      const el = document.querySelector(`.${this._container}`);
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
    btn.setAttribute(
      "data-tooltip",
      isBig ? "tooltipExpand" : "tooltipCompress",
    );
    updateTooltip(btn); // tooltip text + the button's (translated) name
    const icon = btn.querySelector("i");
    if (icon) icon.className = `fas fa-${isBig ? "expand" : "compress"}`;
  }
}

module.exports = new ScreenSizeManager();
