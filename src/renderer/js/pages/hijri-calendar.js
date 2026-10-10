"use strict";

const { t, getLocaleTag } = require("../core/i18n");
const analytics = require("../services/analytics");
const { setupConnectionRecovery } = require("../services/connection-recovery");
const { ALADHAN_API } = require("../../../shared/aladhan");
const { hijriMonthName } = require("../utils/dates");

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
    const today = new Date();
    const response = await fetch(
      `${ALADHAN_API}/gToH/${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`,
    );
    const data = await response.json();

    if (data.code === 200 && data.data.hijri) {
      currentHijriMonth = parseInt(data.data.hijri.month.number);
      currentHijriYear = parseInt(data.data.hijri.year);
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

  document.getElementById("currentMonth").textContent =
    hijriMonthName(currentHijriMonth);
  document.getElementById("currentYear").textContent =
    `${currentHijriYear} ${t("ah")}`;

  const monthData = await getHijriMonthData();
  if (myRequestId !== renderCalendarRequestId) return;
  if (!monthData) return;

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
    const firstDayResponse = await fetch(
      `${ALADHAN_API}/hToG/01-${currentHijriMonth}-${currentHijriYear}`,
    );
    const firstDayData = await firstDayResponse.json();

    if (firstDayData.code !== 200) return null;

    const firstDay = firstDayData.data.gregorian;
    // A Hijri month has 29 or 30 days; the API says which (30 only if it is missing).
    const monthLength = Number(firstDayData.data.hijri?.month?.days) || 30;
    const firstDayDate = new Date(
      firstDay.year,
      firstDay.month.number - 1,
      firstDay.day,
    );

    const monthData = {
      firstDayWeekday: firstDayDate.getDay(),
      days: [],
    };

    for (let day = 1; day <= monthLength; day++) {
      const gregorianDate = new Date(firstDayDate);
      gregorianDate.setDate(firstDayDate.getDate() + (day - 1));

      monthData.days.push({
        hijriDay: day,
        gregorian: {
          day: gregorianDate.getDate(),
          month: {
            number: gregorianDate.getMonth() + 1,
            en: gregorianDate.toLocaleString("en-US", { month: "long" }),
          },
          year: gregorianDate.getFullYear(),
        },
      });
    }

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
