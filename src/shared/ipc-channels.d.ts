// Types only (nothing here runs): the IPC channels between the pages and the main process,
// and the API the preload gives the pages as `window.electron`.
//
// One list for every side, checked by `npm run lint:types`:
//   - src/preload/index.js: its allow-lists must contain exactly these channels
//   - src/main/ipc/secure-ipc.js: a handler can only be registered for one of them
//   - the pages: a misspelled channel name is an error
// To add a channel, add it here first; the checker then shows every place to update.

/** renderer -> main, with an answer (ipcRenderer.invoke / secureIpc.handle) */
export type InvokeChannel =
  | "add-location"
  | "check-connection"
  | "check-for-updates-manual"
  | "clipboard-write-text"
  | "close-window"
  | "delete-location"
  | "detect-location"
  | "get-adhan-audio-src"
  | "get-adhan-state"
  | "get-app-version"
  | "get-connection-status"
  | "get-fasting-occasions"
  | "get-locations"
  | "get-prayer-data"
  | "get-prayer-month"
  | "get-ramadan-calendar"
  | "get-hijri-month"
  | "gregorian-to-hijri"
  | "hijri-to-gregorian"
  | "get-prayer-widget-state"
  | "get-settings"
  | "get-update-mode"
  | "go-back"
  | "maximize-window"
  | "minimize-window"
  | "navigate-to"
  | "open-external"
  | "resize-window"
  | "save-settings"
  | "set-active-location"
  | "toggle-prayer-widget"
  | "toggle-travel-mode"
  | "unmaximize-window"
  | "update-location";

/** renderer -> main, no answer (ipcRenderer.send / secureIpc.on) */
export type SendChannel =
  | "analytics:error"
  | "analytics:feature-open"
  | "analytics:navigation"
  | "analytics:settings-saved"
  | "analytics:track"
  | "app-ready"
  | "close-mini-player"
  | "close-prayer-widget"
  | "close-themed-popup"
  | "install-update"
  | "player-command"
  | "player-update"
  | "prayer-widget-ready"
  | "show-adhan-popup"
  | "show-athkar-popup"
  | "show-main-window"
  | "show-themed-popup-ready"
  | "start-download"
  | "stop-adhan"
  | "theme-changed"
  | "widget-set-always-on-top";

/** main -> renderer (webContents.send / ipcRenderer.on) */
export type ReceiveChannel =
  | "apply-theme"
  | "connection-lost"
  | "connection-restored"
  | "download-progress"
  | "fasting-reminder-due"
  | "force-hide-tooltip"
  | "force-stop-adhan"
  | "init-themed-popup"
  | "location-changed"
  | "player-command"
  | "player-update"
  | "prayer-data-from-main"
  | "prayer-widget-state"
  | "show-pre-adhan-notification"
  | "theme-changed"
  | "trigger-adhan"
  | "update-available"
  | "update-downloaded"
  | "update-error"
  | "update-not-available"
  | "window-focus-changed"
  | "window-maximized-changed";

/**
 * A listener for a main -> renderer message. The first argument is an empty object, never
 * Electron's event (its `sender` would get around the allow-lists).
 */
export type PageListener = (event: {}, ...args: any[]) => void;

/** `window.electron`: what src/preload/index.js exposes through contextBridge. */
export interface ElectronBridge {
  ipcRenderer: {
    invoke(channel: InvokeChannel, ...args: unknown[]): Promise<any>;
    send(channel: SendChannel, ...args: unknown[]): void;
    on(channel: ReceiveChannel, listener: PageListener): void;
    once(channel: ReceiveChannel, listener: PageListener): void;
    removeListener(channel: ReceiveChannel, listener: PageListener): void;
    removeAllListeners(channel: ReceiveChannel): void;
  };
}
