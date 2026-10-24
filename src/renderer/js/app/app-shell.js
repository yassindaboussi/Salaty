"use strict";

// Start-up shared by every page of the main window (each page's entry file calls startPage):
// saved settings, theme and text direction, the adhan overlay and fasting reminders, then the
// page itself, the window buttons, the mini player and the tooltips.
require("../core/error-watch"); // first: errors while the page starts are logged too
const { ipcRenderer } = require("electron");
const { applyLanguageDirection, applyTranslations } = require("../core/i18n");
const { loadSettings } = require("../core/bootstrap");
const { state } = require("../core/store");
const { applyTheme } = require("../core/theme");
const screenSizeManager = require("../core/screen-size");
const { queryAll } = require("../core/dom");
const { initTooltipSystem } = require("../core/tooltips");
const { setupMiniPlayer } = require("../components/mini-player");
const { renderPageHeaders } = require("../components/page-header");
const { initAdhanPlayer } = require("../components/adhan-player");
const analytics = require("../services/analytics");

const revealPage = () => document.body.classList.remove("page-loading");

// Big window <-> full screen. `container` is the page's root class, which gets the size classes.
// Clickable cards that are not <button>s carry role="button" tabindex="0": Enter and Space
// activate them like a real button.
function setupKeyboardActivation() {
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const el = e.target;
    if (
      !(el instanceof HTMLElement) ||
      el.getAttribute("role") !== "button" ||
      el.matches("button, a, input, select, textarea")
    )
      return;
    e.preventDefault();
    el.click();
  });
}

// Windows fades the title bar of a window that is not the active one; ours does the same
// (02-layout/window.css). The main process reports the changes, and the state as soon as the
// page has loaded; until then document.hasFocus() is the best guess.
function trackWindowFocus() {
  /** @param {boolean} focused */
  const show = (focused) =>
    document.documentElement.classList.toggle("window-inactive", !focused);
  show(document.hasFocus());
  ipcRenderer.on("window-focus-changed", (_e, focused) =>
    show(focused === true),
  );
}

function setupScreenSizeToggle(container) {
  screenSizeManager.initPageScreenSize(container);
  document.getElementById("fullscreenBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    screenSizeManager.toggleScreenSize(container);
  });
}

// Header buttons that work the same on every page (components/page-header.js marks them):
// minimize / close the window, and back buttons that only open another page.
function setupHeaderButtons() {
  const WINDOW_ACTIONS = { minimize: "minimize-window", close: "close-window" };
  queryAll("[data-window-action]", HTMLElement).forEach((btn) => {
    btn.addEventListener("click", () =>
      ipcRenderer.invoke(WINDOW_ACTIONS[btn.dataset.windowAction]),
    );
  });
  queryAll("[data-back]", HTMLElement).forEach((btn) => {
    const target = btn.dataset.back;
    btn.addEventListener("click", () =>
      target === "home"
        ? ipcRenderer.invoke("go-back")
        : ipcRenderer.invoke("navigate-to", target),
    );
  });
}

/**
 * @param {object}   options
 * @param {Function} options.init        the page's own set-up
 * @param {string}  [options.screenSize] root class for the big/full-screen toggle; leave it out
 *                                       when the page handles its fullscreen buttons itself
 * @param {string}  [options.feature]    name recorded as "feature opened" (usage statistics)
 * @param {boolean} [options.awaitInit]  wait for init before showing the page (the home page
 *                                       reveals itself as soon as its frame is ready)
 * @param {boolean} [options.miniPlayer] show the floating mini player (pages with their own
 *                                       player controls turn it off)
 */
async function startPage({
  init,
  screenSize,
  feature,
  awaitInit = false,
  miniPlayer = true,
}) {
  try {
    // before the first await: listening by the time the page finishes loading
    trackWindowFocus();
    await loadSettings();
    applyTheme(state.settings.theme || "navy");
    applyLanguageDirection();
    applyTranslations();

    initAdhanPlayer();

    renderPageHeaders();
    setupHeaderButtons();
    setupKeyboardActivation();
    if (screenSize) setupScreenSizeToggle(screenSize);
    if (feature) analytics.featureOpen(feature);

    if (awaitInit) await init();
    else init();
    revealPage();

    if (miniPlayer) setupMiniPlayer();
    initTooltipSystem();

    ipcRenderer.send("app-ready");
  } catch (err) {
    analytics.error("renderer_init", err.message ?? String(err));
    console.error("[Renderer]", err);
    revealPage();
    ipcRenderer.send("app-ready");
  }
}

function onDomReady(fn) {
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", fn);
  else fn();
}

// Entry files call this: runs startPage once the page's HTML is parsed.
function startPageWhenReady(options) {
  onDomReady(() => startPage(options));
}

module.exports = { startPageWhenReady, revealPage };
