"use strict";

// "Send feedback" (Settings → About, and at start-up after a crash): a problem or a suggestion,
// emailed to the developer through Web3Forms (https://web3forms.com, free plan, no server of
// ours). For a problem, if the user leaves the box ticked, the app version, the system and the
// last errors from the log are added, with file paths and the user's saved places removed.
// Nothing is sent unless the user presses Send. Offline, the message waits on disk and is sent
// when the connection is back.

const { app } = require("electron");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { postJson } = require("../services/http");
const { scrubPaths } = require("../services/analytics-events");
const logger = require("../services/logger");
const log = logger.logger("Feedback");

const SUBMIT_URL = "https://api.web3forms.com/submit";
const CONTACT_EMAIL = "salatytime@gmail.com";
const MAX_LOG_LINES = 15;
const MAX_LINE_LENGTH = 200;
const MAX_QUEUED = 5;
const SEND_COOLDOWN_MS = 30_000; // a double click must not send twice
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** @type {Record<string, string>} */
const PLATFORM_NAMES = { win32: "Windows", darwin: "macOS", linux: "Linux" };

/** @typedef {"problem" | "suggestion"} FeedbackType */

let lastSentAt = 0;

// The Web3Forms access key: "feedbackAccessKey" in package.json (shipped with the app). It is
// public by design: it only lets someone send email to the developer's address. The
// environment variable WEB3FORMS_ACCESS_KEY overrides it (e.g. to test with another key).
function accessKey() {
  const fromEnv = process.env.WEB3FORMS_ACCESS_KEY?.trim();
  if (fromEnv) return fromEnv;
  try {
    const file = path.join(app.getAppPath(), "package.json");
    const key = JSON.parse(fs.readFileSync(file, "utf8")).feedbackAccessKey;
    return typeof key === "string" ? key.trim() : "";
  } catch {
    return "";
  }
}

function isConfigured() {
  return UUID.test(accessKey());
}

function installType() {
  if (process.windowsStore) return "Microsoft Store";
  return app.isPackaged ? "installer" : "development";
}

/**
 * The city, country and location names the user saved: never put in a message.
 * @param {any} settings
 * @returns {string[]}
 */
function privatePlaces(settings) {
  const places = [settings?.city, settings?.country];
  for (const loc of settings?.locations ?? [])
    places.push(loc?.name, loc?.city, loc?.country);
  return places.filter((p) => typeof p === "string" && p.trim().length > 1);
}

/**
 * The last warnings and errors of the log file (first line of each entry), cleaned.
 * @param {string[]} places text to remove
 * @returns {string[]}
 */
function recentProblems(places) {
  let text;
  try {
    text = fs.readFileSync(logger.logFile(), "utf8");
  } catch {
    return [];
  }
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const placesRe = places.length
    ? new RegExp(places.map(escape).join("|"), "gi")
    : null;
  return text
    .split(/\r?\n/)
    .filter((line) => /^\[[^\]]+\] \[(error|warn)\]/.test(line))
    .slice(-MAX_LOG_LINES)
    .map((line) => {
      let clean = scrubPaths(line).replace(/\s{2,}/g, " ");
      if (placesRe) clean = clean.replace(placesRe, "<place>");
      return clean.slice(0, MAX_LINE_LENGTH);
    });
}

/**
 * The technical details shown to the user before sending a problem (plain text, in English:
 * the developer reads them).
 * @param {any} settings
 */
function technicalDetails(settings) {
  const system = `${PLATFORM_NAMES[process.platform] ?? process.platform} ${os.release()} ${process.arch}`;
  const problems = recentProblems(privatePlaces(settings));
  return [
    `App: Salaty Time ${app.getVersion()} (${installType()})`,
    `System: ${system}, Electron ${process.versions.electron}`,
    `Language: ${settings?.language ?? "en"}`,
    "",
    "Recent errors in the app log:",
    ...(problems.length ? problems : ["(none)"]),
  ].join("\n");
}

