
// src/renderer/js/renderer.js
const { ipcRenderer } = require('electron');
const { setLanguage, t, applyLanguageDirection } = require('../js/translations');
const { initQuranPage } = require('../js/quranUI');
const { initAthkarPage } = require('../js/athkarUI');
const { initFeaturesPage } = require('../js/featuresUI');
const { initRamadanPage } = require('../js/ramadanUI');
const { loadPrayerTimes, updateCurrentAndNextPrayer } = require('../js/prayer');
const { state } = require('../js/globalStore');
const { initSettingsPage } = require('../js/settings');
const { initQiblaPage } = require('../js/qibla');
const { initAsmaPage } = require('../js/asmaUI');
const { initHijriCalendar } = require('../js/hijriCalendar');
const { applyTheme } = require('../js/theme');
const { initAthkarAlertsSystem } = require('../js/athkarAlerts');
const screenSizeManager = require('../js/screenSize');
const { initLocationSwitcher } = require('../js/locationSwitcher');
const { setupMiniPlayer } = require('../js/mini-player');
const { initTasbihPage } = require('../js/tasbihUI');
const { initRadioPage } = require('../js/radioUI');
const { initLiveStreamsPage } = require('../js/livestreamsUI');
const analytics = require('../js/utils/analytics');

// ==================== SCREEN SIZE HELPER FUNCTIONS ====================
/**
 * Setup screen size for any page with a specific container class
 * @param {string} containerClass - The CSS class of the main container
 */
function setupScreenSizeForPage(containerClass = '') {
    // Initialize screen size
    screenSizeManager.initPageScreenSize(containerClass);

    // Setup screen size toggle button
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', (event) => {
    console.log('Fullscreen button clicked, target:', event.target);
    console.log('Current page:', window.location.pathname);
    event.stopPropagation();
    screenSizeManager.toggleScreenSize(containerClass);
});
    }
}

/**
 * Adjusts the window height to fit the content of the index page.
 */
let resizeTimeout;
async function adjustIndexPageHeight() {
    // Only applies to index page
    const path = globalThis.location.pathname;
    if (!path.includes('index.html') && !path.endsWith('/')) return;

    // Build-in debounce
    if (resizeTimeout) clearTimeout(resizeTimeout);

    resizeTimeout = setTimeout(() => {
        requestAnimationFrame(async () => {
            const appContainer = document.getElementById('app');
            if (!appContainer) return;

            // Calculate total height of visible children
            let totalHeight = 0;

            // Add container padding
            const style = globalThis.getComputedStyle(appContainer);
            totalHeight += Number.parseFloat(style.paddingTop || 0) + Number.parseFloat(style.paddingBottom || 0);

            const children = appContainer.children;
            for (const element of children) {
                const child = element;
                const childStyle = globalThis.getComputedStyle(child);

                // Skip hidden elements and absolute/fixed positioned elements
                if (childStyle.display === 'none') continue;
                if (childStyle.position === 'absolute' || childStyle.position === 'fixed') continue;
                // Skip the "drag-area" explicitly if it's not positioned absolute (though CSS says it is)
                if (child.classList.contains('drag-area')) continue;

                // Add element height and margins
                totalHeight += child.offsetHeight;
                totalHeight += Number.parseFloat(childStyle.marginTop || 0) + Number.parseFloat(childStyle.marginBottom || 0);
            }

            // Add a buffer for safety (bottom spacing)
            totalHeight += 20;

            // Get current window size to preserve width
            const currentSize = await ipcRenderer.invoke('get-window-size');

            // Only resize if height is significantly different to avoid loops and jitter
            if (currentSize && Math.abs(currentSize.height - totalHeight) > 10) {
                 await ipcRenderer.invoke('resize-window', currentSize.width, Math.ceil(totalHeight));
            }
        });
    }, 100); // 100ms debounce
}

