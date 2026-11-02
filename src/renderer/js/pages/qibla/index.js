"use strict";

// The Qibla finder: the direction of the Kaaba from the saved location, on a map.
// Its parts:
//   geo.js         the Qibla's bearing and distance, the great-circle way, compass points
//   locate.js      the city's coordinates (found once, then kept), the dragged marker
//   map.js         the map (Leaflet), the markers, the way, the compass rose, zoom
//   panel.js       the direction, the distance, the place, messages
//   howto.js       how to face it without a compass (from North, with the sun)
//   panel-fold.js  folding the panel to a strip
const { state } = require("../../core/store");
const { t } = require("../../core/i18n");
const { byId } = require("../../core/dom");
const analytics = require("../../services/analytics");
const {
  setupConnectionRecovery,
} = require("../../services/connection-recovery");
const { locate, rememberMoved, forgetMoved } = require("./locate");
const { showMap, showRose, bindMapControls } = require("./map");
const { showPlace, showQibla, showMessage } = require("./panel");
const { bindPanelFold } = require("./panel-fold");

let shown = false;

const place = () => {
  const { city = "", country = "" } = state.settings ?? {};
  return { city, country };
};

/** @param {number} lat @param {number} lon @param {boolean} moved */
function showAt(lat, lon, moved) {
  showRose(showQibla(lat, lon, place().city, moved));
}

async function showLocation() {
  const { city, country } = place();
  showPlace(city, country);
  if (!city || !country) {
    showMessage(t("locationNotSet"));
    return;
  }
  if (!shown) showMessage(t("qbFinding"), { busy: true });
  try {
    const { place: found, source } = await locate(city, country);
    if (!found) {
      showMessage(t("qbNotFound").replace("{city}", city));
      return;
    }
    showMessage(null);
    showMap(found.lat, found.lon);
    showAt(found.lat, found.lon, Boolean(found.moved));
    if (!shown) analytics.qiblaLocationResolved(source);
    shown = true;
  } catch (err) {
    analytics.error("qibla_location", err?.message ?? String(err));
    showMessage(t("qbOffline"), { retry: true });
  }
}

/** The marker was dropped somewhere else. @param {number} lat @param {number} lon */
function onMoved(lat, lon) {
  const { city, country } = place();
  rememberMoved(city, country, lat, lon);
  showAt(lat, lon, true);
}

async function initQiblaPage() {
  bindPanelFold();
  bindMapControls(onMoved);
  byId("qbRetry", HTMLButtonElement).addEventListener("click", showLocation);
  byId("qbBackToCity", HTMLButtonElement).addEventListener("click", () => {
    const { city, country } = place();
    forgetMoved(city, country);
    showLocation();
  });
  // the city was not found yet because the connection was down
  setupConnectionRecovery(() => {
    if (!shown) showLocation();
  }, "Qibla");
  await showLocation();
}

module.exports = { initQiblaPage };
