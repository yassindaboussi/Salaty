"use strict";

const { startPageWhenReady } = require("../app/app-shell");
const { initQuranPage } = require("../pages/quran");

startPageWhenReady({ init: initQuranPage, feature: "quran" });
