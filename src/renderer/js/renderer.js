
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
const { initLiveStreamsPage } = require('../js/livestreams');

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
 * Get current window size based on screen size setting
 */
function getCurrentWindowSize() {
    return screenSizeManager.getWindowSize();
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

// ==================== INITIALIZATION ====================
async function initializeApp() {
  try {
    // Load settings from main process
    const settings = await ipcRenderer.invoke('get-settings');
    if (settings) {
      state.settings = { ...state.settings, ...settings };
      const theme = state.settings.theme || 'navy';

      setLanguage(state.settings.language || 'en');

      // Apply theme and language
      applyTheme(theme);
      applyLanguageDirection();

      // Apply screen size preference
      await screenSizeManager.applyScreenSize();

      // Initialize Athkar Alerts System
      initAthkarAlertsSystem();
    }

    // Check which page we're on and initialize accordingly
    const path = window.location.pathname;
    if (path.includes('index.html') || path.endsWith('/')) {
      setupScreenSizeForPage('app');
      initMainPage();
    } else if (path.includes('settings.html')) {
      setupScreenSizeForPage('settings-container');
      initSettingsPage();
    } else if (path.includes('quran.html')) {
      initQuranPage();
    } else if (path.includes('athkar.html')) {
      console.log('Initializing Athkar page from renderer.js');
      // Setup screen size for athkar page
      setupScreenSizeForPage('athkar-container');
      initAthkarPage();
    } else if (path.includes('features.html')) {
      console.log('Initializing Features page from renderer.js');
      // Setup screen size for features page
      setupScreenSizeForPage('features-container');
      initFeaturesPage();
    } else if (path.includes('ramadan.html')) {
      console.log('Initializing Ramadan page from renderer.js');
      // Setup screen size for ramadan page
      setupScreenSizeForPage('ramadan-container');
      initRamadanPage();
    } else if (path.includes('qibla.html')) {
      console.log('Initializing Qibla page from renderer.js');
      // Setup screen size for qibla page
      setupScreenSizeForPage('qibla-container');
      initQiblaPage();
    } else if (path.includes('asma.html')) {
      console.log('Initializing Asmallah page from renderer.js');
      // Setup screen size for asma page
      setupScreenSizeForPage('asma-container');
      initAsmaPage();
    } else if (path.includes('tasbih.html')) {
      console.log('Initializing Tasbih page from renderer.js');
      // Setup screen size for tasbih page
      setupScreenSizeForPage('tasbih-container');
      initTasbihPage();
    }   
    else if (path.includes('hijri-calendar.html')) {
      console.log('Initializing Hijri Calendar page from renderer.js');
      // Setup screen size for calendar page
      setupScreenSizeForPage('calendar-container');
      initHijriCalendar();
    }
     else if (path.includes('playlist.html')) {
      console.log('Initializing Playlist page from renderer.js');
      // Setup screen size for playlist page
      setupScreenSizeForPage('playlist-container');
      // Note: playlist.js handles its own player initialization
    } else if (path.includes('radio.html')) {
      console.log('Initializing Radio page from renderer.js');
      // Setup screen size for radio page
      setupScreenSizeForPage('radio-container');
      initRadioPage();
    } else if (path.includes('livestreams.html')) {
      console.log('Initializing Live Streams page from renderer.js');
      // Setup screen size for livestreams page
      setupScreenSizeForPage('livestreams-container');
      initLiveStreamsPage();
    }

    // Setup window controls (common to all pages)
    setupWindowControls();

    // Setup Mini Player (Global)
    setupMiniPlayer();

  } catch (error) {
    console.error('Error initializing app:', error);
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
  // Initialize location switcher
  initLocationSwitcher();

  // Setup navigation buttons
  const settingsBtn = document.getElementById('mainSettingsBtn');
  const featuresBtn = document.getElementById('mainFeaturesBtn');

  if (settingsBtn) {
        settingsBtn.addEventListener('click', async () => {
            // Use screen size preference for settings page
            const size = screenSizeManager.getWindowSize();
            await ipcRenderer.invoke('resize-window', size.width, size.height);
            ipcRenderer.invoke('navigate-to', 'settings');
        });
  }

  if (featuresBtn) {
        featuresBtn.addEventListener('click', async () => {
            // Use screen size preference for features page
            const size = screenSizeManager.getWindowSize();
            await ipcRenderer.invoke('resize-window', size.width, size.height);
            ipcRenderer.invoke('navigate-to', 'features');
        });
  }

  // Initialize loading text
  const loadingEl = document.getElementById('loadingText');
  if (loadingEl) {
    loadingEl.textContent = t('loadingPrayerTimes');
  }

  // Initialize Events Banner
  const eventsBanner = document.getElementById('eventsBanner');
  const closeEventBannerBtn = document.getElementById('closeEventBanner');

  if (closeEventBannerBtn && eventsBanner) {
    closeEventBannerBtn.addEventListener('click', () => {
      eventsBanner.style.display = 'none';
    });
  }

  // Monitor DOM changes for automatic resizing on the index page
  const appContainer = document.getElementById('app');
  if (appContainer) {
    const observer = new MutationObserver(() => {
        adjustIndexPageHeight();
    });

    observer.observe(appContainer, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'hidden']
    });
  }

  // Initial height adjustment
  adjustIndexPageHeight();

  // Start prayer times functionality
  loadPrayerTimes();
  setInterval(updateCurrentAndNextPrayer, 1000);
  setInterval(loadPrayerTimes, 3600000);
}

// ==================== START THE APP ====================
document.addEventListener('DOMContentLoaded', initializeApp);