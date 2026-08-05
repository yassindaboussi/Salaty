const { ipcRenderer } = require("electron");
const { setupConnectionRecovery } = require("../services/connection-recovery");
const { t, getLanguage } = require("../core/i18n/translations");
const radioStationsData = require("../../data/radioStations.json");
const analytics = require("../utils/analytics");
const { renderToast } = require("../core/toast");

const radioStations = radioStationsData.stations;

function resolveStationImagePath(imagePath) {
  if (!imagePath) return "";
  return imagePath.replace(/^\.\.\/\.\.\/assets\//, "../../../assets/");
}

let audioPlayer = null;
let currentStation = null;
let isPlaying = false;
let isMuted = false;
let volume = 80;

function initRadioPage() {
  setupConnectionRecovery(() => {
    loadStations();
  }, "Radio");
  updateRadioUI();

  const backBtn = document.getElementById("backBtn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      stopPlayback();
      ipcRenderer.invoke("navigate-to", "features");
    });
  }

  loadStations();
  setupPlayerControls();
  loadSavedVolume();
  setDefaultNowPlaying();
  window.addEventListener("beforeunload", () => stopPlayback());
}

function updateRadioUI() {
  const els = {
    radioTitle: t("muslimRadio"),
    radioFooterText: t("radioFooterText"),
    nowPlayingBadge: t("nowPlaying"),
    stationsLabel: t("availableStations"),
    loadingText: t("connectingToStation"),
  };
  for (const [id, text] of Object.entries(els)) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }
}

function setDefaultNowPlaying() {
  const nameEl = document.getElementById("stationName");
  const descEl = document.getElementById("stationDescription");
  if (nameEl) nameEl.textContent = t("selectStation");
  if (descEl) descEl.textContent = t("chooseFromStations");
}

function loadStations() {
  const grid = document.getElementById("stationsGrid");
  if (!grid) return;
  grid.innerHTML = "";
  const lang = getLanguage();
  radioStations.forEach((station) =>
    grid.appendChild(createStationCard(station, lang)),
  );
  setupStationCards();
}

function createStationCard(station, lang) {
  const card = document.createElement("div");
  card.className = "station-card";
  card.dataset.station = station.id;
  const name = station.name[lang] || station.name.en;
  const country = station.country[lang] || station.country.en;
  card.innerHTML = `
    <div class="station-card-image"><img src="${resolveStationImagePath(station.image)}" alt="${name}" loading="lazy"></div>
    <div class="station-card-info">
      <div class="station-card-name">${name}</div>
      <div class="station-card-location">${country}</div>
    </div>
    <div class="station-card-bars"><span></span><span></span><span></span></div>
    <button class="station-play-btn" data-station="${station.id}" aria-label="Play ${name}">
      <i class="fas fa-play"></i>
    </button>`;
  return card;
}

function setupStationCards() {
  document.querySelectorAll(".station-card").forEach((card) => {
    const id = card.dataset.station;
    card.addEventListener("click", (e) => {
      if (!e.target.closest(".station-play-btn")) playStation(id);
    });
    const btn = card.querySelector(".station-play-btn");
    if (btn)
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        playStation(id);
      });
  });
}

let playRequestId = 0;

function playStation(stationId) {
  const station = radioStations.find((s) => s.id === stationId);
  if (!station) return;
  showLoading(true);

  if (currentStation?.id === stationId && isPlaying) {
    pausePlayback();
    showLoading(false);
    return;
  }
  if (currentStation?.id !== stationId) stopPlayback();

  if (!audioPlayer) {
    audioPlayer = new Audio();
    setupAudioEvents();
  }

  const myRequestId = ++playRequestId;
  audioPlayer.src = station.url;
  audioPlayer.volume = volume / 100;

  audioPlayer
    .play()
    .then(() => {
      if (myRequestId !== playRequestId) return;
      currentStation = station;
      isPlaying = true;
      updateUIForPlayingStation(station);
      showLoading(false);
      analytics.radioStationPlay(station.id, station.name.en);
    })
    .catch((err) => {
      if (myRequestId !== playRequestId) return;
      if (err?.name === "AbortError") {
        showLoading(false);
        return;
      }
      console.error("Playback error:", err);
      analytics.error("radio_playback", err.message || String(err));
      showToast(t("playbackError"), "error");
      showLoading(false);
    });
}

function togglePlayPause() {
  if (!audioPlayer || !currentStation) {
    showToast(t("selectStationFirst"), "error");
    return;
  }
  isPlaying ? pausePlayback() : resumePlayback();
}

function pausePlayback() {
  if (!audioPlayer || !isPlaying) return;
  audioPlayer.pause();
  isPlaying = false;
  updatePlayPauseButton(false);
  setVinylSpinning(false);
  setTonearm(false);
  setSoundBars(false);
  updateCardPlayBtns();
}

function resumePlayback() {
  if (!audioPlayer || isPlaying) return;
  audioPlayer
    .play()
    .then(() => {
      isPlaying = true;
      updatePlayPauseButton(true);
      setVinylSpinning(true);
      setTonearm(true);
      setSoundBars(true);
      updateCardPlayBtns();
    })
    .catch((err) => {
      analytics.error("radio_resume", err.message || String(err));
      showToast(t("playbackError"), "error");
    });
}

function stopPlayback() {
  if (!audioPlayer) return;
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
  analytics.radioStop();
}

