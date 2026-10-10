"use strict";

const { startPageWhenReady } = require("../core/app-shell");
const { initHomePage } = require("../pages/home");

startPageWhenReady({ init: initHomePage, screenSize: "app", awaitInit: true });
