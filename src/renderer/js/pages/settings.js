"use strict";

const { ipcRenderer } = require("electron");
const { setupConnectionRecovery } = require("../services/connection-recovery");
const { initSelectLocation } = require("../components/location-picker");
const {
  setLanguage,
  t,
  applyTranslations,
  applyLanguageDirection,
} = require("../core/i18n");
const { state } = require("../core/store");
const { showToast } = require("../core/toast");
const { applyTheme } = require("../core/theme");
const { refreshTooltips } = require("../core/tooltips");
const screenSizeManager = require("../core/screen-size");
const { initLocationManagementUI } = require("../components/location-manager");
const analytics = require("../services/analytics");

let pendingTheme = "navy";

function initSettingsPage() {
  document.querySelectorAll(".num-spinner-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      const delta = parseInt(btn.dataset.delta, 10);
      const min = parseFloat(input.min ?? "-Infinity");
      const max = parseFloat(input.max ?? "Infinity");
      const next = Math.min(
        max,
        Math.max(min, (parseFloat(input.value) || 0) + delta),
      );
      input.value = next;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    // Holding the button repeats it. A touch also fires mousedown, so a new hold first
    // clears the previous one (otherwise the first interval would never be stopped).
    let holdTimer = null;
    let repeatTimer = null;
    const stopHold = () => {
      clearTimeout(holdTimer);
      clearInterval(repeatTimer);
      holdTimer = null;
      repeatTimer = null;
    };
    const startHold = () => {
      stopHold();
      holdTimer = setTimeout(() => {
        repeatTimer = setInterval(() => btn.click(), 80);
      }, 600);
    };
    btn.addEventListener("mousedown", startHold);
    btn.addEventListener("mouseup", stopHold);
    btn.addEventListener("mouseleave", stopHold);
    btn.addEventListener("touchstart", startHold, { passive: true });
    btn.addEventListener("touchend", stopHold);
    btn.addEventListener("touchcancel", stopHold);
  });

  const locationPicker = initSelectLocation((location) => {
    if (!location?.country || !location?.city) return;
    state.settings.country = location.country;
    state.settings.city = location.city;
    persistSettings();
  });
  // Only the country/city lists come from the network. Re-running the whole init here would
  // add every listener twice and fail on the already-created Tom Select pickers.
  setupConnectionRecovery(async () => {
    const picker = await locationPicker;
    await picker?.reloadIfEmpty();
  }, "Settings");
  initLocationManagementUI();
  initAboutSection();

  pendingTheme = state.settings.theme || "navy";

  updateAllText();
  initThemeSelection();
  initLanguageSelection();
  initAthkarAlerts();
  initPreAdhanNotification();
  initTravelModeToggle();
  initAnalyticsToggle();
  initScreenSizeSetting();
}

// Usage statistics are opt-in (PRIVACY.md): off unless the user has turned them on here.
function initAnalyticsToggle() {
  const toggle = document.getElementById("analyticsToggle");
  if (!toggle) return;

  toggle.checked = state.settings.analyticsEnabled === true;
  toggle.addEventListener("change", () => {
    state.settings.analyticsEnabled = toggle.checked;
    persistSettings();
  });
}

function updateAllText() {
  applyTranslations(); // every [data-i18n] text on the page (they follow the language switch)

  const aboutStatusEl = document.getElementById("aboutStatusText");
  const aboutIconEl = document.getElementById("aboutStatusIcon");
  if (aboutStatusEl && aboutIconEl) {
    const isIdle =
      aboutIconEl.classList.contains("fa-circle-check") &&
      !aboutIconEl.classList.contains("checking") &&
      !aboutIconEl.classList.contains("available") &&
      !aboutIconEl.classList.contains("error");
    if (isIdle) aboutStatusEl.textContent = t("upToDate");
  }

  refreshTooltips();
}

function initThemeSelection() {
  const themeContainer = document.getElementById("themeOptions");
  if (!themeContainer) return;

  const themeCards = themeContainer.querySelectorAll(".theme-card");

  themeCards.forEach((card) => {
    const theme = card.dataset.theme;

    if (theme === pendingTheme) {
      card.classList.add("selected");
    } else {
      card.classList.remove("selected");
    }

    card.addEventListener("click", () => {
      pendingTheme = theme;
      state.settings.theme = theme;
      state.settings.themeChosen = true; // the seasonal Ramadan theme then leaves it alone

      themeCards.forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");

      applyTheme(pendingTheme);

      persistSettings();
    });
  });
}

function initLanguageSelection() {
  const languageContainer = document.getElementById("languageOptions");
  if (!languageContainer) return;

  const languageCards = languageContainer.querySelectorAll(".language-card");

  languageCards.forEach((card) => {
    if (card.dataset.lang === state.settings.language) {
      card.classList.add("selected");
    } else {
      card.classList.remove("selected");
    }

    card.addEventListener("click", () => {
      const newLang = card.dataset.lang;
      state.settings.language = newLang;
      setLanguage(newLang);

      languageCards.forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");

      applyLanguageDirection();
      updateAllText();

      persistSettings();
    });
  });
}

