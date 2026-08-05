"use strict";

const { ipcMain, app } = require("electron");
const fs = require("fs");
const path = require("path");

let mainWindow = null;
let getSettingsData = null;

let occasions = [];
let readyPromise = null;

let tickInterval = null;
let midnightTimer = null;
let firedTodayKeys = new Set();

const FORWARD_HIJRI_MONTHS = 4;
const REMINDER_HOUR_START = 19;
const REMINDER_HOUR_END = 22;
const TICK_MS = 10 * 60 * 1000;


function init(window, settingsFn) {
  mainWindow = window;
  getSettingsData = settingsFn;
  firedTodayKeys = _loadFiredLog();
  _registerIpcHandlers();
  readyPromise = _refreshOccasions();
  readyPromise.then(() => {
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
  ipcMain.handle("get-fasting-occasions", async () => {
    if (readyPromise) await readyPromise;
    return occasions;
  });
}


async function _refreshOccasions() {
  try {
    const todayStr = _toDDMMYYYY(new Date());
    const res = await fetch(`https://api.aladhan.com/v1/gToH?date=${todayStr}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json?.code !== 200 || !json?.data?.hijri) throw new Error("Invalid gToH response");

    const startMonth = parseInt(json.data.hijri.month.number, 10);
    const startYear = parseInt(json.data.hijri.year, 10);

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
  } catch {
  }
}

async function _fetchMonthOccasions(hijriMonth, hijriYear) {
  if (hijriMonth === 9) return [];

  try {
    const url = `https://api.aladhan.com/v1/hToGCalendar/${hijriMonth}/${hijriYear}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json?.code !== 200 || !Array.isArray(json.data)) return [];

    const results = [];
    for (const entry of json.data) {
      const hDay = parseInt(entry?.hijri?.day, 10);
      const gDateStr = entry?.gregorian?.date;
      if (!hDay || !gDateStr) continue;
      const gregorianDate = _ddmmyyyyToISO(gDateStr);
      if (!gregorianDate) continue;

      if (hDay === 13 || hDay === 14 || hDay === 15) {
        results.push(
          _makeOccasion("whiteDays", hDay, hijriMonth, hijriYear, gregorianDate),
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
          _makeOccasion("dhulHijjahFirst9", hDay, hijriMonth, hijriYear, gregorianDate),
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
  } catch {
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
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const now = new Date();
  const hour = now.getHours();
  if (hour < REMINDER_HOUR_START || hour >= REMINDER_HOUR_END) return;

  const settings = getSettingsData?.() || {};
  const fr = settings.fastingReminders || {};
  const enabledIds = new Set(fr.occasions || []);
  const weeklyOn = !!fr.weeklyMonThu;
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

function _sendToRenderer(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("fasting-reminder-due", payload);
  }
}


function _scheduleMidnightRefresh() {
  if (midnightTimer) clearTimeout(midnightTimer);
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 45, 0);
  const msLeft = midnight - now;
  midnightTimer = setTimeout(() => {
    firedTodayKeys = new Set();
    _persistFiredLog();
    readyPromise = _refreshOccasions();
    readyPromise.then(_scheduleMidnightRefresh);
  }, msLeft);
}


function _firedLogPath() {
  return path.join(app.getPath("userData"), "fasting-reminders-log.json");
}

function _loadFiredLog() {
  try {
    const raw = fs.readFileSync(_firedLogPath(), "utf8");
    const parsed = JSON.parse(raw);
    if (parsed?.date === _toISODate(new Date()) && Array.isArray(parsed.firedKeys)) {
      return new Set(parsed.firedKeys);
    }
  } catch {
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
  } catch {
  }
}


function _pad2(n) {
  return String(n).padStart(2, "0");
}

function _toDDMMYYYY(date) {
  return `${_pad2(date.getDate())}-${_pad2(date.getMonth() + 1)}-${date.getFullYear()}`;
}

function _toISODate(date) {
  return `${date.getFullYear()}-${_pad2(date.getMonth() + 1)}-${_pad2(date.getDate())}`;
}

function _midnight(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function _daysBetween(fromMidnight, isoDate) {
  const [y, m, d] = String(isoDate).split("-").map((n) => parseInt(n, 10));
  const target = new Date(y, (m || 1) - 1, d || 1);
  return Math.round((target - fromMidnight) / 86400000);
}

function _ddmmyyyyToISO(str) {
  const parts = String(str).split("-");
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  return `${y}-${m}-${d}`;
}

module.exports = { init, cleanup };
