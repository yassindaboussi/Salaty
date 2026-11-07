"use strict";

// Pinch on the touchpad (or Ctrl + mouse wheel) over the reader: the Quran text gets bigger or
// smaller, like the A- / A+ buttons (same limits, same saved size).
//
// Chromium gives a touchpad pinch to the page as a wheel event with ctrlKey set (Ctrl + wheel
// is the same event); cancelling it stops any page zoom. The size follows the fingers smoothly
// (each event scales it a little, whole pixels shown), and the ayah under the pointer stays
// where it is on screen while the lines reflow, as a PDF or map zoom keeps its point. The
// size is saved once the pinch stops.
const { byId } = require("../../core/dom");
const { state } = require("./state");
const { saveFontSize, clampFont } = require("./storage");
const { applyFontSize } = require("./reader");

const SENSITIVITY = 300; // wheel delta for a ×e change: a pinch is a few units per event
const MAX_STEP = 60; // a mouse wheel notch (100) is limited to this: about 20 % per notch
const SAVE_AFTER_MS = 400;

/** @type {number | null} the exact size during a pinch (state.fontSize is rounded) */
let exact = null;
/** @type {ReturnType<typeof setTimeout> | undefined} */
let saveTimer;

/**
 * The ayah under the pointer (or the first one in view) and its place on screen.
 * @param {HTMLElement} scroller @param {number} x @param {number} y
 */
function anchorAt(scroller, x, y) {
  let el = document.elementFromPoint(x, y)?.closest("[data-ayah]");
  if (!el || !scroller.contains(el)) {
    const top = scroller.getBoundingClientRect().top;
    el =
      [...scroller.querySelectorAll(".ayah-list [id^='ayah-']")].find(
        (a) => a.getBoundingClientRect().bottom > top,
      ) ?? null;
  }
  return el ? { el, top: el.getBoundingClientRect().top } : null;
}

/** @param {HTMLElement} scroller @param {WheelEvent} e */
function onWheel(scroller, e) {
  if (!e.ctrlKey) return; // a normal scroll
  e.preventDefault();
  const step = Math.max(-MAX_STEP, Math.min(MAX_STEP, e.deltaY));
  exact = clampFont((exact ?? state.fontSize) * Math.exp(-step / SENSITIVITY));
  const size = Math.round(exact);
  if (size !== state.fontSize) {
    const anchor = anchorAt(scroller, e.clientX, e.clientY);
    state.fontSize = size;
    applyFontSize();
    if (anchor) {
      scroller.scrollTop += anchor.el.getBoundingClientRect().top - anchor.top;
    }
  }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    exact = null;
    saveFontSize(state.fontSize);
  }, SAVE_AFTER_MS);
}

function bindPinchSize() {
  const scroller = byId("readerContent", HTMLElement);
  // not passive: the event must be cancelled
  scroller.addEventListener("wheel", (e) => onWheel(scroller, e), {
    passive: false,
  });
}

module.exports = { bindPinchSize };
