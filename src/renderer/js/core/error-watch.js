"use strict";

// Errors a page does not catch itself are sent to the app's log file (main process:
// ipc/handlers/problem-handlers.js). Without this they would only appear in DevTools, which is
// off in the installed app. Loaded first by app/app-shell.js and by the small windows
// (windows/*), so it also sees errors thrown while a page starts.

const { ipcRenderer } = require("electron");

// a loop that keeps failing must not fill the log
const MAX_REPORTS_PER_PAGE = 20;
let reports = 0;

/**
 * @param {string} kind
 * @param {unknown} message
 * @param {string} [where]
 */
function report(kind, message, where) {
  if (reports >= MAX_REPORTS_PER_PAGE) return;
  reports++;
  try {
    ipcRenderer.send("renderer-error", {
      kind,
      message: String(message ?? "").slice(0, 500),
      where: (where ?? "").slice(0, 200),
    });
  } catch {
    // reporting must never throw
  }
}

window.addEventListener("error", (e) => {
  const file = e.filename ? e.filename.split("/").pop() : "";
  report(
    "error",
    e.error?.message ?? e.message,
    file && `${file}:${e.lineno}:${e.colno}`,
  );
});

window.addEventListener("unhandledrejection", (e) => {
  const reason = e.reason;
  const firstFrame = reason?.stack?.split("\n")[1]?.trim();
  report("unhandled rejection", reason?.message ?? reason, firstFrame);
});