function setupAudioEvents() {
  if (!audioPlayer) return;
  audioPlayer.addEventListener("error", () => {
    showToast(t("playbackError"), "error");
    showLoading(false);
    stopPlayback();
  });
  audioPlayer.addEventListener("ended", stopPlayback);
  audioPlayer.addEventListener("waiting", () => {
    showLoading(true);
    setVinylSpinning(false);
  });
  audioPlayer.addEventListener("playing", () => {
    showLoading(false);
    if (isPlaying) setVinylSpinning(true);
  });
}

function setVolume(value) {
  volume = Math.min(100, Math.max(0, value));
  if (audioPlayer) audioPlayer.volume = volume / 100;
  localStorage.setItem("radioVolume", volume);
  updateVolumeIcon();
}

function toggleMute() {
  if (!audioPlayer) return;
  isMuted = !isMuted;
  audioPlayer.muted = isMuted;
  updateVolumeIcon();
}

function loadSavedVolume() {
  const saved = localStorage.getItem("radioVolume");
  if (saved !== null) {
    volume = parseInt(saved);
    const slider = document.getElementById("volumeSlider");
    if (slider) slider.value = volume;
    updateVolumeIcon();
  }
}

function updateVolumeIcon() {
  const icon = document.getElementById("volumeIcon");
  if (!icon) return;
  icon.className =
    volume === 0 || isMuted
      ? "fas fa-volume-mute"
      : volume < 50
        ? "fas fa-volume-down"
        : "fas fa-volume-up";
}

function setupPlayerControls() {
  const pp = document.getElementById("playPauseBtn");
  const st = document.getElementById("stopBtn");
  const mu = document.getElementById("muteBtn");
  const vol = document.getElementById("volumeSlider");
  if (pp) pp.addEventListener("click", togglePlayPause);
  if (st) st.addEventListener("click", stopPlayback);
  if (mu) mu.addEventListener("click", toggleMute);
  if (vol)
    vol.addEventListener("input", (e) => setVolume(parseInt(e.target.value)));
}

function updatePlayPauseButton(playing) {
  const icon = document.getElementById("playPauseIcon");
  if (icon) icon.className = playing ? "fas fa-pause" : "fas fa-play";
}

function setVinylSpinning(spin) {
  document.getElementById("vinylDisc")?.classList.toggle("spinning", spin);
}

function setTonearm(active) {
  const arm = document.getElementById("tonearm");
  if (!arm) return;
  arm.classList.toggle("playing", active);
  arm.classList.toggle("idle", !active);
}

function setSoundBars(active) {
  document
    .getElementById("playingAnimation")
    ?.classList.toggle("active", active);
}

function updateUIForPlayingStation(station) {
  const lang = getLanguage();
  const nameEl = document.getElementById("stationName");
  const descEl = document.getElementById("stationDescription");
  const imgEl = document.getElementById("stationImage");
  const defEl = document.getElementById("vinylDefault");

  if (nameEl) nameEl.textContent = station.name[lang] || station.name.en;
  if (descEl)
    descEl.textContent = station.description[lang] || station.description.en;
  if (imgEl) {
    imgEl.src = station.image;
    imgEl.style.display = "block";
  }
  if (defEl) defEl.style.display = "none";

  updatePlayPauseButton(true);
  setVinylSpinning(true);
  setTonearm(true);
  setSoundBars(true);

  document.querySelectorAll(".station-card").forEach((card) => {
    card.classList.remove("active");
    const btn = card.querySelector(".station-play-btn i");
    if (btn) btn.className = "fas fa-play";
  });
  const activeCard = document.querySelector(
    `.station-card[data-station="${station.id}"]`,
  );
  if (activeCard) {
    activeCard.classList.add("active");
    const btn = activeCard.querySelector(".station-play-btn i");
    if (btn) btn.className = "fas fa-pause";
    activeCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function updateUIForStopped() {
  const nameEl = document.getElementById("stationName");
  const descEl = document.getElementById("stationDescription");
  const imgEl = document.getElementById("stationImage");
  const defEl = document.getElementById("vinylDefault");
  if (nameEl) nameEl.textContent = t("selectStation");
  if (descEl) descEl.textContent = t("chooseFromStations");
  if (imgEl) {
    imgEl.src = "";
    imgEl.style.display = "none";
  }
  if (defEl) defEl.style.display = "";
}

function resetAllCards() {
  document.querySelectorAll(".station-card").forEach((card) => {
    card.classList.remove("active");
    const btn = card.querySelector(".station-play-btn i");
    if (btn) btn.className = "fas fa-play";
  });
}

function updateCardPlayBtns() {
  if (!currentStation) return;
  document.querySelectorAll(".station-card").forEach((card) => {
    const btn = card.querySelector(".station-play-btn i");
    if (!btn) return;
    btn.className =
      card.dataset.station === currentStation.id && isPlaying
        ? "fas fa-pause"
        : "fas fa-play";
  });
}

function showLoading(show) {
  const el = document.getElementById("radioLoading");
  if (el) el.style.display = show ? "flex" : "none";
}

function showToast(message, type = "info") {
  renderToast(
    `radio-toast ${type}`,
    `<i class="fas fa-${type === "error" ? "exclamation-circle" : "info-circle"}"></i> ${message}`,
    { duration: 3000, removeDelay: 300 },
  );
}

window.addEventListener("languageChanged", () => {
  updateRadioUI();
  loadStations();
  if (currentStation && isPlaying) updateUIForPlayingStation(currentStation);
  else setDefaultNowPlaying();
});

module.exports = { initRadioPage };
