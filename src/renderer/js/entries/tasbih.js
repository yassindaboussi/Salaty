"use strict";

const { startPageWhenReady } = require("../app/app-shell");
const { initTasbihPage } = require("../pages/tasbih");

startPageWhenReady({
  init: initTasbihPage,
  screenSize: "tasbih-container",
  feature: "tasbih",
});
