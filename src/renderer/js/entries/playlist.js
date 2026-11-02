"use strict";

const { startPageWhenReady } = require("../app/app-shell");
const { initPlaylistPage } = require("../pages/playlist/index");

startPageWhenReady({ init: initPlaylistPage, miniPlayer: false });
