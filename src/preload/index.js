// preload.js
//
// Runs in an isolated context (contextIsolation: true) with Node access
// (sandbox: true) but the page itself has NO direct Node/Electron access
// (nodeIntegration: false). We expose only the small, specific surface the
// renderer actually needs via contextBridge, instead of handing over the
// full `electron` and Node module.
//
// Every channel is on an allow-list (Electron security checklist: "do not expose
// Electron APIs to untrusted web content"). The lists must match src/shared/ipc-channels.d.ts
// exactly (checked by `npm run lint:types`): a new channel goes there first, then here and
// in the main process (ipc/secure-ipc.js).
"use strict";

const { contextBridge, ipcRenderer } = require("electron");

/** @import { ElectronBridge, InvokeChannel, SendChannel, ReceiveChannel } from "../shared/ipc-channels" */

// renderer -> main, with an answer
/** @type {Record<InvokeChannel, true>} */
const INVOKE = {
  "add-location": true,
  "check-connection": true,
  "check-for-updates-manual": true,
  "clipboard-write-text": true,
  "close-window": true,
  "delete-location": true,
  "detect-location": true,
  "get-adhan-audio-src": true,
  "get-adhan-state": true,
  "get-app-version": true,
  "get-connection-status": true,
  "get-fasting-days": true,
  "get-locations": true,
  "get-feedback-info": true,
  "get-prayer-data": true,
  "get-prayer-month": true,
  "get-ramadan-calendar": true,
  "get-hijri-month": true,
  "gregorian-to-hijri": true,
  "hijri-to-gregorian": true,
  "get-prayer-widget-state": true,
  "get-settings": true,
  "get-update-mode": true,
  "go-back": true,
  "maximize-window": true,
  "minimize-window": true,
  "navigate-to": true,
  "open-external": true,
  "resize-window": true,
  "save-settings": true,
  "send-feedback": true,
  "set-active-location": true,
  "take-crash-report": true,
  "toggle-prayer-widget": true,
  "toggle-travel-mode": true,
  "unmaximize-window": true,
  "update-location": true,
};
const INVOKE_CHANNELS = new Set(Object.keys(INVOKE));

// renderer -> main, no answer
/** @type {Record<SendChannel, true>} */
const SEND = {
  "analytics:error": true,
  "analytics:feature-open": true,
  "analytics:navigation": true,
  "analytics:settings-saved": true,
  "analytics:track": true,
  "app-ready": true,
  "close-mini-player": true,
  "close-prayer-widget": true,
  "close-themed-popup": true,
  "install-update": true,
  "player-command": true,
  "player-update": true,
  "prayer-widget-ready": true,
  "renderer-error": true,
  "show-adhan-popup": true,
  "show-athkar-popup": true,
  "show-main-window": true,
  "show-themed-popup-ready": true,
  "start-download": true,
  "stop-adhan": true,
  "theme-changed": true,
  "widget-set-always-on-top": true,
};
const SEND_CHANNELS = new Set(Object.keys(SEND));

// main -> renderer
/** @type {Record<ReceiveChannel, true>} */
const RECEIVE = {
  "apply-theme": true,
  "connection-lost": true,
  "connection-restored": true,
  "download-progress": true,
  "force-hide-tooltip": true,
  "force-stop-adhan": true,
  "init-themed-popup": true,
  "location-changed": true,
  "player-command": true,
  "player-update": true,
  "prayer-data-from-main": true,
  "prayer-widget-state": true,
  "show-pre-adhan-notification": true,
  "theme-changed": true,
  "trigger-adhan": true,
  "update-available": true,
  "update-downloaded": true,
  "update-error": true,
  "update-not-available": true,
  "window-focus-changed": true,
  "window-maximized-changed": true,
};
const RECEIVE_CHANNELS = new Set(Object.keys(RECEIVE));

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

/** @type {ElectronBridge} */
const bridge = {
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
};

contextBridge.exposeInMainWorld("electron", bridge);
