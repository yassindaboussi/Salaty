// featuresUI.js
const { ipcRenderer } = require('electron');
const { t } = require('./translations');
const screenSizeManager = require('./screenSize');

// ==================== FEATURES PAGE FUNCTIONS ====================
function initFeaturesPage() {
  console.log('Initializing Features page...');

  // SCREEN SIZE IS NOW HANDLED IN renderer.js

  // Setup back button
  const backBtn = document.getElementById('backBtn');
  if (backBtn) {
    console.log('Back button found');
    backBtn.addEventListener('click', () => {
      console.log('Back button clicked');
      const currentSize = screenSizeManager.getWindowSize();
      ipcRenderer.invoke('resize-window', currentSize.width, currentSize.height);
      ipcRenderer.invoke('go-back');
    });
  }

  // Update UI text
  updateFeaturesUI();

  // Setup feature card clicks
  setupFeatureCards();
}

function updateFeaturesUI() {
  const featuresTitle = document.getElementById('featuresTitle');
  const featuresFooterText = document.getElementById('featuresFooterText');

  // Feature names
  const featureQuran = document.getElementById('featureQuran');
  const featureAthkar = document.getElementById('featureAthkar');
  const featureMonthly = document.getElementById('featureMonthly');
  const featureTasbih = document.getElementById('featureTasbih');
  const featureCalendar = document.getElementById('featureCalendar');
  const featureRamadhan = document.getElementById('featureRamadhan');
  const featureAsma = document.getElementById('featureAsma');
  const featureQibla = document.getElementById('featureQibla');
  const featurePlaylist = document.getElementById('featurePlaylist');

  // Feature descriptions
  const featureQuranDesc = document.getElementById('featureQuranDesc');
  const featureAthkarDesc = document.getElementById('featureAthkarDesc');
  const featureMonthlyDesc = document.getElementById('featureMonthlyDesc');
  const featureTasbihDesc = document.getElementById('featureTasbihDesc');
  const featureCalendarDesc = document.getElementById('featureCalendarDesc');
  const featureRamadhanDesc = document.getElementById('featureRamadhanDesc');
  const featureAsmaDesc = document.getElementById('featureAsmaDesc');
  const featureQiblaDesc = document.getElementById('featureQiblaDesc');
  const featurePlaylistDesc = document.getElementById('featurePlaylistDesc');
  const featureRadio = document.getElementById('featureRadio');
  const featureRadioDesc = document.getElementById('featureRadioDesc');

  // Coming soon badges
  const comingSoonBadges = document.querySelectorAll('.coming-soon-badge');

  if (featuresTitle) featuresTitle.textContent = t('islamicFeatures');
  if (featuresFooterText) featuresFooterText.textContent = t('moreFeaturesComingSoon');

  if (featureQuran) featureQuran.textContent = t('holyQuran');
  if (featureAthkar) featureAthkar.textContent = t('athkar');
  if (featureMonthly) featureMonthly.textContent = t('prayerTimesMonthly');
  if (featureTasbih) featureTasbih.textContent = t('tasbih');
  if (featureCalendar) featureCalendar.textContent = t('hijriCalendar');
  if (featureRamadhan) featureRamadhan.textContent = t('ramadhan');
  if (featureAsma) featureAsma.textContent = t('asmaAllah');
  if (featureQibla) featureQibla.textContent = t('qiblaFinder');
  if (featurePlaylist) featurePlaylist.textContent = t('audioArchive');

  if (featureQuranDesc) featureQuranDesc.textContent = t('quranDesc');
  if (featureAthkarDesc) featureAthkarDesc.textContent = t('athkarDesc');
  if (featureMonthlyDesc) featureMonthlyDesc.textContent = t('prayerTimesMonthlyDesc');
  if (featureTasbihDesc) featureTasbihDesc.textContent = t('tasbihDesc');
  if (featureCalendarDesc) featureCalendarDesc.textContent = t('calendarDesc');
  if (featureRamadhanDesc) featureRamadhanDesc.textContent = t('ramadhanDesc');
  if (featureAsmaDesc) featureAsmaDesc.textContent = t('asmaDesc');
  if (featureQiblaDesc) featureQiblaDesc.textContent = t('qiblaDesc');
  if (featurePlaylistDesc) featurePlaylistDesc.textContent = t('audioArchiveDesc');
  if (featureRadio) featureRadio.textContent = t('muslimRadio');
  if (featureRadioDesc) featureRadioDesc.textContent = t('radioDesc');

  comingSoonBadges.forEach(badge => {
    badge.textContent = t('comingSoon');
  });
}

