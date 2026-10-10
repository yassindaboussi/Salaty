"use strict";

const { Tray, Menu } = require("electron");
const { icons, pages } = require("../config/paths");

const { t } = require("../services/i18n");

let tray = null;
let buildTrayMenu = null;

function createTray({ getSettings, getMainWindow, onQuit }) {
  if (tray) return tray;

  tray = new Tray(icons.tray);

  // Brings the main window back from the tray or the taskbar.
  const showWindow = () => {
    const win = getMainWindow();
    if (!win || win.isDestroyed()) return null;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    return win;
  };

  buildTrayMenu = () => {
    const lang = getSettings().language;
    return Menu.buildFromTemplate([
      { label: t("trayShow", lang), click: showWindow },
      {
        label: t("trayCheckUpdates", lang),
        click: () => {
          // The "#check-updates" hash is picked up by settings.js on load to scroll to the
          // About section and start the check: the menu can be used from any page (or while
          // the window is hidden), so opening Settings is what lets the user see the result.
          showWindow()?.loadFile(pages.byName("settings"), {
            hash: "check-updates",
          });
        },
      },
      { label: t("trayQuit", lang), click: onQuit },
    ]);
  };

  tray.setToolTip("Salaty Time");
  tray.setContextMenu(buildTrayMenu());
  tray.on("click", showWindow);

  return tray;
}

// Rebuilds the menu in the current language (called when the language setting changes).
function refreshTrayMenu() {
  if (tray && buildTrayMenu) tray.setContextMenu(buildTrayMenu());
}

function destroyTray() {
  tray?.destroy();
  tray = null;
}

function hasTray() {
  return Boolean(tray);
}

module.exports = { createTray, refreshTrayMenu, destroyTray, hasTray };
