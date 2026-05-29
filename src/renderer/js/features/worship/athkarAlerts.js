"use strict";
const { ipcRenderer } = require("electron");
const { state } = require("../../core/globalStore");
const { getAdkar } = require("../../services/api/api");

let adkarData = require("../../../data/adkar.json");
let _intervalId = null;

// Refresh adkar data from API in the background without blocking init.
getAdkar()
  .then((d) => {
    adkarData = d;
  })
  .catch(() => {
    /* use bundled fallback */
  });

function initAthkarAlertsSystem() {
  if (_intervalId) {
    clearInterval(_intervalId);
    _intervalId = null;
  }
  if (!state.settings.athkarAlertEnabled) return;

  const minutes = state.settings.athkarAlertInterval || 30;
  _intervalId = setInterval(_sendAlert, minutes * 60 * 1_000);
}

function _sendAlert() {
  const tasbih = adkarData["تسابيح"];
  if (!tasbih?.length) return;
  const item = tasbih[Math.floor(Math.random() * tasbih.length)];
  ipcRenderer.send("show-athkar-popup", {
    theme: state.settings.theme || "navy",
    content: item.content,
    title: "Salaty Time · أذكار",
  });
}

module.exports = { initAthkarAlertsSystem };
