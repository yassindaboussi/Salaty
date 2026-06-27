"use strict";
const { ipcRenderer } = require("electron");
const { t } = require("../../core/i18n/translations");
const screenSizeManager = require("../../core/screenSize");
const analytics = require("../../utils/analytics");
const {
  setupConnectionRecovery,
} = require("../../services/connection-recovery");

function initFeaturesPage() {
  setupConnectionRecovery(initFeaturesPage, "Features");

  document.getElementById("backBtn")?.addEventListener("click", () => {
    // Navigate back without forcing a size — home page remeasures itself via forceApplyScreenSize
    ipcRenderer.invoke("go-back");
  });

  _updateText();
  _setupCards();
}

// ── Text ──────────────────────────────────────────────────────────────────────
// Map element ID → translation key, using the keys that actually exist in locales.
const TEXT_MAP = {
  featuresTitle: "islamicFeatures",
  featuresFooterText: "moreFeaturesComingSoon",
  // Card titles
  featureQuran: "holyQuran",
  featureAthkar: "athkar",
  featureTasbih: "tasbih",
  featureAsma: "asmaAllah",
  featureCalendar: "hijriCalendar",
  featurePlaylist: "audioArchive",
  featureRamadhan: "ramadhan",
  featureQibla: "qiblaFinder",
  featureMonthly: "prayerTimesMonthly",
  featureRadio: "muslimRadio",
  featureLivestreams: "liveHaramain",
  // Card descriptions — using the keys that exist in the locale files
  featureQuranDesc: "holyQuranDesc", // falls back to existing text if missing
  featureAthkarDesc: "athkarDesc",
  featureTasbihDesc: "tasbihDesc",
  featureAsmaDesc: "asmaDesc",
  featureCalendarDesc: "hijriCalendarDesc",
  featurePlaylistDesc: "audioArchiveDesc",
  featureRamadhanDesc: "ramadhanDesc",
  featureQiblaDesc: "qiblaDesc",
  featureMonthlyDesc: "prayerTimesMonthlyDesc",
  featureRadioDesc: "radioDesc",
  featureLivestreamsDesc: "liveHaramainDesc",
};

function _updateText() {
  for (const [id, key] of Object.entries(TEXT_MAP)) {
    const el = document.getElementById(id);
    const text = t(key);
    // Only set if the translation exists — keep the original HTML text as fallback
    if (el && text) el.textContent = text;
  }
  document.querySelectorAll(".coming-soon-badge").forEach((el) => {
    const text = t("comingSoon");
    if (text) el.textContent = text;
  });
}

// ── Card navigation ───────────────────────────────────────────────────────────
// Keyed by data-feature attribute value (matches the HTML exactly).
const CARD_ROUTES = {
  quran:       { page: "quran",         w: null },
  athkar:      { page: "athkar",        w: null },
  tasbih:      { page: "tasbih",        w: null },
  asma:        { page: "asma",          w: null },
  calendar:    { page: "hijri-calendar",w: null },
  playlist:    { page: "albums",        w: null },
  ramadhan:    { page: "ramadan",       w: null },
  qibla:       { page: "qibla",         w: null },
  radio:       { page: "radio",         w: null },
  livestreams: { page: "livestreams",   w: null },
};

function _setupCards() {
  // Use event delegation on the container — one listener for all cards.
  const grid = document.getElementById("featuresContent");
  if (!grid) return;

  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".feature-card");
    if (!card || card.classList.contains("coming-soon")) return;

    const feature = card.dataset.feature;
    const route = CARD_ROUTES[feature];
    if (!route) return;

    analytics.featureOpen(route.page);
    // Always navigate without passing size — let the window keep its current size.
    // This prevents the stale _baseHeight=null fallback (700px) from wrongly
    // resizing the window when opening a feature page.
    ipcRenderer.invoke("navigate-to", route.page);
  });
}

module.exports = { initFeaturesPage };
