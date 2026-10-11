"use strict";

const { startPageWhenReady } = require("../app/app-shell");
const { initAthkarPage } = require("../pages/athkar");

startPageWhenReady({
  init: initAthkarPage,
  screenSize: "athkar-container",
  feature: "athkar",
});
