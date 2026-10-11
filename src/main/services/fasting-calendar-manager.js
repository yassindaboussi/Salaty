"use strict";

const { app } = require("electron");
const secureIpc = require("../ipc/secure-ipc");
const fs = require("fs");
const path = require("path");
// Hijri dates from the cached Aladhan client: the reminders also work offline
const islamicCalendar = require("./islamic-calendar");
const log = require("./logger").logger("Fasting");

/** @import { BrowserWindow } from "electron" */

/** @type {() => BrowserWindow | null} */
let getMainWindow = () => null;
/** @type {(() => any) | null} returns the current settings */
let getSettingsData = null;

/** @type {any[]} the coming fasting days (see _makeOccasion) */
let occasions = [];
/** @type {Promise<void> | null} the refresh in progress */
let readyPromise = null;

/** @type {ReturnType<typeof setInterval> | null} */
let tickInterval = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let midnightTimer = null;
/** @type {Set<string>} */
let firedTodayKeys = new Set();

const FORWARD_HIJRI_MONTHS = 4;
const REMINDER_HOUR_START = 19;
const REMINDER_HOUR_END = 22;
const TICK_MS = 10 * 60 * 1000;

/**
 * @param {() => BrowserWindow | null} getMainWindowFn returns the main window (or null)
 * @param {() => any} settingsFn returns the current settings
 */
function init(getMainWindowFn, settingsFn) {
  getMainWindow = getMainWindowFn;
  getSettingsData = settingsFn;
  firedTodayKeys = _loadFiredLog();
  _registerIpcHandlers();
  const refresh = _refreshOccasions();
  readyPromise = refresh;
  refresh.then(() => {
    _startTick();
    _scheduleMidnightRefresh();
  });
}

function cleanup() {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
  if (midnightTimer) {
    clearTimeout(midnightTimer);
    midnightTimer = null;
  }
}

function _registerIpcHandlers() {
  secureIpc.handle("get-fasting-occasions", async () => {
    if (readyPromise) await readyPromise;
    return occasions;
  });
}

async function _refreshOccasions() {
  try {
    const now = new Date();
    const today = await islamicCalendar.gregorianToHijri(
      now.getDate(),
      now.getMonth() + 1,
      now.getFullYear(),
    );
    if (!today)
      throw new Error("no Hijri date for today (offline, not cached)");

    const startMonth = parseInt(today.hijri.month.number, 10);
    const startYear = parseInt(today.hijri.year, 10);

    const collected = [];
    for (let i = 0; i < FORWARD_HIJRI_MONTHS; i++) {
      const m = ((startMonth - 1 + i) % 12) + 1;
      const y = startYear + Math.floor((startMonth - 1 + i) / 12);
      const monthOccasions = await _fetchMonthOccasions(m, y);
      collected.push(...monthOccasions);
    }

    const todayIso = _toISODate(new Date());
    occasions = collected
      .filter((o) => o.gregorianDate >= todayIso)
      .sort((a, b) => a.gregorianDate.localeCompare(b.gregorianDate));
  } catch (err) {
    // offline or API down: keep the occasions we have; the midnight refresh tries again
    log.warn("loading fasting occasions failed:", err.message);
  }
}

async function _fetchMonthOccasions(hijriMonth, hijriYear) {
  if (hijriMonth === 9) return [];

  try {
    const days = await islamicCalendar.hijriMonthCalendar(
      hijriMonth,
      hijriYear,
    );
    if (!days) return [];

    const results = [];
    for (const entry of days) {
      const hDay = parseInt(entry?.hijri?.day, 10);
      const gDateStr = entry?.gregorian?.date;
      if (!hDay || !gDateStr) continue;
      const gregorianDate = _ddmmyyyyToISO(gDateStr);
      if (!gregorianDate) continue;

      if (hDay === 13 || hDay === 14 || hDay === 15) {
        results.push(
          _makeOccasion(
            "whiteDays",
            hDay,
            hijriMonth,
            hijriYear,
            gregorianDate,
          ),
        );
      }

      if (hijriMonth === 1 && hDay === 9) {
        results.push(
          _makeOccasion("tasua", hDay, hijriMonth, hijriYear, gregorianDate),
        );
      }
      if (hijriMonth === 1 && hDay === 10) {
        results.push(
          _makeOccasion("ashura", hDay, hijriMonth, hijriYear, gregorianDate),
        );
      }

      if (hijriMonth === 12 && hDay === 1) {
        results.push(
          _makeOccasion(
            "dhulHijjahFirst9",
            hDay,
            hijriMonth,
            hijriYear,
            gregorianDate,
          ),
        );
      }
      if (hijriMonth === 12 && hDay === 9) {
        results.push(
          _makeOccasion("arafah", hDay, hijriMonth, hijriYear, gregorianDate),
        );
      }

      if (hijriMonth === 10 && hDay === 2) {
        results.push(
          _makeOccasion("shawwal6", hDay, hijriMonth, hijriYear, gregorianDate),
        );
      }
    }
    return results;
  } catch (err) {
    log.warn(
      `loading Hijri month ${hijriMonth}/${hijriYear} failed:`,
      err.message,
    );
    return [];
  }
}

