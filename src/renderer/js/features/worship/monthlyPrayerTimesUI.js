"use strict";
const { ipcRenderer } = require("electron");
const { t, getLanguage } = require("../../core/i18n/translations");
const { state, prayerIcons } = require("../../core/globalStore");
const {
  setupConnectionRecovery,
} = require("../../services/connection-recovery");
const analytics = require("../../utils/analytics");

const PRAYER_KEYS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

let viewYear = 0;
let viewMonth = 0;
let monthCache = {};
let todayIso = "";

function initMonthlyPrayerTimesPage() {
  setupConnectionRecovery(initMonthlyPrayerTimesPage, "MonthlyPrayerTimes");
  analytics.featureOpen("monthly-prayer-times");

  document.getElementById("backBtn")?.addEventListener("click", () => {
    ipcRenderer.invoke("navigate-to", "features");
  });

  const now = new Date();
  viewYear = now.getFullYear();
  viewMonth = now.getMonth() + 1;
  todayIso = _isoDate(now);

  document.getElementById("mptPrevBtn")?.addEventListener("click", () => _changeMonth(-1));
  document.getElementById("mptNextBtn")?.addEventListener("click", () => _changeMonth(1));
  document.getElementById("mptTodayBtn")?.addEventListener("click", _jumpToToday);

  _applyStaticText();
  _loadMonth(true, true);
}

function _applyStaticText() {
  const map = {
    mptTitle: "prayerTimesMonthly",
    mptTodayLabel: "today",
    mptLoadingText: "loadingMonthlyPrayerTimes",
    mptFooterText: "monthlyPrayerTimesFooter",
  };
  for (const [id, key] of Object.entries(map)) {
    const el = document.getElementById(id);
    const text = t(key);
    if (el && text) el.textContent = text;
  }
}


function _changeMonth(delta) {
  viewMonth += delta;
  if (viewMonth > 12) {
    viewMonth = 1;
    viewYear++;
  } else if (viewMonth < 1) {
    viewMonth = 12;
    viewYear--;
  }
  _loadMonth();
}

function _jumpToToday() {
  const now = new Date();
  viewYear = now.getFullYear();
  viewMonth = now.getMonth() + 1;
  _loadMonth(true);
}


