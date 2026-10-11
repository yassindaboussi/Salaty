"use strict";

const { startPageWhenReady } = require("../app/app-shell");
const { initSettingsPage } = require("../pages/settings");

startPageWhenReady({
  init: initSettingsPage,
  screenSize: "settings-container",
});