// ─── MAIN INIT ───────────────────────────────────────────────────────────────
async function initializeApp() {
  try {
    const settings = await ipcRenderer.invoke('get-settings');
    if (settings) {
      state.settings = { ...state.settings, ...settings };
      setLanguage(state.settings.language || 'en');
      applyTheme(state.settings.theme || 'navy');
      applyLanguageDirection();
      await screenSizeManager.applyScreenSize();
      initAthkarAlertsSystem();
    }

    // ── Detect current page and init the right module ─────────────────────────
    const pagePath = window.location.pathname;

    if (pagePath.includes('index.html') || pagePath.endsWith('/')) {
      setupScreenSizeForPage('app');
      initMainPage();
      // index is the home page — no featureOpen needed here

    } else if (pagePath.includes('settings.html')) {
      setupScreenSizeForPage('settings-container');
      initSettingsPage();
      // Settings is a utility page, not a feature — no featureOpen

    } else if (pagePath.includes('quran.html')) {
      analytics.featureOpen('quran'); // ← ANALYTICS
      initQuranPage();

    } else if (pagePath.includes('athkar.html')) {
      analytics.featureOpen('athkar'); // ← ANALYTICS
      setupScreenSizeForPage('athkar-container');
      initAthkarPage();

    } else if (pagePath.includes('features.html')) {
      setupScreenSizeForPage('features-container');
      initFeaturesPage();
      // features is a menu page, not a feature itself

    } else if (pagePath.includes('ramadan.html')) {
      analytics.featureOpen('ramadan'); // ← ANALYTICS
      setupScreenSizeForPage('ramadan-container');
      initRamadanPage();

    } else if (pagePath.includes('qibla.html')) {
      analytics.featureOpen('qibla'); // ← ANALYTICS
      setupScreenSizeForPage('qibla-container');
      initQiblaPage();

    } else if (pagePath.includes('asma.html')) {
      analytics.featureOpen('asma'); // ← ANALYTICS
      setupScreenSizeForPage('asma-container');
      initAsmaPage();

    } else if (pagePath.includes('tasbih.html')) {
      analytics.featureOpen('tasbih'); // ← ANALYTICS
      setupScreenSizeForPage('tasbih-container');
      initTasbihPage();

    } else if (pagePath.includes('hijri-calendar.html')) {
      analytics.featureOpen('calendar'); // ← ANALYTICS
      setupScreenSizeForPage('calendar-container');
      initHijriCalendar();

    } else if (pagePath.includes('playlist.html') || pagePath.includes('albums.html')) {
      analytics.featureOpen('playlist'); // ← ANALYTICS
      setupScreenSizeForPage('playlist-container');

    } else if (pagePath.includes('radio.html')) {
      analytics.featureOpen('radio'); // ← ANALYTICS
      setupScreenSizeForPage('radio-container');
      initRadioPage();

    } else if (pagePath.includes('livestreams.html')) {
      analytics.featureOpen('livestreams'); // ← ANALYTICS
      setupScreenSizeForPage('livestreams-container');
      initLiveStreamsPage();
    }

    setupWindowControls();
    setupMiniPlayer();

  } catch (err) {
    analytics.error('renderer_init', err.message || String(err));
    console.error('Error initializing app:', err);
  }
}

// Setup window controls
function setupWindowControls() {
  const minimizeBtn = document.getElementById('minimizeBtn');
  const closeBtn = document.getElementById('closeBtn');

  if (minimizeBtn) {
    minimizeBtn.addEventListener('click', async () => {
      await ipcRenderer.invoke('minimize-window');
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      ipcRenderer.invoke('close-window');
    });
  }

  // Setup update handlers
  setupUpdateHandlers();
}

