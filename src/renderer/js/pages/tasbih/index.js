"use strict";

// The tasbih (dhikr counter) page. Its parts:
//   counter.js      counting: +1 (button, ring tap, Space key), undo, reset, the "no limit" switch
//   ring.js         the counter display: count, target, round badge, progress ring, limit chip
//   dhikr-list.js   the dhikr cards and the panel about the dhikr being counted
//   feedback.js     the success toast and the reset confirmation dialog
//   storage.js      the saved counts and choices (localStorage)
//   state.js        the dhikr list (data/tasbih.json) and what is being counted now
const { t } = require("../../core/i18n");
const { loadTasbihState } = require("./storage");
const { populateDhikrGrid, updateActiveDhikrPanel } = require("./dhikr-list");
const { updateCounterDisplay } = require("./ring");
const {
  setupKeyboardListener,
  incrementCount,
  undoLastCount,
  toggleUnlimited,
  resetCurrentDhikr,
} = require("./counter");

// Everything on this page is local (data/tasbih.json + localStorage), so there is nothing to
// reload when the connection comes back.
function initTasbihPage() {
  document
    .getElementById("incrementBtn")
    ?.addEventListener("click", incrementCount);
  document
    .getElementById("tbRingTap")
    ?.addEventListener("click", incrementCount);
  document.getElementById("undoBtn")?.addEventListener("click", undoLastCount);
  document
    .getElementById("resetBtn")
    ?.addEventListener("click", resetCurrentDhikr);
  document
    .getElementById("tbLimitChip")
    ?.addEventListener("click", toggleUnlimited);

  loadTasbihState();
  updateStaticText();
  populateDhikrGrid();
  updateActiveDhikrPanel();
  updateCounterDisplay();
  setupKeyboardListener();
}

function updateStaticText() {
  const undoBtn = document.getElementById("undoBtn");
  if (undoBtn) undoBtn.setAttribute("aria-label", t("undoBtn"));

  const tasbihFooter = document.getElementById("tasbihFooterText");
  if (tasbihFooter) {
    // one of the remembrance quotes (locales/<lang>/worship/tasbih.json), picked at random
    const quotes = t("footerQuotes");
    if (Array.isArray(quotes)) {
      tasbihFooter.textContent =
        quotes[Math.floor(Math.random() * quotes.length)];
    }
  }
}

module.exports = { initTasbihPage };
