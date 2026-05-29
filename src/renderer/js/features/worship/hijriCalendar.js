// hijriCalendar.js
const { t } = require("../../core/i18n/translations");
const screenSizeManager = require("../../core/screenSize");
const analytics = require("../../utils/analytics");

// Hijri month names
const HIJRI_MONTHS = {
  en: [
    "Muharram",
    "Safar",
    "Rabi al-Awwal",
    "Rabi al-Thani",
    "Jumada al-Awwal",
    "Jumada al-Thani",
    "Rajab",
    "Shaban",
    "Ramadan",
    "Shawwal",
    "Dhul-Qadah",
    "Dhul-Hijjah",
  ],
  ar: [
    "محرم",
    "صفر",
    "ربيع الأول",
    "ربيع الثاني",
    "جمادى الأولى",
    "جمادى الثانية",
    "رجب",
    "شعبان",
    "رمضان",
    "شوال",
    "ذو القعدة",
    "ذو الحجة",
  ],
  fr: [
    "Mouharram",
    "Safar",
    "Rabia al-Awal",
    "Rabia ath-Thani",
    "Joumada al-Oula",
    "Joumada ath-Thania",
    "Rajab",
    "Chaabane",
    "Ramadan",
    "Chawwal",
    "Dhou al-Qiada",
    "Dhou al-Hijja",
  ],
};

// Important Islamic dates (month-day)
const ISLAMIC_EVENTS = {
  "1-1": {
    en: "Islamic New Year",
    ar: "رأس السنة الهجرية",
    fr: "Nouvel An Islamique",
  },
  "1-10": { en: "Day of Ashura", ar: "عاشوراء", fr: "Jour d'Achoura" },
  "3-12": {
    en: "Mawlid al-Nabi",
    ar: "المولد النبوي",
    fr: "Mawlid (Naissance du Prophète)",
  },
  "7-27": { en: "Isra and Miraj", ar: "الإسراء والمعراج", fr: "Isra et Miraj" },
  "8-15": { en: "Mid-Shaban", ar: "ليلة النصف من شعبان", fr: "Mi-Chaabane" },
  "9-1": {
    en: "First Day of Ramadan",
    ar: "أول رمضان",
    fr: "Premier Jour de Ramadan",
  },
  "9-27": { en: "Laylat al-Qadr", ar: "ليلة القدر", fr: "Nuit du Destin" },
  "10-1": { en: "Eid al-Fitr", ar: "عيد الفطر", fr: "Aïd al-Fitr" },
  "12-9": { en: "Day of Arafah", ar: "يوم عرفة", fr: "Jour d'Arafat" },
  "12-10": { en: "Eid al-Adha", ar: "عيد الأضحى", fr: "Aïd al-Adha" },
};

let currentHijriMonth = 1;
let currentHijriYear = 1446;
let monthCache = {};

/**
 * Initialize the Hijri calendar
 */
