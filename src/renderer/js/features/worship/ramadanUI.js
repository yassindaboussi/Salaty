// ramadanUI.js
const { ipcRenderer } = require("electron");
const {
  setupConnectionRecovery,
} = require("../../services/connection-recovery");
const { state } = require("../../core/globalStore");
const { t } = require("../../core/i18n/translations");
const screenSizeManager = require("../../core/screenSize");
const analytics = require("../../utils/analytics");

let ramadanData = [];
let assignedHijriYear = null;

function initRamadanPage() {
  // Setup auto-reload on connection restored
  setupConnectionRecovery(() => {
    initRamadanPage();
  }, "Ramadan");
  // SCREEN SIZE IS NOW HANDLED IN renderer.js

  // Back Button
  const backBtn = document.getElementById("backBtn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      ipcRenderer.invoke("navigate-to", "features");
    });
  }

  // Modal Close
  const modalClose = document.getElementById("modalClose");
  const modal = document.getElementById("dayModal");
  if (modalClose && modal) {
    modalClose.onclick = () => {
      modal.classList.remove("show");
    };
    // Close on click outside
    window.onclick = (event) => {
      if (event.target === modal) {
        modal.classList.remove("show");
      }
    };
  }

  // Apply Static Translations
  const todayFastingTitle = document.getElementById("todayFastingTitle");
  if (todayFastingTitle) todayFastingTitle.textContent = t("todayFasting");

  // New Tab Translations
  const trackerTitle = document.getElementById("trackerTitle");
  if (trackerTitle) trackerTitle.textContent = t("fastingTracker");

  const tableTitle = document.getElementById("tableTitle");
  if (tableTitle)
    tableTitle.textContent = t("timetable", "common") || "Timetable"; // Fallback if 'timetable' not in dictionary

  const thDay = document.getElementById("thDay");
  if (thDay) thDay.textContent = t("day", "common") || "Day";

  const thDate = document.getElementById("thDate");
  if (thDate) thDate.textContent = t("date", "common") || "Date";

  const thSuhoor = document.getElementById("thSuhoor");
  if (thSuhoor) thSuhoor.textContent = t("suhoor");

  const thIftar = document.getElementById("thIftar");
  if (thIftar) thIftar.textContent = t("iftar");

  // Tab switching logic
  initTabs();

  const labelTodaySuhoor = document.getElementById("labelTodaySuhoor");
  if (labelTodaySuhoor) labelTodaySuhoor.textContent = t("suhoor");

  const labelTodayIftar = document.getElementById("labelTodayIftar");
  if (labelTodayIftar) labelTodayIftar.textContent = t("iftar");

  // Add translation for page title initially
  const pageTitle = document.querySelector(".ramadan-title");
  if (pageTitle) pageTitle.textContent = t("ramadhan");

  const modalLabelSuhoor = document.getElementById("modalLabelSuhoor");
  if (modalLabelSuhoor)
    modalLabelSuhoor.innerHTML = `<i class="fas fa-utensils"></i> ${t("suhoor")} (${t("Fajr", "prayerNames")})`;

  const modalLabelIftar = document.getElementById("modalLabelIftar");
  if (modalLabelIftar)
    modalLabelIftar.innerHTML = `<i class="fas fa-glass-water"></i> ${t("iftar")} (${t("Maghrib", "prayerNames")})`;

  fetchRamadanData();
}

async function fetchRamadanData() {
  const { city, country } = state.settings;
  if (!city || !country) {
    document.getElementById("trackerGrid").innerHTML =
      `<p style="text-align:center; color:white; width: 100%;">Please set your location in Settings first.</p>`;
    return;
  }

  try {
    // 1. Get current Hijri Year first
    const method = state.settings.method || 2; // Default to ISNA if not set
    const todayUrl = `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=${method}`;

    const todayRes = await fetch(todayUrl);
    const todayData = await todayRes.json();

    if (!todayData || !todayData.data)
      throw new Error("Could not fetch today's data");

    const currentDate = todayData.data.date;
    const currentHijriMonth = currentDate.hijri.month.number;
    let targetHijriYear = parseInt(currentDate.hijri.year);

    // If Ramadan (9) has passed this year, show next year's Ramadan
    if (currentHijriMonth > 9) {
      targetHijriYear++;
    }

    assignedHijriYear = targetHijriYear;
    const titleEl = document.querySelector(".ramadan-title");
    if (titleEl) titleEl.textContent = `${t("ramadhan")} ${assignedHijriYear}`;

    // 2. Fetch Ramadan Month Data
    const ramadanUrl = `https://api.aladhan.com/v1/hijriCalendarByCity/${targetHijriYear}/9?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=${method}`;

    const ramadanRes = await fetch(ramadanUrl);
    const ramadanJson = await ramadanRes.json();

    if (ramadanJson && ramadanJson.data) {
      ramadanData = ramadanJson.data;
      renderCalendar(ramadanData);
      renderTable(ramadanData);
      updateTodayCard(ramadanData);
    }
  } catch (error) {
    console.error("Error fetching Ramadan data:", error);
    analytics.error("ramadan_fetch", err.message || String(err));
    document.getElementById("trackerGrid").innerHTML =
      `<p style="text-align:center; color:white;">Error loading data. Check internet connection.</p>`;
  }
}

