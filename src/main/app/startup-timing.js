"use strict";

// Start-up timings, written once to the log on every start (no network, nothing stored
// elsewhere), so the start-up time can be measured on any machine and platform:
//   start-up (ms after launch): main-js 180, modules 260, ready 300, migrated 302, window 320,
//   page 690, shown 760
// "launch" is when the operating system created the process (Electron's own metric), so the
// numbers include Electron's start before any of our code runs.
const { app } = require("electron");

/** @type {[string, number][]} */
const marks = [];

/** @param {string} name */
function mark(name) {
  marks.push([name, Date.now()]);
}

/** @param {{ info: (...args: any[]) => void }} log */
function reportStartup(log) {
  const browser = app.getAppMetrics().find((m) => m.type === "Browser");
  const launch = browser?.creationTime ?? marks[0]?.[1] ?? Date.now();
  const timings = marks.map(
    ([name, at]) => `${name} ${Math.round(at - launch)}`,
  );
  log.info(`start-up (ms after launch): ${timings.join(", ")}`);
}

module.exports = { mark, reportStartup };
