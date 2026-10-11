"use strict";

// Counting a dhikr's recitations (+, −, reset), saving the counts and updating its card in place.
const { t } = require("../../core/i18n");
const analytics = require("../../services/analytics");
const { state, saveAthkarState } = require("./state");
const { showSuccessToast } = require("./feedback");

function incrementCount(athkarId, targetCount) {
  if (!state.athkarState[athkarId]) state.athkarState[athkarId] = 0;

  const isUnlimited = targetCount === null || targetCount === undefined;

  if (isUnlimited || state.athkarState[athkarId] < targetCount) {
    state.athkarState[athkarId]++;
    saveAthkarState();
    updateAthkarCard(athkarId, targetCount);
    showSuccessToast(t("countIncreased"));

    if (!isUnlimited && state.athkarState[athkarId] >= targetCount) {
      const items =
        (state.currentCategory && state.athkarData[state.currentCategory]) ||
        [];
      const allDone = items.every((item, idx) => {
        const id = `${state.currentCategory}-${idx}`;
        if (item.count === null || item.count === undefined) return true;
        return (state.athkarState[id] || 0) >= (parseInt(item.count) || 1);
      });
      if (allDone) analytics.athkarCategoryCompleted(state.currentCategory);
    }
  } else {
    showSuccessToast(t("maxCountReached"), true);
  }
}

function decrementCount(athkarId, targetCount) {
  if (!state.athkarState[athkarId]) state.athkarState[athkarId] = 0;

  if (state.athkarState[athkarId] > 0) {
    state.athkarState[athkarId]--;
    saveAthkarState();
    updateAthkarCard(athkarId, targetCount);
  }
}

function resetCount(athkarId) {
  state.athkarState[athkarId] = 0;
  saveAthkarState();
  updateAthkarCard(athkarId);
  showSuccessToast(t("countReset"));
}

function updateAthkarCard(athkarId, targetCount = null) {
  const card = document.getElementById(`athkar-${athkarId}`);
  if (!card) return;

  const index = parseInt(String(card.dataset.index));
  const athkarItem =
    state.currentCategory && state.athkarData[state.currentCategory][index];

  if (!athkarItem) return;

  const isUnlimited =
    athkarItem.count === null || athkarItem.count === undefined;
  const currentCount = state.athkarState[athkarId] || 0;
  const itemTargetCount = isUnlimited
    ? null
    : targetCount || parseInt(athkarItem.count) || 1;
  const progress =
    itemTargetCount === null
      ? 0
      : Math.min((currentCount / itemTargetCount) * 100, 100);
  const isCompleted =
    itemTargetCount !== null && currentCount >= itemTargetCount;

  const countValue = card.querySelector(".count-value");
  const countTarget = card.querySelector(".count-target");
  const decrementBtn = card.querySelector(".decrement-btn");
  const incrementBtn = card.querySelector(".increment-btn");

  if (countValue) countValue.textContent = currentCount;
  if (countTarget)
    countTarget.textContent = `/${isUnlimited ? "∞" : itemTargetCount}`;
  if (decrementBtn instanceof HTMLButtonElement)
    decrementBtn.disabled = currentCount <= 0;

  const progressBar = card.querySelector(".progress-bar");
  if (progressBar instanceof HTMLElement) {
    progressBar.style.width = `${progress}%`;
  }

  if (isCompleted) {
    card.classList.add("completed");
    if (incrementBtn instanceof HTMLButtonElement) incrementBtn.disabled = true;
  } else {
    card.classList.remove("completed");
    if (incrementBtn instanceof HTMLButtonElement)
      incrementBtn.disabled = false;
  }
}

module.exports = { incrementCount, decrementCount, resetCount };
