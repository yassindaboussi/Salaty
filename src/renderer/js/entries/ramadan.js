"use strict";

const { startPageWhenReady } = require("../core/app-shell");
const { initRamadanPage } = require("../pages/ramadan");

startPageWhenReady({
  init: initRamadanPage,
  screenSize: "ramadan-container",
  feature: "ramadan",
});
