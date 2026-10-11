"use strict";

const { startPageWhenReady } = require("../app/app-shell");
const { initFastingPage } = require("../pages/fasting");

startPageWhenReady({
  init: initFastingPage,
  screenSize: "fasting-container",
  feature: "fasting",
});