async function initHijriCalendar() {
  // Setup auto-reload on connection restored
  setupConnectionRecovery(() => {
    initHijriCalendar();
  }, "HijriCalendar");
  try {
    // Update title with translation
    updateCalendarTitle();

    // Get current Hijri date
    const today = new Date();
    const response = await fetch(
      `https://api.aladhan.com/v1/gToH/${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`,
    );
    const data = await response.json();

    if (data.code === 200 && data.data.hijri) {
      currentHijriMonth = parseInt(data.data.hijri.month.number);
      currentHijriYear = parseInt(data.data.hijri.year);
    }

    // SCREEN SIZE IS NOW HANDLED IN renderer.js

    setupEventListeners();
    await renderCalendar();
  } catch (error) {
    console.error("Error initializing Hijri calendar:", error);
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Navigation
  document
    .getElementById("prevMonthBtn")
    ?.addEventListener("click", () => navigateMonth(-1));
  document
    .getElementById("nextMonthBtn")
    ?.addEventListener("click", () => navigateMonth(1));
  document.getElementById("todayBtn")?.addEventListener("click", goToToday);

  // Back button
  document.getElementById("backBtn")?.addEventListener("click", () => {
    window.location.href = "../app/features.html";
  });
}

/**
 * Navigate to previous/next month
 */
async function navigateMonth(direction) {
  currentHijriMonth += direction;

  if (currentHijriMonth > 12) {
    currentHijriMonth = 1;
    currentHijriYear++;
  } else if (currentHijriMonth < 1) {
    currentHijriMonth = 12;
    currentHijriYear--;
  }

  // ── Track navigation direction ─────────────────────────────────────────
  analytics.calendarMonthNavigated(direction === -1 ? "prev" : "next"); // ← ANALYTICS

  await renderCalendar();
}

/**
 * Go to today's date
 */
async function goToToday() {
  try {
    const today = new Date();
    const response = await fetch(
      `https://api.aladhan.com/v1/gToH/${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`,
    );
    const data = await response.json();

    if (data.code === 200 && data.data.hijri) {
      currentHijriMonth = parseInt(data.data.hijri.month.number);
      currentHijriYear = parseInt(data.data.hijri.year);
      analytics.calendarMonthNavigated("today"); // ← ANALYTICS
      await renderCalendar();
    }
  } catch (error) {
    console.error("Error going to today:", error);
  }
}

/**
 * Render the calendar
 */
async function renderCalendar() {
  const lang = localStorage.getItem("language") || "en";

  // Update month and year display - support all languages
  let monthName = HIJRI_MONTHS.en[currentHijriMonth - 1]; // Default to English
  if (HIJRI_MONTHS[lang]) {
    monthName = HIJRI_MONTHS[lang][currentHijriMonth - 1];
  }
  document.getElementById("currentMonth").textContent = monthName;
  document.getElementById("currentYear").textContent =
    `${currentHijriYear} ${t("ah")}`;

  // Get month data
  const monthData = await getHijriMonthData();
  if (!monthData) return;

  // Render calendar days
  renderCalendarDays(monthData, lang);

  // Update Gregorian date display
  updateGregorianDisplay(monthData);

  // Render Islamic events
  renderIslamicEvents(lang);
}

/**
 * Get Hijri month data from API
 */
async function getHijriMonthData() {
  const cacheKey = `${currentHijriMonth}-${currentHijriYear}`;

  if (monthCache[cacheKey]) {
    return monthCache[cacheKey];
  }

  try {
    // Get the first day of the month in Gregorian to calculate the calendar
    const firstDayResponse = await fetch(
      `https://api.aladhan.com/v1/hToG/01-${currentHijriMonth}-${currentHijriYear}`,
    );
    const firstDayData = await firstDayResponse.json();

    if (firstDayData.code !== 200) return null;

    const firstDay = firstDayData.data.gregorian;
    const firstDayDate = new Date(
      firstDay.year,
      firstDay.month.number - 1,
      firstDay.day,
    );

    // Generate days locally to avoid API rate limiting
    const monthData = {
      firstDayWeekday: firstDayDate.getDay(),
      days: [],
    };

    // Hijri months are either 29 or 30 days
    // We'll generate 30 days and calculate the Gregorian dates locally
    for (let day = 1; day <= 30; day++) {
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

/**
 * Render calendar days
 */
function renderCalendarDays(monthData, lang) {
  const daysContainer = document.getElementById("calendarDays");
  if (!daysContainer) return;

  daysContainer.innerHTML = "";

  // Add empty cells for days before the month starts
  for (let i = 0; i < monthData.firstDayWeekday; i++) {
    const emptyDay = document.createElement("div");
    emptyDay.className = "calendar-day empty";
    daysContainer.appendChild(emptyDay);
  }

  // Get today's date for highlighting
  const today = new Date();

  // Add days of the month
  monthData.days.forEach((dayInfo) => {
    const dayEl = document.createElement("div");
    dayEl.className = "calendar-day";

    const gregorianDate = new Date(
      dayInfo.gregorian.year,
      dayInfo.gregorian.month.number - 1,
      dayInfo.gregorian.day,
    );

    // Check if this is today
    if (gregorianDate.toDateString() === today.toDateString()) {
      dayEl.classList.add("today");
    }

    // Check if this is a special Islamic date
    const eventKey = `${currentHijriMonth}-${dayInfo.hijriDay}`;
    if (ISLAMIC_EVENTS[eventKey]) {
      dayEl.classList.add("special-day");
    }

    dayEl.innerHTML = `
            <div class="day-number">${dayInfo.hijriDay}</div>
            <div class="day-gregorian">${dayInfo.gregorian.day}</div>
        `;

    daysContainer.appendChild(dayEl);
  });
}

/**
 * Update Gregorian date display
 */
function updateGregorianDisplay(monthData) {
  const gregorianDisplay = document.getElementById("gregorianDateText");
  if (!gregorianDisplay || monthData.days.length === 0) return;

  const firstDay = monthData.days[0].gregorian;
  const lastDay = monthData.days[monthData.days.length - 1].gregorian;

  gregorianDisplay.textContent = `${firstDay.month.en} ${firstDay.day} - ${lastDay.month.en} ${lastDay.day}, ${firstDay.year}`;
}

/**
 * Render Islamic events for the current month
 */
function renderIslamicEvents(lang) {
  const eventsList = document.getElementById("eventsList");
  if (!eventsList) return;

  eventsList.innerHTML = "";

  const monthEvents = Object.entries(ISLAMIC_EVENTS)
    .filter(([key]) => key.startsWith(`${currentHijriMonth}-`))
    .sort((a, b) => {
      const dayA = parseInt(a[0].split("-")[1]);
      const dayB = parseInt(b[0].split("-")[1]);
      return dayA - dayB;
    });

  if (monthEvents.length === 0) {
    eventsList.innerHTML = `<p class="no-events">${t("noEventsThisMonth") || "No special events this month"}</p>`;
    return;
  }

  monthEvents.forEach(([key, event]) => {
    const day = key.split("-")[1];
    const eventEl = document.createElement("div");
    eventEl.className = "event-item";

    // Get the event name based on the current language
    let eventName = event.en; // Default to English
    if (lang === "ar" && event.ar) {
      eventName = event.ar;
    } else if (lang === "fr" && event.fr) {
      eventName = event.fr;
    } else if (event[lang]) {
      eventName = event[lang];
    }

    eventEl.innerHTML = `
            <div class="event-date">${day}</div>
            <div class="event-name">${eventName}</div>
        `;
    eventsList.appendChild(eventEl);
  });
}

/**
 * Update calendar title based on current language
 */
function updateCalendarTitle() {
  const calendarTitle = document.getElementById("calendarTitle");
  if (calendarTitle) {
    calendarTitle.textContent = t("hijriCalendar");
  }
}

module.exports = {
  initHijriCalendar,
};
