const { ipcRenderer } = require('electron');
const { t } = require('./translations');
const analytics = require('./utils/analytics');

let quranIframeLoaded = false;
let quranLoadingTimeout = null;
let isFullscreen = false;

// ==================== QURAN PAGE FUNCTIONS ====================
function initQuranPage() {
  // Setup back button
  const backBtn = document.getElementById('backBtn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      ipcRenderer.invoke('resize-window', 320, 575);
      ipcRenderer.invoke('navigate-to', 'features');
    });
  }

  // Update UI text
  updateQuranUI();

  // Setup controls
  setupQuranControls();

  // Load Quran iframe
  loadQuranIframe();
}

function updateQuranUI() {
  const quranTitle = document.getElementById('quranTitle');
  const quranFooterText = document.getElementById('quranFooterText');
  const loadingText = document.getElementById('loadingText');
  const quranFullscreenBtn = document.getElementById('quranFullscreenBtn');
  const quranRefreshBtn = document.getElementById('quranRefreshBtn');

  if (quranTitle) quranTitle.textContent = t('holyQuran');
  if (quranFooterText) quranFooterText.textContent = t('listenReadQuran');
  if (loadingText) loadingText.textContent = t('loadingQuran');

  if (quranFullscreenBtn) {
    quranFullscreenBtn.setAttribute('aria-label', isFullscreen ? t('exitFullscreen') : t('enterFullscreen'));
    const icon = quranFullscreenBtn.querySelector('i');
    if (icon) {
      icon.className = isFullscreen ? 'fas fa-compress' : 'fas fa-expand';
    }
  }

  if (quranRefreshBtn) {
    quranRefreshBtn.setAttribute('aria-label', t('refreshQuran'));
  }
}

function setupQuranControls() {
  const quranFullscreenBtn = document.getElementById('quranFullscreenBtn');
  const quranRefreshBtn = document.getElementById('quranRefreshBtn');

  if (quranFullscreenBtn) {
    quranFullscreenBtn.addEventListener('click', toggleQuranFullscreen);
  }

  if (quranRefreshBtn) {
    quranRefreshBtn.addEventListener('click', forceReloadQuran);
  }
}

function loadQuranIframe() {
  const quranIframe = document.getElementById('quranIframe');
  const quranLoading = document.getElementById('quranLoading');

  if (!quranIframe || quranIframeLoaded) return;

  console.log('Loading Tanzil Quran...');

  // Clear any existing timeout
  if (quranLoadingTimeout) {
    clearTimeout(quranLoadingTimeout);
  }

  // Load with cache-busting parameter
  const timestamp = new Date().getTime();
  const quranUrl = `https://tanzil.net/?embed=true&nohead=true&cache=${timestamp}`;

  quranIframe.src = quranUrl;
  quranIframeLoaded = true;

  // Set timeout for loading failure
  quranLoadingTimeout = setTimeout(() => {
    if (quranLoading && quranLoading.style.display !== 'none') {
      showQuranError();
    }
  }, 10000);

  // Setup iframe event listeners
  quranIframe.onload = function() {
    console.log('Quran iframe loaded successfully');

    if (quranLoadingTimeout) {
      clearTimeout(quranLoadingTimeout);
      quranLoadingTimeout = null;
    }

    if (quranLoading) {
      quranLoading.style.display = 'none';
    }
    quranIframe.style.display = 'block';
  };

  quranIframe.onerror = function() {
    console.error('Quran iframe failed to load');

    if (quranLoadingTimeout) {
      clearTimeout(quranLoadingTimeout);
    }

    showQuranError();
  };
}

function showQuranError() {
  const quranLoading = document.getElementById('quranLoading');
  if (!quranLoading) return;

  quranLoading.innerHTML = `
    <div class="quran-loading-content">
      <i class="fas fa-exclamation-triangle"></i>
      <span>${t('quranError')}</span>
      <button class="retry-button" id="retryQuranBtn">
        <i class="fas fa-sync-alt"></i> ${t('retry')}
      </button>
    </div>
  `;

  const retryBtn = document.getElementById('retryQuranBtn');
  if (retryBtn) {
    retryBtn.addEventListener('click', forceReloadQuran);
  }
}

function forceReloadQuran() {
  const quranIframe = document.getElementById('quranIframe');
  const quranLoading = document.getElementById('quranLoading');

  analytics.quranLoadRetry(); // ← ANALYTICS

  if (quranLoading) {
    quranLoading.style.display = 'flex';
    quranLoading.innerHTML = `
      <div class="quran-loading-content">
        <i class="fas fa-book-quran fa-spin"></i>
        <span>${t('loadingQuran')}</span>
      </div>
    `;
  }

  if (quranIframe) {
    quranIframe.style.display = 'none';
    quranIframe.src = 'about:blank';
    quranIframeLoaded = false;

    setTimeout(() => {
      loadQuranIframe();
    }, 100);
  }
}

function toggleQuranFullscreen() {
  isFullscreen = !isFullscreen;

  if (isFullscreen) {
    ipcRenderer.invoke('resize-window', 1024, 768);
    document.body.classList.add('fullscreen');
  } else {
    ipcRenderer.invoke('resize-window', 850, 600);
    document.body.classList.remove('fullscreen');
  }

  analytics.quranFullscreen(isFullscreen); // ← ANALYTICS
  updateQuranUI();
}

module.exports = { initQuranPage };
