"use strict";
const { t, getLocaleTag } = require("../core/i18n");
const { state, prayerIcons } = require("../core/store");
const { setupConnectionRecovery } = require("../services/connection-recovery");
const {
  PRAYER_KEYS,
  JUMUAH_KEY,
  displayPrayerKey,
  cleanTime,
  secondsFromTime,
  secondsSinceMidnight,
} = require("../../../shared/prayerUtils");
const { ALADHAN_API, locationQuery } = require("../../../shared/aladhan");
const { escapeHtml } = require("../utils/html");

let viewYear = 0;
let viewMonth = 0;
const monthCache = {};
let todayIso = "";

function initMonthlyPrayerTimesPage() {
  // Reload the month being viewed (failed months are not cached); re-running the whole init
  // would jump back to the current month and add the button listeners again.
  setupConnectionRecovery(() => _loadMonth(), "MonthlyPrayerTimes");

  const now = new Date();
  viewYear = now.getFullYear();
  viewMonth = now.getMonth() + 1;
  todayIso = _isoDate(now);

  document
    .getElementById("mptPrevBtn")
    ?.addEventListener("click", () => _changeMonth(-1));
  document
    .getElementById("mptNextBtn")
    ?.addEventListener("click", () => _changeMonth(1));
  document
    .getElementById("mptTodayBtn")
    ?.addEventListener("click", _jumpToToday);

  _loadMonth(true, true);
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

  // Same location/method query as the home page, so both show the same times. It is also
  // part of the cache key, so a different city or method never reuses another month's data.
  const query = locationQuery(state.settings);
  const cacheKey = `${viewYear}-${viewMonth}|${query}`;
  let days = monthCache[cacheKey];

  if (!days) {
    _showLoading(true);
    _showTable(false);
    try {
      const url = `${ALADHAN_API}/calendarByCity?${query}&month=${viewMonth}&year=${viewYear}`;
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
  const langTag = getLocaleTag();
  const d = new Date(viewYear, viewMonth - 1, 1);
  el.textContent = d.toLocaleDateString(langTag, {
    month: "long",
    year: "numeric",
  });
}

function _renderTodayCard(days) {
  const dateEl = document.getElementById("mptTodayDate");
  const rowEl = document.getElementById("mptTodayRow");
  if (!dateEl || !rowEl) return;

  const isCurrentMonth =
    viewYear === new Date().getFullYear() &&
    viewMonth === new Date().getMonth() + 1;

  const todayEntry = isCurrentMonth
    ? days.find((d) => _entryIso(d) === todayIso)
    : null;

  if (!todayEntry) {
    dateEl.textContent = "";
    rowEl.innerHTML = "";
    document.getElementById("mptTodayCard")?.classList.add("hidden");
    return;
  }

  document.getElementById("mptTodayCard")?.classList.remove("hidden");

  const langTag = getLocaleTag();
  const gDate = new Date(
    viewYear,
    viewMonth - 1,
    parseInt(todayEntry.date.gregorian.day, 10),
  );
  dateEl.textContent = gDate.toLocaleDateString(langTag, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const nowSec = secondsSinceMidnight();
  let nextKey = null;
  let nextDiff = Infinity;
  for (const key of PRAYER_KEYS) {
    const sec = secondsFromTime(todayEntry.timings[key]);
    const diff = sec - nowSec;
    if (diff > 0 && diff < nextDiff) {
      nextDiff = diff;
      nextKey = key;
    }
  }

  const nameOpts = {
    isFriday: _isFridayEntry(todayEntry, gDate),
  };
  rowEl.innerHTML = PRAYER_KEYS.map((key) => {
    const time = cleanTime(todayEntry.timings[key]);
    const isNext = key === nextKey;
    const nameKey = displayPrayerKey(key, nameOpts);
    return `
      <div class="monthly-today-cell${isNext ? " monthly-today-cell--next" : ""}">
        <i class="fas fa-${prayerIcons[key] || "clock"}" aria-hidden="true"></i>
        <div class="monthly-today-cell-name">${t(nameKey, "prayerNames")}</div>
        <div class="monthly-today-cell-time">${escapeHtml(time)}</div>
      </div>
    `;
  }).join("");
}

function _renderTable(days) {
  const head = document.getElementById("mptTableHead");
  const body = document.getElementById("mptTableBody");
  if (!head || !body) return;

  const langTag = getLocaleTag();

  head.innerHTML = `<th>${t("date", "common")}</th>${PRAYER_KEYS.map(
    (k) => `<th>${t(k, "prayerNames")}</th>`,
  ).join("")}`;

  // The header has one Dhuhr column for the whole month, so Friday rows get a small
  // "Jumu'ah" badge in their Dhuhr cell instead (same time, only the name differs).
  const jumuahLabel = t(JUMUAH_KEY, "prayerNames");

  body.innerHTML = days
    .map((entry) => {
      const day = parseInt(entry.date.gregorian.day, 10);
      const gDate = new Date(viewYear, viewMonth - 1, day);
      const weekday = gDate.toLocaleDateString(langTag, { weekday: "short" });
      const iso = _entryIso(entry);
      const isToday = iso === todayIso;
      const jumuah = _isFridayEntry(entry, gDate);

      const cells = PRAYER_KEYS.map((key) => {
        const time = cleanTime(entry.timings[key]);
        if (
          jumuah &&
          displayPrayerKey(key, { isFriday: true }) === JUMUAH_KEY
        ) {
          return `<td class="monthly-jumuah">${escapeHtml(time)}<span class="monthly-jumuah-badge">${jumuahLabel}</span></td>`;
        }
        return `<td>${escapeHtml(time)}</td>`;
      }).join("");

      return `
        <tr class="${isToday ? "monthly-today-row-highlight" : ""}">
          <td class="monthly-date-cell">
            <span class="monthly-date-day">${day}</span>
            <span class="monthly-date-weekday">${weekday}</span>
          </td>
          ${cells}
        </tr>
      `;
    })
    .join("");
}

function _scrollToTodayRow(instant = false) {
  requestAnimationFrame(() => {
    const row = document.querySelector(".monthly-today-row-highlight");
    row?.scrollIntoView({
      behavior: instant ? "auto" : "smooth",
      block: "center",
    });
  });
}

function _showLoading(visible) {
  document.getElementById("mptLoading")?.classList.toggle("hidden", !visible);
}

function _showTable(visible) {
  document.getElementById("mptTable")?.classList.toggle("hidden", !visible);
}

// Whether a calendar day is a Friday. Uses the weekday Aladhan gives for that date (a
// calendar date, so there is no time-zone question); falls back to the local Date.
function _isFridayEntry(entry, gDate) {
  const weekday = entry?.date?.gregorian?.weekday?.en;
  return weekday ? weekday === "Friday" : gDate.getDay() === 5;
}

function _entryIso(entry) {
  const [d, m, y] = String(entry.date.gregorian.date).split("-");
  return `${y}-${m}-${d}`;
}

function _isoDate(date) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

module.exports = { initMonthlyPrayerTimesPage };
