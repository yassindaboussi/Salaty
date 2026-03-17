// src/renderer/js/settings.js
const { ipcRenderer } = require('electron');
const { initSelectLocation } = require('./selectLocation');
const { setLanguage, t, applyLanguageDirection } = require('./translations');
const { state } = require('./globalStore');
const { showToast } = require('./toast');
const { applyTheme } = require('./theme');
const screenSizeManager = require('./screenSize');
const { initLocationManagementUI } = require('./locationManagementUI');
const analytics = require('./utils/analytics');

let pendingTheme = 'navy';

function initSettingsPage() {
    initSelectLocation();
    initLocationManagementUI();

    // Setup back button
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            ipcRenderer.invoke('go-back');
        });
    }

    // Setup save button
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveSettings);
    }

    // Sync pendingTheme with current theme
    pendingTheme = state.settings.theme || 'navy';

    // Initialize all components
    updateAllText();
    initThemeSelection();
    initLanguageSelection();
    initAthkarAlerts();
    initPreAdhanNotification();
    initScreenSizeSetting();
    initTestPopupButtons();
}

/**
 * Update all text elements with translations
 */
function updateAllText() {
    const textElements = {
        // Header
        'settingsTitle': 'settings',

        // Location Section
        'locationSectionTitle': 'location',
        'countryLabel': 'country',
        'cityLabel': 'city',
        'detectLocationLabel': 'detectLocation',
        'manageLocationsLabel': 'manageLocationsLabel',

        // Appearance Section
        'appearanceSectionTitle': 'theme',
        'themeLabel': 'theme',
        'languageLabel': 'language',
        'screenSizeSettingLabel': 'screenSizeSettingLabel',
        'smallScreenLabel': 'smallScreen',
        'bigScreenLabel': 'bigScreen',

        // Notifications Section
        'notificationsSectionTitle': 'notification',
        'athkarAlertsLabel': 'athkarAlerts',
        'enableAthkarAlertsLabel': 'enableAthkarAlerts',
        'athkarIntervalLabel': 'athkarInterval',
        'minutesLabel': 'minutes',
        'preAdhanNotificationLabel': 'preAdhanNotification',
        'enablePreAdhanNotificationLabel': 'enablePreAdhanNotification',
        'preAdhanMinutesLabel': 'minutesBeforeAdhan',
        'minutesLabel2': 'minutes',

        'saveBtn': 'save',

        // Footer
        'footerText': 'madeWith',

        // Add/Edit Location Modal - ADD THESE NEW ENTRIES
        'addLocationBtn': 'addNewLocation',
        'addEditLocationTitle': 'addLocation',
        'locationNameLabel': 'locationNameLabel',
        'locationCountryLabel': 'locationCountryLabel',
        'locationCityLabel': 'locationCityLabel',
        'favoriteLabel': 'favoriteLabel',
        'favoriteDescription': 'favoriteDescription',
        'cancelLabel': 'cancelLabel',
        'saveLocationLabel': 'saveLocationLabel'
    };

    for (const [id, key] of Object.entries(textElements)) {
        const element = document.getElementById(id);
        if (element) {
            if (id === 'footerText') {
                element.innerHTML = t(key);
            } else {
                element.textContent = t(key);
            }
        }
    }

    // Update theme names
    updateThemeNames();
}

/**
 * Initialize theme selection
 */
function initThemeSelection() {
    const themeContainer = document.getElementById('themeOptions');
    if (!themeContainer) return;

    const themeCards = themeContainer.querySelectorAll('.theme-card');

    themeCards.forEach(card => {
        const theme = card.dataset.theme;

        // Update theme name
        const nameElement = card.querySelector('.theme-name');
        if (nameElement) {
            nameElement.textContent = t(theme, 'themes');
        }

        // Mark selected theme
        if (theme === pendingTheme) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }

        // Add click handler
        card.addEventListener('click', () => {
            pendingTheme = theme;

            // Update visual selection
            themeCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');

            // Apply theme preview
            applyTheme(pendingTheme);
        });
    });
}

/**
 * Update theme names with translations
 */
function updateThemeNames() {
    const themeCards = document.querySelectorAll('.theme-card');
    themeCards.forEach(card => {
        const theme = card.dataset.theme;
        const nameElement = card.querySelector('.theme-name');
        if (nameElement && theme) {
            nameElement.textContent = t(theme, 'themes');
        }
    });
}

/**
 * Initialize language selection
 */
function initLanguageSelection() {
    const languageContainer = document.getElementById('languageOptions');
    if (!languageContainer) return;

    const languageCards = languageContainer.querySelectorAll('.language-card');

    languageCards.forEach(card => {
        // Mark selected language
        if (card.dataset.lang === state.settings.language) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }

        // Add click handler
        card.addEventListener('click', () => {
            const newLang = card.dataset.lang;
            state.settings.language = newLang;
            setLanguage(newLang);

            // Update visual selection
            languageCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');

            // Apply language direction and update UI
            applyLanguageDirection();
            updateAllText();
        });
    });
}

/**
 * Initialize Screen Size card selection
 */
function initScreenSizeSetting() {
    const sizeContainer = document.getElementById('screenSizeOptions');
    if (!sizeContainer) return;

    const sizeCards = sizeContainer.querySelectorAll('.size-card');

    // Set initial selection
    sizeCards.forEach(card => {
        const size = card.dataset.size;
        if ((size === 'big' && state.settings.bigScreen) ||
            (size === 'small' && !state.settings.bigScreen)) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }

        // Add click handler
        card.addEventListener('click', () => {
            const newSize = card.dataset.size;
            state.settings.bigScreen = (newSize === 'big');

            // Update visual selection
            sizeCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
        });
    });
}

