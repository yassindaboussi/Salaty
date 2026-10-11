"use strict";

const { startPageWhenReady } = require("../app/app-shell");
const { initAsmaPage } = require("../pages/asma");

startPageWhenReady({
  init: initAsmaPage,
  screenSize: "asma-container",
  feature: "asma",
});
