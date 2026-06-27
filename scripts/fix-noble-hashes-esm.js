/**
 * Workaround for electron-builder/app-builder-lib bug.
 *
 * app-builder-lib's compiled blockmap.js does:
 *   const blake2_js_1 = require("@noble/hashes/blake2.js");
 *
 * but @noble/hashes v2.x is ESM-only ("type": "module"), which makes
 * `require()` throw ERR_REQUIRE_ESM and crashes `npm run build`.
 *
 * This script patches the compiled file in node_modules right after
 * install so the require() becomes a lazily-awaited dynamic import(),
 * which is what Node recommends for CJS code consuming ESM packages.
 *
 * It is idempotent and safe to run on every install (CI matrix: linux,
 * windows, macos / node 18.x & 20.x): if the file is already patched or
 * is missing (e.g. dependency upgraded and the bug is fixed upstream),
 * it does nothing and exits cleanly.
 */

const fs = require("fs");
const path = require("path");

const targetFile = path.join(
  __dirname,
  "..",
  "node_modules",
  "app-builder-lib",
  "out",
  "targets",
  "blockmap",
  "blockmap.js"
);

function main() {
  if (!fs.existsSync(targetFile)) {
    // Dependency not installed (e.g. fresh checkout before npm install) or
    // path changed in a future version — nothing to do.
    return;
  }

  let content = fs.readFileSync(targetFile, "utf8");

  const brokenRequire = 'const blake2_js_1 = require("@noble/hashes/blake2.js");';
  const alreadyPatchedMarker = "/* patched: dynamic-import @noble/hashes */";

  if (content.includes(alreadyPatchedMarker)) {
    return; // already patched
  }

  if (!content.includes(brokenRequire)) {
    // Upstream changed the file (maybe they fixed it) — don't touch it.
    return;
  }

  // 1. Replace the top-level require with a lazily-resolved holder.
  content = content.replace(
    brokenRequire,
    [
      alreadyPatchedMarker,
      "let blake2_js_1;",
      'async function __loadBlake2() { blake2_js_1 = await import("@noble/hashes/blake2.js"); }',
    ].join("\n")
  );

  // 2. Ensure buildBlockMap awaits the loader before using blake2b.
  //    buildBlockMap is declared as: async function buildBlockMap(inFile, compressionFormat, outFile) {
  const fnSignature = "async function buildBlockMap(inFile, compressionFormat, outFile) {";
  if (content.includes(fnSignature)) {
    content = content.replace(
      fnSignature,
      `${fnSignature}\n    await __loadBlake2();`
    );
  }

  fs.writeFileSync(targetFile, content, "utf8");
  console.log("[fix-noble-hashes-esm] Patched app-builder-lib blockmap.js for ESM compatibility.");
}

main();
