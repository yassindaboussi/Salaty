"use strict";

const { startPageWhenReady } = require("../app/app-shell");
const { initFeaturesPage } = require("../pages/features");

startPageWhenReady({
  init: initFeaturesPage,
  screenSize: "features-container",
});
