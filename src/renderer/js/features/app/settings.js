// src/renderer/js/settings.js
const { ipcRenderer, shell } = require("electron");
const {
  setupConnectionRecovery,
} = require("../../services/connection-recovery");
const { initSelectLocation } = require("../../services/selectLocation");
const {
  setLanguage,
  t,
  applyLanguageDirection,
} = require("../../core/i18n/translations");
const { state } = require("../../core/globalStore");
const { showToast } = require("../../core/toast");
const { applyTheme } = require("../../core/theme");
const screenSizeManager = require("../../core/screenSize");
const { initLocationManagementUI } = require("../../ui/locationManagementUI");
const analytics = require("../../utils/analytics");

let pendingTheme = "navy";

function initSettingsPage() {
  // ── Custom number-spinner buttons (± controls) ──────────────────────────
  document.querySelectorAll(".num-spinner-btn").forEach((btn) => {
    // Single click
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

    // Hold-to-repeat: accelerates after 600 ms hold
    let holdTimer = null;
    let repeatTimer = null;
    const startHold = () => {
      holdTimer = setTimeout(() => {
        repeatTimer = setInterval(() => btn.click(), 80);
      }, 600);
    };
    const stopHold = () => {
      clearTimeout(holdTimer);
      clearInterval(repeatTimer);
    };
    btn.addEventListener("mousedown", startHold);
    btn.addEventListener("mouseup", stopHold);
    btn.addEventListener("mouseleave", stopHold);
    btn.addEventListener("touchstart", startHold, { passive: true });
    btn.addEventListener("touchend", stopHold);
  });

  // Setup auto-reload on connection restored
  setupConnectionRecovery(() => {
    initSettingsPage();
  }, "Settings");
  initSelectLocation((location) => {
    if (!location?.country || !location?.city) return;
    state.settings.country = location.country;
    state.settings.city = location.city;
    persistSettings();
  });
  initLocationManagementUI();
  initAboutSection();

  // Setup back button
  const backBtn = document.getElementById("backBtn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      ipcRenderer.invoke("go-back");
    });
  }

  // Sync pendingTheme with current theme
  pendingTheme = state.settings.theme || "navy";

  // Initialize all components
  updateAllText();
  initThemeSelection();
  initLanguageSelection();
  initAthkarAlerts();
  initPreAdhanNotification();
  initTravelModeToggle();
  initScreenSizeSetting();
  initTestPopupButtons();
}

/**
 * Update all text elements with translations
 */
function updateAllText() {
  const textElements = {
    // Header
    settingsTitle: "settings",

    // Location Section
    locationSectionTitle: "location",
    countryLabel: "country",
    cityLabel: "city",
    detectLocationLabel: "detectLocation",
    manageLocationsLabel: "manageLocationsLabel",
    travelModeLabel: "travelModeLabel",
    travelModeDescription: "travelModeDescription",

    // Appearance Section
    appearanceSectionTitle: "appearance",
    themeLabel: "theme",
    languageLabel: "language",
    screenSizeSettingLabel: "screenSizeSettingLabel",
    smallScreenLabel: "fullScreen",
    bigScreenLabel: "bigScreen",

    // Notifications Section
    notificationsSectionTitle: "notification",
    athkarAlertsLabel: "athkarAlerts",
    enableAthkarAlertsLabel: "enableAthkarAlerts",
    minutesLabel: "minutes",
    preAdhanNotificationLabel: "preAdhanNotification",
    enablePreAdhanNotificationLabel: "enablePreAdhanNotification",
    minutesLabel2: "minutes",

    // Footer
    footerText: "madeWith",

    // Add/Edit Location Modal - ADD THESE NEW ENTRIES
    addLocationBtn: "addNewLocation",
    addEditLocationTitle: "addLocation",
    locationNameLabel: "locationNameLabel",
    locationCountryLabel: "locationCountryLabel",
    locationCityLabel: "locationCityLabel",
    favoriteLabel: "favoriteLabel",
    favoriteDescription: "favoriteDescription",
    cancelLabel: "cancelLabel",
    saveLocationLabel: "saveLocationLabel",

    // About Section static labels
    aboutSectionTitle: "aboutTitle",
    aboutCheckLabel: "checkForUpdates",
    aboutInstallLabel: "restartAndInstall",
    aboutTagline: "aboutTagline",
    aboutGithubLabel: "viewOnGithub",
  };

  for (const [id, key] of Object.entries(textElements)) {
    const element = document.getElementById(id);
    if (element) {
      if (id === "footerText") {
        element.innerHTML = t(key);
      } else {
        element.textContent = t(key);
      }
    }
  }

  // About status text: only reset to "up to date" when idle (not mid-download/error)
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

  // Update theme names
  updateThemeNames();

  // Update language names
  updateLanguageNames();

  // Refresh tooltip text for any data-tooltip buttons on this page
  if (typeof window.updateTooltips === "function") window.updateTooltips();
}

