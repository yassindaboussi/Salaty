"use strict";

// App-wide security rules (Electron security checklist,
// https://www.electronjs.org/docs/latest/tutorial/security):
//   - windows only ever show our own pages (navigation guard, no new windows, no <webview>)
//   - every permission request (camera, microphone, location, notifications…) is refused
//   - links leave the app only through openExternalSafely (https to known sites, mailto)
const path = require("path");
const { app, session, shell } = require("electron");
const { RENDERER_DIR } = require("../config/paths");
const { resolveAppFile } = require("./app-protocol");
const log = require("../services/logger").logger("Security");

const PAGES_DIR = path.join(RENDERER_DIR, "pages");

// Sites a link inside the app may open in the user's browser.
// github.com: the project; sunnah.com: the hadith references of the Sunnah fasting page;
// www.youtube.com: the Haramain live channels ("Open on YouTube")
const EXTERNAL_HOSTS = new Set(["github.com", "sunnah.com", "www.youtube.com"]);

// Who embeds YouTube's player (see applySecurityRules): the project's page.
const APP_HOMEPAGE = "https://github.com/yassindaboussi/Salaty";

// The only permission the app grants: the live-stream player's fullscreen button.
const ALLOWED_PERMISSIONS = new Set(["fullscreen"]);

// True for the app:// URLs of our own HTML pages (app/app-protocol.js). Compares resolved
// paths (not string prefixes), so "../" tricks or look-alike folders cannot pass; file://
// is never an app page.
/** @param {string} url */
function isAppPage(url) {
  const file = resolveAppFile(url);
  if (!file || !file.endsWith(".html")) return false;
  const rel = path.relative(PAGES_DIR, file);
  return Boolean(rel) && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function openExternalSafely(url) {
  let u;
  try {
    u = new URL(String(url));
  } catch {
    return false;
  }
  const allowed =
    u.protocol === "mailto:" ||
    (u.protocol === "https:" && EXTERNAL_HOSTS.has(u.hostname));
  if (!allowed) {
    log.warn("blocked opening an external link:", u.protocol, u.hostname);
    return false;
  }
  shell.openExternal(u.href);
  return true;
}

function applySecurityRules() {
  app.on("web-contents-created", (_event, contents) => {
    // The top frame of our windows never leaves our pages (embedded frames, like the live
    // streams, navigate inside themselves without affecting this).
    contents.on("will-navigate", (event, url) => {
      if (!isAppPage(url)) {
        event.preventDefault();
        log.warn("blocked navigation to", url);
      }
    });
    // No new windows: a link that tries to open one goes to the browser if it is allowed.
    contents.setWindowOpenHandler(({ url }) => {
      openExternalSafely(url);
      return { action: "deny" };
    });
    contents.on("will-attach-webview", (event) => event.preventDefault());
  });

  app.whenReady().then(() => {
    const ses = session.defaultSession;
    ses.setPermissionRequestHandler((_wc, permission, callback) =>
      callback(ALLOWED_PERMISSIONS.has(permission)),
    );
    ses.setPermissionCheckHandler((_wc, permission) =>
      ALLOWED_PERMISSIONS.has(permission),
    );
    // YouTube's embedded player asks the site that embeds it to say who it is (the Referer,
    // YouTube API terms); app:// pages send none, so it shows "Error 153". The Haramain live
    // page's player says it is Salaty (the project's page).
    ses.webRequest.onBeforeSendHeaders(
      { urls: ["https://www.youtube-nocookie.com/embed/*"] },
      ({ requestHeaders, resourceType }, callback) => {
        if (resourceType === "subFrame" && !requestHeaders.Referer) {
          requestHeaders.Referer = APP_HOMEPAGE;
        }
        callback({ requestHeaders });
      },
    );
  });
}

module.exports = { applySecurityRules, isAppPage, openExternalSafely };
