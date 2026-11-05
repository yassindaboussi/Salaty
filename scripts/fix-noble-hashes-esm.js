"use strict";

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
 * It only patches when it is needed and when it can patch completely:
 * - if require() of the installed @noble/hashes works (app-builder-lib 26.18 ships v1.8, which
 *   is CommonJS), the file is left alone;
 * - the loader must be awaited at the start of buildBlockMap, whatever its parameters (26.18
 *   added an `options` one; matching the old signature exactly left the file half patched, with
 *   blake2b never loaded: "Cannot read properties of undefined (reading 'blake2b')").
 * It is idempotent and safe to run on every install.
 */

const fs = require("fs");
const path = require("path");

const blockmapDir = path.join(
  __dirname,
  "..",
  "node_modules",
  "app-builder-lib",
  "out",
  "targets",
  "blockmap",
);
const targetFile = path.join(blockmapDir, "blockmap.js");

const BROKEN_REQUIRE =
  'const blake2_js_1 = require("@noble/hashes/blake2.js");';
const PATCHED_MARKER = "/* patched: dynamic-import @noble/hashes */";
const BUILD_BLOCK_MAP = /async function buildBlockMap\([^)]*\) \{/;

/** Whether app-builder-lib's own require() of @noble/hashes works as it is. */
function requireWorks() {
  try {
    require(
      require.resolve("@noble/hashes/blake2.js", { paths: [blockmapDir] }),
    );
    return true;
  } catch {
    return false;
  }
}

function main() {
  if (!fs.existsSync(targetFile)) {
    // Dependency not installed (e.g. fresh checkout before npm install) or
    // path changed in a future version — nothing to do.
    return;
  }

  let content = fs.readFileSync(targetFile, "utf8");
  if (content.includes(PATCHED_MARKER)) return; // already patched
  if (!content.includes(BROKEN_REQUIRE)) return; // upstream changed the file: don't touch it
  if (requireWorks()) return; // nothing to fix
  if (!BUILD_BLOCK_MAP.test(content)) {
    // Patching the require alone would leave blake2b undefined: better to fail loudly here.
    console.warn(
      "[fix-noble-hashes-esm] buildBlockMap not found in app-builder-lib: file left unpatched.",
    );
    return;
  }

  // 1. Replace the top-level require with a lazily-resolved holder.
  content = content.replace(
    BROKEN_REQUIRE,
    [
      PATCHED_MARKER,
      "let blake2_js_1;",
      'async function __loadBlake2() { blake2_js_1 = await import("@noble/hashes/blake2.js"); }',
    ].join("\n"),
  );
  // 2. Load it at the start of buildBlockMap, before blake2b is used.
  content = content.replace(
    BUILD_BLOCK_MAP,
    (signature) => `${signature}\n    await __loadBlake2();`,
  );

  fs.writeFileSync(targetFile, content, "utf8");
  console.log(
    "[fix-noble-hashes-esm] Patched app-builder-lib blockmap.js for ESM compatibility.",
  );
}

main();
