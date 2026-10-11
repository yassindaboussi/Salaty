"use strict";

// Counting: +1 (button, ring tap, Space key), undo, reset and the "no limit" switch.
const { t } = require("../../core/i18n");
const analytics = require("../../services/analytics");
const { pageState, isUnlimited } = require("./state");
const { saveTasbihState, saveUnlimitedMap } = require("./storage");
const { pulseRing, updateCounterDisplay } = require("./ring");
const { showResetConfirm, showSuccessToast } = require("./feedback");

function setupKeyboardListener() {
  document.addEventListener("keydown", (event) => {
    if (
      event.code === "Space" &&
      !event.defaultPrevented && // a focused card/button used the key itself
      !(
        event.target instanceof Element &&
        event.target.matches("input, textarea, button")
      )
    ) {
      event.preventDefault();
      pulseRing();
      incrementCount();
    }
  });
}

function incrementCount() {
  const unlimited = isUnlimited(pageState.currentDhikr.id);
  if (
    !unlimited &&
    pageState.currentDhikr.current >= pageState.currentDhikr.count
  )
    return;

  pageState.currentDhikr.current++;
  updateCounterDisplay();
  saveTasbihState();
  pulseRing();

  const isLapComplete =
    pageState.currentDhikr.current % pageState.currentDhikr.count === 0;
  if (isLapComplete) {
    const lap = pageState.currentDhikr.current / pageState.currentDhikr.count;
    if (lap <= 1) {
      showSuccessToast(
        t("dhikrCompleted").replace("{count}", pageState.currentDhikr.count),
        false,
        3000,
      );
      analytics.tasbihCompleted(pageState.currentDhikr.name);
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    } else {
      showSuccessToast(
        t("dhikrRoundCompleted").replace("{n}", lap),
        false,
        2200,
      );
      if (navigator.vibrate) navigator.vibrate([80, 40, 80, 40, 80]);
    }
  } else if (navigator.vibrate) {
    navigator.vibrate(30);
  }
}

function undoLastCount() {
  if (pageState.currentDhikr.current <= 0) return;
  pageState.currentDhikr.current--;
  updateCounterDisplay();
  saveTasbihState();
  if (navigator.vibrate) navigator.vibrate(20);
}

function toggleUnlimited() {
  pageState.unlimitedMap[pageState.currentDhikr.id] =
    !pageState.unlimitedMap[pageState.currentDhikr.id];
  saveUnlimitedMap();
  updateCounterDisplay();
}

function resetCurrentDhikr() {
  if (pageState.currentDhikr.current === 0) return;
  showResetConfirm(() => {
    pageState.currentDhikr.current = 0;
    updateCounterDisplay();
    saveTasbihState();
    showSuccessToast(t("counterReset"));
  });
}

module.exports = {
  setupKeyboardListener,
  incrementCount,
  undoLastCount,
  toggleUnlimited,
  resetCurrentDhikr,
};
