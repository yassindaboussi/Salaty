"use strict";

// The Features page: a card per tool. A card opens its page on a click, Enter or Space; three of
// them show a live line under their name (hints.js): where the Quran reading stopped, today's
// Hijri date, and how far Ramadan is.
const { ipcRenderer } = require("electron");
const { byId } = require("../../core/dom");
const { showHints } = require("./hints");

/** Tile → page it opens. @type {Record<string, string>} */
const ROUTES = {
  quran: "quran",
  athkar: "athkar",
  tasbih: "tasbih",
  asma: "asma",
  "monthly-prayer-times": "monthly-prayer-times",
  qibla: "qibla",
  calendar: "hijri-calendar",
  ramadhan: "ramadan",
  fasting: "fasting",
  playlist: "albums",
  radio: "radio",
  livestreams: "livestreams",
};

/** @param {Element | null} card */
function openCard(card) {
  if (!(card instanceof HTMLElement)) return;
  const page = ROUTES[String(card.dataset.feature)];
  // the opened page records the visit itself (analytics.featureOpen on load)
  if (page) ipcRenderer.invoke("navigate-to", page);
}

function initFeaturesPage() {
  const content = byId("featuresContent", HTMLElement);
  content.addEventListener("click", (e) =>
    openCard(/** @type {Element} */ (e.target).closest(".feature-card")),
  );
  // the cards are role="button": Enter and Space open them like a button
  content.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = /** @type {Element} */ (e.target).closest(".feature-card");
    if (!card) return;
    e.preventDefault();
    openCard(card);
  });
  showHints();
}

module.exports = { initFeaturesPage };
