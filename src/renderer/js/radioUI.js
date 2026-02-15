// radioUI.js — Vinyl Studio Redesign
const { ipcRenderer } = require('electron');
const { t, getLanguage } = require('./translations');
const screenSizeManager = require('./screenSize');
const radioStationsData = require('../data/radioStations.json');

const radioStations = radioStationsData.stations;

let audioPlayer = null;
let currentStation = null;
let isPlaying = false;
let isMuted = false;
let volume = 80;

// ==================== INIT ====================
function initRadioPage() {
  console.log('Initializing Radio page (Vinyl redesign)...');

  updateRadioUI();

  // Back button
  const backBtn = document.getElementById('backBtn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      stopPlayback();
      const currentSize = screenSizeManager.getWindowSize();
      ipcRenderer.invoke('resize-window', currentSize.width, currentSize.height);
      ipcRenderer.invoke('navigate-to', 'features');
    });
  }

  loadStations();
  setupPlayerControls();
  loadSavedVolume();
  setDefaultNowPlaying();

  window.addEventListener('beforeunload', () => stopPlayback());
}

// ==================== UI TEXT ====================
function updateRadioUI() {
  const radioTitle      = document.getElementById('radioTitle');
  const radioFooterText = document.getElementById('radioFooterText');
  const nowPlayingBadge = document.getElementById('nowPlayingBadge');
  const stationsLabel   = document.getElementById('stationsLabel');
  const loadingText     = document.getElementById('loadingText');

  if (radioTitle)      radioTitle.textContent      = t('muslimRadio');
  if (radioFooterText) radioFooterText.textContent = t('radioFooterText');
  if (nowPlayingBadge) nowPlayingBadge.textContent  = t('nowPlaying');
  if (stationsLabel)   stationsLabel.textContent    = t('availableStations');
  if (loadingText)     loadingText.textContent      = t('connectingToStation');
}

function setDefaultNowPlaying() {
  const stationName = document.getElementById('stationName');
  const stationDesc = document.getElementById('stationDescription');
  if (stationName) stationName.textContent = t('selectStation');
  if (stationDesc) stationDesc.textContent = t('chooseFromStations');
}

// ==================== STATIONS ====================
function loadStations() {
  const grid = document.getElementById('stationsGrid');
  if (!grid) return;

  grid.innerHTML = '';
  const lang = getLanguage();

  radioStations.forEach(station => {
    grid.appendChild(createStationCard(station, lang));
  });

  setupStationCards();
}

function createStationCard(station, lang) {
  const card = document.createElement('div');
  card.className = 'station-card';
  card.dataset.station = station.id;

  const name    = station.name[lang]    || station.name.en;
  const country = station.country[lang] || station.country.en;

  card.innerHTML = `
    <div class="station-card-image">
      <img src="${station.image}" alt="${name}" loading="lazy">
    </div>
    <div class="station-card-info">
      <div class="station-card-name">${name}</div>
      <div class="station-card-location">${country}</div>
    </div>
    <div class="station-card-bars">
      <span></span><span></span><span></span>
    </div>
    <button class="station-play-btn" data-station="${station.id}" aria-label="Play ${name}">
      <i class="fas fa-play"></i>
    </button>
  `;

  return card;
}

function setupStationCards() {
  document.querySelectorAll('.station-card').forEach(card => {
    const id = card.dataset.station;

    card.addEventListener('click', e => {
      if (!e.target.closest('.station-play-btn')) playStation(id);
    });

    const btn = card.querySelector('.station-play-btn');
    if (btn) {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        playStation(id);
      });
    }
  });
}

