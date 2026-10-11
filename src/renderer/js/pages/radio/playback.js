"use strict";

// Playing a station: one audio element, play (a newer click wins), pause/resume, stop.
const { t } = require("../../core/i18n");
const analytics = require("../../services/analytics");
const { state, radioStations } = require("./state");
const {
  updatePlayPauseButton,
  setVinylSpinning,
  setTonearm,
  setSoundBars,
  updateUIForPlayingStation,
  updateUIForStopped,
  resetAllCards,
  updateCardPlayBtns,
  showLoading,
  showToast,
} = require("./now-playing");

let playRequestId = 0;

function playStation(stationId) {
  const station = radioStations.find((s) => s.id === stationId);
  if (!station) return;
  showLoading(true);

  if (state.currentStation?.id === stationId && state.isPlaying) {
    pausePlayback();
    showLoading(false);
    return;
  }
  if (state.currentStation?.id !== stationId) stopPlayback();

  if (!state.audioPlayer) {
    state.audioPlayer = new Audio();
    setupAudioEvents();
  }

  const myRequestId = ++playRequestId;
  state.audioPlayer.src = station.url;
  state.audioPlayer.volume = state.volume / 100;

  state.audioPlayer
    .play()
    .then(() => {
      if (myRequestId !== playRequestId) return;
      state.currentStation = station;
      state.isPlaying = true;
      updateUIForPlayingStation(station);
      showLoading(false);
      analytics.radioStationPlay();
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
  if (!state.audioPlayer || !state.currentStation) {
    showToast(t("selectStationFirst"), "error");
    return;
  }
  state.isPlaying ? pausePlayback() : resumePlayback();
}

function pausePlayback() {
  if (!state.audioPlayer || !state.isPlaying) return;
  state.audioPlayer.pause();
  state.isPlaying = false;
  updatePlayPauseButton(false);
  setVinylSpinning(false);
  setTonearm(false);
  setSoundBars(false);
  updateCardPlayBtns();
}

function resumePlayback() {
  if (!state.audioPlayer || state.isPlaying) return;
  state.audioPlayer
    .play()
    .then(() => {
      state.isPlaying = true;
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
  if (!state.audioPlayer) return;
  state.audioPlayer.pause();
  state.audioPlayer.currentTime = 0;
  state.isPlaying = false;
  state.currentStation = null;
  updatePlayPauseButton(false);
  setVinylSpinning(false);
  setTonearm(false);
  setSoundBars(false);
  updateUIForStopped();
  resetAllCards();
  analytics.radioStop();
}

function setupAudioEvents() {
  if (!state.audioPlayer) return;
  state.audioPlayer.addEventListener("error", () => {
    showToast(t("playbackError"), "error");
    showLoading(false);
    stopPlayback();
  });
  state.audioPlayer.addEventListener("ended", stopPlayback);
  state.audioPlayer.addEventListener("waiting", () => {
    showLoading(true);
    setVinylSpinning(false);
  });
  state.audioPlayer.addEventListener("playing", () => {
    showLoading(false);
    if (state.isPlaying) setVinylSpinning(true);
  });
}

module.exports = { playStation, togglePlayPause, stopPlayback };
