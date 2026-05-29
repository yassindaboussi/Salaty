// preload.js
//
// This app uses nodeIntegration: true + contextIsolation: false.
// Renderer files access Electron APIs directly via require('electron').
// contextBridge is NOT used — it requires contextIsolation: true,
// which conflicts with the nodeIntegration mode this app relies on.
"use strict";
