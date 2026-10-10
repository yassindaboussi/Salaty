"use strict";

// Home page: today's prayers (components/prayer-times.js), the location switcher, the
// Islamic-events banner, the offline banner and the "update available" dialog.
const { ipcRenderer } = require("electron");
const { t } = require("../core/i18n");
const { state } = require("../core/store");
const screenSizeManager = require("../core/screen-size");
const { revealPage } = require("../core/app-shell");
const {
  loadPrayerTimes,
  updateCurrentAndNextPrayer,
} = require("../components/prayer-times");
const {
  initLocationSwitcher,
  updateLocationSwitcher,
} = require("../components/location-switcher");
const { initOfflineBanner } = require("../components/offline-banner");
const { setupConnectionRecovery } = require("../services/connection-recovery");
const analytics = require("../services/analytics");

let _prayerTick = null;

// The desktop widget toggle. Main owns the open/closed state and announces every change
// ("prayer-widget-state"), so the button also turns off when the widget is closed from its
// own × button, and shows the right state after this page is reloaded.
function initPrayerWidgetButton() {
  const btn = document.getElementById("prayerWidgetBtn");
  if (!btn) return;

  const show = (open) => {
    btn.classList.toggle("widget-toggle-btn--active", open === true);
    btn.setAttribute("aria-pressed", String(open === true));
  };

  // listen first, then ask: no change can slip in between
  ipcRenderer.on("prayer-widget-state", (_e, open) => show(open));
  ipcRenderer.invoke("get-prayer-widget-state").then(show, () => show(false));

  let busy = false;
  btn.addEventListener("click", async () => {
    if (busy) return;
    busy = true;
    try {
      show(await ipcRenderer.invoke("toggle-prayer-widget"));
    } finally {
      busy = false;
    }
  });
}

async function initHomePage() {
  initOfflineBanner();
  initLocationSwitcher();
  initUpdateDialog();
  setupConnectionRecovery(loadPrayerTimes, "Home");

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

  initPrayerWidgetButton();

  document.getElementById("closeEventBanner")?.addEventListener("click", () => {
    document.getElementById("eventsBanner").style.display = "none";
    screenSizeManager.setBannerVisible(false);
  });

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

// "A new version is available" dialog, driven by the auto-updater in main.
function initUpdateDialog() {
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
      messageEl.textContent = t("newVersionAvailable").replace(
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

module.exports = { initHomePage };
