"use strict";

const { startPageWhenReady } = require("../core/app-shell");
const { initRadioPage } = require("../pages/radio");

startPageWhenReady({
  init: initRadioPage,
  screenSize: "radio-container",
  feature: "radio",
});
