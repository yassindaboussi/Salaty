"use strict";

const { startPageWhenReady } = require("../app/app-shell");
const { initAsmaPage } = require("../pages/asma/index");

startPageWhenReady({
  init: initAsmaPage,
  screenSize: "asma-container",
  feature: "asma",
});
