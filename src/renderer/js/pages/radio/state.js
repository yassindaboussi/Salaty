"use strict";

// What the radio page shows now (shared by its modules) and the saved favourites.

/**
 * A radio in the list.
 * @typedef {object} RadioItem
 * @property {string} key      "station:<id>" (data/radioStations.json) or "reciter:<mp3quran radio id>"
 * @property {"station" | "reciter"} kind
 * @property {string} name
 * @property {string} sub      the country, or the reciter radio's line
 * @property {string} url      the live stream
 * @property {string} [image]  a station's logo, from the page
 * @property {number} [reciterId]  for the reciter's photo (components/reciter-photo.js)
 */

const FAVOURITES_KEY = "radioFavourites"; // ["station:tunisia", "reciter:12", ...]

const view = {
  /** @type {"stations" | "reciters"} */
  tab: "stations",
  query: "",
  /** @type {RadioItem[]} */
  stations: [],
  /** @type {RadioItem[] | null} null: not loaded yet */
  reciters: null,
  recitersFailed: false,
  /** @type {RadioItem | null} what the player has (playing or paused) */
  current: null,
  playing: false,
  connecting: false,
  volume: 1, // 0..1
  /** @type {Set<string>} */
  favourites: new Set(),
};

function loadFavourites() {
  try {
    const saved = JSON.parse(localStorage.getItem(FAVOURITES_KEY) ?? "[]");
    if (Array.isArray(saved)) view.favourites = new Set(saved.map(String));
  } catch {
    // storage unavailable or broken: no favourites
  }
}

/** @param {string} key */
function toggleFavourite(key) {
  if (view.favourites.has(key)) view.favourites.delete(key);
  else view.favourites.add(key);
  try {
    localStorage.setItem(FAVOURITES_KEY, JSON.stringify([...view.favourites]));
  } catch {
    // storage unavailable: the favourites last until the page closes
  }
}

/** @param {string} key */
const findItem = (key) =>
  [...view.stations, ...(view.reciters ?? [])].find((r) => r.key === key) ??
  null;

module.exports = { view, loadFavourites, toggleFavourite, findItem };
