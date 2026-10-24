"use strict";

// Counting: +1 (the ring, Space or Enter), undo (the button or Backspace), reset, "no limit",
// and the after-prayer tasbih, which moves to the next words by itself when a target is reached.
const { t } = require("../../core/i18n");
const analytics = require("../../services/analytics");
const { showConfirmDialog } = require("../../components/confirm-dialog");
const { pageState, AFTER_PRAYER, counting } = require("./state");
const storage = require("./storage");
const { pulseRing, updateCounterDisplay } = require("./ring");
const { renderActive } = require("./active");
const { showSuccessToast, announce } = require("./feedback");

const NEXT_STEP_DELAY_MS = 700;
/** @type {(() => void) | null} told after each change (the list) */
let onChange = null;

/** @param {() => void} listener */
const setOnChange = (listener) => {
  onChange = listener;
};

function refresh() {
  renderActive();
  updateCounterDisplay();
  onChange?.();
}

/** @param {number} value */
function setCurrent(value) {
  const seq = pageState.sequence;
  if (seq) {
    seq.counts[seq.step] = value;
    storage.saveSequence();
  } else {
    pageState.counts[pageState.currentId] = value;
    storage.saveCounts();
  }
}

function increment() {
  const { dhikr, target, current, unlimited } = counting();
  if (pageState.sequence?.done || (!unlimited && current >= target)) return;
  setCurrent(current + 1);
  pulseRing();
  updateCounterDisplay();
  onChange?.();

  const reached = (current + 1) % target === 0;
  if (!reached) return;
  const seq = pageState.sequence;
  if (seq) {
    if (seq.step < AFTER_PRAYER.length - 1) {
      announce(t("tbStepDone").replace("{name}", dhikr.name));
      setTimeout(() => {
        if (pageState.sequence !== seq) return; // stopped meanwhile
        seq.step++;
        storage.saveSequence();
        refresh();
      }, NEXT_STEP_DELAY_MS);
    } else {
      seq.done = true;
      storage.saveSequence();
      showSuccessToast(t("tbSequenceDone"), false, 3500);
      announce(t("tbSequenceDone"));
      analytics.tasbihSequenceCompleted();
      refresh();
    }
    return;
  }
  const lap = (current + 1) / target;
  const message =
    lap <= 1
      ? t("dhikrCompleted").replace("{count}", String(target))
      : t("dhikrRoundCompleted").replace("{n}", String(lap));
  showSuccessToast(message, false, 2500);
  announce(message);
  if (lap === 1) analytics.tasbihCompleted(dhikr.custom ? "custom" : dhikr.id);
}

function undo() {
  const { current } = counting();
  if (current <= 0 || pageState.sequence?.done) return;
  setCurrent(current - 1);
  updateCounterDisplay();
  onChange?.();
}

async function reset() {
  const seq = pageState.sequence;
  if (seq) {
    if (seq.counts.every((c) => c === 0)) return;
    if (
      !(await showConfirmDialog(t("tbSequenceResetConfirm"), {
        confirmText: t("reset"),
      }))
    )
      return;
    startSequence();
    return;
  }
  if (!counting().current) return;
  if (
    !(await showConfirmDialog(t("resetConfirmMessage"), {
      confirmText: t("reset"),
    }))
  )
    return;
  setCurrent(0);
  refresh();
  showSuccessToast(t("counterReset"));
}

function toggleUnlimited() {
  if (pageState.sequence) return;
  pageState.unlimited[pageState.currentId] =
    !pageState.unlimited[pageState.currentId];
  storage.saveUnlimited();
  refresh();
}

function startSequence() {
  pageState.sequence = {
    step: 0,
    counts: AFTER_PRAYER.map(() => 0),
    done: false,
  };
  storage.saveSequence();
  refresh();
}

function stopSequence() {
  pageState.sequence = null;
  storage.saveSequence();
  refresh();
}

/** @param {string} id */
function choose(id) {
  pageState.sequence = null;
  storage.saveSequence();
  pageState.currentId = id;
  storage.saveCounts();
  refresh();
}

// Space / Enter count and Backspace undoes, unless typing or on a control that uses the key.
function bindKeys() {
  document.addEventListener("keydown", (e) => {
    const el = e.target;
    const typing =
      el instanceof Element &&
      el.closest(
        "input, textarea, select, dialog[open], .custom-dialog-overlay",
      );
    if (typing || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey)
      return;
    const onControl = el instanceof Element && el.closest("button, a");
    if ((e.code === "Space" || e.key === "Enter") && !onControl) {
      e.preventDefault();
      increment();
    } else if (e.key === "Backspace") {
      e.preventDefault();
      undo();
    }
  });
}

module.exports = {
  increment,
  undo,
  reset,
  toggleUnlimited,
  startSequence,
  stopSequence,
  choose,
  bindKeys,
  refresh,
  setOnChange,
};
