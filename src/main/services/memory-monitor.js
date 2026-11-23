"use strict";

// Development only: every minute, log how much RAM the whole app uses, split by process type
// (Browser, Tab = each window, GPU, Utility = audio). Runs only when the app is not packaged
// and writes to the development log file (never in a user's build, never to analytics).
//
//   memory 412 MB (5 processes) | Browser 120 MB, Tab x2 210 MB, GPU 62 MB, Utility 20 MB
//
// Watch for: total that keeps climbing while idle (leak), or one Tab that grows after you
// open and close a page.
const { app, webContents } = require("electron");
const log = require("./logger").logger("Memory");

const INTERVAL_MS = 60_000;
const FIRST_REPORT_MS = 10_000;
const KB_PER_MB = 1024;

/** @type {ReturnType<typeof setInterval> | null} */
let timer = null;

/** @returns {string} */
function snapshot() {
  const metrics = app.getAppMetrics();
  let totalKb = 0;
  /** @type {Map<string, { count: number, kb: number }>} */
  const byType = new Map();

  for (const m of metrics) {
    const kb = m.memory.workingSetSize;
    totalKb += kb;
    const entry = byType.get(m.type) ?? { count: 0, kb: 0 };
    entry.count += 1;
    entry.kb += kb;
    byType.set(m.type, entry);
  }

  const parts = [...byType].map(([type, { count, kb }]) => {
    const mb = Math.round(kb / KB_PER_MB);
    return count > 1 ? `${type} x${count} ${mb} MB` : `${type} ${mb} MB`;
  });
  // which page each Tab is: "index 140 MB, background-player 95 MB"
  const pages = webContents.getAllWebContents().map((wc) => {
    const m = metrics.find((p) => p.pid === wc.getOSProcessId());
    const name = wc.getURL().split("/").pop()?.split(".")[0] || "blank";
    return `${name} ${Math.round((m?.memory.workingSetSize ?? 0) / KB_PER_MB)} MB`;
  });
  const totalMb = Math.round(totalKb / KB_PER_MB);
  return `memory ${totalMb} MB (${metrics.length} processes) | ${parts.join(", ")} | ${pages.join(", ")}`;
}

function report() {
  try {
    log.info(snapshot());
  } catch (err) {
    log.warn("memory snapshot failed:", err);
  }
}

/** Starts the monitor in development builds only. Does nothing in a packaged app. */
function start() {
  if (app.isPackaged || timer) return;
  setTimeout(report, FIRST_REPORT_MS);
  timer = setInterval(report, INTERVAL_MS);
  app.once("will-quit", () => {
    if (timer) clearInterval(timer);
    timer = null;
  });
}

module.exports = { start, snapshot };
