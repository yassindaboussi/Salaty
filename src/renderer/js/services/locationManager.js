"use strict";
const { ipcRenderer } = require("electron");
const { t } = require("../core/i18n/translations");
const { showToast } = require("../core/toast");

// Generic IPC wrapper — centralises error handling and toast for every operation.
async function _invoke(channel, ...args) {
  try {
    return await ipcRenderer.invoke(channel, ...args);
  } catch (err) {
    console.error(`[LocationManager] ${channel}:`, err);
    return null;
  }
}

async function getLocations() {
  return (await _invoke("get-locations")) ?? [];
}

async function getActiveLocation() {
  const locs = await getLocations();
  return locs.find((l) => l.isActive) ?? null;
}

async function addLocation(data) {
  const loc = await _invoke("add-location", data);
  if (loc) showToast(t("locationAdded"), "success");
  else showToast(t("errorAddingLocation"), "error");
  return loc;
}

async function updateLocation(id, updates) {
  const loc = await _invoke("update-location", id, updates);
  if (loc) showToast(t("locationUpdated"), "success");
  else showToast(t("errorUpdatingLocation"), "error");
  return loc;
}

async function deleteLocation(id) {
  const ok = await _invoke("delete-location", id);
  if (ok === true) showToast(t("locationDeleted"), "success");
  else if (ok === false) showToast(t("cannotDeleteLastLocation"), "error");
  else showToast(t("errorDeletingLocation"), "error");
  return ok ?? false;
}

async function setActiveLocation(id) {
  const ok = await _invoke("set-active-location", id);
  if (ok) showToast(t("locationActivated"), "success");
  else showToast(t("errorActivatingLocation"), "error");
  return ok ?? false;
}

async function toggleTravelMode(enabled) {
  return _invoke("toggle-travel-mode", enabled);
}

async function detectLocation() {
  const loc = await _invoke("detect-location");
  if (!loc) showToast(t("errorDetectingLocation"), "error");
  return loc;
}

module.exports = {
  getLocations,
  getActiveLocation,
  addLocation,
  updateLocation,
  deleteLocation,
  setActiveLocation,
  toggleTravelMode,
  detectLocation,
};
