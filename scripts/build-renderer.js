"use strict";
/**
 * build-renderer.js
 *
 * Bundles renderer entry-point scripts with esbuild.
 *
 * Why this exists: with nodeIntegration disabled (see the contextIsolation
 * security migration), the renderer no longer has a Node module loader at
 * runtime, so every `require()` call between local files has to be
 * resolved ahead of time. This script bundles each page's script(s) into
 * a single output file per page.
 *
 * Two important details preserved from the pre-bundling architecture:
 *
 * 1. Some pages load more than one local <script> tag (e.g. playlist.html
 *    loads playlist.js, toast.js, globalStore.js, and tooltip-init.js as
 *    separate tags). Under the old nodeIntegration:true setup, Electron's
 *    module cache meant all of those shared a single instance of, say,
 *    globalStore.js. To preserve that, multi-script pages are bundled from
 *    a single generated "virtual entry" that requires each original script
 *    in its original order — esbuild's bundler naturally dedupes a module
 *    required more than once, so the shared-singleton behavior is kept.
 *
 * 2. `require("electron")` calls are aliased to
 *    src/renderer/js/core/electron-bridge.js, which reads the API the
 *    preload script exposed via contextBridge. This means existing call
 *    sites like `const { ipcRenderer } = require("electron")` did not
 *    need to be rewritten one by one.
 */

const path = require("path");
const fs = require("fs");
const esbuild = require("esbuild");

const RENDERER_DIR = path.join(__dirname, "../src/renderer");
const JS_DIR = path.join(RENDERER_DIR, "js");
const OUT_DIR = path.join(RENDERER_DIR, "js-bundled");
const BRIDGE = path.join(JS_DIR, "core/electron-bridge.js");

// name -> ordered list of source files (relative to src/renderer/js/)
const TARGETS = {
  renderer: ["core/renderer.js"],
  index: ["ui/offline-banner.js", "core/renderer.js"],
  albums: ["media/albums.js", "core/globalStore.js", "core/tooltip-init.js"],
  playlist: [
    "media/playlist.js",
    "core/toast.js",
    "core/globalStore.js",
    "core/tooltip-init.js",
  ],
  "background-player": ["media/background-player.js", "core/tooltip-init.js"],
  "athkar-popup": ["widgets/athkar-popup.js"],
  "prayer-widget": ["widgets/prayer-widget.js"],
};

async function buildTarget(name, files) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outfile = path.join(OUT_DIR, `${name}.bundle.js`);

  let entryPath;
  let cleanupVirtualEntry = null;

  if (files.length === 1) {
    entryPath = path.join(JS_DIR, files[0]);
  } else {
    // Virtual entry: require() each file in order so esbuild bundles them
    // into one file while still only evaluating any shared module once.
    const virtualEntryPath = path.join(JS_DIR, `.__virtual_${name}.js`);
    const contents = files
      .map((f) => `require(${JSON.stringify("./" + f)});`)
      .join("\n");
    fs.writeFileSync(virtualEntryPath, contents);
    entryPath = virtualEntryPath;
    cleanupVirtualEntry = virtualEntryPath;
  }

  try {
    await esbuild.build({
      entryPoints: [entryPath],
      bundle: true,
      outfile,
      platform: "browser",
      format: "iife",
      target: "es2021",
      logLevel: "warning",
      alias: {
        electron: BRIDGE,
      },
      loader: { ".json": "json" },
    });
    console.log(`[build-renderer] ${name} -> ${path.relative(RENDERER_DIR, outfile)}`);
  } finally {
    if (cleanupVirtualEntry) fs.rmSync(cleanupVirtualEntry, { force: true });
  }
}

async function main() {
  for (const [name, files] of Object.entries(TARGETS)) {
    await buildTarget(name, files);
  }
}

main().catch((err) => {
  console.error("[build-renderer] Build failed:", err);
  process.exit(1);
});
