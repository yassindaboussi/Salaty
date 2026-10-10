"use strict";

const { startPageWhenReady } = require("../core/app-shell");
const { initAsmaPage } = require("../pages/asma");

startPageWhenReady({
  init: initAsmaPage,
  screenSize: "asma-container",
  feature: "asma",
});
