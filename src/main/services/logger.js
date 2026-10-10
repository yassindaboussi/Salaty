"use strict";

// One logger for the main process (electron-log). Messages go to the console and to a log
// file in the OS logs folder (Windows: %APPDATA%\Salaty Time\logs\main.log), so a user can
// send that file when reporting a problem. The file is capped at 1 MB (older lines rotate out).
const log = require("electron-log/main");

log.transports.file.level = "info";
log.transports.file.maxSize = 1024 * 1024;
log.transports.console.level = process.argv.includes("--enable-logging")
  ? "debug"
  : "warn";

// A named logger, e.g. logger("Prayer").error("load failed", err) -> "[Prayer] load failed".
function logger(scope) {
  return log.scope(scope);
}

module.exports = { logger };