function initScreenSizeSetting() {
  const sizeContainer = document.getElementById("screenSizeOptions");
  if (!sizeContainer) return;

  const sizeCards = sizeContainer.querySelectorAll(".size-card");

  const showSelected = () => {
    const current = state.settings.bigScreen ? "big" : "fullscreen";
    sizeCards.forEach((c) =>
      c.classList.toggle("selected", c.dataset.size === current),
    );
  };
  showSelected();
  // also when the window is maximized/restored another way (title-bar double-click, Snap…)
  screenSizeManager.onChange(showSelected);

  sizeCards.forEach((card) => {
    card.addEventListener("click", async () => {
      const newSize = card.dataset.size;
      state.settings.bigScreen = newSize === "big";

      sizeCards.forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");

      await persistSettings();
      await screenSizeManager.applyScreenSize();
    });
  });
}

function initAthkarAlerts() {
  const toggle = document.getElementById("athkarAlertsToggle");
  const intervalInput = document.getElementById("athkarIntervalInput");
  const container = document.getElementById("athkarIntervalContainer");

  if (!toggle || !intervalInput || !container) return;

  toggle.checked = state.settings.athkarAlertEnabled || false;
  intervalInput.value = state.settings.athkarAlertInterval || 30;

  const updateUI = () => {
    if (toggle.checked) {
      container.classList.add("active");
      intervalInput.disabled = false;
    } else {
      container.classList.remove("active");
      intervalInput.disabled = true;
    }
  };

  updateUI();

  toggle.addEventListener("change", () => {
    updateUI();
    state.settings.athkarAlertEnabled = toggle.checked;
    persistSettings();
  });

  intervalInput.addEventListener("change", () => {
    const v = parseInt(intervalInput.value);
    state.settings.athkarAlertInterval = isNaN(v) || v < 1 ? 30 : v;
    scheduleAutoSave();
  });
}

function initTravelModeToggle() {
  const toggle = document.getElementById("travelModeToggle");
  if (!toggle) return;

  toggle.checked = state.settings.travelMode === true;

  toggle.addEventListener("change", async () => {
    state.settings.travelMode = toggle.checked;
    try {
      await ipcRenderer.invoke("toggle-travel-mode", toggle.checked);
      showToast(
        toggle.checked ? t("travelModeEnabled") : t("travelModeDisabled"),
        "success",
      );
    } catch (err) {
      console.error("Failed to save travel mode setting:", err);
      analytics.error("travel_mode_toggle", err.message || String(err));
    }
  });
}

function initPreAdhanNotification() {
  const toggle = document.getElementById("preAdhanNotificationToggle");
  const minutesInput = document.getElementById("preAdhanMinutesInput");
  const container = document.getElementById("preAdhanMinutesContainer");

  if (!toggle || !minutesInput || !container) return;

  toggle.checked = state.settings.preAdhanNotificationEnabled !== false;
  minutesInput.value = state.settings.preAdhanMinutes || 5;

  const updateUI = () => {
    if (toggle.checked) {
      container.classList.add("active");
      minutesInput.disabled = false;
    } else {
      container.classList.remove("active");
      minutesInput.disabled = true;
    }
  };

  updateUI();

  toggle.addEventListener("change", () => {
    updateUI();
    state.settings.preAdhanNotificationEnabled = toggle.checked;
    persistSettings();
  });

  minutesInput.addEventListener("change", () => {
    const v = parseInt(minutesInput.value);
    state.settings.preAdhanMinutes = isNaN(v) || v < 1 ? 5 : v;
    scheduleAutoSave();
  });
}

async function persistSettings() {
  try {
    await ipcRenderer.invoke("save-settings", state.settings);
    analytics.settingsSaved(state.settings);
  } catch (err) {
    console.error("Error auto-saving settings:", err);
    analytics.error("settings_autosave", err.message || String(err));
    showToast(t("errorSaving"), "error");
  }
}

let autoSaveDebounceTimer = null;
function scheduleAutoSave(delay = 500) {
  clearTimeout(autoSaveDebounceTimer);
  autoSaveDebounceTimer = setTimeout(persistSettings, delay);
}

module.exports = {
  initSettingsPage,
};

