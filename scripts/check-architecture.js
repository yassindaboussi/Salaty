"use strict";
/**
 * check-architecture.js: the renderer's module rules (src/renderer/js/README.md), checked on
 * every `npm run lint` so the structure cannot drift:
 *
 *   1. Layers: a module imports only from its own layer or the layers below it.
 *        utils < core < services < components < app < pages, windows < entries
 *   2. Pages stay independent: a page (pages/<name>.js or the folder pages/<name>/) imports
 *      nothing from another page; the same for the windows.
 *   3. No circular imports.
 *
 * Imports are the `require("./...")` calls between files of src/renderer/js; data files
 * (.json), src/shared and packages are not part of the rules.
 */

const fs = require("fs");
const path = require("path");

const JS_DIR = path.join(__dirname, "../src/renderer/js");
const LAYERS = [
  "utils",
  "core",
  "services",
  "components",
  "app",
  "pages",
  "entries",
];
// windows/ are the pages of the small windows (widget, popups, background player)
const layerOf = (rel) => {
  const top = rel.split("/")[0];
  return LAYERS.indexOf(top === "windows" ? "pages" : top);
};
// pages/quran/reader.js -> "pages/quran"; pages/home.js -> "pages/home"
const unitOf = (rel) => {
  const [top, name] = rel.split("/");
  return `${top}/${name.replace(/\.js$/, "")}`;
};

function jsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return jsFiles(full);
    return e.name.endsWith(".js") ? [full] : [];
  });
}

const rel = (file) => path.relative(JS_DIR, file).split(path.sep).join("/");

function resolveRequire(fromFile, request) {
  const base = path.resolve(path.dirname(fromFile), request);
  for (const candidate of [base, `${base}.js`, path.join(base, "index.js")]) {
    if (candidate.endsWith(".js") && fs.existsSync(candidate)) return candidate;
  }
  return null; // a data file, src/shared, or a typo (the bundler reports those)
}

const graph = new Map();
for (const file of jsFiles(JS_DIR)) {
  const source = fs.readFileSync(file, "utf8");
  const deps = [...source.matchAll(/require\(\s*"(\.{1,2}\/[^"]+)"\s*\)/g)]
    .map((m) => resolveRequire(file, m[1]))
    .filter((dep) => dep && dep.startsWith(JS_DIR));
  graph.set(file, deps);
}

const problems = [];
for (const [file, deps] of graph) {
  const from = rel(file);
  if (layerOf(from) === -1) {
    problems.push(
      `${from}: not in a known layer folder (${LAYERS.join(", ")}, windows)`,
    );
    continue;
  }
  for (const dep of deps) {
    const to = rel(dep);
    if (layerOf(to) > layerOf(from)) {
      problems.push(
        `${from} imports ${to}: a lower layer must not depend on a higher one`,
      );
    } else if (
      layerOf(from) === layerOf("pages/x") &&
      layerOf(to) === layerOf("pages/x") &&
      unitOf(from) !== unitOf(to)
    ) {
      problems.push(
        `${from} imports ${to}: pages and windows must not import each other`,
      );
    }
  }
}

// circular imports (depth-first search; each cycle reported once)
const state = new Map(); // file -> "visiting" | "done"
const stack = [];
const cycles = new Set();
function visit(file) {
  state.set(file, "visiting");
  stack.push(file);
  for (const dep of graph.get(file) ?? []) {
    if (state.get(dep) === "visiting") {
      cycles.add(
        [...stack.slice(stack.indexOf(dep)), dep].map(rel).join(" -> "),
      );
    } else if (!state.has(dep)) {
      visit(dep);
    }
  }
  stack.pop();
  state.set(file, "done");
}
for (const file of graph.keys()) if (!state.has(file)) visit(file);
for (const cycle of cycles) problems.push(`circular import: ${cycle}`);

if (problems.length) {
  console.error(problems.join("\n"));
  console.error(
    `\n${problems.length} architecture problem(s); the rules: src/renderer/js/README.md`,
  );
  process.exit(1);
}
console.log(
  `architecture: ${graph.size} modules, layers respected, no cycles.`,
);
