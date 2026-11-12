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

  // both play with the pre-adhan alert: dim their switches while that one is off
  const before = [
    _bindSwitch("preAdhanVoiceToggle", "preAdhanVoiceEnabled", true),
    _bindSwitch("preAdhanHadithToggle", "preAdhanHadithEnabled"),
  ];
  const syncVoice = () => {
    for (const input of before) if (input) input.disabled = !toggle.checked;
  };
  syncVoice();
  toggle.addEventListener("change", syncVoice);
  _bindSwitch("afterAdhanHadithToggle", "afterAdhanHadithEnabled");
}

/**
 * A plain on/off setting.
 * @param {string} id
 * @param {"preAdhanVoiceEnabled" | "preAdhanHadithEnabled" | "afterAdhanHadithEnabled"} key
 * @param {boolean} [onByDefault] its value before the user ever changed it
 */
function _bindSwitch(id, key, onByDefault = false) {
  const input = document.getElementById(id);
  if (!(input instanceof HTMLInputElement)) return null;
  const saved = state.settings[key];
  input.checked = saved === undefined ? onByDefault : saved === true;
  input.addEventListener("change", () => {
    state.settings[key] = input.checked;
    persistSettings();
  });
  return input;
}

module.exports = { initAthkarAlerts, initPreAdhanNotification };
