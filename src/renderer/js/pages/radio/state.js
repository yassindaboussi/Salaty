"use strict";

// The stations (data/radioStations.json), what is playing now (shared by the radio page's modules)
// and a station image's path from the page.
const radioStationsData = require("../../../data/radioStations.json");

const radioStations = radioStationsData.stations;

/** @typedef {(typeof radioStations)[number]} RadioStation */

function resolveStationImagePath(imagePath) {
  if (!imagePath) return "";
  return imagePath.replace(/^\.\.\/\.\.\/assets\//, "../../../assets/");
}

const state = {
  /** @type {HTMLAudioElement | null} */
  audioPlayer: null,
  /** @type {RadioStation | null} */
  currentStation: null,
  isPlaying: false,
  volume: 80,
};

module.exports = { state, radioStations, resolveStationImagePath };
