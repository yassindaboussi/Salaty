"use strict";

const { startPageWhenReady } = require("../core/app-shell");
const { initQuranPage } = require("../pages/quran");

startPageWhenReady({ init: initQuranPage, feature: "quran" });
