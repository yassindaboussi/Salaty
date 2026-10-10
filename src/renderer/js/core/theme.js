"use strict";
const { ipcRenderer } = require("electron");

// Replaces the `theme-*` class on each element. The themes (css/00-settings/themes.css) hang
// their colour variables on that class; other classes on the element are left alone.
function setThemeClass(elements, theme) {
  if (!theme) return;
  for (const el of elements) {
    if (!el) continue;
    el.classList.remove(
      ...[...el.classList].filter((c) => c.startsWith("theme-")),
    );
    el.classList.add(`theme-${theme}`);
  }
}

// App pages: the theme goes on <body> and #app, and main is told so the background player and
// the popups follow. (Popup windows are transparent: they only theme their own #app card.)
function applyTheme(theme) {
  const app = document.getElementById("app");
  if (!app || !theme) return;
  setThemeClass([document.body, app], theme);
  ipcRenderer.send("theme-changed", theme);
}

module.exports = { applyTheme, setThemeClass };