async function initAboutSection() {
  try {
    const version = await ipcRenderer.invoke("get-app-version");
    const versionEl = document.getElementById("appVersionDisplay");
    if (versionEl) versionEl.textContent = `v${version}`;
  } catch (error) {
    console.error("Error fetching app version:", error);
  }

  const statusIcon = document.getElementById("aboutStatusIcon");
  const statusText = document.getElementById("aboutStatusText");
  const checkBtn = document.getElementById("aboutCheckUpdateBtn");
  const checkLabel = document.getElementById("aboutCheckLabel");
  const progressWrap = document.getElementById("aboutProgressWrap");
  const progressFill = document.getElementById("aboutProgressFill");
  const progressText = document.getElementById("aboutProgressText");
  const installBtn = document.getElementById("aboutInstallBtn");
  const githubBtn = document.getElementById("aboutGithubBtn");
  const contactBtn = document.getElementById("aboutContactBtn");
  const contactIcon = document.getElementById("aboutContactIcon");

  if (statusText) statusText.textContent = t("upToDate");

  githubBtn?.addEventListener("click", () => {
    ipcRenderer.invoke(
      "open-external",
      "https://github.com/yassindaboussi/Salaty",
    );
  });

  if (contactBtn) {
    const email = contactBtn.dataset.email;
    contactBtn.addEventListener("click", async () => {
      try {
        await ipcRenderer.invoke("clipboard-write-text", email);
        showToast(t("emailCopied"), "success");

        if (contactIcon) contactIcon.className = "fas fa-check";
        contactBtn.classList.add("copied");
        setTimeout(() => {
          if (contactIcon) contactIcon.className = "fas fa-envelope";
          contactBtn.classList.remove("copied");
        }, 1500);
      } catch (err) {
        console.error("Failed to copy email:", err);
      }
    });
  }

  if (!checkBtn) return;

  function setStatus(type, text) {
    const icons = {
      ok: "fa-circle-check",
      checking: "fa-rotate",
      available: "fa-circle-arrow-down",
      downloading: "fa-circle-arrow-down",
      ready: "fa-bolt-lightning",
      error: "fa-circle-exclamation",
    };
    const colorClass =
      {
        checking: "checking",
        available: "available",
        downloading: "available",
        error: "error",
      }[type] || "";

    if (statusIcon) {
      statusIcon.className =
        `fas ${icons[type] || "fa-circle-check"} about-status-icon ${colorClass}`.trim();
    }
    if (statusText) statusText.textContent = text;
  }

  let isManualCheckInFlight = false;

  const CHECK_TIMEOUT_MS = 20000;
  let checkTimeoutId = null;

  function clearCheckTimeout() {
    if (checkTimeoutId) {
      clearTimeout(checkTimeoutId);
      checkTimeoutId = null;
    }
  }

  function startFreshCheck() {
    isManualCheckInFlight = true;
    checkBtn.disabled = true;
    setStatus("checking", t("checkingForUpdates"));

    clearCheckTimeout();
    checkTimeoutId = setTimeout(() => {
      if (!isManualCheckInFlight) return;
      isManualCheckInFlight = false;
      setStatus("error", t("updateCheckFailed"));
      checkBtn.disabled = false;
    }, CHECK_TIMEOUT_MS);

    ipcRenderer.invoke("check-for-updates-manual").catch(() => {
      clearCheckTimeout();
      isManualCheckInFlight = false;
      setStatus("error", t("updateCheckFailed"));
      checkBtn.disabled = false;
    });
  }

  checkBtn.onclick = startFreshCheck;

  if (window.location.hash === "#check-updates") {
    document
      .getElementById("aboutSection")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    startFreshCheck();
  }

  ipcRenderer.on("update-available", (_ev, info) => {
    clearCheckTimeout();
    isManualCheckInFlight = false;
    analytics.track("update_available", { version: info.version });
    setStatus("available", `v${info.version} ${t("isAvailable")}`);
    checkBtn.disabled = false;
    if (checkLabel) checkLabel.textContent = t("download");
    checkBtn.querySelector("i").className = "fas fa-download";
    checkBtn.onclick = () => {
      ipcRenderer.send("start-download");
      checkBtn.disabled = true;
      setStatus("downloading", `${t("downloading")}…`);
      progressWrap?.classList.remove("hidden");
    };
  });

  ipcRenderer.on("update-not-available", () => {
    clearCheckTimeout();
    isManualCheckInFlight = false;
    setStatus("ok", t("upToDate"));
    checkBtn.disabled = false;
  });

  ipcRenderer.on("update-error", (_ev, message) => {
    clearCheckTimeout();
    console.error("[Updater] Error:", message);
    analytics.error("update_check", message || "unknown");

    progressWrap?.classList.add("hidden");
    checkBtn.onclick = startFreshCheck;
    checkBtn.disabled = false;

    if (isManualCheckInFlight) {
      setStatus("error", t("updateCheckFailed"));
    }
    isManualCheckInFlight = false;
  });

  ipcRenderer.on("download-progress", (_ev, prog) => {
    const pct = Math.round(prog.percent);
    if (progressFill) progressFill.style.width = `${pct}%`;
    if (progressText) progressText.textContent = `${pct}%`;
    setStatus("downloading", `${t("downloading")} ${pct}%`);
  });

  ipcRenderer.on("update-downloaded", () => {
    analytics.track("update_downloaded");
    progressWrap?.classList.add("hidden");
    installBtn?.classList.remove("hidden");
    checkBtn.classList.add("hidden");
    setStatus("ready", t("readyToInstall"));
    installBtn?.addEventListener(
      "click",
      () => ipcRenderer.send("install-update"),
      { once: true },
    );
  });
}
