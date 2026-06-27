"use strict";
// renderer.js — main entry point, shared by every page.

const { ipcRenderer } = require("electron");
const {
  setLanguage,
  t,
  applyLanguageDirection,
} = require("../../js/core/i18n/translations");
const {
  loadPrayerTimes,
  updateCurrentAndNextPrayer,
} = require("../../js/features/worship/prayer");
const { state } = require("../../js/core/globalStore");
const { applyTheme } = require("../../js/core/theme");
const {
  initAthkarAlertsSystem,
} = require("../../js/features/worship/athkarAlerts");
const screenSizeManager = require("../../js/core/screenSize");
const {
  initLocationSwitcher,
  updateLocationSwitcher,
} = require("../../js/ui/locationSwitcher");
const { setupMiniPlayer } = require("../../js/media/mini-player");
const analytics = require("../../js/utils/analytics");
const { initAdhanPlayer } = require("../../js/media/adhan-player");

window._t = t;

// ─── Page reveal ──────────────────────────────────────────────────────────────
// Body starts with class "page-loading" (opacity:0, set in HTML before any JS).
// Call revealPage() once the page is ready to show — triggers a CSS fade-in.
const revealPage = () => document.body.classList.remove("page-loading");

// ─── Screen size ──────────────────────────────────────────────────────────────
function setupScreenSizeForPage(containerClass = "") {
  screenSizeManager.initPageScreenSize(containerClass);
  document.getElementById("fullscreenBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    screenSizeManager.toggleScreenSize(containerClass);
  });
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────
// Settings are fetched ONCE and synchronously applied before any page init.
// We do NOT await screenSizeManager.applyScreenSize() — the window is already
// the right size (main process reads settings before creating the BrowserWindow).
// This removes one full IPC round-trip from the critical path.
async function initializeApp() {
  try {
    // Single IPC call — get settings, apply theme/language immediately.
    const settings = await ipcRenderer.invoke("get-settings");
    if (settings) {
      state.settings = { ...state.settings, ...settings };
      setLanguage(state.settings.language || "en");
      applyTheme(state.settings.theme || "navy");
      applyLanguageDirection();
      screenSizeManager.syncFromSettings(); // sync internal state, no IPC needed
      if (typeof window.reinitializeOfflineBanner === "function") {
        window.reinitializeOfflineBanner();
      }
      initAthkarAlertsSystem();
    }

    initAdhanPlayer();

    // Route to the correct page initialiser.
    const path = window.location.pathname;
    await routePage(path);

    // Global controls — set up after page init so DOM is ready.
    setupWindowControls();
    setupMiniPlayer();
    setupTooltips();

    // Tell main process to show the window (first launch only — ipcMain.once).
    ipcRenderer.send("app-ready");
  } catch (err) {
    analytics.error("renderer_init", err.message ?? String(err));
    console.error("[Renderer]", err);
    revealPage();
    ipcRenderer.send("app-ready");
  }
}

// ─── Page router ─────────────────────────────────────────────────────────────
async function routePage(path) {
  // Lazy-require each page module — only load the code that's actually needed.
  // This is the key performance fix: on the index page we don't require athkar,
  // quran, radio, etc. Each require() reads and executes a file from disk.

  if (path.includes("index.html") || path.endsWith("/")) {
    setupScreenSizeForPage("app");
    await initHomePage(); // async: reveals after prayer data loads
    return;
  }

  if (path.includes("settings.html")) {
    setupScreenSizeForPage("settings-container");
    const { initSettingsPage } = require("../../js/features/app/settings");
    initSettingsPage();
  } else if (path.includes("features.html")) {
    setupScreenSizeForPage("features-container");
    const { initFeaturesPage } = require("../../js/features/app/featuresUI");
    initFeaturesPage();
  } else if (path.includes("quran.html")) {
    analytics.featureOpen("quran");
    const { initQuranPage } = require("../../js/features/worship/quranUI");
    initQuranPage();
  } else if (path.includes("athkar.html")) {
    analytics.featureOpen("athkar");
    setupScreenSizeForPage("athkar-container");
    const { initAthkarPage } = require("../../js/features/worship/athkarUI");
    initAthkarPage();
  } else if (path.includes("ramadan.html")) {
    analytics.featureOpen("ramadan");
    setupScreenSizeForPage("ramadan-container");
    const { initRamadanPage } = require("../../js/features/worship/ramadanUI");
    initRamadanPage();
  } else if (path.includes("qibla.html")) {
    analytics.featureOpen("qibla");
    setupScreenSizeForPage("qibla-container");
    const { initQiblaPage } = require("../../js/features/worship/qibla");
    initQiblaPage();
  } else if (path.includes("asma.html")) {
    analytics.featureOpen("asma");
    setupScreenSizeForPage("asma-container");
    const { initAsmaPage } = require("../../js/features/worship/asmaUI");
    initAsmaPage();
  } else if (path.includes("tasbih.html")) {
    analytics.featureOpen("tasbih");
    setupScreenSizeForPage("tasbih-container");
    const { initTasbihPage } = require("../../js/features/worship/tasbihUI");
    initTasbihPage();
  } else if (path.includes("hijri-calendar.html")) {
    analytics.featureOpen("calendar");
    setupScreenSizeForPage("calendar-container");
    const {
      initHijriCalendar,
    } = require("../../js/features/worship/hijriCalendar");
    initHijriCalendar();
  } else if (path.includes("playlist.html") || path.includes("albums.html")) {
    analytics.featureOpen("playlist");
    setupScreenSizeForPage("playlist-container");
  } else if (path.includes("radio.html")) {
    analytics.featureOpen("radio");
    setupScreenSizeForPage("radio-container");
    const { initRadioPage } = require("../../js/media/radioUI");
    initRadioPage();
  } else if (path.includes("livestreams.html")) {
    analytics.featureOpen("livestreams");
    setupScreenSizeForPage("livestreams-container");
    const { initLiveStreamsPage } = require("../../js/media/livestreamsUI");
    initLiveStreamsPage();
  }

  // Non-home pages reveal immediately — no async data needed before showing.
  revealPage();
}

