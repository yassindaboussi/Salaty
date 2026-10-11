"use strict";

// The pages are served from app://salaty/ instead of file:// (Electron security checklist #18,
// https://www.electronjs.org/docs/latest/tutorial/security#18-avoid-usage-of-the-file-protocol-and-prefer-usage-of-custom-protocols).
// A file:// page can load any file the user can read, and Electron gives file:// pages extra
// privileges (turned off with the grantFileProtocolExtraPrivileges fuse, package.json). Here a
// page reaches only what this handler serves:
//
//   app://salaty/renderer/pages/app/index.html -> src/renderer/pages/app/index.html
//
// The pages keep their relative links (../../css/app.css), the CSP's 'self' means
// app://salaty, and fetch() and <audio> work on it (the privileges below).
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { net, protocol } = require("electron");
const {
  SRC_DIR,
  APP_SCHEME,
  APP_HOST,
  APP_ORIGIN,
} = require("../config/paths");
const log = require("../services/logger").logger("Protocol");

// What the pages may load, as paths under src/: their own folder, the images and the adhan.
// Not main/, preload/, shared/ (bundled into the pages already) or the installer files.
const SERVED = ["renderer", "assets/images", "assets/adhan.mp3"];

/** Must run before the app's "ready" event (Electron requires it). */
function registerAppScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: {
        standard: true, // relative URLs and web storage, like http(s)
        secure: true, // a secure context (navigator.clipboard...)
        supportFetchAPI: true, // fetch() of the locale and data files
        stream: true, // <audio> plays, and seeks in, the adhan
        codeCache: true, // V8 code cache for the page bundles
      },
    },
  ]);
}

/**
 * The file under src/ that an app:// URL points to, or null when it is not one we serve.
 * Resolves the decoded path and checks the result, so "../", "%2e%2e%2f" or "\" tricks
 * cannot leave the served folders. Does not check that the file exists.
 * @param {string} url
 * @returns {string | null}
 */
function resolveAppFile(url) {
  let u;
  let pathname;
  try {
    u = new URL(url);
    pathname = decodeURIComponent(u.pathname);
  } catch {
    return null; // not a URL, or a malformed %-escape
  }
  if (u.protocol !== `${APP_SCHEME}:` || u.host !== APP_HOST) return null;
  if (pathname.includes("\0")) return null;

  const file = path.resolve(SRC_DIR, `.${pathname}`);
  const rel = path.relative(SRC_DIR, file);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return null;
  const relUrl = rel.split(path.sep).join("/");
  const served = SERVED.some(
    (allowed) => relUrl === allowed || relUrl.startsWith(`${allowed}/`),
  );
  return served ? file : null;
}

/**
 * @param {number} status
 * @returns {Response}
 */
const refuse = (status) => new Response(null, { status });

/**
 * The bytes a "Range: bytes=…" header asks for (what <audio> sends to seek), as
 * [first, last], "unsatisfiable", or null when there is no single range to honour (the
 * whole file is sent then, which HTTP allows).
 * @param {string | null} header
 * @param {number} size
 * @returns {[number, number] | "unsatisfiable" | null}
 */
function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header?.trim() ?? "");
  if (!m || (m[1] === "" && m[2] === "")) return null;
  const [first, last] =
    m[1] === ""
      ? [Math.max(0, size - Number(m[2])), size - 1] // the last N bytes
      : [
          Number(m[1]),
          m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1),
        ];
  return first <= last && first < size ? [first, last] : "unsatisfiable";
}

/** Serves app:// (after "ready", before the first window loads). */
function handleAppScheme() {
  protocol.handle(
    APP_SCHEME,
    /** @param {Request & { initiatorOrigin?: string }} request */
    async (request) => {
      // Only our own pages (or the app itself, e.g. loadURL) may load these files: an
      // embedded site, like the live streams, cannot even probe for them.
      const initiator = request.initiatorOrigin;
      if (initiator && initiator !== APP_ORIGIN) return refuse(403);
      if (request.method !== "GET" && request.method !== "HEAD") {
        return refuse(405);
      }
      const file = resolveAppFile(request.url);
      const stat = file ? await fs.promises.stat(file).catch(() => null) : null;
      // (a directory would be answered with a listing of its files)
      if (!file || !stat?.isFile()) return refuse(404);
      try {
        // Chromium's file loader: streams the file, with its Content-Type
        const res = await net.fetch(pathToFileURL(file).href, {
          method: request.method,
        });
        const headers = new Headers(res.headers);
        headers.set("Accept-Ranges", "bytes"); // so <audio> knows it can seek
        headers.set("Content-Length", String(stat.size));
        const range = parseRange(request.headers.get("range"), stat.size);
        if (!range) {
          return new Response(res.body, { status: res.status, headers });
        }
        // The file loader ignores Range: send the part ourselves (readFile also reads
        // inside app.asar; the only file seeked in is the 4 MB adhan).
        await res.body?.cancel();
        if (range === "unsatisfiable") {
          return new Response(null, {
            status: 416,
            headers: { "Content-Range": `bytes */${stat.size}` },
          });
        }
        const [first, last] = range;
        headers.set("Content-Range", `bytes ${first}-${last}/${stat.size}`);
        headers.set("Content-Length", String(last - first + 1));
        const body =
          request.method === "HEAD"
            ? null
            : (await fs.promises.readFile(file)).subarray(first, last + 1);
        return new Response(body, { status: 206, headers });
      } catch (err) {
        log.warn("serving failed:", request.url, err.message);
        return refuse(404);
      }
    },
  );
}

module.exports = { registerAppScheme, handleAppScheme, resolveAppFile };