// ==================== PLAYBACK ====================
function playStation(stationId) {
  const station = radioStations.find(s => s.id === stationId);
  if (!station) return;

  showLoading(true);

  // Same station + playing → pause
  if (currentStation && currentStation.id === stationId && isPlaying) {
    pausePlayback();
    showLoading(false);
    return;
  }

  // Different station → stop first
  if (currentStation && currentStation.id !== stationId) {
    stopPlayback();
  }

  if (!audioPlayer) {
    audioPlayer = new Audio();
    setupAudioEvents();
  }

  audioPlayer.src = station.url;
  audioPlayer.volume = volume / 100;

  audioPlayer.play()
    .then(() => {
      currentStation = station;
      isPlaying = true;
      updateUIForPlayingStation(station);
      showLoading(false);
    })
    .catch(err => {
      console.error('Playback error:', err);
      showToast(t('playbackError'), 'error');
      showLoading(false);
    });
}

function togglePlayPause() {
  if (!audioPlayer || !currentStation) {
    showToast(t('selectStationFirst'), 'error');
    return;
  }
  isPlaying ? pausePlayback() : resumePlayback();
}

function pausePlayback() {
  if (audioPlayer && isPlaying) {
    audioPlayer.pause();
    isPlaying = false;
    updatePlayPauseButton(false);
    setVinylSpinning(false);
    setTonearm(false);
    setSoundBars(false);
    updateCardPlayBtns();
  }
}

function resumePlayback() {
  if (audioPlayer && !isPlaying) {
    audioPlayer.play()
      .then(() => {
        isPlaying = true;
        updatePlayPauseButton(true);
        setVinylSpinning(true);
        setTonearm(true);
        setSoundBars(true);
        updateCardPlayBtns();
      })
      .catch(err => {
        console.error('Resume error:', err);
        showToast(t('playbackError'), 'error');
      });
  }
}

function stopPlayback() {
  if (audioPlayer) {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    isPlaying = false;
    currentStation = null;

    updatePlayPauseButton(false);
    setVinylSpinning(false);
    setTonearm(false);
    setSoundBars(false);
    updateUIForStopped();
    resetAllCards();
  }
}

function setupAudioEvents() {
  if (!audioPlayer) return;

  audioPlayer.addEventListener('error', () => {
    showToast(t('playbackError'), 'error');
    showLoading(false);
    stopPlayback();
  });

  audioPlayer.addEventListener('ended', stopPlayback);

  audioPlayer.addEventListener('waiting', () => {
    showLoading(true);
    setVinylSpinning(false);
  });

  audioPlayer.addEventListener('playing', () => {
    showLoading(false);
    if (isPlaying) setVinylSpinning(true);
  });
}

// ==================== VOLUME ====================
function setVolume(value) {
  volume = Math.min(100, Math.max(0, value));
  if (audioPlayer) audioPlayer.volume = volume / 100;
  localStorage.setItem('radioVolume', volume);
  updateVolumeIcon();
}

function toggleMute() {
  if (!audioPlayer) return;
  isMuted = !isMuted;
  audioPlayer.muted = isMuted;
  updateVolumeIcon();
}

function loadSavedVolume() {
  const saved = localStorage.getItem('radioVolume');
  if (saved !== null) {
    volume = parseInt(saved);
    const slider = document.getElementById('volumeSlider');
    if (slider) slider.value = volume;
    updateVolumeIcon();
  }
}

function updateVolumeIcon() {
  const icon = document.getElementById('volumeIcon');
  if (!icon) return;
  if (volume === 0 || isMuted)  icon.className = 'fas fa-volume-mute';
  else if (volume < 50)         icon.className = 'fas fa-volume-down';
  else                          icon.className = 'fas fa-volume-up';
}

// ==================== CONTROLS SETUP ====================
function setupPlayerControls() {
  const playPauseBtn = document.getElementById('playPauseBtn');
  const stopBtn      = document.getElementById('stopBtn');
  const muteBtn      = document.getElementById('muteBtn');
  const volumeSlider = document.getElementById('volumeSlider');

  if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlayPause);
  if (stopBtn)      stopBtn.addEventListener('click', stopPlayback);
  if (muteBtn)      muteBtn.addEventListener('click', toggleMute);
  if (volumeSlider) volumeSlider.addEventListener('input', e => setVolume(parseInt(e.target.value)));
}

