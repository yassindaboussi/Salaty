"use strict";

// The station cards; a click on a card or its button plays the station (or pauses it).
const { t, getLanguage } = require("../../core/i18n");
const { html, setHtml } = require("../../utils/html");
const { queryAll } = require("../../core/dom");
const { radioStations, resolveStationImagePath } = require("./state");
const { playStation } = require("./playback");

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
  setHtml(
    card,
    html`
    <div class="station-card-image"><img src="${resolveStationImagePath(station.image)}" alt="${name}" loading="lazy"></div>
    <div class="station-card-info">
      <div class="station-card-name">${name}</div>
      <div class="station-card-location">${country}</div>
    </div>
    <div class="station-card-bars"><span></span><span></span><span></span></div>
    <button type="button" class="station-play-btn" data-station="${station.id}" aria-label="${t("tooltipPlayPause")}: ${name}">
      <i class="fas fa-play" aria-hidden="true"></i>
    </button>`,
  );
  return card;
}

function setupStationCards() {
  queryAll(".station-card", HTMLElement).forEach((card) => {
    const id = card.dataset.station;
    card.addEventListener("click", (e) => {
      if (!(e.target instanceof Element)) return;
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

module.exports = { loadStations };
