"use strict";

const { t, getLocaleTag } = require("../core/i18n");
const analytics = require("../services/analytics");
const { setupConnectionRecovery } = require("../services/connection-recovery");
const { ipcRenderer } = require("electron");
const { hijriMonthName } = require("../core/dates");
const { escapeHtml } = require("../utils/html");
const { byId } = require("../core/dom");

// Special days shown on the calendar as { "month-day": name } in the UI language
// (locales/<lang>/worship/calendar.json).
function calendarEvents() {
  const events = t("calendarEvents");
  return events && typeof events === "object" ? events : {};
}

let currentHijriMonth = 1;
let currentHijriYear = 1446;
const monthCache = {};

// Weekday headings (Sun … Sat) in the UI language; the grid starts on Sunday.
function renderWeekdayNames() {
  const format = new Intl.DateTimeFormat(getLocaleTag(), { weekday: "short" });
  document.querySelectorAll(".calendar-weekdays .weekday").forEach((el, i) => {
    el.textContent = format.format(new Date(2023, 0, 1 + i)); // 1 Jan 2023 was a Sunday
  });
}

async function initHijriCalendar() {
  renderWeekdayNames();
  setupEventListeners();
  setupConnectionRecovery(_loadTodayAndRender, "HijriCalendar");
  await _loadTodayAndRender();
}

// Shows the Hijri month that contains today.
async function _loadTodayAndRender() {
  try {
    // Hijri dates come from the main process's cache, so the calendar also works offline
    const today = new Date();
    const data = await ipcRenderer.invoke(
      "gregorian-to-hijri",
      today.getDate(),
      today.getMonth() + 1,
      today.getFullYear(),
    );
    if (data?.hijri) {
      currentHijriMonth = parseInt(data.hijri.month.number);
      currentHijriYear = parseInt(data.hijri.year);
    }

    await renderCalendar();
  } catch (error) {
    console.error("Error initializing Hijri calendar:", error);
  }
}

function setupEventListeners() {
  document
    .getElementById("prevMonthBtn")
    ?.addEventListener("click", () => navigateMonth(-1));
  document
    .getElementById("nextMonthBtn")
    ?.addEventListener("click", () => navigateMonth(1));
  document.getElementById("todayBtn")?.addEventListener("click", goToToday);
}

async function navigateMonth(direction) {
  currentHijriMonth += direction;

  if (currentHijriMonth > 12) {
    currentHijriMonth = 1;
    currentHijriYear++;
  } else if (currentHijriMonth < 1) {
    currentHijriMonth = 12;
    currentHijriYear--;
  }

  analytics.calendarMonthNavigated(direction === -1 ? "prev" : "next");

  await renderCalendar();
}

function goToToday() {
  analytics.calendarMonthNavigated("today");
  return _loadTodayAndRender();
}

let renderCalendarRequestId = 0;

async function renderCalendar() {
  const myRequestId = ++renderCalendarRequestId;

  byId("currentMonth", HTMLElement).textContent =
    hijriMonthName(currentHijriMonth);
  byId("currentYear", HTMLElement).textContent =
    `${currentHijriYear} ${t("ah")}`;

  const monthData = await getHijriMonthData();
  if (myRequestId !== renderCalendarRequestId) return;
  if (!monthData) {
    showMonthUnavailable();
    return;
  }

  renderCalendarDays(monthData);

  updateGregorianDisplay(monthData);

  renderIslamicEvents();
}