// ==================== UI UPDATES ====================
function updatePlayPauseButton(playing) {
  const icon = document.getElementById('playPauseIcon');
  if (icon) icon.className = playing ? 'fas fa-pause' : 'fas fa-play';
}

function setVinylSpinning(spin) {
  const disc = document.getElementById('vinylDisc');
  if (!disc) return;
  disc.classList.toggle('spinning', spin);
}

function setTonearm(active) {
  const arm = document.getElementById('tonearm');
  if (!arm) return;
  arm.classList.toggle('playing', active);
  arm.classList.toggle('idle', !active);
}

function setSoundBars(active) {
  const bars = document.getElementById('playingAnimation');
  if (bars) bars.classList.toggle('active', active);
}

function updateUIForPlayingStation(station) {
  const lang = getLanguage();

  const nameEl  = document.getElementById('stationName');
  const descEl  = document.getElementById('stationDescription');
  const imgEl   = document.getElementById('stationImage');
  const defEl   = document.getElementById('vinylDefault');

  if (nameEl) nameEl.textContent = station.name[lang] || station.name.en;
  if (descEl) descEl.textContent = station.description[lang] || station.description.en;

  // Swap vinyl center to show station art
  if (imgEl) {
    imgEl.src = station.image;
    imgEl.style.display = 'block';
  }
  if (defEl) defEl.style.display = 'none';

  // Animate
  updatePlayPauseButton(true);
  setVinylSpinning(true);
  setTonearm(true);
  setSoundBars(true);

  // Update cards
  document.querySelectorAll('.station-card').forEach(card => {
    card.classList.remove('active');
    const btn = card.querySelector('.station-play-btn i');
    if (btn) btn.className = 'fas fa-play';
  });

  const activeCard = document.querySelector(`.station-card[data-station="${station.id}"]`);
  if (activeCard) {
    activeCard.classList.add('active');
    const btn = activeCard.querySelector('.station-play-btn i');
    if (btn) btn.className = 'fas fa-pause';
    // Scroll into view smoothly
    activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function updateUIForStopped() {
  const nameEl = document.getElementById('stationName');
  const descEl = document.getElementById('stationDescription');
  const imgEl  = document.getElementById('stationImage');
  const defEl  = document.getElementById('vinylDefault');

  if (nameEl) nameEl.textContent = t('selectStation');
  if (descEl) descEl.textContent = t('chooseFromStations');
  if (imgEl)  { imgEl.src = ''; imgEl.style.display = 'none'; }
  if (defEl)  defEl.style.display = '';
}

function resetAllCards() {
  document.querySelectorAll('.station-card').forEach(card => {
    card.classList.remove('active');
    const btn = card.querySelector('.station-play-btn i');
    if (btn) btn.className = 'fas fa-play';
  });
}

function updateCardPlayBtns() {
  if (!currentStation) return;
  document.querySelectorAll('.station-card').forEach(card => {
    const btn = card.querySelector('.station-play-btn i');
    if (!btn) return;
    if (card.dataset.station === currentStation.id) {
      btn.className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
    } else {
      btn.className = 'fas fa-play';
    }
  });
}

// ==================== LOADING / TOAST ====================
function showLoading(show) {
  const el = document.getElementById('radioLoading');
  if (el) el.style.display = show ? 'flex' : 'none';
}

function showToast(message, type = 'info') {
  const existing = document.querySelector('.radio-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `radio-toast ${type}`;
  toast.innerHTML = `<i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i> ${message}`;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ==================== LANGUAGE CHANGE ====================
window.addEventListener('languageChanged', () => {
  updateRadioUI();
  loadStations();
  if (currentStation && isPlaying) updateUIForPlayingStation(currentStation);
  else setDefaultNowPlaying();
});

module.exports = { initRadioPage };