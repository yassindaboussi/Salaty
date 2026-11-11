"use strict";
const { BrowserWindow, screen } = require("electron");
const secureIpc = require("../secure-ipc");
const check = require("../validate");
const { pages } = require("../../config/paths");
const {
  secureWebPreferences,
  visiblePosition,
} = require("../../config/window-options");
const settings = require("../../services/settings-store");
const prayerTimerManager = require("../../services/prayer-timer-manager");
const { shownTimeKeys } = require("../../../shared/prayerUtils");

/** @import { BrowserWindow as Window } from "electron" */

/** @type {Window | null} */
let athkarPopupWindow = null;
/** @type {Window | null} */
let adhanPopupWindow = null;
/** @type {Window | null} */
let prayerWidgetWindow = null;
/** @type {() => Window | null} */
let getMainWindow = () => null;

// small bar: the five prayer names + times fit in en/ar/fr (checked); each extra time
// turned on in Settings → Show times adds one column
const WIDGET_WIDTH = 380;
const WIDGET_EXTRA_COLUMN = 78;
// 12-hour times ("12:03 PM") are wider: each column gets this much more
const WIDGET_12H_COLUMN = 14;
const WIDGET_HEIGHT = 40; // Windows keeps windows at least ~39px high at 125% scale
// closer than this to a screen edge when dropped: it snaps to the edge
const WIDGET_SNAP = 16;
const POPUP_WIDTH = 340;
const POPUP_MARGIN = 16;
// The widget page normally reports "prayer-widget-ready" within ~0.2 s; this only covers a
// page that crashed or hung before it could.
const WIDGET_SHOW_FALLBACK_MS = 2000;
let revealPrayerWidget = () => {};

// The widget window while it is open, otherwise null.
function openWidget() {
  return prayerWidgetWindow && !prayerWidgetWindow.isDestroyed()
    ? prayerWidgetWindow
    : null;
}

function isPrayerWidgetOpen() {
  return openWidget() !== null;
}

// Main owns the widget's open/closed state; the main window's widget button follows it.
// Sent from the window's own lifecycle so every way of closing it is covered: the toggle
// button, the widget's own × button, or the OS.
function sendPrayerWidgetState() {
  const main = getMainWindow();
  if (main && !main.isDestroyed())
    main.webContents.send("prayer-widget-state", isPrayerWidgetOpen());
}

function closePrayerWidget() {
  openWidget()?.destroy();
}

/**
 * After a drag: snaps to the edges of the screen it was dropped on, then remembers the spot.
 * @param {Window} widget
 */
function snapAndSave(widget) {
  if (widget.isDestroyed()) return;
  const b = widget.getBounds();
  const a = screen.getDisplayMatching(b).workArea;
  const snap = (
    /** @type {number} */ v,
    /** @type {number} */ min,
    /** @type {number} */ max,
  ) =>
    Math.abs(v - min) < WIDGET_SNAP
      ? min
      : Math.abs(v - max) < WIDGET_SNAP
        ? max
        : v;
  const x = snap(b.x, a.x, a.x + a.width - b.width);
  const y = snap(b.y, a.y, a.y + a.height - b.height);
  if (x !== b.x || y !== b.y) widget.setPosition(x, y);
  settings.saveWidgetPosition(x, y);
}

/** The bar's width for the times shown now (Show times, Time format). */
function widgetWidth({ extraTimes, timeFormat } = settings.get()) {
  const columns = shownTimeKeys(extraTimes).length;
  const wide = timeFormat === "12" ? columns * WIDGET_12H_COLUMN : 0;
  return WIDGET_WIDTH + (columns - 5) * WIDGET_EXTRA_COLUMN + wide;
}

/**
 * Settings → Show times or Time format changed: the open widget gets the new width (same
 * centre, kept on its screen); `channel` tells it to draw its columns again.
 * @param {"extra-times-changed" | "time-format-changed"} channel
 * @param {unknown} value the new setting
 */
function resizeWidget(channel, value) {
  const widget = openWidget();
  if (!widget) return;
  const b = widget.getBounds();
  const width = widgetWidth();
  const { workArea } = screen.getDisplayMatching(b);
  const centred = b.x + Math.round((b.width - width) / 2);
  const max = workArea.x + workArea.width - width;
  const x = Math.max(workArea.x, Math.min(centred, max));
  widget.setBounds({ x, y: b.y, width, height: WIDGET_HEIGHT });
  settings.saveWidgetPosition(x, b.y);
  widget.webContents.send(channel, value);
}

