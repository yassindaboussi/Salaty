"use strict";

const { startPageWhenReady } = require("../app/app-shell");
const { initQiblaPage } = require("../pages/qibla");

startPageWhenReady({
  init: initQiblaPage,
  screenSize: "qibla-container",
  feature: "qibla",
});