/**
 * Initialize Athkar Alerts toggle and settings
 */
function initAthkarAlerts() {
    const toggle = document.getElementById('athkarAlertsToggle');
    const intervalInput = document.getElementById('athkarIntervalInput');
    const container = document.getElementById('athkarIntervalContainer');

    if (!toggle || !intervalInput || !container) return;

    // Set initial values
    toggle.checked = state.settings.athkarAlertEnabled || false;
    intervalInput.value = state.settings.athkarAlertInterval || 30;

    // Update UI based on toggle state
    const updateUI = () => {
        if (toggle.checked) {
            container.classList.add('active');
            intervalInput.disabled = false;
        } else {
            container.classList.remove('active');
            intervalInput.disabled = true;
        }
    };

    // Initial update
    updateUI();

    // Listen for changes
    toggle.addEventListener('change', updateUI);
}

/**
 * Initialize Pre-Adhan Notification toggle and settings
 */
function initPreAdhanNotification() {
    const toggle = document.getElementById('preAdhanNotificationToggle');
    const minutesInput = document.getElementById('preAdhanMinutesInput');
    const container = document.getElementById('preAdhanMinutesContainer');

    if (!toggle || !minutesInput || !container) return;

    // Set initial values (default to true)
    toggle.checked = state.settings.preAdhanNotificationEnabled !== false;
    minutesInput.value = state.settings.preAdhanMinutes || 5;

    // Update UI based on toggle state
    const updateUI = () => {
        if (toggle.checked) {
            container.classList.add('active');
            minutesInput.disabled = false;
        } else {
            container.classList.remove('active');
            minutesInput.disabled = true;
        }
    };

    // Initial update
    updateUI();

    // Listen for changes
    toggle.addEventListener('change', updateUI);
}

/**
 * Initialize test popup buttons (Athkar & Adhan preview) – dev mode only
 */
async function initTestPopupButtons() {
    const isDev = await ipcRenderer.invoke('is-dev-mode');

    const section   = document.getElementById('testPopupsSection');
    if (!isDev || !section) return;

    // Reveal the section
    section.style.display = '';

    const athkarBtn = document.getElementById('testAthkarPopupBtn');
    const adhanBtn  = document.getElementById('testAdhanPopupBtn');

    if (athkarBtn) {
        athkarBtn.addEventListener('click', () => {
            ipcRenderer.send('show-athkar-popup', {
                theme:   pendingTheme || state.settings.theme || 'navy',
                title:   'Salaty Time · أذكار',
                content: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ'
            });
        });
    }

    if (adhanBtn) {
        adhanBtn.addEventListener('click', () => {
            ipcRenderer.send('show-adhan-popup', {
                theme:   pendingTheme || state.settings.theme || 'navy',
                title:   'Salaty Time · الأذان',
                content: 'حان وقت صلاة الفجر'
            });
        });
    }
}

/**
 * Save all settings
 */
async function saveSettings() {
  const cityInput     = document.getElementById('cityInput');
  const countryInput  = document.getElementById('countryInput');
  const athkarToggle  = document.getElementById('athkarAlertsToggle');
  const athkarInput   = document.getElementById('athkarIntervalInput');
  const preAdhanToggle = document.getElementById('preAdhanNotificationToggle');
  const preAdhanInput = document.getElementById('preAdhanMinutesInput');
  const selectedSizeCard = document.querySelector('.size-card.selected');
  const selectedSize  = selectedSizeCard ? selectedSizeCard.dataset.size : 'small';

  const city    = cityInput    ? cityInput.value.trim()    : '';
  const country = countryInput ? countryInput.value.trim() : '';

  if (!city || !country) {
    showToast(t('enterBothCityCountry'), 'error');
    return;
  }

  try {
    state.settings.city       = city;
    state.settings.country    = country;
    state.settings.theme      = pendingTheme;
    state.settings.bigScreen  = (selectedSize === 'big');

    if (athkarToggle) state.settings.athkarAlertEnabled = athkarToggle.checked;
    if (athkarInput) {
      let v = parseInt(athkarInput.value);
      state.settings.athkarAlertInterval = isNaN(v) || v < 1 ? 30 : v;
    }
    if (preAdhanToggle) state.settings.preAdhanNotificationEnabled = preAdhanToggle.checked;
    if (preAdhanInput) {
      let v = parseInt(preAdhanInput.value);
      state.settings.preAdhanMinutes = isNaN(v) || v < 1 ? 5 : v;
    }

    await ipcRenderer.invoke('save-settings', state.settings);

    // ── Track settings save with preference snapshot ─────────────────────────
    analytics.settingsSaved(state.settings); // ← ANALYTICS
    // ────────────────────────────────────────────────────────────────────────

    await screenSizeManager.applyScreenSize();
    showToast(t('settingsSaved'), 'success');
    setTimeout(() => ipcRenderer.invoke('go-back'), 1500);
  } catch (err) {
    console.error('Error saving settings:', err);
    analytics.error('settings_save', err.message || String(err)); // ← ANALYTICS
    showToast(t('errorSaving'), 'error');
  }
}

module.exports = {
    initSettingsPage
};