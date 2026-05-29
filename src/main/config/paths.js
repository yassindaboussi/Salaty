"use strict";

const path = require("path");

const ROOT_DIR = path.join(__dirname, "../../..");
const SRC_DIR = path.join(ROOT_DIR, "src");
const MAIN_DIR = path.join(SRC_DIR, "main");
const RENDERER_DIR = path.join(SRC_DIR, "renderer");
const ASSETS_DIR = path.join(SRC_DIR, "assets");
const PRELOAD_ENTRY = path.join(SRC_DIR, "preload", "index.js");

const PAGE_GROUPS = Object.freeze({
  app: ["index", "features", "settings"],
  worship: [
    "quran",
    "athkar",
    "asma",
    "tasbih",
    "ramadan",
    "qibla",
    "hijri-calendar",
  ],
  media: ["albums", "playlist", "radio", "livestreams"],
  widgets: ["prayer-widget", "athkar-popup", "background-player", "offline"],
});

const PAGE_ROUTE_MAP = Object.freeze(
  Object.entries(PAGE_GROUPS).reduce((routes, [group, pageNames]) => {
    pageNames.forEach((pageName) => {
      routes[pageName] = path.join(
        RENDERER_DIR,
        "pages",
        group,
        `${pageName}.html`,
      );
    });
    return routes;
  }, {}),
);

const pages = {
  index: PAGE_ROUTE_MAP.index,
  playlist: PAGE_ROUTE_MAP.playlist,
  backgroundPlayer: PAGE_ROUTE_MAP["background-player"],
  prayerWidget: PAGE_ROUTE_MAP["prayer-widget"],
  athkarPopup: PAGE_ROUTE_MAP["athkar-popup"],
  byName: (page) => PAGE_ROUTE_MAP[page] || PAGE_ROUTE_MAP.index,
};

const icons = {
  app:
    process.platform === "darwin"
      ? path.join(ASSETS_DIR, "icons", "app_icon.png")
      : path.join(ASSETS_DIR, "icons", "app_icon.ico"),
  tray:
    process.platform === "darwin"
      ? path.join(ASSETS_DIR, "icons", "app_icon.png")
      : path.join(ASSETS_DIR, "icons", "app_icon.ico"),
};

module.exports = {
  ROOT_DIR,
  SRC_DIR,
  MAIN_DIR,
  RENDERER_DIR,
  ASSETS_DIR,
  PRELOAD_ENTRY,
  PAGE_GROUPS,
  PAGE_ROUTE_MAP,
  pages,
  icons,
};
