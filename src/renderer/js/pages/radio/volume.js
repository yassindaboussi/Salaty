"use strict";

// The volume slider (remembered in localStorage "radioVolume"), mute, and the volume icon.
const { state } = require("./state");

let isMuted = false;

function setVolume(value) {
  state.volume = Math.min(100, Math.max(0, value));
  if (state.audioPlayer) state.audioPlayer.volume = state.volume / 100;
  localStorage.setItem("radioVolume", String(state.volume));
  updateVolumeIcon();
}

function toggleMute() {
  if (!state.audioPlayer) return;
  isMuted = !isMuted;
  state.audioPlayer.muted = isMuted;
  updateVolumeIcon();
}

function loadSavedVolume() {
  const saved = localStorage.getItem("radioVolume");
  if (saved !== null) {
    state.volume = parseInt(saved);
    const slider = document.getElementById("volumeSlider");
    if (slider instanceof HTMLInputElement) slider.value = String(state.volume);
    updateVolumeIcon();
  }
}

function updateVolumeIcon() {
  const icon = document.getElementById("volumeIcon");
  if (!icon) return;
  icon.className =
    state.volume === 0 || isMuted
      ? "fas fa-volume-mute"
      : state.volume < 50
        ? "fas fa-volume-down"
        : "fas fa-volume-up";
}

module.exports = { setVolume, toggleMute, loadSavedVolume };
