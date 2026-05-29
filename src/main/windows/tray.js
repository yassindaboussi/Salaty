"use strict";

const { Tray, Menu, ipcMain } = require("electron");
const { icons } = require("../config/paths");

let tray = null;

function createTray({ getSettings, getMainWindow, onQuit }) {
  if (tray) return tray;

  tray = new Tray(icons.tray);

  const buildTrayMenu = () => {
    const settings = getSettings();
    const lang = settings.language || "en";
    const labels = {
      en: { show: "Show Salaty Time", quit: "Quit" },
      ar: { show: "فتح صلاتي", quit: "إغلاق" },
      fr: { show: "Afficher Salaty Time", quit: "Quitter" },
    };
    const l = labels[lang] || labels.en;

    return Menu.buildFromTemplate([
      { label: l.show, click: () => getMainWindow()?.show() },
      { label: l.quit, click: onQuit },
    ]);
  };

  tray.setToolTip("Salaty Time");
  tray.setContextMenu(buildTrayMenu());
  tray.on("click", () => getMainWindow()?.show());
  ipcMain.on("tray-rebuild-menu", () => tray?.setContextMenu(buildTrayMenu()));

  return tray;
}

function destroyTray() {
  tray?.destroy();
  tray = null;
}

function hasTray() {
  return Boolean(tray);
}

module.exports = { createTray, destroyTray, hasTray };