async function getHijriMonthData() {
  const cacheKey = `${currentHijriMonth}-${currentHijriYear}`;

  if (monthCache[cacheKey]) {
    return monthCache[cacheKey];
  }

  try {
    // Every day of the Hijri month (29 or 30) with its Gregorian date, from the main process.
    // The fasting reminders load the coming months the same way, so they are usually saved
    // already, which also makes them available offline.
    const calendar = await ipcRenderer.invoke(
      "get-hijri-month",
      currentHijriMonth,
      currentHijriYear,
    );
    if (!Array.isArray(calendar) || !calendar.length) return null;

    const [d, m, y] = calendar[0].gregorian.date.split("-").map(Number);
    const monthData = {
      firstDayWeekday: new Date(y, m - 1, d).getDay(),
      days: calendar.map((entry) => ({
        hijriDay: Number(entry.hijri.day),
        gregorian: {
          day: Number(entry.gregorian.day),
          month: {
            number: Number(entry.gregorian.month.number),
            en: entry.gregorian.month.en,
          },
          year: Number(entry.gregorian.year),
        },
      })),
    };

    monthCache[cacheKey] = monthData;
    return monthData;
  } catch (error) {
    console.error("Error fetching month data:", error);
    return null;
  }
}

function renderCalendarDays(monthData) {
  const daysContainer = document.getElementById("calendarDays");
  if (!daysContainer) return;

  daysContainer.innerHTML = "";

  for (let i = 0; i < monthData.firstDayWeekday; i++) {
    const emptyDay = document.createElement("div");
    emptyDay.className = "calendar-day empty";
    daysContainer.appendChild(emptyDay);
  }

  const today = new Date();
  const events = calendarEvents();

  monthData.days.forEach((dayInfo) => {
    const dayEl = document.createElement("div");
    dayEl.className = "calendar-day";

    const gregorianDate = new Date(
      dayInfo.gregorian.year,
      dayInfo.gregorian.month.number - 1,
      dayInfo.gregorian.day,
    );

    if (gregorianDate.toDateString() === today.toDateString()) {
      dayEl.classList.add("today");
    }

    const eventKey = `${currentHijriMonth}-${dayInfo.hijriDay}`;
    if (events[eventKey]) {
      dayEl.classList.add("special-day");
    }

    dayEl.innerHTML = `
            <div class="day-number">${dayInfo.hijriDay}</div>
            <div class="day-gregorian">${dayInfo.gregorian.day}</div>
        `;

    daysContainer.appendChild(dayEl);
  });
}

// Offline and this month was never loaded: say so, instead of leaving the previous month's
// days under this month's name.
function showMonthUnavailable() {
  const daysContainer = document.getElementById("calendarDays");
  if (daysContainer) {
    daysContainer.innerHTML = `<p class="calendar-message">${escapeHtml(t("calendarMonthUnavailable"))}</p>`;
  }
  const gregorianDisplay = document.getElementById("gregorianDateText");
  if (gregorianDisplay) gregorianDisplay.textContent = "";
}

function updateGregorianDisplay(monthData) {
  const gregorianDisplay = document.getElementById("gregorianDateText");
  if (!gregorianDisplay || monthData.days.length === 0) return;

  const firstDay = monthData.days[0].gregorian;
  const lastDay = monthData.days[monthData.days.length - 1].gregorian;

  gregorianDisplay.textContent = `${firstDay.month.en} ${firstDay.day} - ${lastDay.month.en} ${lastDay.day}, ${firstDay.year}`;
}

function renderIslamicEvents() {
  const eventsList = document.getElementById("eventsList");
  if (!eventsList) return;

  eventsList.innerHTML = "";

  const monthEvents = Object.entries(calendarEvents())
    .filter(([key]) => key.startsWith(`${currentHijriMonth}-`))
    .sort((a, b) => {
      const dayA = parseInt(a[0].split("-")[1]);
      const dayB = parseInt(b[0].split("-")[1]);
      return dayA - dayB;
    });

  if (monthEvents.length === 0) {
    eventsList.innerHTML = `<p class="no-events">${t("noEventsThisMonth")}</p>`;
    return;
  }

  monthEvents.forEach(([key, eventName]) => {
    const day = key.split("-")[1];
    const eventEl = document.createElement("div");
    eventEl.className = "event-item";

    eventEl.innerHTML = `
            <div class="event-date">${day}</div>
            <div class="event-name">${eventName}</div>
        `;
    eventsList.appendChild(eventEl);
  });
}

module.exports = {
  initHijriCalendar,
};
