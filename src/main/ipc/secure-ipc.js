"use strict";

// ipcMain.handle / .on / .once that only accept messages sent by the top frame of our own
// pages (Electron security checklist #17, "validate the sender of all IPC messages"): an
// embedded site (the live-stream iframes) or a page that somehow navigated away can never
// reach a handler. Every main-process IPC channel is registered through this module.
const { ipcMain } = require("electron");
const { isAppPage } = require("../app/security");
const log = require("../services/logger").logger("IPC");

function isTrustedSender(event) {
  const frame = event.senderFrame;
  return Boolean(frame) && frame.parent === null && isAppPage(frame.url);
}

function reject(channel, event) {
  log.warn(
    `blocked "${channel}" from`,
    event.senderFrame?.url ?? "(unknown frame)",
  );
}

function handle(channel, handler) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrustedSender(event)) {
      reject(channel, event);
      throw new Error(`"${channel}" is not allowed from this page`);
    }
    return handler(event, ...args);
  });
}

function on(channel, listener) {
  ipcMain.on(channel, (event, ...args) => {
    if (!isTrustedSender(event)) return reject(channel, event);
    return listener(event, ...args);
  });
}

function once(channel, listener) {
  ipcMain.once(channel, (event, ...args) => {
    if (!isTrustedSender(event)) return reject(channel, event);
    return listener(event, ...args);
  });
}

module.exports = { handle, on, once, isTrustedSender };
