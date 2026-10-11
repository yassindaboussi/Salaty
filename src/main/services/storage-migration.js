"use strict";

// One-time copy of the pages' localStorage from file:// (where the pages ran before) to
// app://salaty (app/app-protocol.js). Web storage belongs to an origin, so without it the move
// would lose the Tasbih counter, the Athkar progress, the Ramadan tracker and the page
// preferences. A key the new origin already has is never overwritten, and the old copy is
// kept (an older version of the app still finds it). A marker file makes it run once; if it
// fails, the next start tries again.
const fs = require("fs");
const path = require("path");
const { app, BrowserWindow, session } = require("electron");
const { RENDERER_DIR, APP_ORIGIN, appUrl } = require("../config/paths");
const log = require("./logger").logger("Storage");

/** @import { WebPreferences } from "electron" */

const MARKER_VERSION = 1;
const TIMEOUT_MS = 10_000;
// an empty page of ours, opened hidden in the app:// origin
const BLANK_PAGE = path.join(
  RENDERER_DIR,
  "pages",
  "app",
  "storage-migration.html",
);

const markerFile = () =>
  path.join(app.getPath("userData"), "storage-migration.json");
// The old origin is read from an empty page written to the profile folder for a moment: every
// file:// page shares one localStorage, and in the installed app a file:// page inside
// app.asar no longer opens (grantFileProtocolExtraPrivileges fuse off).
const oldOriginPage = () =>
  path.join(app.getPath("userData"), "storage-migration.html");

function isDone() {
  try {
    const marker = JSON.parse(fs.readFileSync(markerFile(), "utf8"));
    return marker?.version === MARKER_VERSION;
  } catch {
    return false;
  }
}

/**
 * @template T
 * @param {Promise<T>} promise
 * @returns {Promise<T>}
 */
function withTimeout(promise) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("timed out")), TIMEOUT_MS),
    ),
  ]);
}

/**
 * Opens a hidden window (no preload, sandboxed), loads a page with `load`, runs `script` there
 * and closes the window.
 * @param {(win: BrowserWindow) => Promise<void>} load
 * @param {string} script an expression
 * @param {WebPreferences} [webPreferences]
 */
async function runInHiddenPage(load, script, webPreferences = {}) {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      devTools: false,
      ...webPreferences,
    },
  });
  try {
    await withTimeout(load(win));
    // an error thrown in the page only reaches us as "Script failed to execute": send it back
    const result = await withTimeout(
      win.webContents.executeJavaScript(
        `(() => { try { return { ok: ${script} }; } catch (e) { return { error: String(e) }; } })()`,
      ),
    );
    if ("error" in result) throw new Error(result.error);
    return result.ok;
  } finally {
    win.destroy();
  }
}

async function migrateLocalStorage() {
  if (isDone()) return;
  const oldPage = oldOriginPage();
  try {
    fs.writeFileSync(oldPage, "<!doctype html><title>Salaty Time</title>");
    /** @type {[string, string][]} */
    const entries = JSON.parse(
      await runInHiddenPage(
        (win) => win.loadFile(oldPage),
        "JSON.stringify(Object.entries(localStorage))",
        // With the fuse off, a file:// page gets no storage unless web security is off for
        // its window. Only this window has it off: it opens nothing but the empty page
        // written above, runs this one read and is closed.
        { webSecurity: false },
      ),
    );
    let copied = 0;
    if (entries.length) {
      copied = await runInHiddenPage(
        (win) => win.loadURL(appUrl(BLANK_PAGE)),
        `(() => {
          let copied = 0;
          for (const [key, value] of ${JSON.stringify(entries)}) {
            if (localStorage.getItem(key) === null) {
              localStorage.setItem(key, value);
              copied++;
            }
          }
          return copied;
        })()`,
      );
      session.defaultSession.flushStorageData();
    }
    fs.writeFileSync(
      markerFile(),
      JSON.stringify({
        version: MARKER_VERSION,
        from: "file://",
        to: APP_ORIGIN,
        found: entries.length,
        copied,
        at: new Date().toISOString(),
      }),
    );
    log.info(
      `localStorage moved to app://: ${copied} of ${entries.length} keys`,
    );
  } catch (err) {
    log.warn(
      "moving localStorage failed (will retry next start):",
      err.message,
    );
  } finally {
    fs.rmSync(oldPage, { force: true });
  }
}

module.exports = { migrateLocalStorage };
