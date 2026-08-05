"use strict";

const { Tray, Menu, ipcMain } = require("electron");
const { icons, pages } = require("../config/paths");

let tray = null;

function createTray({ getSettings, getMainWindow, onQuit }) {
  if (tray) return tray;

  tray = new Tray(icons.tray);

  const buildTrayMenu = () => {
    const settings = getSettings();
    const lang = settings.language || "en";
    const labels = {
      en: { show: "Show Salaty Time", checkUpdate: "Check for Updates", quit: "Quit" },
      ar: { show: "فتح صلاتي", checkUpdate: "التحقق من التحديثات", quit: "إغلاق" },
      fr: { show: "Afficher Salaty Time", checkUpdate: "Rechercher des mises à jour", quit: "Quitter" },
    };
    const l = labels[lang] || labels.en;

    return Menu.buildFromTemplate([
      { label: l.show, click: () => getMainWindow()?.show() },
      {
        label: l.checkUpdate,
        click: () => {
          const win = getMainWindow();
          if (!win || win.isDestroyed()) return;
          if (win.isMinimized()) win.restore();
          win.show();
          win.focus();
          // The "#check-updates" hash is picked up by settings.js on load
          // to scroll to the About section and auto-trigger the check —
          // this menu item can be clicked while the app is on any page
          // (or fully hidden in the tray), so navigating straight to
          // Settings is what actually lets the user see the result.
          win.loadFile(pages.byName("settings"), { hash: "check-updates" });
        },
      },
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
