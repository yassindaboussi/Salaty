"use strict";

// App-wide security rules (Electron security checklist,
// https://www.electronjs.org/docs/latest/tutorial/security):
//   - windows only ever show our own pages (navigation guard, no new windows, no <webview>)
//   - every permission request (camera, microphone, location, notifications…) is refused
//   - links leave the app only through openExternalSafely (https to known sites, mailto)
const path = require("path");
const { fileURLToPath } = require("url");
const { app, session, shell } = require("electron");
const { RENDERER_DIR } = require("../config/paths");
const log = require("../services/logger").logger("Security");

const PAGES_DIR = path.join(RENDERER_DIR, "pages");

// Sites a link inside the app may open in the user's browser.
const EXTERNAL_HOSTS = new Set(["github.com"]);

// The only permission the app grants: the live-stream player's fullscreen button.
const ALLOWED_PERMISSIONS = new Set(["fullscreen"]);

// True for file:// URLs of our own HTML pages. Compares resolved paths (not string prefixes),
// so "../" tricks or look-alike folders cannot pass.
function isAppPage(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "file:") return false;
    const rel = path.relative(PAGES_DIR, fileURLToPath(u));
    return Boolean(rel) && !rel.startsWith("..") && !path.isAbsolute(rel);
  } catch {
    return false;
  }
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
  });
}

module.exports = { applySecurityRules, isAppPage, openExternalSafely };
