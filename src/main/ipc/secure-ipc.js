"use strict";

// ipcMain.handle / .on / .once that only accept messages sent by the top frame of our own
// pages (Electron security checklist #17, "validate the sender of all IPC messages"): an
// embedded site (the live-stream iframes) or a page that somehow navigated away can never
// reach a handler. Every main-process IPC channel is registered through this module.
const { ipcMain } = require("electron");
const { isAppPage } = require("../app/security");
const log = require("../services/logger").logger("IPC");

/**
 * @import { IpcMainEvent, IpcMainInvokeEvent } from "electron"
 * @import { InvokeChannel, SendChannel } from "../../shared/ipc-channels"
 */

/** @param {IpcMainEvent | IpcMainInvokeEvent} event */
function isTrustedSender(event) {
  const frame = event.senderFrame;
  return frame != null && frame.parent === null && isAppPage(frame.url);
}

/**
 * @param {string} channel
 * @param {IpcMainEvent | IpcMainInvokeEvent} event
 */
function reject(channel, event) {
  log.warn(
    `blocked "${channel}" from`,
    event.senderFrame?.url ?? "(unknown frame)",
  );
}

/**
 * @param {InvokeChannel} channel
 * @param {(event: IpcMainInvokeEvent, ...args: any[]) => any} handler
 */
function handle(channel, handler) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrustedSender(event)) {
      reject(channel, event);
      throw new Error(`"${channel}" is not allowed from this page`);
    }
    return handler(event, ...args);
  });
}

/**
 * @param {SendChannel} channel
 * @param {(event: IpcMainEvent, ...args: any[]) => void} listener
 */
function on(channel, listener) {
  ipcMain.on(channel, (event, ...args) => {
    if (!isTrustedSender(event)) return reject(channel, event);
    return listener(event, ...args);
  });
}

/**
 * @param {SendChannel} channel
 * @param {(event: IpcMainEvent, ...args: any[]) => void} listener
 */
function once(channel, listener) {
  ipcMain.once(channel, (event, ...args) => {
    if (!isTrustedSender(event)) return reject(channel, event);
    return listener(event, ...args);
  });
}

module.exports = { handle, on, once, isTrustedSender };