// ─── Home page ────────────────────────────────────────────────────────────────
let _prayerTick = null;

async function initHomePage() {
  initLocationSwitcher();

  // Navigation — resize then navigate in a single IPC call via 'navigate-to'
  // which the main process handles. No sequential awaits.
  const navigateTo = (page) => {
    // Navigate without forcing a size — the destination page will
    // resize itself (settings/features use current window size).
    ipcRenderer.invoke("navigate-to", page);
  };

  document.getElementById("mainSettingsBtn")?.addEventListener("click", () => {
    analytics.navigation("home", "settings");
    navigateTo("settings");
  });

  document.getElementById("mainFeaturesBtn")?.addEventListener("click", () => {
    analytics.navigation("home", "features");
    navigateTo("features");
  });

  // Widget toggle with busy guard
  let _widgetBusy = false;
  document
    .getElementById("prayerWidgetBtn")
    ?.addEventListener("click", async () => {
      if (_widgetBusy) return;
      _widgetBusy = true;
      try {
        const isOpen = await ipcRenderer.invoke("toggle-prayer-widget");
        document
          .getElementById("prayerWidgetBtn")
          ?.classList.toggle("widget-toggle-btn--active", isOpen);
      } finally {
        _widgetBusy = false;
      }
    });

  // Banner close
  document.getElementById("closeEventBanner")?.addEventListener("click", () => {
    document.getElementById("eventsBanner").style.display = "none";
    screenSizeManager.setBannerVisible(false);
  });

  // Set loading text
  const loadingEl = document.getElementById("loadingText");
  if (loadingEl) loadingEl.textContent = t("loadingPrayerTimes");

  // Reveal the page immediately with the loading state visible —
  // the user sees the skeleton UI instead of a blank/invisible window.
  revealPage();

  // Fetch prayer data in the background. The page is already visible.
  await loadPrayerTimes();

  // Render prayer cards FIRST (updateCurrentAndNextPrayer fills #prayerCards),
  // THEN measure — otherwise cards=20px (empty placeholder height).
  if (_prayerTick) clearInterval(_prayerTick);
  _prayerTick = setInterval(updateCurrentAndNextPrayer, 1000);
  updateCurrentAndNextPrayer();

  // Now ALL content is rendered. Measure and resize to fit perfectly.
  await screenSizeManager.forceApplyScreenSize();

  // Location-change events (from settings save or location switcher)
  ipcRenderer.removeAllListeners("location-changed");
  ipcRenderer.on("location-changed", async () => {
    try {
      const fresh = await ipcRenderer.invoke("get-settings");
      if (fresh) state.settings = { ...state.settings, ...fresh };
      await loadPrayerTimes();
      await updateLocationSwitcher();
    } catch (e) {
      console.error("[Home] location-changed", e);
    }
  });
}

