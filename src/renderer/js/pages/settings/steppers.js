"use strict";

// The − / + buttons next to the number inputs: a click steps the value within the input's
// min/max, holding the button repeats it.
const { queryAll } = require("../../core/dom");

function initNumberSteppers() {
  queryAll(".num-spinner-btn", HTMLElement).forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.target ?? "");
      if (!(input instanceof HTMLInputElement)) return;
      const delta = parseInt(btn.dataset.delta ?? "", 10);
      // .min / .max are "" (not null) when the attribute is missing: no limit then
      const min = input.min === "" ? -Infinity : parseFloat(input.min);
      const max = input.max === "" ? Infinity : parseFloat(input.max);
      const next = Math.min(
        max,
        Math.max(min, (parseFloat(input.value) || 0) + delta),
      );
      input.value = String(next);
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    // Holding the button repeats it. A touch also fires mousedown, so a new hold first
    // clears the previous one (otherwise the first interval would never be stopped).
    /** @type {ReturnType<typeof setTimeout> | null} */
    let holdTimer = null;
    /** @type {ReturnType<typeof setInterval> | null} */
    let repeatTimer = null;
    const stopHold = () => {
      if (holdTimer) clearTimeout(holdTimer);
      if (repeatTimer) clearInterval(repeatTimer);
      holdTimer = null;
      repeatTimer = null;
    };
    const startHold = () => {
      stopHold();
      holdTimer = setTimeout(() => {
        repeatTimer = setInterval(() => btn.click(), 80);
      }, 600);
    };
    btn.addEventListener("mousedown", startHold);
    btn.addEventListener("mouseup", stopHold);
    btn.addEventListener("mouseleave", stopHold);
    btn.addEventListener("touchstart", startHold, { passive: true });
    btn.addEventListener("touchend", stopHold);
    btn.addEventListener("touchcancel", stopHold);
  });
}

module.exports = { initNumberSteppers };
