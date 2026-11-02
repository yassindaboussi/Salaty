"use strict";

// The map (Leaflet, OpenStreetMap tiles): the user's place, the Kaaba, the great-circle way
// between them, and a compass rose. On this flat map the way is a curve whose angle on screen
// is not the Qibla, so the rose shows the true direction. The user's marker can be dragged to
// the exact place (the city's coordinates are its centre).
// The tiles come with the app's User-Agent, as OSM's tile policy asks (main/app/security.js).
const L = require("leaflet");
const { byId } = require("../../core/dom");
const { t } = require("../../core/i18n");
const { html } = require("../../utils/html");
const { wayToKaaba } = require("./geo");

const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

/** @type {L.Map | null} */
let map = null;
/** @type {L.Marker | null} */
let you = null;
/** @type {L.Marker | null} */
let kaaba = null;
/** @type {L.Polyline | null} */
let way = null;
/** @type {(lat: number, lon: number) => void} */
let onMoved = () => {};

const youIcon = () =>
  L.divIcon({
    className: "qb-you-marker",
    html: String(html`<span class="qb-you-dot"></span>`),
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

const kaabaIcon = () =>
  L.divIcon({
    className: "qb-kaaba-marker",
    html: String(html`<i class="fas fa-kaaba" aria-hidden="true"></i>`),
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

function createMap() {
  map = L.map("qbMap", {
    zoomControl: false,
    worldCopyJump: true,
    minZoom: 2,
    maxZoom: 19,
  });
  map.attributionControl.setPrefix(false);
  const tiles = L.tileLayer(TILES, { maxZoom: 19, attribution: ATTRIBUTION });
  // no connection: the way still shows, the map says why it is blank
  tiles.on("tileerror", () =>
    byId("qbMapCard", HTMLElement).classList.add("has-tile-error"),
  );
  tiles.on("tileload", () =>
    byId("qbMapCard", HTMLElement).classList.remove("has-tile-error"),
  );
  tiles.addTo(map);

  you = L.marker([0, 0], {
    icon: youIcon(),
    draggable: true,
    autoPan: true,
    keyboard: true,
    title: t("qbYouHere"),
    alt: t("qbYouHere"),
  }).addTo(map);
  you.on("drag", () => {
    const p = you?.getLatLng();
    if (p) drawWay(p.lat, p.lng);
  });
  you.on("dragend", () => {
    const p = you?.getLatLng().wrap();
    if (p) onMoved(p.lat, p.lng);
  });
  kaaba = L.marker([0, 0], {
    icon: kaabaIcon(),
    keyboard: false,
    title: t("qbKaaba"),
  }).addTo(map);
}

/** @param {number} lat @param {number} lon */
function drawWay(lat, lon) {
  if (!map || !kaaba) return;
  const points = wayToKaaba(lat, lon);
  if (way) way.setLatLngs(points);
  else
    way = L.polyline(points, {
      className: "qb-way",
      interactive: false,
      weight: 3,
    }).addTo(map);
  kaaba.setLatLng(points[points.length - 1]); // stays at the end of an unwrapped way
}

/** Both ends of the way in view. */
function fitWay() {
  if (map && way) map.fitBounds(way.getBounds(), { padding: [48, 48] });
}

/**
 * Puts the user on the map and shows the whole way.
 * @param {number} lat @param {number} lon
 */
function showMap(lat, lon) {
  if (!map) createMap();
  you?.setLatLng([lat, lon]);
  drawWay(lat, lon);
  fitWay();
  byId("qbMapCard", HTMLElement).classList.add("has-map");
}

/** The compass rose: its needle points to the Qibla. @param {number} bearing */
function showRose(bearing) {
  byId("qbRoseNeedle", SVGGElement).setAttribute(
    "transform",
    `rotate(${bearing.toFixed(2)})`,
  );
}

/** @param {(lat: number, lon: number) => void} handler called when the marker is dropped */
function bindMapControls(handler) {
  onMoved = handler;
  byId("qbZoomIn", HTMLButtonElement).addEventListener("click", () =>
    map?.zoomIn(),
  );
  byId("qbZoomOut", HTMLButtonElement).addEventListener("click", () =>
    map?.zoomOut(),
  );
  byId("qbZoomFit", HTMLButtonElement).addEventListener("click", fitWay);
  byId("qbZoomYou", HTMLButtonElement).addEventListener("click", () => {
    const p = you?.getLatLng();
    if (map && p) map.flyTo(p, 15, { duration: 1 });
  });
  // the panel folding or the window resizing changes the map's size
  new ResizeObserver(() => map?.invalidateSize()).observe(
    byId("qbMap", HTMLElement),
  );
}

module.exports = { showMap, showRose, bindMapControls };
