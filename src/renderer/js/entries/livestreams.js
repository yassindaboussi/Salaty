"use strict";

const { startPageWhenReady } = require("../app/app-shell");
const { initLiveStreamsPage } = require("../pages/livestreams/index");

startPageWhenReady({
  init: initLiveStreamsPage,
  screenSize: "livestreams-container",
  feature: "livestreams",
});
