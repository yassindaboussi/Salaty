"use strict";

const { startPageWhenReady } = require("../app/app-shell");
const { initAlbumsPage } = require("../pages/albums/index");

startPageWhenReady({
  init: initAlbumsPage,
  screenSize: "albums-container",
  feature: "albums",
});
