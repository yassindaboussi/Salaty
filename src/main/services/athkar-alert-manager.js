"use strict";

const adkarData = require("../../renderer/data/adkar.json");

const CHECK_INTERVAL_MS = 30 * 1000;

let checkTimer = null;
let getSettingsData = null;
let wasEnabled = false;
let lastFiredAt = 0;

function init(settingsFn) {
  getSettingsData = settingsFn;
  wasEnabled = false;
  lastFiredAt = 0;

  if (checkTimer) clearInterval(checkTimer);
  checkTimer = setInterval(_check, CHECK_INTERVAL_MS);
}

function cleanup() {
  if (checkTimer) clearInterval(checkTimer);
  checkTimer = null;
}

function _check() {
  const settings = getSettingsData?.() || {};
  const enabled = !!settings.athkarAlertEnabled;

  if (!enabled) {
    wasEnabled = false;
    return;
  }

  if (!wasEnabled) {
    wasEnabled = true;
    lastFiredAt = Date.now();
    return;
  }

  const intervalMs = (settings.athkarAlertInterval || 30) * 60 * 1000;
  if (Date.now() - lastFiredAt < intervalMs) return;

  lastFiredAt = Date.now();
  _fireAlert(settings);
}

function _fireAlert(settings) {
  const tasbih = adkarData["تسابيح"];
  if (!tasbih?.length) return;
  const item = tasbih[Math.floor(Math.random() * tasbih.length)];

  const { showThemedPopup } = require("../ipc/handlers/popup-handlers");
  showThemedPopup(
    {
      icon: "fa-moon",
      theme: settings.theme || "navy",
      content: item.content,
      title: "Salaty Time · أذكار",
    },
    "athkar",
  );
}

module.exports = { init, cleanup };
