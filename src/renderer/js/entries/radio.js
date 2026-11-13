"use strict";

const { startPageWhenReady } = require("../app/app-shell");
const { initRadioPage } = require("../pages/radio");

startPageWhenReady({
  init: initRadioPage,
  screenSize: "radio-container",
  feature: "radio",
  ownPlayerFor: "radio", // its panel is the player for a radio; a surah keeps the mini player
});
