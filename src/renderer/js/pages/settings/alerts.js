"use strict";

// The reminders: athkar alerts every N minutes, and the notification N minutes before the adhan.
const { state } = require("../../core/store");
const { persistSettings, scheduleAutoSave } = require("./persist");

function initAthkarAlerts() {
  const toggle = document.getElementById("athkarAlertsToggle");
  const intervalInput = document.getElementById("athkarIntervalInput");
  const container = document.getElementById("athkarIntervalContainer");

  if (
    !(toggle instanceof HTMLInputElement) ||
    !(intervalInput instanceof HTMLInputElement) ||
    !container
  )
    return;

  toggle.checked = state.settings.athkarAlertEnabled || false;
  intervalInput.value = String(state.settings.athkarAlertInterval || 30);

  const updateUI = () => {
    if (toggle.checked) {
      container.classList.add("active");
      intervalInput.disabled = false;
    } else {
      container.classList.remove("active");
      intervalInput.disabled = true;
    }
  };

  updateUI();

  toggle.addEventListener("change", () => {
    updateUI();
    state.settings.athkarAlertEnabled = toggle.checked;
    persistSettings();
  });

  intervalInput.addEventListener("change", () => {
    const v = parseInt(intervalInput.value);
    state.settings.athkarAlertInterval = isNaN(v) || v < 1 ? 30 : v;
    scheduleAutoSave();
  });
}

function initPreAdhanNotification() {
  const toggle = document.getElementById("preAdhanNotificationToggle");
  const minutesInput = document.getElementById("preAdhanMinutesInput");
  const container = document.getElementById("preAdhanMinutesContainer");

  if (
    !(toggle instanceof HTMLInputElement) ||
    !(minutesInput instanceof HTMLInputElement) ||
    !container
  )
    return;

  toggle.checked = state.settings.preAdhanNotificationEnabled !== false;
  minutesInput.value = String(state.settings.preAdhanMinutes || 5);

  const updateUI = () => {
    if (toggle.checked) {
      container.classList.add("active");
      minutesInput.disabled = false;
    } else {
      container.classList.remove("active");
      minutesInput.disabled = true;
    }
  };

  updateUI();

  toggle.addEventListener("change", () => {
    updateUI();
    state.settings.preAdhanNotificationEnabled = toggle.checked;
    persistSettings();
  });

  minutesInput.addEventListener("change", () => {
    const v = parseInt(minutesInput.value);
    state.settings.preAdhanMinutes = isNaN(v) || v < 1 ? 5 : v;
    scheduleAutoSave();
  });
}

module.exports = { initAthkarAlerts, initPreAdhanNotification };
