"use strict";

const { setupConnectionRecovery } = require("../services/connection-recovery");
const { state } = require("../core/store");
const { t } = require("../core/i18n");
const analytics = require("../services/analytics");
const { ipcRenderer } = require("electron");
const { cleanTime } = require("../../../shared/prayerUtils");
const { html, setHtml, insertHtml, asButton } = require("../utils/html");
const { byId, query, queryAll } = require("../core/dom");

let ramadanData = [];
/** @type {number | null} */
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
    setHtml(
      modalLabelSuhoor,
      html`<i class="fas fa-utensils" aria-hidden="true"></i> ${t("suhoor")} (${t("Fajr", "prayerNames")})`,
    );

  const modalLabelIftar = document.getElementById("modalLabelIftar");
  if (modalLabelIftar)
    setHtml(
      modalLabelIftar,
      html`<i class="fas fa-glass-water" aria-hidden="true"></i> ${t("iftar")} (${t("Maghrib", "prayerNames")})`,
    );

  fetchRamadanData();
}

async function fetchRamadanData() {
  const { city, country } = state.settings;
  if (!city || !country) {
    setHtml(
      byId("trackerGrid", HTMLElement),
      html`<p class="ramadan-message">${t("locationNotSet")}</p>`,
    );
    return;
  }

  try {
    // From the main process, like the home page and the adhan (same location and method:
    // suhoor ends at Fajr, so this page must never show a different Fajr), and from its disk
    // cache, so the page also works offline.
    const today = await ipcRenderer.invoke("get-prayer-data");
    if (!today?.date)
      throw new Error("no prayer times yet (offline, nothing saved)");

    const currentDate = today.date;
    const currentHijriMonth = currentDate.hijri.month.number;
    let targetHijriYear = parseInt(currentDate.hijri.year);

    if (currentHijriMonth > 9) {
      targetHijriYear++;
    }

    assignedHijriYear = targetHijriYear;
    const titleEl = document.querySelector(".ramadan-title");
    if (titleEl) titleEl.textContent = `${t("ramadhan")} ${assignedHijriYear}`;

    const days = await ipcRenderer.invoke(
      "get-ramadan-calendar",
      targetHijriYear,
    );
    if (!Array.isArray(days))
      throw new Error("no Ramadan calendar (offline, nothing saved)");
    ramadanData = days;
    renderCalendar(ramadanData);
    renderTable(ramadanData);
    updateTodayCard(ramadanData);
  } catch (error) {
    console.error("Error fetching Ramadan data:", error);
    analytics.error("ramadan_fetch", error.message || String(error));
    setHtml(
      byId("trackerGrid", HTMLElement),
      html`<p class="ramadan-message">${t("ramadanError")}</p>`,
    );
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

    insertHtml(
      el,
      "beforeend",
      html`
            <span class="hijri-day">${hijriDay}</span>
            <span class="gregorian-date">${gDay} ${monthName}</span>
        `,
    );

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
      const diffTime = firstDayDate.getTime() - today.getTime();
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

  byId("modalTitle", HTMLElement).textContent =
    `${t("ramadhan")} ${hijriDay} (${gregDate})`;
  byId("modalSuhoor", HTMLElement).textContent = cleanTime(
    dayData.timings.Fajr,
  );
  byId("modalIftar", HTMLElement).textContent = cleanTime(
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
  setHtml(
    trackBtn,
    isTracked
      ? html`<i class="fas fa-check" aria-hidden="true"></i> ${t("fastingCompleted")}`
      : html`${t("markAsCompleted")}`,
  );

  trackBtn.onclick = () => {
    toggleDayTracking(hijriDay, element, trackBtn);
  };

  const modalContent = query(".cal-modal-content", HTMLElement);
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
    setHtml(btn, html`${t("markAsCompleted")}`);
    analytics.ramadanDayTracked(hijriDay, "unmark");
  } else {
    trackedDays.push(hijriDay);
    dayElement.classList.add("completed");
    btn.classList.add("is-tracked");
    setHtml(
      btn,
      html`<i class="fas fa-check" aria-hidden="true"></i> ${t("fastingCompleted")}`,
    );
    analytics.ramadanDayTracked(hijriDay, "mark");
  }
  localStorage.setItem(
    `ramadanTracker_${assignedHijriYear}`,
    JSON.stringify(trackedDays),
  );
}

function initTabs() {
  const tabBtns = document.querySelectorAll(".ramadan-tab");
  const tabContents = queryAll(".tab-content", HTMLElement);

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      tabContents.forEach((content) => (content.style.display = "none"));

      const tabId = btn.getAttribute("data-tab");
      if (tabId === null) return;
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

    setHtml(
      row,
      html`
            <td>${hijriDay}</td>
            <td>${gDay} ${monthName}</td>
            <td>${cleanTime(dayData.timings.Fajr)}</td>
            <td>${cleanTime(dayData.timings.Maghrib)}</td>
        `,
    );

    tableBody.appendChild(row);
  });
}

module.exports = { initRamadanPage };
