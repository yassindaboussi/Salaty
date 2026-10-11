"use strict";

// Anonymous usage statistics (Google Analytics 4, Measurement Protocol).
// Opt-in: nothing is recorded or sent unless the user turned "Anonymous usage statistics" on
// in Settings (settings.analyticsEnabled === true). Turning it off deletes the queued events
// and the random install id. Never sent: location, what is listened to, file paths.
// Events are queued on disk first and sent in batches when online.

const { app, net } = require("electron");
const secureIpc = require("../ipc/secure-ipc");
const check = require("../ipc/validate");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { randomUUID } = require("crypto");
const log = require("./logger").logger("Analytics");

const GA4_MEASUREMENT_ID = "G-YLJT04QTL3";
const GA4_API_SECRET = "cK0q1iCuSwOtlLNT4VofcA";

const FLUSH_INTERVAL_MS = 30_000;
const BATCH_SIZE = 25;
const MAX_QUEUE_SIZE = 2_000;
const MIN_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 300_000;
const QUEUE_SAVE_DELAY_MS = 2_000;

const GA4_ENDPOINT = `https://www.google-analytics.com/mp/collect?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=${GA4_API_SECRET}`;

/** @type {string | null} */
let QUEUE_FILE = null;
/** @type {string | null} */
let CLIENT_ID_FILE = null;
/** @type {() => any} returns the current settings */
let getSettings = () => ({});

function initPaths() {
  const userData = app.getPath("userData");
  QUEUE_FILE = path.join(userData, "analytics-queue.json");
  CLIENT_ID_FILE = path.join(userData, "analytics-client-id.txt");
}

function isEnabled() {
  return getSettings()?.analyticsEnabled === true;
}

/** @type {string | null} */
let _clientId = null;

/** @returns {string} */
function getClientId() {
  if (_clientId) return _clientId;
  const file = CLIENT_ID_FILE;
  try {
    if (file && fs.existsSync(file)) {
      const stored = fs.readFileSync(file, "utf8").trim();
      if (stored && stored.length > 10) {
        _clientId = stored;
        return _clientId;
      }
    }
    _clientId = randomUUID();
    if (file) fs.writeFileSync(file, _clientId, "utf8");
  } catch {
    _clientId = randomUUID();
  }
  return _clientId;
}

const _sessionId = String(Date.now());

/**
 * @typedef {{ os_platform: string, os_arch: string, os_release: string, cpu_cores: number,
 *   ram_gb: number, electron_ver: string, node_ver: string, app_version: string,
 *   app_locale: string }} SystemInfo
 */

/** @type {SystemInfo | null} */
let _systemInfo = null;

/** @returns {SystemInfo} */
function collectSystemInfo() {
  if (_systemInfo) return _systemInfo;

  /** @type {Record<string, string>} */
  const platformMap = {
    win32: "Windows",
    darwin: "macOS",
    linux: "Linux",
  };

  _systemInfo = {
    os_platform: platformMap[process.platform] || process.platform,
    os_arch: process.arch,
    os_release: os.release(),
    cpu_cores: os.cpus().length,
    ram_gb: Math.round(os.totalmem() / 1_073_741_824),
    electron_ver: process.versions.electron || "unknown",
    node_ver: process.versions.node,
    app_version: app.getVersion(),
    app_locale: app.getLocale(),
  };

  return _systemInfo;
}

