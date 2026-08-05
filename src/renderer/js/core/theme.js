"use strict";
const { ipcRenderer } = require("electron");

function applyTheme(theme) {
  const app = document.getElementById("app");
  if (!app || !theme) return;

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
