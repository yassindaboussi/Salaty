"use strict";

const { setupConnectionRecovery } = require("../services/connection-recovery");
const { state } = require("../core/store");
const { t } = require("../core/i18n");
const analytics = require("../services/analytics");
const { ALADHAN_API, locationQuery } = require("../../../shared/aladhan");
const { cleanTime } = require("../../../shared/prayerUtils");
const { escapeHtml, asButton } = require("../utils/html");

let ramadanData = [];
let assignedHijriYear = null;

function initRamadanPage() {
  // Only the timings come from the network; re-running the whole init would add every
  // listener again.
  setupConnectionRecovery(fetchRamadanData, "Ramadan");

  const modalClose = document.getElementById("modalClose");
  const modal = document.getElementById("dayModal");
  if (modalClose && modal) {
    modalClose.addEventListener("click", () => modal.classList.remove("show"));
    // A click on the dimmed backdrop (the overlay itself, not its content) closes it.
    modal.addEventListener("click", (event) => {
      if (event.target === modal) modal.classList.remove("show");
    });
  }

  initTabs();

  const modalLabelSuhoor = document.getElementById("modalLabelSuhoor");
  if (modalLabelSuhoor)
    modalLabelSuhoor.innerHTML = `<i class="fas fa-utensils" aria-hidden="true"></i> ${t("suhoor")} (${t("Fajr", "prayerNames")})`;

  const modalLabelIftar = document.getElementById("modalLabelIftar");
  if (modalLabelIftar)
    modalLabelIftar.innerHTML = `<i class="fas fa-glass-water" aria-hidden="true"></i> ${t("iftar")} (${t("Maghrib", "prayerNames")})`;

  fetchRamadanData();
}

async function fetchRamadanData() {
  const { city, country } = state.settings;
  if (!city || !country) {
    document.getElementById("trackerGrid").innerHTML =
      `<p class="ramadan-message">${t("locationNotSet")}</p>`;
    return;
  }

  try {
    // Same location/method query as the home page and the adhan: suhoor ends at Fajr, so the
    // Ramadan page must never show a different Fajr than the one the adhan is played for.
    const query = locationQuery(state.settings);
    const todayUrl = `${ALADHAN_API}/timingsByCity?${query}`;

    const todayRes = await fetch(todayUrl);
    const todayData = await todayRes.json();

    if (!todayData || !todayData.data)
      throw new Error("Could not fetch today's data");

    const currentDate = todayData.data.date;
    const currentHijriMonth = currentDate.hijri.month.number;
    let targetHijriYear = parseInt(currentDate.hijri.year);

    if (currentHijriMonth > 9) {
      targetHijriYear++;
    }

    assignedHijriYear = targetHijriYear;
    const titleEl = document.querySelector(".ramadan-title");
    if (titleEl) titleEl.textContent = `${t("ramadhan")} ${assignedHijriYear}`;

    const ramadanUrl = `${ALADHAN_API}/hijriCalendarByCity/${targetHijriYear}/9?${query}`;

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
    analytics.error("ramadan_fetch", error.message || String(error));
    document.getElementById("trackerGrid").innerHTML =
      `<p class="ramadan-message">${t("ramadanError")}</p>`;
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

  data.forEach((dayData) => {
    const hijriDay = dayData.date.hijri.day;
    const gregorianDate = dayData.date.gregorian.date;
    const [gDay, gMonth, gYear] = gregorianDate.split("-").map(Number);

    const jsDate = new Date(gYear, gMonth - 1, gDay);
    let monthName = monthFormatter.format(jsDate).trim();

    if (lang === "ar") {
      monthName = monthName.replace(/[.\s]+$/, "");
    }

    const el = asButton(document.createElement("div"));
    el.className = "day-tracker";

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

    if (trackedDays.includes(hijriDay)) {
      el.classList.add("completed");
    }

    el.innerHTML += `
            <span class="hijri-day">${escapeHtml(hijriDay)}</span>
            <span class="gregorian-date">${gDay} ${monthName}</span>
        `;

    el.addEventListener("click", () => openDayModal(dayData, el));

    grid.appendChild(el);
  });
}

function updateTodayCard(data) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const d = String(today.getDate()).padStart(2, "0");
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const y = today.getFullYear();
  const todayStr = `${d}-${m}-${y}`;

  const todayData = data.find((item) => item.date.gregorian.date === todayStr);

  const suhoorEl = document.getElementById("todaySuhoor");
  const iftarEl = document.getElementById("todayIftar");
  const cardTitle = document.querySelector("#todayCard h3");

  if (todayData) {
    if (suhoorEl) suhoorEl.textContent = cleanTime(todayData.timings.Fajr);
    if (iftarEl) iftarEl.textContent = cleanTime(todayData.timings.Maghrib);

    if (cardTitle) {
      cardTitle.textContent = t("ramadanDay").replace(
        "{days}",
        todayData.date.hijri.day,
      );
    }
  } else if (data.length > 0) {
    const firstDayStr = data[0].date.gregorian.date;
    const [fd, fm, fy] = firstDayStr.split("-");
    const firstDayDate = new Date(fy, fm - 1, fd);
    firstDayDate.setHours(0, 0, 0, 0);

    if (today < firstDayDate) {
      const diffTime = firstDayDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (cardTitle)
        cardTitle.textContent = t("daysUntilRamadan").replace(
          "{days}",
          diffDays,
        );

      if (suhoorEl) suhoorEl.textContent = cleanTime(data[0].timings.Fajr);
      if (iftarEl) iftarEl.textContent = cleanTime(data[0].timings.Maghrib);
    } else {
      if (cardTitle) cardTitle.textContent = t("ramadanEnded");
      if (suhoorEl) suhoorEl.textContent = "--:--";
      if (iftarEl) iftarEl.textContent = "--:--";
    }
  } else {
    if (suhoorEl) suhoorEl.textContent = "--:--";
    if (iftarEl) iftarEl.textContent = "--:--";
  }
}

