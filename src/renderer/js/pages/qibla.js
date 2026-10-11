"use strict";
const { state } = require("../core/store");
const { t } = require("../core/i18n");
const { showToast } = require("../core/toast");
const QiblaMap = require("salaty-qibla-map");
const analytics = require("../services/analytics");
const { setupConnectionRecovery } = require("../services/connection-recovery");

/** @type {InstanceType<typeof QiblaMap> | null} */
let _map = null;
let _lat = null;
let _lng = null;

async function initQiblaPage() {
  document
    .getElementById("zoomLocationBtn")
    ?.addEventListener("click", _zoomToUser);

  _setText("qiblaTitle", t("qiblaFinder"));
  _setText("qiblaDirectionLabel", t("fromNorth"));
  _setText("instructionText", t("dragToAdjustInfo"));

  setupConnectionRecovery(_detectAndRenderLocation, "Qibla");
  await _detectAndRenderLocation();
}

async function _detectAndRenderLocation() {
  _setText("locationText", t("loading"));
  try {
    const { city, country, latitude, longitude, lat, lng } =
      state.settings ?? {};
    const result = await QiblaMap.detectLocation({
      city,
      country,
      lat: latitude ?? lat,
      lng: longitude ?? lng,
    });
    _lat = result.lat;
    _lng = result.lng;
    analytics.qiblaLocationResolved(result.source);

    // Only a geocoded settings city is exact; the other sources are a best guess.
    const approximate = result.source !== "settings-photon";
    _setText(
      "locationText",
      `${result.city}, ${result.country}${approximate ? ` (${t("approximate")})` : ""}`,
    );

    _initMap(_lat, _lng);
    if (approximate) showToast(t("locationApprox"), "info");
  } catch (err) {
    analytics.error("qibla_location", err.message ?? String(err));
    _setText("locationText", t("locationNotSet"));
  }
}

function _initMap(lat, lng) {
  if (_map) {
    _map.init(lat, lng);
    return;
  }
  _map = new QiblaMap("qiblaMap", {
    onAngleUpdate: (angle) => _setText("qiblaDegree", `${Math.round(angle)}°`),
    onDragEnd: (la, lo) => {
      _lat = la;
      _lng = lo;
    },
    markerPopupText: t("dragToAdjust"),
    kaabaPopupText: "Kaaba",
  });
  _map.init(lat, lng);
}

function _zoomToUser() {
  if (_map && _lat != null && _lng != null) _map.flyTo(_lat, _lng, 15);
}

function _setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

module.exports = { initQiblaPage };