/**
 * Initialize theme selection
 */
function initThemeSelection() {
  const themeContainer = document.getElementById("themeOptions");
  if (!themeContainer) return;

  const themeCards = themeContainer.querySelectorAll(".theme-card");

  themeCards.forEach((card) => {
    const theme = card.dataset.theme;

    // Update theme name
    const nameElement = card.querySelector(".theme-name");
    if (nameElement) {
      nameElement.textContent = t(theme, "themes");
    }

    // Mark selected theme
    if (theme === pendingTheme) {
      card.classList.add("selected");
    } else {
      card.classList.remove("selected");
    }

    // Add click handler
    card.addEventListener("click", () => {
      pendingTheme = theme;
      state.settings.theme = theme;

      // Update visual selection
      themeCards.forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");

      // Apply theme preview
      applyTheme(pendingTheme);

      // Persist immediately — theme is a simple preference, not a form
      // field that needs review before saving.
      persistSettings();
    });
  });
}

/**
 * Update theme names with translations
 */
function updateThemeNames() {
  const themeCards = document.querySelectorAll(".theme-card");
  themeCards.forEach((card) => {
    const theme = card.dataset.theme;
    const nameElement = card.querySelector(".theme-name");
    if (nameElement && theme) {
      nameElement.textContent = t(theme, "themes");
    }
  });
}

/**
 * Update language card names based on current language
 */
function updateLanguageNames() {
  const langNameEn = document.getElementById("langNameEn");
  const langNameAr = document.getElementById("langNameAr");
  const langNameFr = document.getElementById("langNameFr");

  if (langNameEn) langNameEn.textContent = t("englishLanguage");
  if (langNameAr) langNameAr.textContent = t("arabicLanguage");
  if (langNameFr) langNameFr.textContent = t("frenchLanguage");
}

/**
 * Initialize language selection
 */
function initLanguageSelection() {
  const languageContainer = document.getElementById("languageOptions");
  if (!languageContainer) return;

  const languageCards = languageContainer.querySelectorAll(".language-card");

  languageCards.forEach((card) => {
    // Mark selected language
    if (card.dataset.lang === state.settings.language) {
      card.classList.add("selected");
    } else {
      card.classList.remove("selected");
    }

    // Add click handler
    card.addEventListener("click", () => {
      const newLang = card.dataset.lang;
      state.settings.language = newLang;
      setLanguage(newLang);

      // Update visual selection
      languageCards.forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");

      // Apply language direction and update UI
      applyLanguageDirection();
      updateAllText();

      // Persist immediately
      persistSettings();
    });
  });
}

/**
 * Initialize Screen Size card selection
 */
function initScreenSizeSetting() {
  const sizeContainer = document.getElementById("screenSizeOptions");
  if (!sizeContainer) return;

  const sizeCards = sizeContainer.querySelectorAll(".size-card");

  // Set initial selection: fullscreen = !bigScreen, big = bigScreen
  sizeCards.forEach((card) => {
    const size = card.dataset.size;
    if (
      (size === "big" && state.settings.bigScreen) ||
      (size === "fullscreen" && !state.settings.bigScreen)
    ) {
      card.classList.add("selected");
    } else {
      card.classList.remove("selected");
    }

    // Add click handler
    card.addEventListener("click", async () => {
      const newSize = card.dataset.size;
      state.settings.bigScreen = newSize === "big";

      // Update visual selection
      sizeCards.forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");

      // Persist immediately and actually resize the window now, instead of
      // waiting for a "Save" click.
      await persistSettings();
      await screenSizeManager.applyScreenSize();
    });
  });
}

/**
 * Initialize Athkar Alerts toggle and settings
 */
