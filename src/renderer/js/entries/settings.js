"use strict";

const { startPageWhenReady } = require("../core/app-shell");
const { initSettingsPage } = require("../pages/settings");

startPageWhenReady({
  init: initSettingsPage,
  screenSize: "settings-container",
});
