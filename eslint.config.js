"use strict";

// JavaScript linting: `npm run lint` (also run in CI).
const js = require("@eslint/js");
const globals = require("globals");

// Shared code-quality rules for every part of the app.
const quality = {
  // Real bugs or dead code
  "no-unused-vars": [
    "error",
    { args: "after-used", argsIgnorePattern: "^_", caughtErrors: "none" },
  ],
  "no-empty": ["error", { allowEmptyCatch: true }],
  "no-shadow": "error",
  eqeqeq: ["error", "smart"],
  strict: ["error", "global"],
  // Modern, consistent JavaScript
  "no-var": "error",
  "prefer-const": "error",
  "prefer-template": "error",
  "object-shorthand": "error",
  "no-implicit-coercion": "error",
  "no-unneeded-ternary": "error",
  "no-lonely-if": "error",
  "no-useless-return": "error",
  "no-else-return": "error",
  // Only warnings and errors reach the console in production code
  "no-console": ["error", { allow: ["warn", "error"] }],
};

module.exports = [
  { ignores: ["src/renderer/vendor/**", "src/renderer/js-bundled/**"] },
  js.configs.recommended,

  // Main process, preload and code shared with the main process: Node.js (CommonJS)
  {
    files: [
      "src/main/**/*.js",
      "src/preload/**/*.js",
      "src/shared/**/*.js",
      "scripts/**/*.js",
      "*.config.js",
      "*.config.cjs",
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
    rules: quality,
  },

  // Renderer: runs in the browser (sandboxed, no Node.js). Files are CommonJS only because
  // esbuild bundles them (scripts/build-renderer.js), so `require`/`module` exist at build time.
  {
    files: ["src/renderer/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: { ...globals.browser, require: "readonly", module: "writable" },
    },
    rules: quality,
  },

  // Howler is loaded by a <script> tag (vendor/howler) on the background player page.
  {
    files: ["src/renderer/js/windows/background-player.js"],
    languageOptions: { globals: { Howler: "readonly", Howl: "readonly" } },
  },

  // Command-line scripts print their results.
  { files: ["scripts/**/*.js"], rules: { "no-console": "off" } },
];
