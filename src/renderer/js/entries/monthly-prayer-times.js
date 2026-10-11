"use strict";

const { startPageWhenReady } = require("../app/app-shell");
const { initMonthlyPrayerTimesPage } = require("../pages/monthly-prayer-times");

startPageWhenReady({
  init: initMonthlyPrayerTimesPage,
  screenSize: "monthly-container",
  feature: "monthly-prayer-times",
});
