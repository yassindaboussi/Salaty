"use strict";

// The counter display: the count, the target, the round badge, the progress ring with its bead
// and the "stop at N / no limit" chip.
const { t } = require("../../core/i18n");
const { pageState, isUnlimited } = require("./state");

const RING_RADIUS = 96;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function pulseRing() {
  const ring = document.getElementById("tbRingTap");
  if (!ring) return;
  ring.classList.remove("tasbih-ring-tap--pulse");
  void ring.offsetWidth;
  ring.classList.add("tasbih-ring-tap--pulse");
}

function computeRingState() {
  const target = pageState.currentDhikr.count || 1;
  const current = pageState.currentDhikr.current;
  const unlimited = isUnlimited(pageState.currentDhikr.id);

  let fraction;
  let lapLocalCount;
  let lapNumber;

  if (unlimited && current > target) {
    const mod = current % target;
    lapLocalCount = mod === 0 ? target : mod;
    fraction = lapLocalCount / target;
    lapNumber = Math.ceil(current / target);
  } else {
    lapLocalCount = current;
    fraction = target > 0 ? Math.min(current / target, 1) : 0;
    lapNumber = current > 0 ? 1 : 0;
  }

  return { target, current, unlimited, fraction, lapLocalCount, lapNumber };
}

function updateCounterDisplay() {
  const state = computeRingState();

  const cv = document.getElementById("counterValue");
  const targetLine = document.getElementById("targetLine");
  const roundBadge = document.getElementById("tbRoundBadge");

  if (cv) cv.textContent = String(state.current);

  if (targetLine) {
    targetLine.textContent =
      state.unlimited && state.lapNumber >= 2
        ? `${state.lapLocalCount} / ${state.target}`
        : `/ ${state.target}`;
  }

  if (roundBadge) {
    if (state.unlimited && state.lapNumber >= 2) {
      roundBadge.textContent = t("roundLabel").replace("{n}", state.lapNumber);
      roundBadge.classList.remove("hidden");
    } else {
      roundBadge.classList.add("hidden");
    }
  }

  updateRing(state.fraction);
  updateLimitChip(state.unlimited);
}

function updateRing(fraction) {
  const progressEl = document.getElementById("tbRingProgress");
  const beadEl = document.getElementById("tbRingBead");
  if (!progressEl) return;

  const offset = RING_CIRCUMFERENCE * (1 - fraction);
  progressEl.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;
  progressEl.style.strokeDashoffset = `${offset}`;

  if (beadEl) {
    const angleDeg = fraction * 360 - 90;
    const angleRad = (angleDeg * Math.PI) / 180;
    const cx = 110 + RING_RADIUS * Math.cos(angleRad);
    const cy = 110 + RING_RADIUS * Math.sin(angleRad);
    beadEl.setAttribute("cx", cx.toFixed(2));
    beadEl.setAttribute("cy", cy.toFixed(2));
    beadEl.style.opacity = fraction > 0.01 ? "1" : "0";
  }
}

function updateLimitChip(unlimited) {
  const chip = document.getElementById("tbLimitChip");
  const chipText = document.getElementById("tbLimitChipText");
  if (!chip || !chipText) return;

  chip.classList.toggle("tasbih-limit-chip--unlimited", unlimited);
  chip.setAttribute("aria-pressed", String(unlimited));
  chipText.textContent = unlimited
    ? t("noLimit")
    : t("stopAtCount").replace("{count}", pageState.currentDhikr.count);

  const icon = chip.querySelector("i");
  if (icon)
    icon.className = unlimited ? "fas fa-infinity" : "fas fa-flag-checkered";
}

module.exports = { pulseRing, updateCounterDisplay };
