"use strict";

const { startPageWhenReady } = require("../core/app-shell");
const { initLiveStreamsPage } = require("../pages/livestreams");

startPageWhenReady({
  init: initLiveStreamsPage,
  screenSize: "livestreams-container",
  feature: "livestreams",
});