function setupFeatureCards() {
  // Quran card
  const quranCard = document.querySelector('[data-feature="quran"]');

  if (quranCard) {
    quranCard.addEventListener('click', openQuran);
  }

  // Playlist card
  const playlistCard = document.querySelector('[data-feature="playlist"]');
  if (playlistCard) {
    playlistCard.addEventListener('click', openPlaylist);
  }

  // Athkar card
  const athkarCard = document.querySelector('[data-feature="athkar"]');

  if (athkarCard) {
    athkarCard.addEventListener('click', openAthkar);
  }

  // Ramadhan card
  const ramadhanCard = document.querySelector('[data-feature="ramadhan"]');
  if (ramadhanCard) {
    ramadhanCard.addEventListener('click', openRamadhan);
  }

  // Qibla card
  const qiblaCard = document.querySelector('[data-feature="qibla"]');
  if (qiblaCard) {
    qiblaCard.addEventListener('click', openQibla);
  }

  const asmaCard = document.querySelector('[data-feature="asma"]');
  if (asmaCard) {
    asmaCard.addEventListener('click', openAsma);
  }

  // Calendar card
  const calendarCard = document.querySelector('[data-feature="calendar"]');
  if (calendarCard) {
    calendarCard.addEventListener('click', openCalendar);
  }
  
  // Tasbih card
  const tasbihCard = document.querySelector('[data-feature="tasbih"]');
  if (tasbihCard) {
    tasbihCard.addEventListener('click', openTasbih);
  }
  // Radio card
  const radioCard = document.querySelector('[data-feature="radio"]');
  if (radioCard) {
    radioCard.addEventListener('click', openRadio);
  }
}

function openPlaylist() {
  console.log('Opening Playlist...');
  ipcRenderer.invoke('resize-window', 850, 600);
  ipcRenderer.invoke('navigate-to', 'albums');
}

function openQuran() {
  console.log('Opening Quran...');
  ipcRenderer.invoke('resize-window', 850, 600);
  ipcRenderer.invoke('navigate-to', 'quran');
}

function openAthkar() {
  console.log('Opening Athkar...');
  const size = screenSizeManager.getWindowSize();
  ipcRenderer.invoke('resize-window', size.width, size.height);
  ipcRenderer.invoke('navigate-to', 'athkar');
}

function openRamadhan() {
  console.log('Opening Ramadhan...');
  const size = screenSizeManager.getWindowSize();
  ipcRenderer.invoke('resize-window', size.width, size.height);
  ipcRenderer.invoke('navigate-to', 'ramadan');
}

function openQibla() {
  console.log('Opening Qibla...');
  const size = screenSizeManager.getWindowSize();
  ipcRenderer.invoke('resize-window', size.width, size.height);
  ipcRenderer.invoke('navigate-to', 'qibla');
}

function openAsma() {
  console.log('Opening Asma Allah...');
  const size = screenSizeManager.getWindowSize();
  ipcRenderer.invoke('resize-window', size.width, size.height);
  ipcRenderer.invoke('navigate-to', 'asma');
}

function openCalendar() {
  console.log('Opening Hijri Calendar...');
  const size = screenSizeManager.getWindowSize();
  ipcRenderer.invoke('resize-window', size.width, size.height);
  ipcRenderer.invoke('navigate-to', 'hijri-calendar');
}

function openTasbih() {
  console.log('Opening Tasbih...');
  const size = screenSizeManager.getWindowSize();
  ipcRenderer.invoke('resize-window', size.width, size.height);
  ipcRenderer.invoke('navigate-to', 'tasbih');
}

function openRadio() {
  console.log('Opening Muslim Radio...');
  const size = screenSizeManager.getWindowSize();
  ipcRenderer.invoke('resize-window', size.width, size.height);
  ipcRenderer.invoke('navigate-to', 'radio');
}


module.exports = { initFeaturesPage };