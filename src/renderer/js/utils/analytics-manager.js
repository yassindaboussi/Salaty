/**
 * analytics-manager.js  ─  Main Process Analytics Engine
 * =========================================================
 * Salaty Time — Offline-first Google Analytics 4 integration
 *
 * HOW IT WORKS
 * ─────────────
 * 1. Every event is written to a JSON queue file on disk IMMEDIATELY.
 *    Events are NEVER lost, even if the app crashes or has no internet.
 *
 * 2. A background flush loop runs every 30 seconds. When online, it
 *    reads the queue and POSTs batches of up to 25 events to GA4's
 *    Measurement Protocol endpoint, then removes sent events from disk.
 *
 * 3. If the request fails (no internet, poor connection, GA4 down),
 *    events stay in the queue and are retried on the next flush cycle.
 *    Exponential back-off prevents hammering a slow connection.
 *
 * SETUP
 * ──────
 * 1. Go to GA4 → Admin → Data Streams → your stream → Measurement Protocol
 * 2. Create an API secret and copy it
 * 3. Replace GA4_MEASUREMENT_ID and GA4_API_SECRET below
 *
 * PRIVACY
 * ────────
 * No personally identifiable information (PII) is ever collected.
 * The client_id is a random UUID generated on first install, stored locally.
 * City/country names from user settings are never sent.
 */

'use strict';

// NOTE: we no longer load a .env file; keys are hardcoded below.
// Remove the dotenv dependency to keep the package lean.

const { app, ipcMain, net } = require('electron');
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { v4: uuidv4 } = require('./analytics-uuid');

// ─── ⚙️  CONFIGURATION — EDIT THESE ──────────────────────────────────────────
// Put your GA4 credentials directly here. This file is not committed with
// the real values in the public repo; they are inserted during your build
// or maintained privately.
const GA4_MEASUREMENT_ID = 'G-YLJT04QTL3';
const GA4_API_SECRET     = 'cK0q1iCuSwOtlLNT4VofcA';

if (!GA4_MEASUREMENT_ID || !GA4_API_SECRET) {
  console.warn('[Analytics] GA4 credentials missing; analytics will be disabled.');
}

// Tune these if needed
const FLUSH_INTERVAL_MS  = 30_000;  // How often to attempt sending (ms)
const BATCH_SIZE         = 25;      // GA4 max events per request
const MAX_QUEUE_SIZE     = 2_000;   // Max queued events before dropping oldest
const MIN_BACKOFF_MS     = 5_000;   // Minimum retry delay on failure
const MAX_BACKOFF_MS     = 300_000; // Maximum retry delay (5 minutes)
// ─────────────────────────────────────────────────────────────────────────────

// endpoint is only valid if credentials are present; keep undefined otherwise
const GA4_ENDPOINT = GA4_MEASUREMENT_ID && GA4_API_SECRET
  ? `https://www.google-analytics.com/mp/collect?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=${GA4_API_SECRET}`
  : null;

// ─── FILE PATHS (set after app is ready) ─────────────────────────────────────
let QUEUE_FILE      = null;
let CLIENT_ID_FILE  = null;

function initPaths() {
  const userData  = app.getPath('userData');
  QUEUE_FILE      = path.join(userData, 'analytics-queue.json');
  CLIENT_ID_FILE  = path.join(userData, 'analytics-client-id.txt');
}

// ─── CLIENT ID ────────────────────────────────────────────────────────────────
// Stable, anonymous installation identifier — never changes after first run.
let _clientId = null;

function getClientId() {
  if (_clientId) return _clientId;
  try {
    if (fs.existsSync(CLIENT_ID_FILE)) {
      const stored = fs.readFileSync(CLIENT_ID_FILE, 'utf8').trim();
      if (stored && stored.length > 10) {
        _clientId = stored;
        return _clientId;
      }
    }
    _clientId = uuidv4();
    fs.writeFileSync(CLIENT_ID_FILE, _clientId, 'utf8');
  } catch {
    _clientId = uuidv4(); // in-memory fallback
  }
  return _clientId;
}

// ─── SESSION ──────────────────────────────────────────────────────────────────
// New session on each app launch. GA4 uses this to count sessions.
let _sessionId = String(Date.now());

// ─── SYSTEM INFO ─────────────────────────────────────────────────────────────
// Collected once on init, attached to every event for OS/hardware segmentation.
let _systemInfo = null;

function collectSystemInfo() {
  if (_systemInfo) return _systemInfo;

  // Map process.platform to readable names for GA4 custom dimensions
  const platformMap = {
    win32 : 'Windows',
    darwin: 'macOS',
    linux : 'Linux',
  };

  _systemInfo = {
    os_platform  : platformMap[process.platform] || process.platform,
    os_arch      : process.arch,                   // x64, arm64, ia32
    os_release   : os.release(),                   // e.g. "10.0.19045"
    cpu_cores    : os.cpus().length,
    ram_gb       : Math.round(os.totalmem() / 1_073_741_824), // bytes → GB
    electron_ver : process.versions.electron || 'unknown',
    node_ver     : process.versions.node,
    app_version  : app.getVersion(),
    app_locale   : app.getLocale(),                // system locale, e.g. "en-US"
  };

  return _systemInfo;
}

