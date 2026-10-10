"use strict";

const { startPageWhenReady } = require("../core/app-shell");
const { initFeaturesPage } = require("../pages/features");

startPageWhenReady({
  init: initFeaturesPage,
  screenSize: "features-container",
});