// ─── Window controls ──────────────────────────────────────────────────────────
function setupWindowControls() {
  document
    .getElementById("minimizeBtn")
    ?.addEventListener("click", () => ipcRenderer.invoke("minimize-window"));
  document
    .getElementById("closeBtn")
    ?.addEventListener("click", () => ipcRenderer.invoke("close-window"));

  // Update modal — only wire up if it exists on this page
  const modal = document.getElementById("updateModal");
  if (!modal) return;

  const titleEl = document.getElementById("updateTitle");
  const messageEl = document.getElementById("updateMessage");
  const actionBtn = document.getElementById("updateActionBtn");
  const cancelBtn = document.getElementById("updateCancelBtn");
  const progressWrap = document.getElementById("updateProgress");
  const progressFill = document.getElementById("updateProgressBar");
  const progressText = document.getElementById("updateProgressText");
  let downloaded = false;

  cancelBtn?.addEventListener("click", () => modal.classList.remove("show"));
  actionBtn?.addEventListener("click", () => {
    if (!downloaded) {
      ipcRenderer.send("start-download");
      if (actionBtn) actionBtn.disabled = true;
      if (cancelBtn) cancelBtn.style.display = "none";
      if (progressWrap) progressWrap.classList.remove("hidden");
    } else {
      ipcRenderer.send("install-update");
    }
  });

  ipcRenderer.on("update-available", (_e, info) => {
    downloaded = false;
    if (titleEl) titleEl.textContent = t("updateAvailable");
    if (messageEl)
      messageEl.textContent = (t("newVersionAvailable") || "").replace(
        "{version}",
        info.version,
      );
    if (actionBtn) {
      actionBtn.textContent = t("download");
      actionBtn.disabled = false;
    }
    if (cancelBtn) {
      cancelBtn.style.display = "block";
      cancelBtn.textContent = t("later");
    }
    if (progressWrap) progressWrap.classList.add("hidden");
    modal.classList.add("show");
  });
  ipcRenderer.on("download-progress", (_e, { percent }) => {
    const pct = Math.round(percent);
    if (progressWrap) progressWrap.classList.remove("hidden");
    if (progressFill) progressFill.style.width = `${pct}%`;
    if (progressText) progressText.textContent = `${pct}%`;
  });
  ipcRenderer.on("update-downloaded", () => {
    downloaded = true;
    if (titleEl) titleEl.textContent = t("updateReady");
    if (messageEl) messageEl.textContent = t("updateDownloaded");
    if (actionBtn) {
      actionBtn.textContent = t("install");
      actionBtn.disabled = false;
    }
    if (progressWrap) progressWrap.classList.add("hidden");
    modal.classList.add("show");
  });
}

// ─── Tooltips ─────────────────────────────────────────────────────────────────
function setupTooltips() {
  // Resolve translation keys → data-tip attributes
  document.querySelectorAll("[data-tooltip]").forEach((el) => {
    const text =
      t(el.getAttribute("data-tooltip")) || el.getAttribute("data-tooltip");
    el.setAttribute("data-tip", text);
  });
  window.updateTooltips = () =>
    document.querySelectorAll("[data-tooltip]").forEach((el) => {
      const text =
        t(el.getAttribute("data-tooltip")) || el.getAttribute("data-tooltip");
      el.setAttribute("data-tip", text);
    });

  // Single floating tooltip element — appended to body so overflow:hidden never clips it
  const tip = document.createElement("div");
  tip.id = "appTooltip";
  Object.assign(tip.style, {
    position: "fixed",
    zIndex: "99999",
    pointerEvents: "none",
    opacity: "0",
    transition: "opacity 0.12s ease, transform 0.12s ease",
    transform: "translateX(-50%) scale(0.88)",
    background: "rgba(10,15,35,0.92)",
    backdropFilter: "blur(8px)",
    color: "#fff",
    fontSize: "11px",
    fontWeight: "600",
    letterSpacing: "0.03em",
    whiteSpace: "nowrap",
    padding: "5px 10px",
    borderRadius: "7px",
    border: "1px solid rgba(255,255,255,0.1)",
    boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
  });
  document.body.appendChild(tip);

  const show = (el) => {
    const text = el.getAttribute("data-tip");
    if (!text) return;
    tip.textContent = text;
    const r = el.getBoundingClientRect();
    tip.style.left = `${r.left + r.width / 2}px`;
    tip.style.top = `${r.bottom + 8}px`;
    tip.style.opacity = "1";
    tip.style.transform = "translateX(-50%) scale(1)";
  };
  const hide = () => {
    tip.style.opacity = "0";
    tip.style.transform = "translateX(-50%) scale(0.88)";
  };

  const attach = () => {
    document
      .querySelectorAll("[data-tip]:not([data-tip-bound])")
      .forEach((el) => {
        el.setAttribute("data-tip-bound", "1");
        el.addEventListener("mouseenter", () => show(el));
        el.addEventListener("mouseleave", hide);
        el.addEventListener("click", hide);
      });
  };
  attach();
  new MutationObserver(attach).observe(document.body, {
    childList: true,
    subtree: true,
  });
}

// ─── Entry point ──────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", initializeApp);
