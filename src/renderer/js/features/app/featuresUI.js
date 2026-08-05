"use strict";
const { ipcRenderer } = require("electron");
const { t } = require("../../core/i18n/translations");
const analytics = require("../../utils/analytics");
const {
  setupConnectionRecovery,
} = require("../../services/connection-recovery");

function initFeaturesPage() {
  setupConnectionRecovery(initFeaturesPage, "Features");

  document.getElementById("backBtn")?.addEventListener("click", () => {
    ipcRenderer.invoke("go-back");
  });

  _updateText();
  _setupCards();
}

const TEXT_MAP = {
  featuresTitle: "islamicFeatures",
  featuresFooterText: "moreFeaturesComingSoon",
  featureQuran: "holyQuran",
  featureAthkar: "athkar",
  featureTasbih: "tasbih",
  featureAsma: "asmaAllah",
  featureCalendar: "hijriCalendar",
  featurePlaylist: "audioArchive",
  featureRamadhan: "ramadhan",
  featureFasting: "sunnahFasting",
  featureQibla: "qiblaFinder",
  featureMonthly: "prayerTimesMonthly",
  featureRadio: "muslimRadio",
  featureLivestreams: "liveHaramain",
  featureQuranDesc: "holyQuranDesc",
  featureAthkarDesc: "athkarDesc",
  featureTasbihDesc: "tasbihDesc",
  featureAsmaDesc: "asmaDesc",
  featureCalendarDesc: "hijriCalendarDesc",
  featurePlaylistDesc: "audioArchiveDesc",
  featureRamadhanDesc: "ramadhanDesc",
  featureFastingDesc: "sunnahFastingDesc",
  featureQiblaDesc: "qiblaDesc",
  featureMonthlyDesc: "prayerTimesMonthlyDesc",
  featureRadioDesc: "radioDesc",
  featureLivestreamsDesc: "liveHaramainDesc",
};

function _updateText() {
  for (const [id, key] of Object.entries(TEXT_MAP)) {
    const el = document.getElementById(id);
    const text = t(key);
    if (el && text) el.textContent = text;
  }
  document.querySelectorAll(".coming-soon-badge").forEach((el) => {
    const text = t("comingSoon");
    if (text) el.textContent = text;
  });
}

const CARD_ROUTES = {
  quran:       { page: "quran",         w: null },
  athkar:      { page: "athkar",        w: null },
  tasbih:      { page: "tasbih",        w: null },
  asma:        { page: "asma",          w: null },
  calendar:    { page: "hijri-calendar",w: null },
  "monthly-prayer-times": { page: "monthly-prayer-times", w: null },
  playlist:    { page: "albums",        w: null },
  ramadhan:    { page: "ramadan",       w: null },
  fasting:     { page: "fasting",       w: null },
  qibla:       { page: "qibla",         w: null },
  radio:       { page: "radio",         w: null },
  livestreams: { page: "livestreams",   w: null },
};

function _setupCards() {
  const grid = document.getElementById("featuresContent");
  if (!grid) return;

  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".feature-card");
    if (!card || card.classList.contains("coming-soon")) return;

    const feature = card.dataset.feature;
    const route = CARD_ROUTES[feature];
    if (!route) return;

    analytics.featureOpen(route.page);
    ipcRenderer.invoke("navigate-to", route.page);
  });
}

module.exports = { initFeaturesPage };
