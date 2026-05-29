"use strict";
const { ipcRenderer } = require("electron");
const { state } = require("../../core/globalStore");
const { t } = require("../../core/i18n/translations");
const { showToast } = require("../../core/toast");
const QiblaMap = require("salaty-qibla-map");
const screenSizeManager = require("../../core/screenSize");
const analytics = require("../../utils/analytics");
const {
  setupConnectionRecovery,
} = require("../../services/connection-recovery");

let _map = null;
let _lat = null;
let _lng = null;

async function initQiblaPage() {
  setupConnectionRecovery(initQiblaPage, "Qibla");

  document.getElementById("backBtn")?.addEventListener("click", () => {
    const { width, height } = screenSizeManager.getWindowSize();
    ipcRenderer.invoke("navigate-to", "features", width, height);
  });

  document
    .getElementById("zoomLocationBtn")
    ?.addEventListener("click", _zoomToUser);

  _setText("qiblaTitle", t("qiblaFinder"));
  _setText("qiblaDirectionLabel", t("fromNorth"));
  _setText("locationText", t("loading"));
  _setText("instructionText", t("dragToAdjustInfo"));

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

    const label = `${result.city}, ${result.country}${result.source !== "settings-photon" ? " (Approx)" : ""}`;
    _setText("locationText", label);

    _initMap(_lat, _lng);
    if (label.includes("Approx")) showToast(t("locationApprox"), "info");
  } catch (err) {
    analytics.error("qibla_location", err.message ?? String(err));
    _setText("locationText", t("locationNotSet"));
  }
}

function _initMap(lat, lng) {
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
