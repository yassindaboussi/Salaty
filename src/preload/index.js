// preload.js
//
// Runs in an isolated context (contextIsolation: true) with Node access
// (sandbox: true) but the page itself has NO direct Node/Electron access
// (nodeIntegration: false). We expose only the small, specific surface the
// renderer actually needs via contextBridge, instead of handing over the
// full `electron` and Node module.
//
// Every channel is on an allow-list (Electron security checklist: "do not expose
// Electron APIs to untrusted web content"). A new channel must be added here and
// registered in the main process with ipc/secure-ipc.js.
"use strict";

const { contextBridge, ipcRenderer } = require("electron");

// renderer -> main, with an answer
const INVOKE_CHANNELS = new Set([
  "add-location",
  "check-connection",
  "check-for-updates-manual",
  "clipboard-write-text",
  "close-window",
  "delete-location",
  "detect-location",
  "get-adhan-audio-src",
  "get-adhan-state",
  "get-app-version",
  "get-connection-status",
  "get-fasting-occasions",
  "get-locations",
  "get-prayer-data",
  "get-prayer-widget-state",
  "get-settings",
  "go-back",
  "maximize-window",
  "minimize-window",
  "navigate-to",
  "open-external",
  "resize-window",
  "save-settings",
  "set-active-location",
  "toggle-prayer-widget",
  "toggle-travel-mode",
  "unmaximize-window",
  "update-location",
]);

// renderer -> main, no answer
const SEND_CHANNELS = new Set([
  "analytics:error",
  "analytics:feature-open",
  "analytics:navigation",
  "analytics:settings-saved",
  "analytics:track",
  "app-ready",
  "close-mini-player",
  "close-prayer-widget",
  "close-themed-popup",
  "install-update",
  "player-command",
  "player-update",
  "prayer-data-updated",
  "prayer-widget-ready",
  "show-adhan-popup",
  "show-athkar-popup",
  "show-main-window",
  "show-themed-popup-ready",
  "start-download",
  "stop-adhan",
  "theme-changed",
  "widget-set-always-on-top",
]);

// main -> renderer
const RECEIVE_CHANNELS = new Set([
  "apply-theme",
  "connection-lost",
  "connection-restored",
  "download-progress",
  "fasting-reminder-due",
  "force-hide-tooltip",
  "force-stop-adhan",
  "init-themed-popup",
  "location-changed",
  "player-command",
  "player-update",
  "prayer-data-from-main",
  "prayer-widget-state",
  "show-pre-adhan-notification",
  "theme-changed",
  "trigger-adhan",
  "update-available",
  "update-downloaded",
  "update-error",
  "update-not-available",
  "window-maximized-changed",
]);

function assertAllowed(list, channel) {
  if (!list.has(channel)) {
    throw new Error(`IPC channel "${channel}" is not allowed`);
  }
}

// ipcRenderer.on/once wrap each listener so the page never gets the raw
// IpcRendererEvent: its `sender` is the full ipcRenderer, which would get around the
// allow-lists above. Listeners receive an empty event object instead. Renderer code (unchanged from before this
// migration) calls removeListener with the SAME callback reference it
// originally passed to on() — so we track original -> wrapped mappings
// per channel here, to make that still work correctly.
const PAGE_EVENT = Object.freeze({});
const listenerMap = new Map(); // channel -> Map(originalListener -> wrappedListener)

function getChannelMap(channel) {
  let map = listenerMap.get(channel);
  if (!map) {
    map = new Map();
    listenerMap.set(channel, map);
  }
  return map;
}

contextBridge.exposeInMainWorld("electron", {
  ipcRenderer: {
    invoke: (channel, ...args) => {
      if (!INVOKE_CHANNELS.has(channel)) {
        return Promise.reject(
          new Error(`IPC channel "${channel}" is not allowed`),
        );
      }
      return ipcRenderer.invoke(channel, ...args);
    },
    send: (channel, ...args) => {
      assertAllowed(SEND_CHANNELS, channel);
      ipcRenderer.send(channel, ...args);
    },
    on: (channel, listener) => {
      assertAllowed(RECEIVE_CHANNELS, channel);
      const wrapped = (_event, ...args) => listener(PAGE_EVENT, ...args);
      getChannelMap(channel).set(listener, wrapped);
      ipcRenderer.on(channel, wrapped);
    },
    once: (channel, listener) => {
      assertAllowed(RECEIVE_CHANNELS, channel);
      ipcRenderer.once(channel, (_event, ...args) =>
        listener(PAGE_EVENT, ...args),
      );
    },
    removeListener: (channel, listener) => {
      const map = listenerMap.get(channel);
      const wrapped = map?.get(listener);
      if (wrapped) {
        ipcRenderer.removeListener(channel, wrapped);
        map.delete(listener);
      }
    },
    removeAllListeners: (channel) => {
      assertAllowed(RECEIVE_CHANNELS, channel);
      ipcRenderer.removeAllListeners(channel);
      listenerMap.delete(channel);
    },
  },
});
