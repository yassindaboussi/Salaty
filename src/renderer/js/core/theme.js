"use strict";
const { ipcRenderer } = require("electron");

// Use a prefix-based replace instead of a hardcoded list of theme names —
// this never goes stale when new themes are added to CSS.
function applyTheme(theme) {
  const app = document.getElementById("app");
  if (!app || !theme) return;

  // Remove all existing theme-* classes from app and body in one pass.
  const stripTheme = (el) => {
    const next = [...el.classList].filter((c) => !c.startsWith("theme-"));
    el.className = next.join(" ");
  };
  stripTheme(app);
  stripTheme(document.body);

  app.classList.add(`theme-${theme}`);
  document.body.classList.add(`theme-${theme}`);
  ipcRenderer.send("theme-changed", theme);
}

module.exports = { applyTheme };