// ── Sending ──────────────────────────────────────────────────────────────────────────────

function queueFile() {
  return path.join(app.getPath("userData"), "pending-feedback.json");
}

/** @returns {Array<{ subject: string, message: string, email?: string }>} */
function readQueue() {
  try {
    const list = JSON.parse(fs.readFileSync(queueFile(), "utf8"));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** @param {object[]} list */
function writeQueue(list) {
  try {
    if (list.length) fs.writeFileSync(queueFile(), JSON.stringify(list));
    else fs.rmSync(queueFile(), { force: true });
  } catch (err) {
    log.warn("could not save the waiting messages:", err.message);
  }
}

/**
 * One delivery attempt. Throws on network failures (offline...); otherwise true when
 * Web3Forms accepted the message.
 * @param {{ subject: string, message: string, email?: string }} item
 */
async function deliver(item) {
  const { status, json } = await postJson(
    SUBMIT_URL,
    {
      access_key: accessKey(),
      subject: item.subject,
      from_name: "Salaty Time app",
      message: item.message,
      ...(item.email ? { email: item.email } : {}),
      botcheck: false,
    },
    { timeoutMs: 15_000 },
  );
  if (json?.success === true) return true;
  log.warn(`feedback not accepted (HTTP ${status}):`, json?.message ?? "");
  return false;
}

/**
 * @param {{ type: FeedbackType, message: string, email?: string, includeDetails: boolean }} input
 *   checked by IPC
 * @param {any} settings
 * @returns {Promise<"sent" | "queued" | "failed" | "too-soon" | "not-configured">}
 */
async function sendFeedback(input, settings) {
  if (!isConfigured()) return "not-configured";
  if (Date.now() - lastSentAt < SEND_COOLDOWN_MS) return "too-soon";
  const isProblem = input.type === "problem";
  const details =
    isProblem && input.includeDetails ? technicalDetails(settings) : null;
  const text = `${isProblem ? "Problem" : "Suggestion"}:\n${input.message}`;
  const item = {
    subject: `Salaty Time ${app.getVersion()}: ${isProblem ? "problem report" : "suggestion"}`,
    message: details ? `${text}\n\n${details}` : text,
    email: input.email || undefined,
  };
  try {
    const ok = await deliver(item);
    if (!ok) return "failed";
    lastSentAt = Date.now();
    log.info(`${input.type} sent`);
    return "sent";
  } catch (err) {
    // no connection: keep it and send it later (flushQueue)
    log.info(`${input.type} saved until the connection is back:`, err.message);
    writeQueue(
      [...readQueue(), { ...item, createdAt: Date.now() }].slice(-MAX_QUEUED),
    );
    lastSentAt = Date.now();
    return "queued";
  }
}

// Sends the messages saved while offline (called at start-up and when the connection is back).
async function flushQueue() {
  if (!isConfigured()) return;
  let list = readQueue();
  while (list.length) {
    try {
      await deliver(list[0]); // a refused one is dropped too: it would never pass
    } catch {
      return; // still offline: try again later
    }
    list = list.slice(1);
    writeQueue(list);
  }
}

// ── After a crash ────────────────────────────────────────────────────────────────────────

function crashFile() {
  return path.join(app.getPath("userData"), "report-after-crash.json");
}

// The crash dialog's "Report a problem": the feedback window opens at the next start (the app
// is closing and cannot show it now).
function markCrashForReport() {
  try {
    fs.writeFileSync(crashFile(), JSON.stringify({ time: Date.now() }));
  } catch {
    // best effort
  }
}

/** True once after a crash the user wanted to report (the mark is then removed). */
function takeCrashReport() {
  const file = crashFile();
  if (!fs.existsSync(file)) return false;
  fs.rmSync(file, { force: true });
  return true;
}

module.exports = {
  CONTACT_EMAIL,
  isConfigured,
  technicalDetails,
  sendFeedback,
  flushQueue,
  markCrashForReport,
  takeCrashReport,
};
