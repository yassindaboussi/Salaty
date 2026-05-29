// livestreams.js - Live Haramain Streams
const { ipcRenderer } = require("electron");
const { setupConnectionRecovery } = require("../services/connection-recovery");
const { t } = require("../core/i18n/translations");
const screenSizeManager = require("../core/screenSize");
const analytics = require("../utils/analytics");

// Stream sources — keep here so we can restore them when switching tabs
const STREAM_SOURCES = {
  makkah: "https://makkahlive.netlify.app/makkah",
  madina: "https://makkahlive.netlify.app/madina",
};

function initLiveStreamsPage() {
  // Setup auto-reload on connection restored
  setupConnectionRecovery(() => {
    loadLiveStreams();
  }, "Livestreams");
  updateStreamsUI();

  // Back button
  const backBtn = document.getElementById("backBtn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      stopAllStreams();
      const currentSize = screenSizeManager.getWindowSize();
      ipcRenderer.invoke(
        "navigate-to",
        "features",
        currentSize.width,
        currentSize.height,
      );
    });
  }

  // Window close button — also stop streams
  const closeBtn = document.getElementById("closeBtn");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      stopAllStreams();
    });
  }

  initTabs();

  // Load only the first (active) stream on startup
  loadStream("makkah");
}

/**
 * Load a stream into its iframe by setting the src attribute.
 * Only the active tab's iframe should ever have a src.
 */
function loadStream(streamKey) {
  const iframe = document.getElementById(`iframe-${streamKey}`);
  if (iframe && !iframe.src.includes(STREAM_SOURCES[streamKey])) {
    iframe.src = STREAM_SOURCES[streamKey];
  }
}

/**
 * Stop a stream by blanking the iframe src.
 * This unloads the page content and stops audio/video.
 */
function stopStream(streamKey) {
  const iframe = document.getElementById(`iframe-${streamKey}`);
  if (iframe) {
    iframe.src = "about:blank";
  }
}

/**
 * Stop every stream (used on navigate-away or close).
 */
function stopAllStreams() {
  Object.keys(STREAM_SOURCES).forEach((key) => stopStream(key));
}

function initTabs() {
  const tabs = document.querySelectorAll(".channel-tab");
  const panels = document.querySelectorAll(".stream-panel");
  const streamKeys = ["makkah", "madina"];

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      const currentIndex = Array.from(tabs).findIndex((t) =>
        t.classList.contains("active"),
      );
      if (currentIndex === index) return; // already on this tab

      // Stop the stream we're leaving
      stopStream(streamKeys[currentIndex]);

      // Animate out current panel
      panels[currentIndex].classList.remove("active");
      panels[currentIndex].classList.add("prev");
      setTimeout(() => panels[currentIndex].classList.remove("prev"), 380);

      // Activate new tab + panel
      tabs.forEach((t) => {
        t.classList.remove("active");
        t.setAttribute("aria-selected", "false");
      });
      tab.classList.add("active");
      tab.setAttribute("aria-selected", "true");
      panels[index].classList.add("active");

      // Load the new stream (only now)
      loadStream(streamKeys[index]);

      // ── Track which stream the user switched to ───────────────────────────
      analytics.livestreamSwitch(streamKeys[index]);
    });
  });
}

function updateStreamsUI() {
  const elements = {
    livestreamsTitle: "livestreamsTitle",
    makkahTitle: "makkahLive",
    madinaTitle: "madinaLive",
    tabMakkahLabel: "makkahTab",
    tabMadinaLabel: "madinaTab",
  };

  // Update text elements that use translation keys
  for (const [id, key] of Object.entries(elements)) {
    const el = document.getElementById(id);
    if (el) {
      const translated = t(key);
      if (translated && translated !== key) el.textContent = translated;
    }
  }

  // Update location sub-texts using the new translation keys
  const makkahLocationSub = document.querySelector(
    "#panelMakkah .stream-location-sub",
  );
  if (makkahLocationSub) {
    makkahLocationSub.textContent = t("makkahLocation");
  }

  const madinaLocationSub = document.querySelector(
    "#panelMadina .stream-location-sub",
  );
  if (madinaLocationSub) {
    madinaLocationSub.textContent = t("madinaLocation");
  }

  // Update Live badge text using the new translation key
  const liveBadges = document.querySelectorAll(".live-text");
  liveBadges.forEach((badge) => {
    badge.textContent = t("live");
  });
}

// Handle language changes
window.addEventListener("languageChanged", () => {
  updateStreamsUI();
});

module.exports = { initLiveStreamsPage };
