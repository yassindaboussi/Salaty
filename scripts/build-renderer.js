"use strict";
/**
 * build-renderer.js
 *
 * Bundles the renderer with esbuild: one bundle per file in src/renderer/js/entries/
 * (entries/<name>.js -> js-bundled/<name>.bundle.js). Each HTML page loads only its own
 * bundle, so a page contains just the code it uses.
 *
 * Why bundling: the renderer runs with nodeIntegration off and contextIsolation on, so it has
 * no module loader at runtime; every require() between local files is resolved here.
 *
 * `require("electron")` is aliased to src/renderer/js/core/electron-bridge.js, which reads
 * the API the preload script exposes through contextBridge, so renderer code can keep the
 * usual `const { ipcRenderer } = require("electron")`.
 */

const path = require("path");
const fs = require("fs");
const esbuild = require("esbuild");

const RENDERER_DIR = path.join(__dirname, "../src/renderer");
const JS_DIR = path.join(RENDERER_DIR, "js");
const ENTRIES_DIR = path.join(JS_DIR, "entries");
const OUT_DIR = path.join(RENDERER_DIR, "js-bundled");
const BRIDGE = path.join(JS_DIR, "core/electron-bridge.js");

async function buildEntry(file) {
  const name = path.basename(file, ".js");
  const outfile = path.join(OUT_DIR, `${name}.bundle.js`);
  await esbuild.build({
    entryPoints: [path.join(ENTRIES_DIR, file)],
    bundle: true,
    outfile,
    platform: "browser",
    format: "iife",
    target: "es2021",
    logLevel: "warning",
    alias: { electron: BRIDGE },
    loader: { ".json": "json" },
  });
  console.log(
    `[build-renderer] ${name} -> ${path.relative(RENDERER_DIR, outfile)}`,
  );
}

async function main() {
  // Start clean so a bundle whose entry was removed cannot linger and be loaded by mistake.
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const entries = fs
    .readdirSync(ENTRIES_DIR)
    .filter((f) => f.endsWith(".js"))
    .sort();
  await Promise.all(entries.map(buildEntry));
}

main().catch((err) => {
  console.error("[build-renderer] Build failed:", err);
  process.exit(1);
});
