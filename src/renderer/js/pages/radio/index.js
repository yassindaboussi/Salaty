"use strict";

// The radio page (radio.html). Its parts:
//   stations.js      the station cards
//   playback.js      the audio: play, pause/resume, stop
//   volume.js        volume slider and mute
//   now-playing.js   what the page shows about playback (vinyl, tonearm, icons, loading, toasts)
//   state.js         the stations and what is playing now
const { ipcRenderer } = require("electron");
const {
  setupConnectionRecovery,
} = require("../../services/connection-recovery");
const { t } = require("../../core/i18n");
const { loadStations } = require("./stations");
const { togglePlayPause, stopPlayback } = require("./playback");
const { setVolume, toggleMute, loadSavedVolume } = require("./volume");
const { setDefaultNowPlaying } = require("./now-playing");

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

function setupPlayerControls() {
  const pp = document.getElementById("playPauseBtn");
  const st = document.getElementById("stopBtn");
  const mu = document.getElementById("muteBtn");
  const vol = document.getElementById("volumeSlider");
  if (pp) pp.addEventListener("click", togglePlayPause);
  if (st) st.addEventListener("click", stopPlayback);
  if (mu) mu.addEventListener("click", toggleMute);
  if (vol instanceof HTMLInputElement)
    vol.addEventListener("input", () => setVolume(parseInt(vol.value)));
}

module.exports = { initRadioPage };
