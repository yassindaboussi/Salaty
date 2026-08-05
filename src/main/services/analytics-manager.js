
"use strict";


const { app, ipcMain, net } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { v4: uuidv4 } = require("./analytics-uuid");

const GA4_MEASUREMENT_ID = "G-YLJT04QTL3";
const GA4_API_SECRET = "cK0q1iCuSwOtlLNT4VofcA";

if (!GA4_MEASUREMENT_ID || !GA4_API_SECRET) {
  console.warn(
    "[Analytics] GA4 credentials missing; analytics will be disabled.",
  );
}

const FLUSH_INTERVAL_MS = 30_000;
const BATCH_SIZE = 25;
const MAX_QUEUE_SIZE = 2_000;
const MIN_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 300_000;

const GA4_ENDPOINT =
  GA4_MEASUREMENT_ID && GA4_API_SECRET
    ? `https://www.google-analytics.com/mp/collect?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=${GA4_API_SECRET}`
    : null;

let QUEUE_FILE = null;
let CLIENT_ID_FILE = null;

function initPaths() {
  const userData = app.getPath("userData");
  QUEUE_FILE = path.join(userData, "analytics-queue.json");
  CLIENT_ID_FILE = path.join(userData, "analytics-client-id.txt");
}

let _clientId = null;

function getClientId() {
  if (_clientId) return _clientId;
  try {
    if (fs.existsSync(CLIENT_ID_FILE)) {
      const stored = fs.readFileSync(CLIENT_ID_FILE, "utf8").trim();
      if (stored && stored.length > 10) {
        _clientId = stored;
        return _clientId;
      }
    }
    _clientId = uuidv4();
    fs.writeFileSync(CLIENT_ID_FILE, _clientId, "utf8");
  } catch {
    _clientId = uuidv4();
  }
  return _clientId;
}

let _sessionId = String(Date.now());

let _systemInfo = null;

function collectSystemInfo() {
  if (_systemInfo) return _systemInfo;

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

let _queue = [];
let _queueDirty = false;

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
  if (!_queueDirty || !QUEUE_FILE) return;
  try {
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(_queue), "utf8");
    _queueDirty = false;
  } catch (err) {
    console.error("[Analytics] Failed to persist queue:", err.message);
  }
}

function enqueueEvent(gaEvent) {
  if (_queue.length >= MAX_QUEUE_SIZE) {
    _queue.splice(0, _queue.length - MAX_QUEUE_SIZE + 1);
  }
  _queue.push(gaEvent);
  _queueDirty = true;
  saveQueueToDisk();
}

function sendBatchToGA4(events) {
  return new Promise((resolve) => {
    if (!GA4_ENDPOINT) {
      resolve(false);
      return;
    }

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
        console.warn("[Analytics] Request error:", err.message);
        resolve(false);
      }
    });

    req.write(payload);
    req.end();
  });
}

let _flushTimer = null;
let _backoffDelay = MIN_BACKOFF_MS;
let _flushLocked = false;

async function flushQueue() {
  if (_flushLocked || _queue.length === 0 || !net.isOnline()) return;

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
      console.warn(
        `[Analytics] Flush failed. Next retry in ${_backoffDelay / 1000}s. Queue: ${_queue.length}`,
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
    city: userSettings.city || "",
    country: userSettings.country || "",
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

    city: settings.city || "",
    country: settings.country || "",

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
    error_context: String(context).substring(0, 100),
    error_message: String(message).substring(0, 100),
  });
}

function trackLocationAdded(params = {}) {
  track("location_added", params);
}
function trackLocationEdited(params = {}) {
  track("location_edited", params);
}
function trackLocationDeleted(params = {}) {
  track("location_deleted", params);
}
function trackLocationActivated(params = {}) {
  track("location_activated", params);
}
function trackLocationList(params = {}) {
  track("location_list", params);
}


function setupIpcHandlers() {
  ipcMain.on("analytics:track", (_e, eventName, params) => {
    track(eventName, params || {});
  });

  ipcMain.on("analytics:feature-open", (_e, featureName) => {
    trackFeatureOpen(featureName);
  });

  ipcMain.on("analytics:settings-saved", (_e, settings) => {
    trackSettingsSaved(settings);
  });

  ipcMain.on("analytics:navigation", (_e, fromPage, toPage) => {
    trackNavigation(fromPage, toPage);
  });

  ipcMain.on("analytics:error", (_e, context, message) => {
    trackError(context, message);
  });
}


function init(initialSettings = {}) {
  initPaths();
  loadQueueFromDisk();
  setupIpcHandlers();
  startFlushLoop();
  trackAppStart(initialSettings);

  app.on("before-quit", () => {
    stopFlushLoop();
    flushQueue();
    saveQueueToDisk();
  });
}

module.exports = {
  init,
  track,
  trackAppStart,
  trackFeatureOpen,
  trackSettingsSaved,
  trackNavigation,
  trackError,

  trackLocationAdded,
  trackLocationEdited,
  trackLocationDeleted,
  trackLocationActivated,
  trackLocationList,
};