function initAthkarAlerts() {
  const toggle = document.getElementById("athkarAlertsToggle");
  const intervalInput = document.getElementById("athkarIntervalInput");
  const container = document.getElementById("athkarIntervalContainer");

  if (!toggle || !intervalInput || !container) return;

  // Set initial values
  toggle.checked = state.settings.athkarAlertEnabled || false;
  intervalInput.value = state.settings.athkarAlertInterval || 30;

  // Update UI based on toggle state
  const updateUI = () => {
    if (toggle.checked) {
      container.classList.add("active");
      intervalInput.disabled = false;
    } else {
      container.classList.remove("active");
      intervalInput.disabled = true;
    }
  };

  // Initial update
  updateUI();

  // Listen for changes
  toggle.addEventListener("change", () => {
    updateUI();
    state.settings.athkarAlertEnabled = toggle.checked;
    persistSettings();
  });

  intervalInput.addEventListener("change", () => {
    const v = parseInt(intervalInput.value);
    state.settings.athkarAlertInterval = isNaN(v) || v < 1 ? 30 : v;
    // Debounced: the +/- spinner can fire this rapidly while held down.
    scheduleAutoSave();
  });
}

/**
 * Initialize Auto-Detect Location (travel mode) toggle.
 * Controls whether the app silently checks the IP-based location on launch
 * and prompts to switch when it differs from the active saved location.
 */
