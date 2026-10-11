"use strict";

// What the anonymous usage statistics contain (analytics-manager.js queues and sends them): the
// system facts attached to events and the parameters of each kind of event. Nothing here
// identifies the user: no location, and file paths are removed from error text.

const { app } = require("electron");
const os = require("os");

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

// app_start: the system, and the language, theme and window size in use.
function appStartParams(userSettings = {}) {
  const sys = collectSystemInfo();
  return {
    os_release: sys.os_release,
    cpu_cores: sys.cpu_cores,
    ram_gb: sys.ram_gb,
    electron_ver: sys.electron_ver,
    node_ver: sys.node_ver,
    user_language: userSettings.language || "en",
    user_theme: userSettings.theme || "navy",
    screen_size: userSettings.bigScreen ? "big" : "small",
  };
}

// settings_saved: which options are used (never the location).
function settingsSavedParams(settings = {}) {
  return {
    language: settings.language,
    theme: settings.theme,
    screen_size: settings.bigScreen ? "big" : "small",

    athkar_alert_enabled: settings.athkarAlertEnabled ? 1 : 0,
    athkar_alert_interval: settings.athkarAlertInterval || 0,
    pre_adhan_enabled: settings.preAdhanNotificationEnabled ? 1 : 0,
    pre_adhan_minutes: settings.preAdhanMinutes || 0,
  };
}

// app_error: where it happened and the message, without paths, 100 characters each.
function errorParams(context, message) {
  return {
    error_context: scrubPaths(context).substring(0, 100),
    error_message: scrubPaths(message).substring(0, 100),
  };
}

module.exports = {
  collectSystemInfo,
  scrubPaths,
  appStartParams,
  settingsSavedParams,
  errorParams,
};