async function _loadMonth(scrollToToday = false, instant = false) {
  _updateMonthLabel();

  const { city, country } = state.settings;
  if (!city || !country) {
    _showLoading(false);
    _showTable(false);
    return;
  }

  const cacheKey = `${viewYear}-${viewMonth}`;
  let days = monthCache[cacheKey];

  if (!days) {
    _showLoading(true);
    _showTable(false);
    try {
      const method = state.settings.method || 2;
      const url =
        `https://api.aladhan.com/v1/calendarByCity?city=${encodeURIComponent(city)}` +
        `&country=${encodeURIComponent(country)}&method=${method}` +
        `&month=${viewMonth}&year=${viewYear}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json?.code !== 200 || !Array.isArray(json.data)) {
        throw new Error("Invalid calendarByCity response");
      }
      days = json.data;
      monthCache[cacheKey] = days;
    } catch (err) {
      console.error("[MonthlyPrayerTimes] fetch error:", err);
      _showLoading(false);
      _showTable(false);
      return;
    }
  }

  _showLoading(false);
  _renderTable(days);
  _renderTodayCard(days);
  _showTable(true);

  if (scrollToToday) _scrollToTodayRow(instant);
}


function _updateMonthLabel() {
  const el = document.getElementById("mptMonthLabel");
  if (!el) return;
  const lang = getLanguage();
  const langTag = lang === "ar" ? "ar" : lang === "fr" ? "fr" : "en";
  const d = new Date(viewYear, viewMonth - 1, 1);
  el.textContent = d.toLocaleDateString(langTag, { month: "long", year: "numeric" });
}


function _renderTodayCard(days) {
  const dateEl = document.getElementById("mptTodayDate");
  const rowEl = document.getElementById("mptTodayRow");
  if (!dateEl || !rowEl) return;

  const isCurrentMonth =
    viewYear === new Date().getFullYear() && viewMonth === new Date().getMonth() + 1;

  const todayEntry = isCurrentMonth
    ? days.find((d) => _entryIso(d) === todayIso)
    : null;

  if (!todayEntry) {
    dateEl.textContent = "";
    rowEl.innerHTML = "";
    document.getElementById("mptTodayCard")?.classList.add("mpt-hidden");
    return;
  }

  document.getElementById("mptTodayCard")?.classList.remove("mpt-hidden");

  const lang = getLanguage();
  const langTag = lang === "ar" ? "ar" : lang === "fr" ? "fr" : "en";
  const gDate = new Date(viewYear, viewMonth - 1, parseInt(todayEntry.date.gregorian.day, 10));
  dateEl.textContent = gDate.toLocaleDateString(langTag, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const nowSec = _secondsSinceMidnight(new Date());
  let nextKey = null;
  let nextDiff = Infinity;
  for (const key of PRAYER_KEYS) {
    const sec = _timeStrToSeconds(todayEntry.timings[key]);
    const diff = sec - nowSec;
    if (diff > 0 && diff < nextDiff) {
      nextDiff = diff;
      nextKey = key;
    }
  }

  rowEl.innerHTML = PRAYER_KEYS.map((key) => {
    const time = _cleanTime(todayEntry.timings[key]);
    const isNext = key === nextKey;
    return `
      <div class="mpt-today-cell${isNext ? " mpt-today-cell--next" : ""}">
        <i class="fas fa-${prayerIcons[key] || "clock"}"></i>
        <div class="mpt-today-cell-name">${t(key, "prayerNames") || key}</div>
        <div class="mpt-today-cell-time">${time}</div>
      </div>
    `;
  }).join("");
}


function _renderTable(days) {
  const head = document.getElementById("mptTableHead");
  const body = document.getElementById("mptTableBody");
  if (!head || !body) return;

  const lang = getLanguage();
  const langTag = lang === "ar" ? "ar" : lang === "fr" ? "fr" : "en";

  head.innerHTML =
    `<th>${t("date", "common") || "Date"}</th>` +
    PRAYER_KEYS.map((k) => `<th>${t(k, "prayerNames") || k}</th>`).join("");

  body.innerHTML = days
    .map((entry) => {
      const day = parseInt(entry.date.gregorian.day, 10);
      const gDate = new Date(viewYear, viewMonth - 1, day);
      const weekday = gDate.toLocaleDateString(langTag, { weekday: "short" });
      const iso = _entryIso(entry);
      const isToday = iso === todayIso;

      const cells = PRAYER_KEYS.map(
        (key) => `<td>${_cleanTime(entry.timings[key])}</td>`,
      ).join("");

      return `
        <tr class="${isToday ? "mpt-today-row-highlight" : ""}">
          <td class="mpt-date-cell">
            <span class="mpt-date-day">${day}</span>
            <span class="mpt-date-weekday">${weekday}</span>
          </td>
          ${cells}
        </tr>
      `;
    })
    .join("");
}

function _scrollToTodayRow(instant = false) {
  requestAnimationFrame(() => {
    const row = document.querySelector(".mpt-today-row-highlight");
    row?.scrollIntoView({ behavior: instant ? "auto" : "smooth", block: "center" });
  });
}


function _showLoading(visible) {
  document.getElementById("mptLoading")?.classList.toggle("mpt-hidden", !visible);
}

function _showTable(visible) {
  document.getElementById("mptTable")?.classList.toggle("mpt-hidden", !visible);
}


function _entryIso(entry) {
  const [d, m, y] = String(entry.date.gregorian.date).split("-");
  return `${y}-${m}-${d}`;
}

function _isoDate(date) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

function _cleanTime(raw) {
  if (!raw) return "--:--";
  return String(raw).split(" ")[0];
}

function _timeStrToSeconds(raw) {
  const clean = _cleanTime(raw);
  const [h, m] = clean.split(":").map((n) => parseInt(n, 10));
  return (h || 0) * 3600 + (m || 0) * 60;
}

function _secondsSinceMidnight(date) {
  return date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
}

module.exports = { initMonthlyPrayerTimesPage };
