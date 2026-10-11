"use strict";

// IPC for the main window: window buttons, size, page navigation, app info, clipboard.
const { app, clipboard } = require("electron");
const secureIpc = require("../secure-ipc");
const check = require("../validate");
const { pages, ADHAN_AUDIO_URL } = require("../../config/paths");
const {
  showExistingWindow,
  syncWindowState,
} = require("../../windows/main-window");
const { openExternalSafely } = require("../../app/security");
const { checkForUpdatesNow } = require("../../windows/updater");
const startup = require("../../app/startup-timing");
const log = require("../../services/logger").logger("Main");

let registered = false;

// getMainWindow: returns the main window (or null); read on every call so the handlers never
// keep a stale window.
function registerWindowHandlers(getMainWindow) {
  if (registered) return;
  registered = true;

  const win = () => {
    const w = getMainWindow();
    return w && !w.isDestroyed() ? w : null;
  };

  secureIpc.handle("minimize-window", () => win()?.minimize());
  secureIpc.handle("close-window", () => win()?.hide());

  // A page fitting the window to its content. Never un-maximizes: whether the window is
  // maximized is the user's choice (see syncWindowState), not a side effect of a resize.
  secureIpc.handle("resize-window", (_e, width, height) => {
    const w = win();
    const size = check.windowSize(width, height);
    if (!w || !size) return { width: 850, height: 560 };
    if (w.isMaximized()) {
      const [cw, ch] = w.getSize();
      return { width: cw, height: ch };
    }
    w.setSize(size.width, size.height, false);
    return size;
  });

  // The page's expand/compress button. The page updates when "window-maximized-changed"
  // arrives; if nothing changes (already in that state) the state is sent again.
  secureIpc.handle("maximize-window", () => {
    const w = win();
    if (!w) return false;
    if (w.isMaximized()) syncWindowState(w);
    else w.maximize();
    return true;
  });
  secureIpc.handle("unmaximize-window", () => {
    const w = win();
    if (!w) return false;
    if (w.isMaximized()) w.unmaximize();
    else syncWindowState(w);
    return true;
  });

  secureIpc.handle("navigate-to", (_e, page, width, height) => {
    const w = win();
    if (!w) return false;
    // a page that needs a size (e.g. the playlist from the mini player) gets it only in
    // normal mode; a maximized window stays maximized
    const size = width && height ? check.windowSize(width, height) : null;
    if (size && !w.isMaximized()) w.setSize(size.width, size.height, false);
    w.loadURL(pages.byName(page));
    return true;
  });

  secureIpc.handle("go-back", () => {
    win()?.loadURL(pages.index);
    return true;
  });

  // The window starts hidden and is shown once the first page has rendered.
  secureIpc.once("app-ready", () => {
    win()?.show();
    startup.mark("shown");
    startup.reportStartup(log);
  });

  secureIpc.handle("get-app-version", () => app.getVersion());
  secureIpc.handle("get-adhan-audio-src", () => ADHAN_AUDIO_URL);
  secureIpc.handle("check-for-updates-manual", () => checkForUpdatesNow());

  // Electron 44+: clipboard calls return a Promise
  secureIpc.handle("clipboard-write-text", async (_e, text) => {
    const clean = check.clipboardText(text);
    if (clean === undefined) return false;
    await clipboard.writeText(clean);
    return true;
  });

  // Links to outside sites (allow-list in app/security.js).
  secureIpc.handle("open-external", (_e, url) => openExternalSafely(url));

  // "Open app" in the popups.
  secureIpc.on("show-main-window", () => showExistingWindow(win()));
}

module.exports = { registerWindowHandlers };
