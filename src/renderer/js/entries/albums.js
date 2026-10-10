"use strict";

const { startPageWhenReady } = require("../core/app-shell");
const { initAlbumsPage } = require("../pages/albums");

startPageWhenReady({
  init: initAlbumsPage,
  screenSize: "albums-container",
  feature: "albums",
  miniPlayer: false,
});
