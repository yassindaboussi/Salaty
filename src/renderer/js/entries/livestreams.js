"use strict";

const { startPageWhenReady } = require("../app/app-shell");
const { initLiveStreamsPage } = require("../pages/livestreams");

startPageWhenReady({
  init: initLiveStreamsPage,
  screenSize: "livestreams-container",
  feature: "livestreams",
});
