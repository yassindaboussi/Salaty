/**
 * popup-handlers.js
 * Manages athkar/adhan popup windows and the prayer widget window.
 */
"use strict";
const { BrowserWindow, ipcMain, screen } = require("electron");
const { pages } = require("../../config/paths");
const prayerTimerManager = require("../../services/prayer-timer-manager");

let athkarPopupWindow = null;
let adhanPopupWindow = null;
let prayerWidgetWindow = null;

const WIDGET_WIDTH = 360;
const WIDGET_HEIGHT = 36;
const POPUP_WIDTH = 340;
const POPUP_MARGIN = 16;

// ── Prayer Widget ─────────────────────────────────────────────────────────────

function createPrayerWidget() {
  if (prayerWidgetWindow && !prayerWidgetWindow.isDestroyed()) {
    prayerWidgetWindow.focus();
    return;
  }
  const { bounds, workArea } = screen.getPrimaryDisplay();
  prayerWidgetWindow = new BrowserWindow({
    width: WIDGET_WIDTH,
    height: WIDGET_HEIGHT,
    x: bounds.x + Math.round((bounds.width - WIDGET_WIDTH) / 2),
    y: workArea.y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: true,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      backgroundThrottling: false, // FIX: prevent timer drift when window not focused
    },
  });
  prayerWidgetWindow.setAlwaysOnTop(true, "pop-up-menu");
  prayerWidgetWindow.loadFile(pages.prayerWidget);
  prayerWidgetWindow.once("ready-to-show", () => prayerWidgetWindow.show());
  prayerWidgetWindow.on("closed", () => {
    prayerWidgetWindow = null;
  });
}

ipcMain.handle("toggle-prayer-widget", () => {
  if (prayerWidgetWindow && !prayerWidgetWindow.isDestroyed()) {
    prayerWidgetWindow.destroy();
    prayerWidgetWindow = null;
    return false;
  }
  createPrayerWidget();
  return true;
});

ipcMain.on("close-prayer-widget", () => {
  if (prayerWidgetWindow && !prayerWidgetWindow.isDestroyed()) {
    prayerWidgetWindow.destroy();
    prayerWidgetWindow = null;
  }
});

ipcMain.on("widget-set-always-on-top", (_e, value) => {
  if (prayerWidgetWindow && !prayerWidgetWindow.isDestroyed())
    prayerWidgetWindow.setAlwaysOnTop(value, "pop-up-menu");
});

// FIX: Expose already-fetched prayer data to widget — avoids duplicate HTTP fetch
ipcMain.handle("get-prayer-data", () => {
  return prayerTimerManager.getPrayerData() || null;
});

// ── Themed popups (athkar / adhan) ───────────────────────────────────────────

function showThemedPopup(data, type) {
  const existing = type === "adhan" ? adhanPopupWindow : athkarPopupWindow;
  if (existing && !existing.isDestroyed()) existing.destroy();

  const { workArea } = screen.getPrimaryDisplay();
  const win = new BrowserWindow({
    width: POPUP_WIDTH,
    height: 800,
    x: workArea.x + workArea.width,
    y: workArea.y + workArea.height - 800 - POPUP_MARGIN,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: true,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
    },
  });
  win.setAlwaysOnTop(true, "pop-up-menu");
  win.loadFile(pages.athkarPopup);
  win.once("ready-to-show", () =>
    win.webContents.send("init-themed-popup", { ...data, type }),
  );
  win.on("closed", () => {
    if (type === "adhan") adhanPopupWindow = null;
    else athkarPopupWindow = null;
  });
  if (type === "adhan") adhanPopupWindow = win;
  else athkarPopupWindow = win;
}

ipcMain.on("show-athkar-popup", (_e, data) =>
  showThemedPopup({ icon: "fa-moon", ...data }, "athkar"),
);
ipcMain.on("show-adhan-popup", (_e, data) =>
  showThemedPopup({ icon: "fa-mosque", ...data }, "adhan"),
);

ipcMain.on("show-themed-popup-ready", (event, { height }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) return;
  const { workArea } = screen.getPrimaryDisplay();
  const newHeight = Math.min(Math.max(height, 120), 520);
  win.setBounds({
    x: workArea.x + workArea.width - POPUP_WIDTH - POPUP_MARGIN,
    y: workArea.y + workArea.height - newHeight - POPUP_MARGIN,
    width: POPUP_WIDTH,
    height: newHeight,
  });
  win.showInactive();
});

ipcMain.on("close-themed-popup", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) win.destroy();
});

// ── Broadcast theme changes to popup/widget windows ──────────────────────────

function broadcastThemeToPopups(theme) {
  if (prayerWidgetWindow && !prayerWidgetWindow.isDestroyed())
    prayerWidgetWindow.webContents.send("theme-changed", theme);
}

function getPrayerWidgetWindow() {
  return prayerWidgetWindow;
}

module.exports = { broadcastThemeToPopups, getPrayerWidgetWindow };
