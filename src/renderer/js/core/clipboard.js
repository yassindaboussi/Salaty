"use strict";

// Copying text. The pages cannot use navigator.clipboard: the app denies them every browser
// permission except fullscreen (main/app/security.js), so the main process writes the
// clipboard for them (ipc "clipboard-write-text", text checked there).

const { ipcRenderer } = require("electron");

/**
 * @param {string} text
 * @returns {Promise<boolean>} true when the text is on the clipboard
 */
async function copyText(text) {
  try {
    return (await ipcRenderer.invoke("clipboard-write-text", text)) === true;
  } catch {
    return false;
  }
}

module.exports = { copyText };
