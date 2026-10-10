"use strict";

const { startPageWhenReady } = require("../core/app-shell");
const { initHijriCalendar } = require("../pages/hijri-calendar");

startPageWhenReady({
  init: initHijriCalendar,
  screenSize: "calendar-container",
  feature: "calendar",
});
