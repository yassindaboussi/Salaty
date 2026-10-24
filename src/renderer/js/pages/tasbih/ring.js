"use strict";

// The counter display: the count and its target, the round badge (no limit), the progress ring
// with its bead, the limit chip and the counter's accessible name.
const { t } = require("../../core/i18n");
const { counting } = require("./state");

const RING_RADIUS = 96;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function pulseRing() {
  const ring = document.getElementById("tbRingTap");
  if (!ring) return;
  ring.classList.remove("is-pulse");
  void ring.offsetWidth; // restart the animation
  ring.classList.add("is-pulse");
}

function ringState() {
  const { target, current, unlimited } = counting();
  const size = target || 1;
  if (unlimited && current > size) {
    const inLap = current % size === 0 ? size : current % size;
    return {
      target: size,
      current,
      unlimited,
      fraction: inLap / size,
      inLap,
      lap: Math.ceil(current / size),
    };
  }
  return {
    target: size,
    current,
    unlimited,
    fraction: Math.min(current / size, 1),
    inLap: current,
    lap: current > 0 ? 1 : 0,
  };
}

function updateCounterDisplay() {
  const s = ringState();
  const value = document.getElementById("counterValue");
  const targetLine = document.getElementById("targetLine");
  const badge = document.getElementById("tbRoundBadge");
  if (value) value.textContent = String(s.current);
  if (targetLine) {
    targetLine.textContent =
      s.unlimited && s.lap >= 2
        ? `${s.inLap} / ${s.target}`
        : s.unlimited
          ? "∞"
          : `/ ${s.target}`;
  }
  if (badge) {
    const show = s.unlimited && s.lap >= 2;
    badge.hidden = !show;
    if (show) badge.textContent = t("roundLabel").replace("{n}", String(s.lap));
  }
  const tap = document.getElementById("tbRingTap");
  if (tap) {
    tap.setAttribute(
      "aria-label",
      `${t("countBtn")}: ${s.current}${s.unlimited ? "" : ` / ${s.target}`}`,
    );
    tap.classList.toggle("is-done", !s.unlimited && s.current >= s.target);
  }
  updateRing(s.fraction);
  updateLimitChip(s.unlimited, s.target);
}

let shownFraction = 0;

/**
 * The arc from the top, clockwise, and the bead at its end. The SVG is turned a quarter back
 * (CSS), so the arc and the bead both start at the top. Both move with the same transition;
 * going back (a new lap, a reset) they jump instead of running backwards round the ring.
 * @param {number} fraction 0-1
 */
function updateRing(fraction) {
  const progress = document.getElementById("tbRingProgress");
  const turn = document.getElementById("tbRingBeadTurn");
  const bead = document.getElementById("tbRingBead");
  if (!progress || !turn || !bead) return;
  const jump = fraction < shownFraction - 0.5;
  shownFraction = fraction;
  for (const el of [progress, turn]) el.classList.toggle("no-move", jump);
  if (jump) void progress.getBoundingClientRect(); // apply the jump before the next move
  progress.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;
  progress.style.strokeDashoffset = `${RING_CIRCUMFERENCE * (1 - fraction)}`;
  turn.style.transform = `rotate(${fraction * 360}deg)`;
  bead.style.opacity = fraction > 0.01 ? "1" : "0";
}

/** @param {boolean} unlimited @param {number} target */
function updateLimitChip(unlimited, target) {
  const chip = document.getElementById("tbLimitChip");
  const text = document.getElementById("tbLimitChipText");
  if (!chip || !text) return;
  chip.setAttribute("aria-pressed", String(unlimited));
  text.textContent = unlimited
    ? t("noLimit")
    : t("stopAtCount").replace("{count}", String(target));
  const icon = chip.querySelector("i");
  if (icon)
    icon.className = unlimited ? "fas fa-infinity" : "fas fa-flag-checkered";
}

module.exports = { pulseRing, updateCounterDisplay };