function openDayModal(dayData, element) {
  const modal = document.getElementById("dayModal");
  if (!modal) return;

  const hijriDay = dayData.date.hijri.day;
  const gregDate = dayData.date.gregorian.date;

  document.getElementById("modalTitle").textContent =
    `${t("ramadhan")} ${hijriDay} (${gregDate})`;
  document.getElementById("modalSuhoor").textContent = cleanTime(
    dayData.timings.Fajr,
  );
  document.getElementById("modalIftar").textContent = cleanTime(
    dayData.timings.Maghrib,
  );

  const existingTrackBtn = document.getElementById("trackBtn");
  if (existingTrackBtn) existingTrackBtn.remove();

  const trackedDays = JSON.parse(
    localStorage.getItem(`ramadanTracker_${assignedHijriYear}`) || "[]",
  );
  const isTracked = trackedDays.includes(hijriDay);

  const trackBtn = document.createElement("button");
  trackBtn.type = "button";
  trackBtn.id = "trackBtn";
  trackBtn.className = "control-btn ramadan-track-btn";
  trackBtn.classList.toggle("is-tracked", isTracked);
  trackBtn.innerHTML = isTracked
    ? `<i class="fas fa-check" aria-hidden="true"></i> ${t("fastingCompleted")}`
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
    btn.classList.remove("is-tracked");
    btn.innerHTML = t("markAsCompleted");
    analytics.ramadanDayTracked(hijriDay, "unmark");
  } else {
    trackedDays.push(hijriDay);
    dayElement.classList.add("completed");
    btn.classList.add("is-tracked");
    btn.innerHTML = `<i class="fas fa-check" aria-hidden="true"></i> ${t("fastingCompleted")}`;
    analytics.ramadanDayTracked(hijriDay, "mark");
  }
  localStorage.setItem(
    `ramadanTracker_${assignedHijriYear}`,
    JSON.stringify(trackedDays),
  );
}

function initTabs() {
  const tabBtns = document.querySelectorAll(".ramadan-tab");
  const tabContents = document.querySelectorAll(".tab-content");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      tabContents.forEach((content) => (content.style.display = "none"));

      const tabId = btn.getAttribute("data-tab");
      const targetContent = document.getElementById(
        `content${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`,
      );
      if (targetContent) {
        targetContent.style.display = "block";
        analytics.ramadanTabSwitch(tabId);
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = String(today.getDate()).padStart(2, "0");
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const y = today.getFullYear();
  const todayStr = `${d}-${m}-${y}`;

  data.forEach((dayData) => {
    const hijriDay = dayData.date.hijri.day;
    const gregDateStr = dayData.date.gregorian.date;

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
            <td>${escapeHtml(hijriDay)}</td>
            <td>${gDay} ${monthName}</td>
            <td>${escapeHtml(cleanTime(dayData.timings.Fajr))}</td>
            <td>${escapeHtml(cleanTime(dayData.timings.Maghrib))}</td>
        `;

    tableBody.appendChild(row);
  });
}

module.exports = { initRamadanPage };
