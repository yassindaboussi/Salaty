"use strict";

// Texts shown by the main process (tray menu, popup titles, error dialog). They live in the
// same locale folders as the page texts: src/renderer/locales/<lang>/app/desktop.json.
const fs = require("fs");
const path = require("path");
const { RENDERER_DIR } = require("../config/paths");

const FALLBACK = "en";
const cache = {};

function load(lang) {
  if (!(lang in cache)) {
    try {
      const file = path.join(
        RENDERER_DIR,
        "locales",
        lang,
        "app",
        "desktop.json",
      );
      cache[lang] = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      cache[lang] = {};
    }
  }
  return cache[lang];
}

// Text for `key` in `lang` (English when missing; the key itself as a last resort).
function t(key, lang = FALLBACK) {
  return load(lang)[key] ?? load(FALLBACK)[key] ?? key;
}

module.exports = { t };
