"use strict";

const path = require("path");

const ROOT_DIR = path.join(__dirname, "../../..");
const SRC_DIR = path.join(ROOT_DIR, "src");
const MAIN_DIR = path.join(SRC_DIR, "main");
const RENDERER_DIR = path.join(SRC_DIR, "renderer");
const ASSETS_DIR = path.join(SRC_DIR, "assets");
const PRELOAD_ENTRY = path.join(SRC_DIR, "preload", "index.js");

// The pages are served from app://salaty/ (app/app-protocol.js): src/<path> is
// app://salaty/<path>.
const APP_SCHEME = "app";
const APP_HOST = "salaty";
const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;

/**
 * The app:// URL of a file under src/ (only some folders are served: app/app-protocol.js).
 * @param {string} file absolute path
 */
function appUrl(file) {
  const rel = path.relative(SRC_DIR, file).split(path.sep);
  return `${APP_ORIGIN}/${rel.map(encodeURIComponent).join("/")}`;
}

const PAGE_GROUPS = Object.freeze({
  app: ["index", "features", "settings"],
  worship: [
    "quran",
    "athkar",
    "asma",
    "tasbih",
    "ramadan",
    "fasting",
    "qibla",
    "hijri-calendar",
    "monthly-prayer-times",
  ],
  media: ["albums", "playlist", "radio", "livestreams"],
  widgets: ["prayer-widget", "athkar-popup", "background-player"],
});

// page name -> app:// URL of its HTML file (for win.loadURL)
const PAGE_ROUTE_MAP = Object.freeze(
  Object.entries(PAGE_GROUPS).reduce((routes, [group, pageNames]) => {
    pageNames.forEach((pageName) => {
      routes[pageName] = appUrl(
        path.join(RENDERER_DIR, "pages", group, `${pageName}.html`),
      );
    });
    return routes;
  }, /** @type {Record<string, string>} */ ({})),
);

const pages = {
  index: PAGE_ROUTE_MAP.index,
  playlist: PAGE_ROUTE_MAP.playlist,
  backgroundPlayer: PAGE_ROUTE_MAP["background-player"],
  prayerWidget: PAGE_ROUTE_MAP["prayer-widget"],
  athkarPopup: PAGE_ROUTE_MAP["athkar-popup"],
  // unknown names (or anything that is not a page name) open the home page
  byName: (page) =>
    typeof page === "string" && Object.hasOwn(PAGE_ROUTE_MAP, page)
      ? PAGE_ROUTE_MAP[page]
      : PAGE_ROUTE_MAP.index,
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

// The adhan the pages play. An app:// page cannot load file:// media, so it is served too.
const ADHAN_AUDIO_URL = appUrl(path.join(ASSETS_DIR, "adhan.mp3"));

module.exports = {
  ROOT_DIR,
  SRC_DIR,
  MAIN_DIR,
  RENDERER_DIR,
  ASSETS_DIR,
  PRELOAD_ENTRY,
  APP_SCHEME,
  APP_HOST,
  APP_ORIGIN,
  appUrl,
  PAGE_GROUPS,
  PAGE_ROUTE_MAP,
  pages,
  icons,
  ADHAN_AUDIO_URL,
};
