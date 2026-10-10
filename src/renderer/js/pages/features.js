"use strict";
const { ipcRenderer } = require("electron");

// The page is static (cards + translated labels): nothing to reload when the connection returns.
function initFeaturesPage() {
  _setupCards();
}

const CARD_ROUTES = {
  quran: { page: "quran", w: null },
  athkar: { page: "athkar", w: null },
  tasbih: { page: "tasbih", w: null },
  asma: { page: "asma", w: null },
  calendar: { page: "hijri-calendar", w: null },
  "monthly-prayer-times": { page: "monthly-prayer-times", w: null },
  playlist: { page: "albums", w: null },
  ramadhan: { page: "ramadan", w: null },
  fasting: { page: "fasting", w: null },
  qibla: { page: "qibla", w: null },
  radio: { page: "radio", w: null },
  livestreams: { page: "livestreams", w: null },
};

function _setupCards() {
  const grid = document.getElementById("featuresContent");
  if (!grid) return;

  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".feature-card");
    if (!card) return;

    const feature = card.dataset.feature;
    const route = CARD_ROUTES[feature];
    if (!route) return;

    // the opened page records the visit itself (analytics.featureOpen on load)
    ipcRenderer.invoke("navigate-to", route.page);
  });
}

module.exports = { initFeaturesPage };
