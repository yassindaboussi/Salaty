// preload.js
//
// Runs in an isolated context (contextIsolation: true) with Node access
// (sandbox: true) but the page itself has NO direct Node/Electron access
// (nodeIntegration: false). We expose only the small, specific surface the
// renderer actually needs via contextBridge, instead of handing over the
// full `electron` and Node module.
"use strict";

const { contextBridge, ipcRenderer, shell } = require("electron");

// ipcRenderer.on/once wrap each listener so we can strip the raw
// IpcRendererEvent's internals down to what's safe to pass across the
// context-isolation bridge. Renderer code (unchanged from before this
// migration) calls removeListener with the SAME callback reference it
// originally passed to on() — so we track original -> wrapped mappings
// per channel here, to make that still work correctly.
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
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    send: (channel, ...args) => ipcRenderer.send(channel, ...args),
    on: (channel, listener) => {
      const wrapped = (event, ...args) => listener(event, ...args);
      getChannelMap(channel).set(listener, wrapped);
      ipcRenderer.on(channel, wrapped);
    },
    once: (channel, listener) => {
      ipcRenderer.once(channel, (event, ...args) => listener(event, ...args));
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
      ipcRenderer.removeAllListeners(channel);
      listenerMap.delete(channel);
    },
  },
  shell: {
    openExternal: (url) => shell.openExternal(url),
  },
});