function initTravelModeToggle() {
  const toggle = document.getElementById("travelModeToggle");
  if (!toggle) return;

  // Default to enabled (preserves existing behavior for users who haven't
  // set this yet).
  toggle.checked = state.settings.travelMode !== false;

  // Persist immediately on change. Unlike city/theme/etc., which are part
  // of a form that needs an explicit "Save", a simple on/off toggle is
  // expected to take effect (and be remembered) right away — otherwise
  // navigating back without pressing "Save" silently discards it, which is
  // exactly the bug reported: toggle it off, leave the page, come back,
  // and it looks re-enabled.
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

/**
 * Initialize Pre-Adhan Notification toggle and settings
 */
function initPreAdhanNotification() {
  const toggle = document.getElementById("preAdhanNotificationToggle");
  const minutesInput = document.getElementById("preAdhanMinutesInput");
  const container = document.getElementById("preAdhanMinutesContainer");

  if (!toggle || !minutesInput || !container) return;

  // Set initial values (default to true)
  toggle.checked = state.settings.preAdhanNotificationEnabled !== false;
  minutesInput.value = state.settings.preAdhanMinutes || 5;

  // Update UI based on toggle state
  const updateUI = () => {
    if (toggle.checked) {
      container.classList.add("active");
      minutesInput.disabled = false;
    } else {
      container.classList.remove("active");
      minutesInput.disabled = true;
    }
  };

  // Initial update
  updateUI();

  // Listen for changes
  toggle.addEventListener("change", () => {
    updateUI();
    state.settings.preAdhanNotificationEnabled = toggle.checked;
    persistSettings();
  });

  minutesInput.addEventListener("change", () => {
    const v = parseInt(minutesInput.value);
    state.settings.preAdhanMinutes = isNaN(v) || v < 1 ? 5 : v;
    // Debounced: the +/- spinner can fire this rapidly while held down.
    scheduleAutoSave();
  });
}

/**
 * Initialize test popup buttons (Athkar & Adhan preview) – dev mode only
 */
async function initTestPopupButtons() {
  const isDev = process.argv.includes("--enable-logging");

  const section = document.getElementById("testPopupsSection");
  if (!isDev || !section) return;

  // Reveal the section
  section.style.display = "";

  const athkarBtn = document.getElementById("testAthkarPopupBtn");
  const adhanBtn = document.getElementById("testAdhanPopupBtn");

  if (athkarBtn) {
    athkarBtn.addEventListener("click", () => {
      ipcRenderer.send("show-athkar-popup", {
        theme: pendingTheme || state.settings.theme || "navy",
        title: "Salaty Time · أذكار",
        content: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ",
      });
    });
  }

  if (adhanBtn) {
    adhanBtn.addEventListener("click", () => {
      ipcRenderer.send("show-adhan-popup", {
        theme: pendingTheme || state.settings.theme || "navy",
        title: "Salaty Time · الأذان",
        content: "حان وقت صلاة الفجر",
      });
    });
  }
}

/**
 * Persist the current state.settings to disk immediately. Used by controls
 * that change infrequently (theme, language, screen size, toggles) so the
 * change is never lost, unlike the old flow where navigating away without
 * pressing "Save" silently discarded everything.
 */
async function persistSettings() {
  try {
    await ipcRenderer.invoke("save-settings", state.settings);
    analytics.settingsSaved(state.settings); // ← ANALYTICS
  } catch (err) {
    console.error("Error auto-saving settings:", err);
    analytics.error("settings_autosave", err.message || String(err)); // ← ANALYTICS
    showToast(t("errorSaving"), "error");
  }
}

// Debounced variant for controls that can fire many events in quick
// succession (e.g. holding a +/- spinner button) — coalesces them into a
// single write instead of hammering disk I/O on every tick.
let autoSaveDebounceTimer = null;
function scheduleAutoSave(delay = 500) {
  clearTimeout(autoSaveDebounceTimer);
  autoSaveDebounceTimer = setTimeout(persistSettings, delay);
}

module.exports = {
  initSettingsPage,
};

// ─────────────────────────────────────────────────────────────────────────────
// About Section — version display + manual update check
// ─────────────────────────────────────────────────────────────────────────────

async function initAboutSection() {
  // Display current version
  try {
    const version = await ipcRenderer.invoke("get-app-version");
    const versionEl = document.getElementById("appVersionDisplay");
    if (versionEl) versionEl.textContent = `v${version}`;
  } catch (_) {}

  const statusIcon = document.getElementById("aboutStatusIcon");
  const statusText = document.getElementById("aboutStatusText");
  const checkBtn = document.getElementById("aboutCheckUpdateBtn");
  const checkLabel = document.getElementById("aboutCheckLabel");
  const progressWrap = document.getElementById("aboutProgressWrap");
  const progressFill = document.getElementById("aboutProgressFill");
  const progressText = document.getElementById("aboutProgressText");
  const installBtn = document.getElementById("aboutInstallBtn");
  const installLabel = document.getElementById("aboutInstallLabel");
  const sectionTitle = document.getElementById("aboutSectionTitle");
  const githubBtn = document.getElementById("aboutGithubBtn");
  const contactBtn = document.getElementById("aboutContactBtn");
  const contactIcon = document.getElementById("aboutContactIcon");

  // Apply translated static labels immediately
  if (sectionTitle) sectionTitle.textContent = t("aboutTitle");
  if (statusText) statusText.textContent = t("upToDate");
  if (checkLabel) checkLabel.textContent = t("checkForUpdates");
  if (installLabel) installLabel.textContent = t("restartAndInstall");

  // GitHub link opens in the OS default browser.
  githubBtn?.addEventListener("click", () => {
    shell.openExternal("https://github.com/yassindaboussi/Salaty");
  });

  // Contact email: mailto: links are unreliable (many machines have no
  // default mail client configured), so instead show the address on the
  // button itself and copy it to the clipboard on click — the address is
  // always visible, and the action always does something the user can see.
  if (contactBtn) {
    const email = contactBtn.dataset.email;
    contactBtn.addEventListener("click", async () => {
      try {
        await ipcRenderer.invoke("clipboard-write-text", email);
        showToast(t("emailCopied"), "success");

        // Brief "copied" confirmation directly on the button
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

  // Manual check button
  checkBtn.addEventListener("click", async () => {
    checkBtn.disabled = true;
    setStatus("checking", t("checkingForUpdates"));
    try {
      await ipcRenderer.invoke("check-for-updates-manual");
      // Result arrives via IPC events (update-available / update-not-available / update-error)
    } catch (_) {
      // IPC call itself failed (main process threw before autoUpdater ran)
      setStatus("error", t("updateCheckFailed"));
      checkBtn.disabled = false;
    }
  });

  // Updater events
  ipcRenderer.on("update-available", (_ev, info) => {
    setStatus("available", `v${info.version} ${t("isAvailable")}`);
    checkBtn.disabled = false;
    if (checkLabel) checkLabel.textContent = t("download");
    checkBtn.querySelector("i").className = "fas fa-download";
    checkBtn.onclick = () => {
      ipcRenderer.send("start-download");
      checkBtn.disabled = true;
      setStatus("downloading", t("downloading") + "…");
      progressWrap?.classList.remove("hidden");
    };
  });

  // No update found — show "up to date" immediately instead of waiting 8 seconds
  ipcRenderer.on("update-not-available", () => {
    setStatus("ok", t("upToDate"));
    checkBtn.disabled = false;
  });

  // Updater error forwarded from main process
  ipcRenderer.on("update-error", (_ev, _msg) => {
    setStatus("error", t("updateCheckFailed"));
    checkBtn.disabled = false;
  });

  ipcRenderer.on("download-progress", (_ev, prog) => {
    const pct = Math.round(prog.percent);
    if (progressFill) progressFill.style.width = pct + "%";
    if (progressText) progressText.textContent = pct + "%";
    setStatus("downloading", `${t("downloading")} ${pct}%`);
  });

  ipcRenderer.on("update-downloaded", () => {
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
