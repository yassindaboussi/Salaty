"use strict";

// The side panel (the direction, the distance, the place) and the map's messages.
const { byId } = require("../../core/dom");
const { t, getLocaleTag } = require("../../core/i18n");
const { qiblaOf, compassPoint } = require("./geo");
const { showHowTo } = require("./howto");

const POINTS = [
  "qbPointN",
  "qbPointNE",
  "qbPointE",
  "qbPointSE",
  "qbPointS",
  "qbPointSW",
  "qbPointW",
  "qbPointNW",
];

const locale = () => `${getLocaleTag()}-u-nu-latn`;

/** @param {string} id @param {string} text */
const setText = (id, text) => {
  byId(id, HTMLElement).textContent = text;
};

/** "36.81° N, 10.18° E" @param {number} lat @param {number} lon */
function coordinates(lat, lon) {
  const n = new Intl.NumberFormat(locale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const part = (/** @type {string} */ key, /** @type {number} */ value) =>
    t(key).replace("{n}", n.format(Math.abs(value)));
  return t("qbCoords")
    .replace("{lat}", part(lat >= 0 ? "qbLatN" : "qbLatS", lat))
    .replace("{lon}", part(lon >= 0 ? "qbLonE" : "qbLonW", lon));
}

/** @param {string} city @param {string} country */
function showPlace(city, country) {
  setText("qbCity", city || "—");
  setText("qbCountry", country);
}

/**
 * @param {number} lat @param {number} lon @param {string} city
 * @param {boolean} moved the user dragged the marker away from the city's centre
 * @returns {number} the bearing
 */
function showQibla(lat, lon, city, moved) {
  const { bearing, km, arc } = qiblaOf(lat, lon);
  byId("qbMovedRow", HTMLElement).hidden = !moved;
  const degrees = new Intl.NumberFormat(locale(), {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(bearing);
  const point = t(POINTS[compassPoint(bearing)]);
  setText("qbBearing", `${degrees}°`);
  setText("qbRailBearing", `${Math.round(bearing)}°`);
  setText("qbPoint", point);
  showHowTo(`${degrees}°`, point, arc);
  setText(
    "qbDistance",
    new Intl.NumberFormat(locale(), {
      style: "unit",
      unit: "kilometer",
      maximumFractionDigits: 0,
    }).format(km),
  );
  setText("qbCoords", coordinates(lat, lon));
  byId("qbMap", HTMLElement).setAttribute(
    "aria-label",
    t("qbMapLabel").replace("{city}", city).replace("{degrees}", `${degrees}°`),
  );
  byId("qbLayout", HTMLElement).classList.add("is-ready");
  return bearing;
}

/**
 * A message over the map: while finding the city, or why it can't be shown.
 * @param {string | null} text null hides it @param {{ busy?: boolean, retry?: boolean }} [opts]
 */
function showMessage(text, { busy = false, retry = false } = {}) {
  const box = byId("qbMessage", HTMLElement);
  box.hidden = text === null;
  box.classList.toggle("is-busy", busy);
  setText("qbMessageText", text ?? "");
  byId("qbRetry", HTMLButtonElement).hidden = !retry;
}

module.exports = { showPlace, showQibla, showMessage };
