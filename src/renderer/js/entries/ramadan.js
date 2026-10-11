"use strict";

const { startPageWhenReady } = require("../app/app-shell");
const { initRamadanPage } = require("../pages/ramadan");

startPageWhenReady({
  init: initRamadanPage,
  screenSize: "ramadan-container",
  feature: "ramadan",
});