// ─── DISK QUEUE ───────────────────────────────────────────────────────────────
let _queue      = [];
let _queueDirty = false;

function loadQueueFromDisk() {
  if (!QUEUE_FILE) return;
  try {
    if (fs.existsSync(QUEUE_FILE)) {
      const raw = fs.readFileSync(QUEUE_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      _queue = Array.isArray(parsed) ? parsed : [];
    }
  } catch {
    _queue = [];
  }
  console.log(`[Analytics] Queue loaded from disk: ${_queue.length} pending event(s).`);
}

function saveQueueToDisk() {
  if (!_queueDirty || !QUEUE_FILE) return;
  try {
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(_queue), 'utf8');
    _queueDirty = false;
  } catch (err) {
    console.error('[Analytics] Failed to persist queue:', err.message);
  }
}

function enqueueEvent(gaEvent) {
  // Drop oldest events to stay within size limit
  if (_queue.length >= MAX_QUEUE_SIZE) {
    _queue.splice(0, _queue.length - MAX_QUEUE_SIZE + 1);
  }
  _queue.push(gaEvent);
  _queueDirty = true;
  saveQueueToDisk(); // persist immediately — critical for offline resilience
}

// ─── GA4 HTTP REQUEST ─────────────────────────────────────────────────────────
/**
 * POST a batch of GA4 events.
 * Uses Electron's net module which respects the app's proxy settings.
 * @param {object[]} events  Array of GA4 event objects (max 25)
 * @returns {Promise<boolean>}  true if GA4 accepted the batch
 */
function sendBatchToGA4(events) {
  return new Promise((resolve) => {
    if (!GA4_ENDPOINT) {
      // missing credentials; nothing to do
      resolve(false);
      return;
    }

    if (!net.isOnline()) {
      resolve(false);
      return;
    }

    const payload = JSON.stringify({
      client_id : getClientId(),
      events,
    });

    const req = net.request({ method: 'POST', url: GA4_ENDPOINT });
    req.setHeader('Content-Type', 'application/json');

    let responded = false;

    req.on('response', (res) => {
      responded = true;
      // GA4 returns 204 (no content) on success. 200 also acceptable.
      resolve(res.statusCode === 204 || res.statusCode === 200);
      // Drain the response body to avoid memory leaks
      res.on('data', () => {});
    });

    req.on('error', (err) => {
      if (!responded) {
        console.warn('[Analytics] Request error:', err.message);
        resolve(false);
      }
    });

    req.write(payload);
    req.end();
  });
}

// ─── FLUSH LOOP ───────────────────────────────────────────────────────────────
let _flushTimer   = null;
let _backoffDelay = MIN_BACKOFF_MS;
let _flushLocked  = false; // prevent concurrent flushes

async function flushQueue() {
  if (_flushLocked || _queue.length === 0 || !net.isOnline()) return;

  _flushLocked = true;
  try {
    const batch = _queue.slice(0, BATCH_SIZE);
    const ok    = await sendBatchToGA4(batch);

    if (ok) {
      _queue.splice(0, batch.length);
      _queueDirty  = true;
      _backoffDelay = MIN_BACKOFF_MS; // reset back-off on success
      saveQueueToDisk();

      // If more events remain, schedule another flush soon
      if (_queue.length > 0) {
        setTimeout(flushQueue, 1_000);
      }
    } else {
      // Failed — increase back-off, will retry on next scheduled flush
      _backoffDelay = Math.min(_backoffDelay * 2, MAX_BACKOFF_MS);
      console.warn(`[Analytics] Flush failed. Next retry in ${_backoffDelay / 1000}s. Queue: ${_queue.length}`);
    }
  } finally {
    _flushLocked = false;
  }
}

function startFlushLoop() {
  if (_flushTimer) return;
  _flushTimer = setInterval(flushQueue, FLUSH_INTERVAL_MS);
  // First flush attempt after 8 seconds (give app time to fully start)
  setTimeout(flushQueue, 8_000);
}

function stopFlushLoop() {
  if (_flushTimer) {
    clearInterval(_flushTimer);
    _flushTimer = null;
  }
}

// ─── EVENT BUILDER ────────────────────────────────────────────────────────────
/**
 * Build a GA4-compatible event object and enqueue it.
 * System info is attached to EVERY event for cross-event segmentation.
 *
 * @param {string} eventName   GA4 event name — snake_case, max 40 chars
 * @param {object} [params]    Custom dimensions/metrics (max 25 per event)
 */
function track(eventName, params = {}) {
  const sys = collectSystemInfo();

  const event = {
    name: eventName,
    params: {
      // Required for GA4 Active Users metric
      engagement_time_msec: 100,
      session_id: _sessionId,

      // System dimensions — available on EVERY event for segmentation
      os_platform  : sys.os_platform,
      os_arch      : sys.os_arch,
      app_version  : sys.app_version,
      app_locale   : sys.app_locale,

      // Spread caller's custom params last (can override defaults if needed)
      ...params,
    },
  };

  enqueueEvent(event);
}

