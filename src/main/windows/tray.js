"use strict";

const { Tray, Menu } = require("electron");
const { icons, pages } = require("../config/paths");

const { t } = require("../services/i18n");
const { updateMode } = require("./updater");

/** @import { BrowserWindow } from "electron" */

/** @type {Tray | null} */
let tray = null;
/** @type {(() => Menu) | null} the menu in the current language */
let buildTrayMenu = null;

/**
 * @param {object} options
 * @param {() => { language?: string }} options.getSettings
 * @param {() => BrowserWindow | null} options.getMainWindow
 * @param {() => void} options.onQuit
 */
function createTray({ getSettings, getMainWindow, onQuit }) {
  if (tray) return tray;

  const trayIcon = new Tray(icons.tray);
  tray = trayIcon;

  // Brings the main window back from the tray or the taskbar.
  const showWindow = () => {
    const win = getMainWindow();
    if (!win || win.isDestroyed()) return null;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    return win;
  };

  const buildMenu = () => {
    const lang = getSettings().language;
    return Menu.buildFromTemplate([
      { label: t("trayShow", lang), click: showWindow },
      {
        // the Microsoft Store build is updated by the Store
        visible: updateMode() !== "store",
        label: t("trayCheckUpdates", lang),
        click: () => {
          // The "#check-updates" hash is picked up by settings/about.js on load to scroll to the
          // About section and start the check: the menu can be used from any page (or while
          // the window is hidden), so opening Settings is what lets the user see the result.
          showWindow()?.loadURL(`${pages.byName("settings")}#check-updates`);
        },
      },
      { label: t("trayQuit", lang), click: onQuit },
    ]);
  };
  buildTrayMenu = buildMenu;

  trayIcon.setToolTip("Salaty Time");
  trayIcon.setContextMenu(buildMenu());
  trayIcon.on("click", showWindow);

  return trayIcon;
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