function _makeOccasion(type, hijriDay, hijriMonth, hijriYear, gregorianDate) {
  return {
    id: `${type}-${hijriYear}-${hijriMonth}-${hijriDay}`,
    type,
    hijriDay,
    hijriMonth,
    hijriYear,
    gregorianDate,
  };
}

function _startTick() {
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = setInterval(_checkReminders, TICK_MS);
  _checkReminders();
}

function _checkReminders() {
  if (!_mainWindow()) return;

  const now = new Date();
  const hour = now.getHours();
  if (hour < REMINDER_HOUR_START || hour >= REMINDER_HOUR_END) return;

  const settings = getSettingsData?.() || {};
  const fr = settings.fastingReminders || {};
  const enabledIds = new Set(fr.occasions || []);
  const weeklyOn = Boolean(fr.weeklyMonThu);
  const leadDays = Math.max(1, parseInt(fr.leadDays, 10) || 1);
  const todayMidnight = _midnight(now);

  let didFire = false;
  for (const o of occasions) {
    if (!enabledIds.has(o.id)) continue;
    const daysUntil = _daysBetween(todayMidnight, o.gregorianDate);
    if (daysUntil < 0 || daysUntil > leadDays) continue;
    const fireKey = `occ:${o.id}`;
    if (firedTodayKeys.has(fireKey)) continue;
    firedTodayKeys.add(fireKey);
    didFire = true;
    _sendToRenderer({ ...o });
  }

  if (weeklyOn) {
    for (let offset = 0; offset <= leadDays; offset++) {
      const d = new Date(todayMidnight);
      d.setDate(d.getDate() + offset);
      const dow = d.getDay();
      if (dow !== 1 && dow !== 4) continue;
      const dIso = _toISODate(d);
      const fireKey = `weekly:${dIso}`;
      if (firedTodayKeys.has(fireKey)) continue;
      firedTodayKeys.add(fireKey);
      didFire = true;
      _sendToRenderer({ type: "weekly", gregorianDate: dIso, weekday: dow });
    }
  }

  if (didFire) _persistFiredLog();
}

/** @returns {BrowserWindow | null} the main window while it exists */
function _mainWindow() {
  const w = getMainWindow();
  return w && !w.isDestroyed() ? w : null;
}

function _sendToRenderer(payload) {
  _mainWindow()?.webContents.send("fasting-reminder-due", payload);
}

function _scheduleMidnightRefresh() {
  if (midnightTimer) clearTimeout(midnightTimer);
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 45, 0);
  const msLeft = midnight.getTime() - now.getTime();
  midnightTimer = setTimeout(() => {
    firedTodayKeys = new Set();
    _persistFiredLog();
    const refresh = _refreshOccasions();
    readyPromise = refresh;
    refresh.then(_scheduleMidnightRefresh);
  }, msLeft);
}

function _firedLogPath() {
  return path.join(app.getPath("userData"), "fasting-reminders-log.json");
}

/** @returns {Set<string>} */
function _loadFiredLog() {
  try {
    const raw = fs.readFileSync(_firedLogPath(), "utf8");
    const parsed = JSON.parse(raw);
    if (
      parsed?.date === _toISODate(new Date()) &&
      Array.isArray(parsed.firedKeys)
    ) {
      return new Set(parsed.firedKeys);
    }
  } catch {
    // no log yet (first run today) or unreadable: start a fresh day
  }
  return new Set();
}

function _persistFiredLog() {
  try {
    fs.writeFileSync(
      _firedLogPath(),
      JSON.stringify({
        date: _toISODate(new Date()),
        firedKeys: Array.from(firedTodayKeys),
      }),
    );
  } catch (err) {
    log.warn("saving the reminder log failed:", err.message);
  }
}

function _pad2(n) {
  return String(n).padStart(2, "0");
}

/** @param {Date} date */
function _toISODate(date) {
  return `${date.getFullYear()}-${_pad2(date.getMonth() + 1)}-${_pad2(date.getDate())}`;
}

/** @param {Date} date */
function _midnight(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * @param {Date} fromMidnight
 * @param {string} isoDate "YYYY-MM-DD"
 */
function _daysBetween(fromMidnight, isoDate) {
  const [y, m, d] = String(isoDate)
    .split("-")
    .map((n) => parseInt(n, 10));
  const target = new Date(y, (m || 1) - 1, d || 1);
  return Math.round((target.getTime() - fromMidnight.getTime()) / 86400000);
}

function _ddmmyyyyToISO(str) {
  const parts = String(str).split("-");
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  return `${y}-${m}-${d}`;
}

module.exports = { init, cleanup };