function renderCalendar(data) {
  const grid = document.getElementById("trackerGrid");
  if (!grid) return;
  grid.innerHTML = "";

  const trackedDays = JSON.parse(
    localStorage.getItem(`ramadanTracker_${assignedHijriYear}`) || "[]",
  );

  const lang = state.settings.language || "en";
  const monthFormatter = new Intl.DateTimeFormat(
    lang === "ar" ? "ar-TN" : lang,
    { month: "short" },
  );

  data.forEach((dayData, index) => {
    const hijriDay = dayData.date.hijri.day;
    const gregorianDate = dayData.date.gregorian.date; // DD-MM-YYYY
    const [gDay, gMonth, gYear] = gregorianDate.split("-").map(Number);

    const jsDate = new Date(gYear, gMonth - 1, gDay);
    let monthName = monthFormatter.format(jsDate).trim();

    // Clean up trailing dot/period if any (some locales add it)
    if (lang === "ar") {
      monthName = monthName.replace(/[.\s]+$/, "");
    }

    const el = document.createElement("div");
    el.className = "day-tracker";

    // Check special days
    if (parseInt(hijriDay) === 15) {
      el.classList.add("special-day");
      const badge = document.createElement("i");
      badge.className = "fas fa-star special-badge";
      el.appendChild(badge);
    }
    if (parseInt(hijriDay) === 27) {
      el.classList.add("laylat-al-qadr");
      const badge = document.createElement("i");
      badge.className = "fas fa-moon special-badge";
      el.appendChild(badge);
    }

    // Check if completed
    if (trackedDays.includes(hijriDay)) {
      el.classList.add("completed");
    }

    el.innerHTML += `
            <span class="hijri-day">${hijriDay}</span>
            <span class="gregorian-date">${gDay} ${monthName}</span>
        `;

    el.addEventListener("click", () => openDayModal(dayData, el));

    grid.appendChild(el);
  });
}

function updateTodayCard(data) {
  // Find if today is in the list
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to midnight

  const d = String(today.getDate()).padStart(2, "0");
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const y = today.getFullYear();
  const todayStr = `${d}-${m}-${y}`;

  const todayData = data.find((item) => item.date.gregorian.date === todayStr);

  const suhoorEl = document.getElementById("todaySuhoor");
  const iftarEl = document.getElementById("todayIftar");
  const cardTitle = document.querySelector("#todayCard h3");

  if (todayData) {
    // We are in Ramadan and found today!
    if (suhoorEl) suhoorEl.textContent = formatTimeStr(todayData.timings.Fajr);
    if (iftarEl) iftarEl.textContent = formatTimeStr(todayData.timings.Maghrib);

    if (cardTitle) {
      cardTitle.textContent = t("ramadanDay").replace(
        "{days}",
        todayData.date.hijri.day,
      );
    }
  } else {
    // Not Ramadan or data not matching
    if (data.length > 0) {
      // Check start date
      const firstDayStr = data[0].date.gregorian.date;
      const [fd, fm, fy] = firstDayStr.split("-");
      const firstDayDate = new Date(fy, fm - 1, fd);
      firstDayDate.setHours(0, 0, 0, 0);

      if (today < firstDayDate) {
        // Before Ramadan
        const diffTime = firstDayDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (cardTitle)
          cardTitle.textContent = t("daysUntilRamadan").replace(
            "{days}",
            diffDays,
          );

        // Show 1st day times as requested
        if (suhoorEl)
          suhoorEl.textContent = formatTimeStr(data[0].timings.Fajr);
        if (iftarEl)
          iftarEl.textContent = formatTimeStr(data[0].timings.Maghrib);
      } else {
        // Likely After Ramadan
        if (cardTitle) cardTitle.textContent = t("ramadanEnded");
        if (suhoorEl) suhoorEl.textContent = "--:--";
        if (iftarEl) iftarEl.textContent = "--:--";
      }
    } else {
      if (suhoorEl) suhoorEl.textContent = "--:--";
      if (iftarEl) iftarEl.textContent = "--:--";
    }
  }
}