function setupUpdateHandlers() {
    const modal = document.getElementById('updateModal');
    if (!modal) return; // Only if modal exists on this page

    const titleCtx = document.getElementById('updateTitle');
    const messageCtx = document.getElementById('updateMessage');
    const updateBtn = document.getElementById('updateActionBtn');
    const cancelBtn = document.getElementById('updateCancelBtn');
    const progressBar = document.getElementById('updateProgress');
    const progressBarFill = document.getElementById('updateProgressBar');
    const progressText = document.getElementById('updateProgressText');

    let updateInfo = null;
    let isUpdateDownloaded = false;

    // Reset UI state
    function resetUI() {
        modal.classList.remove('show');
        progressBar.classList.add('hidden');
        if (updateBtn) {
            updateBtn.textContent = t('download');
            updateBtn.disabled = false;
        }
        if (cancelBtn) cancelBtn.style.display = 'block';
    }

    // Close modal action
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            modal.classList.remove('show');
        });
    }

    // Main update action
    if (updateBtn) {
        updateBtn.addEventListener('click', () => {
            if (!isUpdateDownloaded) {
                // Start download
                ipcRenderer.send('start-download');
                updateBtn.disabled = true;
                if (cancelBtn) cancelBtn.style.display = 'none'; // Prevent cancelling during download
                progressBar.classList.remove('hidden');
            } else {
                // Install and restart
                ipcRenderer.send('install-update');
            }
        });
    }

    // Listeners from Main Process
    ipcRenderer.on('update-available', (event, info) => {
        isUpdateDownloaded = false;
        updateInfo = info;
        if (titleCtx) titleCtx.textContent = t('updateAvailable');
        if (messageCtx) messageCtx.textContent = t('newVersionAvailable').replace('{version}', info.version);
        if (updateBtn) updateBtn.textContent = t('download');
        if (cancelBtn) {
          cancelBtn.style.display = 'block';
          cancelBtn.textContent = t('later');
        }
        if (progressBar) progressBar.classList.add('hidden');

        modal.classList.add('show');
    });

    ipcRenderer.on('download-progress', (event, progressObj) => {
        if (progressBar) progressBar.classList.remove('hidden');
        const percentage = Math.round(progressObj.percent);
        if (progressBarFill) progressBarFill.style.width = percentage + '%';
        if (progressText) progressText.textContent = percentage + '%';
    });

    ipcRenderer.on('update-downloaded', (event, info) => {
        isUpdateDownloaded = true;
        if (titleCtx) titleCtx.textContent = t('updateReady');
        if (messageCtx) messageCtx.textContent = t('updateDownloaded');
        if (updateBtn) {
            updateBtn.textContent = t('install');
            updateBtn.disabled = false;
        }
        if (progressBar) progressBar.classList.add('hidden');

        modal.classList.add('show');
    });
}

// ==================== MAIN PAGE FUNCTIONS ====================
function initMainPage() {
  initLocationSwitcher();

  const settingsBtn    = document.getElementById('mainSettingsBtn');
  const featuresBtn    = document.getElementById('mainFeaturesBtn');
  const widgetBtn      = document.getElementById('prayerWidgetBtn');

  if (settingsBtn) {
    settingsBtn.addEventListener('click', async () => {
      analytics.navigation('home', 'settings'); // ← ANALYTICS
      const size = screenSizeManager.getWindowSize();
      await ipcRenderer.invoke('resize-window', size.width, size.height);
      ipcRenderer.invoke('navigate-to', 'settings');
    });
  }

  if (featuresBtn) {
    featuresBtn.addEventListener('click', async () => {
      analytics.navigation('home', 'features'); // ← ANALYTICS
      const size = screenSizeManager.getWindowSize();
      await ipcRenderer.invoke('resize-window', size.width, size.height);
      ipcRenderer.invoke('navigate-to', 'features');
    });
  }

  if (widgetBtn) {
    widgetBtn.addEventListener('click', async () => {
      const isOpen = await ipcRenderer.invoke('toggle-prayer-widget');
      widgetBtn.classList.toggle('widget-toggle-btn--active', isOpen);
    });
  }

  const loadingEl = document.getElementById('loadingText');
  if (loadingEl) loadingEl.textContent = t('loadingPrayerTimes');

  const eventsBanner     = document.getElementById('eventsBanner');
  const closeEventBanner = document.getElementById('closeEventBanner');
  if (closeEventBanner && eventsBanner) {
    closeEventBanner.addEventListener('click', () => { eventsBanner.style.display = 'none'; });
  }

  const appContainer = document.getElementById('app');
  if (appContainer) {
    const observer = new MutationObserver(adjustIndexPageHeight);
    observer.observe(appContainer, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ['style', 'class', 'hidden'],
    });
  }

  adjustIndexPageHeight();
  loadPrayerTimes();
  setInterval(updateCurrentAndNextPrayer, 1_000);
  setInterval(loadPrayerTimes, 3_600_000);
}

// ==================== START THE APP ====================
document.addEventListener('DOMContentLoaded', initializeApp);