// Error messages can contain file paths, and paths contain the user's account name.
function scrubPaths(text) {
  return String(text)
    .replace(/file:\/\/[^\s'")]+/gi, "<path>")
    .replace(/\b[A-Za-z]:[\\/][^\s'")]+/g, "<path>")
    .replace(
      /\/(?:Users|home|private|var|tmp|opt|Applications|Volumes)\/[^\s'")]+/g,
      "<path>",
    );
}

/** @type {object[]} events waiting to be sent */
let _queue = [];
let _queueDirty = false;
/** @type {ReturnType<typeof setTimeout> | null} */
let _saveTimer = null;

function loadQueueFromDisk() {
  if (!QUEUE_FILE) return;
  try {
    if (fs.existsSync(QUEUE_FILE)) {
      const raw = fs.readFileSync(QUEUE_FILE, "utf8");
      const parsed = JSON.parse(raw);
      _queue = Array.isArray(parsed) ? parsed : [];
    }
  } catch {
    _queue = [];
  }
}

function saveQueueToDisk() {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = null;
  if (!_queueDirty || !QUEUE_FILE) return;
  try {
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(_queue), "utf8");
    _queueDirty = false;
  } catch (err) {
    log.error("Failed to persist queue:", err.message);
  }
}

// Several events often arrive together (page open + settings save...): write them once.
function saveQueueSoon() {
  if (!_saveTimer)
    _saveTimer = setTimeout(saveQueueToDisk, QUEUE_SAVE_DELAY_MS);
}

function enqueueEvent(gaEvent) {
  if (_queue.length >= MAX_QUEUE_SIZE) {
    _queue.splice(0, _queue.length - MAX_QUEUE_SIZE + 1);
  }
  _queue.push(gaEvent);
  _queueDirty = true;
  saveQueueSoon();
}

// Drops everything recorded so far: the queue (memory + file) and the random install id.
function forgetAll() {
  _queue = [];
  _queueDirty = false;
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = null;
  _clientId = null;
  for (const file of [QUEUE_FILE, CLIENT_ID_FILE]) {
    if (!file) continue;
    try {
      fs.rmSync(file, { force: true });
    } catch (err) {
      log.error("Failed to delete", path.basename(file), err.message);
    }
  }
}

function sendBatchToGA4(events) {
  return new Promise((resolve) => {
    if (!net.isOnline()) {
      resolve(false);
      return;
    }

    const payload = JSON.stringify({
      client_id: getClientId(),
      events,
    });

    const req = net.request({ method: "POST", url: GA4_ENDPOINT });
    req.setHeader("Content-Type", "application/json");

    let responded = false;

    req.on("response", (res) => {
      responded = true;
      resolve(res.statusCode === 204 || res.statusCode === 200);
      res.on("data", () => {});
    });

    req.on("error", (err) => {
      if (!responded) {
        log.warn("Request error:", err.message);
        resolve(false);
      }
    });

    req.write(payload);
    req.end();
  });
}

/** @type {ReturnType<typeof setInterval> | null} */
let _flushTimer = null;
let _backoffDelay = MIN_BACKOFF_MS;
let _flushLocked = false;

async function flushQueue() {
  if (!isEnabled() || _flushLocked || _queue.length === 0 || !net.isOnline())
    return;

  _flushLocked = true;
  try {
    const batch = _queue.slice(0, BATCH_SIZE);
    const ok = await sendBatchToGA4(batch);

    if (ok) {
      _queue.splice(0, batch.length);
      _queueDirty = true;
      _backoffDelay = MIN_BACKOFF_MS;
      saveQueueToDisk();

      if (_queue.length > 0) {
        setTimeout(flushQueue, 1_000);
      }
    } else {
      _backoffDelay = Math.min(_backoffDelay * 2, MAX_BACKOFF_MS);
      log.warn(
        `Flush failed. Next retry in ${_backoffDelay / 1000}s. Queue: ${_queue.length}`,
      );
    }
  } finally {
    _flushLocked = false;
  }
}

function startFlushLoop() {
  if (_flushTimer) return;
  _flushTimer = setInterval(flushQueue, FLUSH_INTERVAL_MS);
  setTimeout(flushQueue, 8_000);
}

function stopFlushLoop() {
  if (_flushTimer) {
    clearInterval(_flushTimer);
    _flushTimer = null;
  }
}

function track(eventName, params = {}) {
  if (!isEnabled()) return;
  const sys = collectSystemInfo();

  const event = {
    name: eventName,
    params: {
      engagement_time_msec: 100,
      session_id: _sessionId,

      os_platform: sys.os_platform,
      os_arch: sys.os_arch,
      app_version: sys.app_version,
      app_locale: sys.app_locale,

      ...params,
    },
  };

  enqueueEvent(event);
}

function trackAppStart(userSettings = {}) {
  const sys = collectSystemInfo();
  track("app_start", {
    os_release: sys.os_release,
    cpu_cores: sys.cpu_cores,
    ram_gb: sys.ram_gb,
    electron_ver: sys.electron_ver,
    node_ver: sys.node_ver,
    user_language: userSettings.language || "en",
    user_theme: userSettings.theme || "navy",
    screen_size: userSettings.bigScreen ? "big" : "small",
  });
}

function trackFeatureOpen(featureName) {
  track("feature_open", { feature_name: featureName });
}

function trackSettingsSaved(settings = {}) {
  track("settings_saved", {
    language: settings.language,
    theme: settings.theme,
    screen_size: settings.bigScreen ? "big" : "small",

    athkar_alert_enabled: settings.athkarAlertEnabled ? 1 : 0,
    athkar_alert_interval: settings.athkarAlertInterval || 0,
    pre_adhan_enabled: settings.preAdhanNotificationEnabled ? 1 : 0,
    pre_adhan_minutes: settings.preAdhanMinutes || 0,
  });
}

function trackNavigation(fromPage, toPage) {
  track("page_navigation", {
    from_page: fromPage,
    to_page: toPage,
  });
}

function trackError(context, message) {
  track("app_error", {
    error_context: scrubPaths(context).substring(0, 100),
    error_message: scrubPaths(message).substring(0, 100),
  });
}

// Called when the Settings switch changes. Off: forget everything recorded so far.
function applyConsent(enabled) {
  if (enabled) {
    trackAppStart(getSettings());
  } else {
    forgetAll();
  }
}

function setupIpcHandlers() {
  // Everything a page sends is checked first (ipc/validate.js).
  secureIpc.on("analytics:track", (_e, eventName, params) => {
    const name = check.analyticsName(eventName);
    if (name) track(name, check.analyticsParams(params));
  });

  secureIpc.on("analytics:feature-open", (_e, featureName) => {
    const name = check.text(featureName, 100);
    if (name) trackFeatureOpen(name);
  });

  secureIpc.on("analytics:settings-saved", (_e, settings) => {
    if (check.isPlainObject(settings)) trackSettingsSaved(settings);
  });

  secureIpc.on("analytics:navigation", (_e, fromPage, toPage) => {
    trackNavigation(check.text(fromPage, 100), check.text(toPage, 100));
  });

  secureIpc.on("analytics:error", (_e, context, message) => {
    trackError(String(context ?? ""), String(message ?? ""));
  });
}

let _initialized = false;

/**
 * @param {() => any} getSettingsFn returns the current settings (read on every event, so the
 *   Settings switch takes effect immediately)
 */
function init(getSettingsFn) {
  if (_initialized) return;
  _initialized = true;
  getSettings = getSettingsFn;

  initPaths();
  if (isEnabled()) {
    loadQueueFromDisk();
  } else {
    forgetAll(); // also drops events queued by older versions, which sent statistics without asking
  }
  setupIpcHandlers();
  startFlushLoop();
  trackAppStart(getSettings());

  app.on("before-quit", () => {
    stopFlushLoop();
    flushQueue();
    saveQueueToDisk();
  });
}

module.exports = {
  init,
  applyConsent,
  track,
  trackError,
};