function createPrayerWidget() {
  const existing = openWidget();
  if (existing) {
    existing.focus();
    return;
  }
  // where the user left it, if still on a connected screen; else top centre, against the edge
  const { workArea } = screen.getPrimaryDisplay();
  const width = widgetWidth();
  const saved = visiblePosition(settings.get().widgetPosition, width);
  const widget = new BrowserWindow({
    width,
    height: WIDGET_HEIGHT,
    x: saved.x ?? workArea.x + Math.round((workArea.width - width) / 2),
    y: saved.y ?? workArea.y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: true,
    show: false,
    webPreferences: secureWebPreferences({ backgroundThrottling: false }),
  });
  prayerWidgetWindow = widget;
  widget.setAlwaysOnTop(true, "pop-up-menu");
  widget.loadURL(pages.prayerWidget);
  // Shown when the page says it is ready ("prayer-widget-ready": theme, direction and times
  // in place), like the main window's "app-ready". Not on "ready-to-show": that fires before
  // the theme is applied, and on some opens a whole second late (it waits for a visible
  // paint, and the bar is invisible until the page reveals it).
  let shown = false;
  // bound to this window: a timer left from a closed widget can never show a newer one
  const reveal = () => {
    clearTimeout(fallback);
    if (shown || widget.isDestroyed()) return;
    shown = true;
    widget.show();
  };
  const fallback = setTimeout(reveal, WIDGET_SHOW_FALLBACK_MS);
  revealPrayerWidget = reveal;
  widget.on("moved", () => snapAndSave(widget));
  widget.on("closed", () => {
    clearTimeout(fallback);
    // a quick close + reopen must not forget the new widget
    if (prayerWidgetWindow === widget) prayerWidgetWindow = null;
    sendPrayerWidgetState();
  });
  sendPrayerWidgetState();
}

/**
 * The athkar/adhan/fasting/update popup at the bottom corner of the screen.
 * @param {object} data what the popup shows (see ipc/validate.js popupData); `button` is the
 *   update popup's button text
 * @param {"adhan" | "athkar" | "update"} type the update popup shares the athkar one's place
 */
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
    webPreferences: secureWebPreferences(),
  });
  win.setAlwaysOnTop(true, "pop-up-menu");
  win.loadURL(pages.athkarPopup);
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

let registered = false;

/**
 * Popup windows (prayer widget, athkar/adhan popups) and their IPC; called once at start-up.
 * @param {{ getMainWindow?: () => Window | null }} [options] getMainWindow: told when the
 *   widget opens or closes
 */
function registerPopupHandlers({ getMainWindow: getMainWindowFn } = {}) {
  if (registered) return;
  registered = true;
  if (getMainWindowFn) getMainWindow = getMainWindowFn;

  secureIpc.handle("toggle-prayer-widget", () => {
    if (isPrayerWidgetOpen()) closePrayerWidget();
    else createPrayerWidget();
    return isPrayerWidgetOpen();
  });

  // the main window asks on load (its page is reloaded on every navigation)
  secureIpc.handle("get-prayer-widget-state", () => isPrayerWidgetOpen());

  // the widget's own × button
  secureIpc.on("close-prayer-widget", () => closePrayerWidget());

  // the widget page is ready to be seen; only the current widget may ask
  secureIpc.on("prayer-widget-ready", (event) => {
    const widget = openWidget();
    if (widget && event.sender === widget.webContents) revealPrayerWidget();
  });

  secureIpc.on("widget-set-always-on-top", (_e, value) => {
    openWidget()?.setAlwaysOnTop(value === true, "pop-up-menu");
  });

  // Today's prayer times for the home page and the widget (main is their only source).
  secureIpc.handle("get-prayer-data", async () => {
    return (await prayerTimerManager.getPrayerDataWhenReady()) ?? null;
  });

  secureIpc.on("show-athkar-popup", (_e, data) => {
    const clean = check.popupData(data);
    if (clean) showThemedPopup({ icon: "fa-moon", ...clean }, "athkar");
  });
  secureIpc.on("show-adhan-popup", (_e, data) => {
    const clean = check.popupData(data);
    if (clean) showThemedPopup({ icon: "fa-mosque", ...clean }, "adhan");
  });

  secureIpc.on("show-themed-popup-ready", (event, data) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) return;
    const height = Number(data?.height);
    if (!Number.isFinite(height)) return;
    const { workArea } = screen.getPrimaryDisplay();
    const newHeight = Math.round(Math.min(Math.max(height, 120), 520));
    win.setBounds({
      x: workArea.x + workArea.width - POPUP_WIDTH - POPUP_MARGIN,
      y: workArea.y + workArea.height - newHeight - POPUP_MARGIN,
      width: POPUP_WIDTH,
      height: newHeight,
    });
    win.showInactive();
  });

  secureIpc.on("close-themed-popup", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) win.destroy();
  });
}

/** @param {string} theme */
function broadcastThemeToPopups(theme) {
  openWidget()?.webContents.send("theme-changed", theme);
}

// The widget window while it is open, otherwise null.
function getPrayerWidgetWindow() {
  return openWidget();
}

module.exports = {
  registerPopupHandlers,
  broadcastThemeToPopups,
  resizeWidget,
  getPrayerWidgetWindow,
  showThemedPopup,
};
