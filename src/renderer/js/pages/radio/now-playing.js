"use strict";

// What the page shows about playback: the now-playing text and image, the vinyl, tonearm and
// sound bars, the play/pause icons, the active station card, the loading overlay and toasts.
const { t, getLanguage } = require("../../core/i18n");
const { renderToast } = require("../../core/toast");
const { queryAll } = require("../../core/dom");
const { state, resolveStationImagePath } = require("./state");

function setDefaultNowPlaying() {
  const nameEl = document.getElementById("stationName");
  const descEl = document.getElementById("stationDescription");
  if (nameEl) nameEl.textContent = t("selectStation");
  if (descEl) descEl.textContent = t("chooseFromStations");
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
  if (imgEl instanceof HTMLImageElement) {
    imgEl.src = resolveStationImagePath(station.image);
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
  if (imgEl instanceof HTMLImageElement) {
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
  if (!state.currentStation) return;
  queryAll(".station-card", HTMLElement).forEach((card) => {
    const btn = card.querySelector(".station-play-btn i");
    if (!btn) return;
    btn.className =
      card.dataset.station === state.currentStation?.id && state.isPlaying
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
    `<i class="fas fa-${type === "error" ? "exclamation-circle" : "info-circle"}" aria-hidden="true"></i> ${message}`,
    { duration: 3000, removeDelay: 300 },
  );
}

module.exports = {
  setDefaultNowPlaying,
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
};
