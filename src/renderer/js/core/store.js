"use strict";

const prayerIcons = {
  Fajr: "cloud-moon",
  Dhuhr: "sun",
  Asr: "cloud-sun",
  Maghrib: "cloud",
  Isha: "moon",
  // extra times (Settings → Show times)
  Sunrise: "mountain-sun",
  Sunset: "circle-half-stroke",
  Midnight: "hourglass-half",
  Lastthird: "star",
};

const state = {
  settings: {
    theme: "navy",
    city: "",
    country: "",
    language: "en",
    athkarAlertEnabled: false,
    athkarAlertInterval: 30,
    preAdhanMinutes: 5,
    preAdhanNotificationEnabled: true,
  },
};

module.exports = {
  prayerIcons,
  state,
};