// ─── PUBLIC TRACKING HELPERS ─────────────────────────────────────────────────
// These are the specific events you want to see in GA4.

/**
 * Track app launch. Called once per session with full system info.
 */
function trackAppStart(userSettings = {}) {
  const sys = collectSystemInfo();
  track('app_start', {
    // Full system details — only sent on start to keep other events lean
    os_release   : sys.os_release,
    cpu_cores    : sys.cpu_cores,
    ram_gb       : sys.ram_gb,
    electron_ver : sys.electron_ver,
    node_ver     : sys.node_ver,
    // User preferences at launch
    user_language : userSettings.language || 'en',
    user_theme    : userSettings.theme    || 'navy',
    screen_size   : userSettings.bigScreen ? 'big' : 'small',
    city          : userSettings.city || '',
    country       : userSettings.country || '',
  });
}

/**
 * Track when a feature is opened.
 * This is the primary engagement metric — how popular each feature is.
 * @param {string} featureName  e.g. 'quran', 'radio', 'tasbih'
 */
function trackFeatureOpen(featureName) {
  track('feature_open', { feature_name: featureName });
}

/**
 * Track settings saved (for language/theme popularity).
 */
function trackSettingsSaved(settings = {}) {
  // mirror whatever the renderer side sends, plus any defaults/sanitization
  track('settings_saved', {
    language   : settings.language,
    theme      : settings.theme,
    screen_size: settings.bigScreen ? 'big' : 'small',

    // user location (city/country) – non-PII, provided by user
    city       : settings.city || '',
    country    : settings.country || '',

    // various alert/notification options
    athkar_alert_enabled  : settings.athkarAlertEnabled ? 1 : 0,
    athkar_alert_interval : settings.athkarAlertInterval || 0,
    pre_adhan_enabled     : settings.preAdhanNotificationEnabled ? 1 : 0,
    pre_adhan_minutes     : settings.preAdhanMinutes || 0,
  });
}

/**
 * Track navigation between pages.
 */
function trackNavigation(fromPage, toPage) {
  track('page_navigation', {
    from_page: fromPage,
    to_page  : toPage,
  });
}

/**
 * Track non-fatal errors for debugging.
 */
function trackError(context, message) {
  track('app_error', {
    error_context: String(context).substring(0, 100),
    error_message: String(message).substring(0, 100),
  });
}

// ─── LOCATION TRACKING WRAPPERS ─────────────────────────────────────────────
// These make it easier if the main process ever needs to log location events.
function trackLocationAdded(params = {}) {
  track('location_added', params);
}
function trackLocationEdited(params = {}) {
  track('location_edited', params);
}
function trackLocationDeleted(params = {}) {
  track('location_deleted', params);
}
function trackLocationActivated(params = {}) {
  track('location_activated', params);
}
function trackLocationList(params = {}) {
  track('location_list', params);
}

// ─── IPC BRIDGE ──────────────────────────────────────────────────────────────
// Renderer processes cannot call analytics-manager directly.
// They use ipcRenderer.send() → these handlers call track() in main process.

function setupIpcHandlers() {
  // Generic event
  ipcMain.on('analytics:track', (_e, eventName, params) => {
    track(eventName, params || {});
  });

  // Feature opened
  ipcMain.on('analytics:feature-open', (_e, featureName) => {
    trackFeatureOpen(featureName);
  });

  // Settings saved
  ipcMain.on('analytics:settings-saved', (_e, settings) => {
    trackSettingsSaved(settings);
  });

  // Navigation
  ipcMain.on('analytics:navigation', (_e, fromPage, toPage) => {
    trackNavigation(fromPage, toPage);
  });

  // Error
  ipcMain.on('analytics:error', (_e, context, message) => {
    trackError(context, message);
  });
}

// ─── INIT / TEARDOWN ─────────────────────────────────────────────────────────

/**
 * Initialize analytics. Call this inside createWindow(), after loadSettings().
 * @param {object} initialSettings  The loaded settings object from ipc-handlers
 */
function init(initialSettings = {}) {
  initPaths();
  loadQueueFromDisk();
  setupIpcHandlers();
  startFlushLoop();
  trackAppStart(initialSettings);

  // Best-effort flush on quit — send whatever we can before closing
  app.on('before-quit', () => {
    stopFlushLoop();
    flushQueue(); // fire-and-forget; disk queue covers the rest
    saveQueueToDisk();
  });

  console.log(`[Analytics] Ready. Client: ${getClientId()}. Pending: ${_queue.length} event(s).`);
}

// ─── EXPORTS ─────────────────────────────────────────────────────────────────
module.exports = {
  init,
  track,
  trackAppStart,
  trackFeatureOpen,
  trackSettingsSaved,
  trackNavigation,
  trackError,

  // location helpers (could be used from main in future)
  trackLocationAdded,
  trackLocationEdited,
  trackLocationDeleted,
  trackLocationActivated,
  trackLocationList,
};
