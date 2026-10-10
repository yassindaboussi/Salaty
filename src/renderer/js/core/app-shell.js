"use strict";

// Start-up shared by every page of the main window (each page's entry file calls startPage):
// saved settings, theme and text direction, the adhan overlay and fasting reminders, then the
// page itself, the window buttons, the mini player and the tooltips.
const { ipcRenderer } = require("electron");
const { applyLanguageDirection, applyTranslations } = require("./i18n");
const { loadSettings } = require("./bootstrap");
const { state } = require("./store");
const { applyTheme } = require("./theme");
const screenSizeManager = require("./screen-size");
const { initTooltipSystem } = require("./tooltips");
const { setupMiniPlayer } = require("../components/mini-player");
const { renderPageHeaders } = require("../components/page-header");
const { initAdhanPlayer } = require("../components/adhan-player");
const { initFastingReminderListener } = require("../services/fasting-reminder");
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
      el.getAttribute?.("role") !== "button" ||
      el.matches("button, a, input, select, textarea")
    )
      return;
    e.preventDefault();
    el.click();
  });
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
  document.querySelectorAll("[data-window-action]").forEach((btn) => {
    btn.addEventListener("click", () =>
      ipcRenderer.invoke(WINDOW_ACTIONS[btn.dataset.windowAction]),
    );
  });
  document.querySelectorAll("[data-back]").forEach((btn) => {
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
    await loadSettings();
    applyTheme(state.settings.theme || "navy");
    applyLanguageDirection();
    applyTranslations();

    initAdhanPlayer();
    initFastingReminderListener();

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