function openDayModal(dayData, element) {
  const modal = document.getElementById("dayModal");
  if (!modal) return;

  const hijriDay = dayData.date.hijri.day;
  const gregDate = dayData.date.gregorian.date;

  // Update Modal Content
  document.getElementById("modalTitle").textContent =
    `${t("ramadhan")} ${hijriDay} (${gregDate})`;
  document.getElementById("modalSuhoor").textContent = formatTimeStr(
    dayData.timings.Fajr,
  );
  document.getElementById("modalIftar").textContent = formatTimeStr(
    dayData.timings.Maghrib,
  );

  // Track button logic
  const existingTrackBtn = document.getElementById("trackBtn");
  if (existingTrackBtn) existingTrackBtn.remove();

  const trackedDays = JSON.parse(
    localStorage.getItem(`ramadanTracker_${assignedHijriYear}`) || "[]",
  );
  const isTracked = trackedDays.includes(hijriDay);

  const trackBtn = document.createElement("button");
  trackBtn.id = "trackBtn";
  trackBtn.className = "control-btn";
  trackBtn.style.marginTop = "15px";
  trackBtn.style.width = "100%";
  trackBtn.style.padding = "10px";
  trackBtn.style.borderRadius = "8px";
  trackBtn.style.background = isTracked
    ? "var(--accent-color)"
    : "rgba(255,255,255,0.1)";
  trackBtn.style.color = "white";
  trackBtn.style.border = "1px solid var(--border-color)";
  trackBtn.innerHTML = isTracked
    ? `<i class="fas fa-check"></i> ${t("fastingCompleted")}`
    : t("markAsCompleted");

  trackBtn.onclick = () => {
    toggleDayTracking(hijriDay, element, trackBtn);
  };

  const modalContent = document.querySelector(".cal-modal-content");
  modalContent.appendChild(trackBtn);

  modal.classList.add("show");
}

function toggleDayTracking(hijriDay, dayElement, btn) {
  let trackedDays = JSON.parse(
    localStorage.getItem(`ramadanTracker_${assignedHijriYear}`) || "[]",
  );
  if (trackedDays.includes(hijriDay)) {
    trackedDays = trackedDays.filter((d) => d !== hijriDay);
    dayElement.classList.remove("completed");
    btn.style.background = "rgba(255,255,255,0.1)";
    btn.innerHTML = t("markAsCompleted");
    analytics.ramadanDayTracked(hijriDay, "unmark"); // ← ANALYTICS
  } else {
    trackedDays.push(hijriDay);
    dayElement.classList.add("completed");
    btn.style.background = "var(--accent-color)";
    btn.innerHTML = `<i class="fas fa-check"></i> ${t("fastingCompleted")}`;
    analytics.ramadanDayTracked(hijriDay, "mark"); // ← ANALYTICS
  }
  localStorage.setItem(
    `ramadanTracker_${assignedHijriYear}`,
    JSON.stringify(trackedDays),
  );
}

// Remove the (EST) part for cleaner display if present
function formatTimeStr(time) {
  return time.split(" ")[0];
}

function initTabs() {
  const tabBtns = document.querySelectorAll(".ramadan-tab");
  const tabContents = document.querySelectorAll(".tab-content");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      // Remove active class from all buttons
      tabBtns.forEach((b) => b.classList.remove("active"));
      // Add active class to clicked button
      btn.classList.add("active");

      // Hide all tab contents
      tabContents.forEach((content) => (content.style.display = "none"));

      // Show selected tab content
      const tabId = btn.getAttribute("data-tab");
      const targetContent = document.getElementById(
        `content${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`,
      );
      if (targetContent) {
        targetContent.style.display = "block";
        analytics.ramadanTabSwitch(tabId); // ← ANALYTICS
      }
    });
  });
}

function renderTable(data) {
  const tableBody = document.querySelector("#ramadanTable tbody");
  if (!tableBody) return;
  tableBody.innerHTML = "";

  const lang = state.settings.language || "en";
  const monthFormatter = new Intl.DateTimeFormat(
    lang === "ar" ? "ar-TN" : lang,
    { month: "short" },
  );

  // Today check for highlighting
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = String(today.getDate()).padStart(2, "0");
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const y = today.getFullYear();
  const todayStr = `${d}-${m}-${y}`;

  data.forEach((dayData) => {
    const hijriDay = dayData.date.hijri.day;
    const gregDateStr = dayData.date.gregorian.date; // DD-MM-YYYY

    // Format date display
    const [gDay, gMonth, gYear] = gregDateStr.split("-").map(Number);
    const jsDate = new Date(gYear, gMonth - 1, gDay);
    let monthName = monthFormatter.format(jsDate).trim();
    if (lang === "ar") {
      monthName = monthName.replace(/[.\s]+$/, "");
    }

    const row = document.createElement("tr");
    if (gregDateStr === todayStr) {
      row.classList.add("current-day-row");
    }

    row.innerHTML = `
            <td>${hijriDay}</td>
            <td>${gDay} ${monthName}</td>
            <td>${formatTimeStr(dayData.timings.Fajr)}</td>
            <td>${formatTimeStr(dayData.timings.Maghrib)}</td>
        `;

    tableBody.appendChild(row);
  });
}

module.exports = { initRamadanPage };
