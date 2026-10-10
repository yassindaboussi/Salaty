"use strict";

const { startPageWhenReady } = require("../core/app-shell");
const { initPlaylistPage } = require("../pages/playlist");

startPageWhenReady({ init: initPlaylistPage, miniPlayer: false });
