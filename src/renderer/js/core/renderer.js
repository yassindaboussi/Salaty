"use strict";

const { ipcRenderer } = require("electron");
const {
  setLanguage,
  t,
  applyLanguageDirection,
  whenReady,
} = require("../../js/core/i18n/translations");
const {
  loadPrayerTimes,
  updateCurrentAndNextPrayer,
} = require("../../js/features/worship/prayer");
const { state } = require("../../js/core/globalStore");
const { applyTheme } = require("../../js/core/theme");
const screenSizeManager = require("../../js/core/screenSize");
const {
  initLocationSwitcher,
  updateLocationSwitcher,
} = require("../../js/ui/locationSwitcher");
const { initTooltipSystem } = require("../../js/core/tooltipSystem");
const { setupMiniPlayer } = require("../../js/media/mini-player");
const analytics = require("../../js/utils/analytics");
const { initAdhanPlayer } = require("../../js/media/adhan-player");
const {
  initFastingReminderListener,
} = require("../../js/features/worship/fastingReminder");

window._t = t;

const revealPage = () => document.body.classList.remove("page-loading");

function setupScreenSizeForPage(containerClass = "") {
  screenSizeManager.initPageScreenSize(containerClass);
  document.getElementById("fullscreenBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    screenSizeManager.toggleScreenSize(containerClass);
  });
}

async function initializeApp() {
  try {
    await whenReady();

    const settings = await ipcRenderer.invoke("get-settings");
    if (settings) {
      state.settings = { ...state.settings, ...settings };
      setLanguage(state.settings.language || "en");
      applyTheme(state.settings.theme || "navy");
      applyLanguageDirection();
      screenSizeManager.syncFromSettings();
      if (typeof window.reinitializeOfflineBanner === "function") {
        window.reinitializeOfflineBanner();
      }
    }

    initAdhanPlayer();
    initFastingReminderListener();

    const path = window.location.pathname;
    await routePage(path);

    setupWindowControls();
    setupMiniPlayer();
    initTooltipSystem();

    ipcRenderer.send("app-ready");
  } catch (err) {
    analytics.error("renderer_init", err.message ?? String(err));
    console.error("[Renderer]", err);
    revealPage();
    ipcRenderer.send("app-ready");
  }
}

async function routePage(path) {

  if (path.includes("index.html") || path.endsWith("/")) {
    setupScreenSizeForPage("app");
    await initHomePage();
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
  } else if (path.includes("fasting.html")) {
    analytics.featureOpen("fasting");
    setupScreenSizeForPage("fasting-container");
    const { initFastingPage } = require("../../js/features/worship/fastingUI");
    initFastingPage();
  } else if (path.includes("monthly-prayer-times.html")) {
    analytics.featureOpen("monthly-prayer-times");
    setupScreenSizeForPage("mpt-container");
    const {
      initMonthlyPrayerTimesPage,
    } = require("../../js/features/worship/monthlyPrayerTimesUI");
    initMonthlyPrayerTimesPage();
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

  revealPage();
}

let _prayerTick = null;

async function initHomePage() {
  initLocationSwitcher();

  const navigateTo = (page) => {
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

  document.getElementById("closeEventBanner")?.addEventListener("click", () => {
    document.getElementById("eventsBanner").style.display = "none";
    screenSizeManager.setBannerVisible(false);
  });

  const loadingEl = document.getElementById("loadingText");
  if (loadingEl) loadingEl.textContent = t("loadingPrayerTimes");

  revealPage();

  await loadPrayerTimes();

  if (_prayerTick) clearInterval(_prayerTick);
  _prayerTick = setInterval(updateCurrentAndNextPrayer, 1000);
  updateCurrentAndNextPrayer();

  await screenSizeManager.forceApplyScreenSize();

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

function setupWindowControls() {
  document
    .getElementById("minimizeBtn")
    ?.addEventListener("click", () => ipcRenderer.invoke("minimize-window"));
  document
    .getElementById("closeBtn")
    ?.addEventListener("click", () => ipcRenderer.invoke("close-window"));

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


document.addEventListener("DOMContentLoaded", initializeApp);
