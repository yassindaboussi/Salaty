"use strict";

const { startPageWhenReady } = require("../app/app-shell");
const { initHijriCalendar } = require("../pages/hijri-calendar");

startPageWhenReady({
  init: initHijriCalendar,
  screenSize: "calendar-container",
  feature: "calendar",
});
