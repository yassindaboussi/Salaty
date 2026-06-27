"use strict";
// prayer.js — Home page prayer time display.
// Adhan firing is owned by the main process (prayer-timer-manager.js).

const { ipcRenderer } = require("electron");
const {
  translations,
  getLanguage,
  t,
} = require("../../core/i18n/translations");
const { showToast } = require("../../core/toast");
const {
  formatTime,
  getCurrentAndNext,
} = require("../../../../shared/prayerUtils");
const {
  getGregorianDate,
  getHijriDate,
  checkUpcomingEvent,
} = require("../../utils/dateUtils");
const { state, prayerIcons } = require("../../core/globalStore");
const { updateRamadanCountdown } = require("./ramadan");
const screenSizeManager = require("../../core/screenSize");

let prayerData = null;
let currentActivePrayer = null;
let adhanByPrayer = {};

// ── Load ──────────────────────────────────────────────────────────────────────

async function loadPrayerTimes() {
  const locationEl = document.getElementById("location");
  const loadingEl = document.getElementById("loadingText");

  if (!state.settings.city || !state.settings.country) {
    if (locationEl) locationEl.textContent = t("locationNotSet");
    return;
  }

  try {
    const url = `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(state.settings.city)}&country=${encodeURIComponent(state.settings.country)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json?.code !== 200) throw new Error("Invalid API response");

    prayerData = json.data;
    ipcRenderer.send("prayer-data-updated", prayerData);
    _renderPrayerUI();
    updateRamadanCountdown(prayerData);
  } catch (err) {
    console.error("[Prayer] loadPrayerTimes:", err);
    if (locationEl) locationEl.textContent = t("errorLoading");
    showToast(t("errorLoading"), "error");
  }
}

// ── Render ────────────────────────────────────────────────────────────────────

function updatePrayerUI() {
  _renderPrayerUI();
}

function _renderPrayerUI() {

  const lang = getLanguage();
  _setText("location", `${state.settings.city}, ${state.settings.country}`);
  _setText("gregorianDate", getGregorianDate(prayerData));
  _setText("hijriDate", getHijriDate(prayerData, lang, t));

  // Events banner
  const {
    day,
    month: { number: monthNum },
  } = prayerData.date?.hijri ?? {};
  if (day != null) {
    const eventKey = checkUpcomingEvent(day, monthNum, new Date().getDay());
    const banner = document.getElementById("eventsBanner");
    const textEl = document.getElementById("eventText");
    if (banner && textEl) {
      if (eventKey) {
        const ev = t(eventKey, "islamicEvents");
        const isObj = typeof ev === "object" && ev !== null;
        const name = isObj ? ev.event : ev;
        const date = isObj ? ev.date : "";
        const desc = isObj ? ev.description : "";
        const note = isObj ? ev.note : "";
        const prefix = (t("tomorrowIs", "islamicEvents") || "Tomorrow:").split(
          ":",
        )[0];
        let html = `<div class="event-title">${prefix}: ${name}</div>`;
        if (date)
          html += `<div class="event-date"><i class="far fa-calendar-alt"></i> ${date}</div>`;
        if (desc) html += `<div class="event-desc">${desc}</div>`;
        if (note)
          html += `<div class="event-note"><i class="fas fa-info-circle"></i> ${note}</div>`;
        textEl.innerHTML = html;
        banner.style.display = "flex";
        screenSizeManager.setBannerVisible(true);
      } else {
        banner.style.display = "none";
        screenSizeManager.setBannerVisible(false);
      }
    }
  }

  const loadingEl = document.getElementById("loadingText");
  if (loadingEl) loadingEl.style.display = "none";

  // Sync adhan state
  adhanByPrayer = { ...(state.settings.adhanEnabledByPrayer ?? {}) };
  const prayerKeys = Object.keys(translations[lang]?.prayerNames ?? {});
  prayerKeys.forEach((k) => {
    if (adhanByPrayer[k] === undefined) adhanByPrayer[k] = true;
  });

  const listEl = document.getElementById("prayerList");
  if (!listEl) return;

  listEl.innerHTML = prayerKeys
    .map((key) => {
      const name = t(key, "prayerNames");
      const time = prayerData.timings[key];
      const icon = prayerIcons[key] ?? "clock";
      const cur = key === currentActivePrayer;
      const state_ = adhanByPrayer[key] ?? true;
      const [btnIcon, btnTitle] =
        state_ === true
          ? ["volume-up", `${t("soundAdhan")} – ${t("disableAdhan")}`]
          : state_ === "silent"
            ? ["bell", `${t("silentAdhan")} – ${t("disableAdhan")}`]
            : ["volume-mute", `${t("disableAdhan")} – ${t("enableAdhan")}`];
      return `<div class="prayer-item${cur ? " current-prayer" : ""}" data-prayer="${key}">
      <i class="fas fa-${icon}"></i>
      <span class="prayer-name">${name}</span>
      <span class="prayer-time">${time}${cur ? ` <span class="current-indicator">${t("now")}</span>` : ""}</span>
      <button class="adhan-toggle-btn" data-prayer="${key}" title="${btnTitle}">
        <i class="fas fa-${btnIcon} adhan-toggle-icon"></i>
      </button>
    </div>`;
    })
    .join("");

  // Single delegated listener — replace each render to avoid stacking
  listEl.onclick = (e) => {
    const btn = e.target.closest(".adhan-toggle-btn");
    if (btn) _toggleAdhan(btn.dataset.prayer);
  };
}

// ── Countdown (called every second) ──────────────────────────────────────────

function updateCurrentAndNextPrayer() {
  if (!prayerData?.timings) return;
  try {
    const lang = getLanguage();
    const now = new Date();
    const nowSec =
      now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const keys = Object.keys(translations[lang]?.prayerNames ?? {});
    const { currentPrayer, nextPrayer, timeRemaining } = getCurrentAndNext(
      nowSec,
      prayerData.timings,
      keys,
      (k) => t(k, "prayerNames"),
    );

    if (!currentPrayer || !nextPrayer) return;

    const cardsEl = document.getElementById("prayerCards");
    if (cardsEl) {
      if (currentActivePrayer !== currentPrayer.key) {
        // Prayer changed — rebuild the cards
        cardsEl.innerHTML = `
          <div class="prayer-card current">
            <div class="prayer-label">${t("currentPrayer")}</div>
            <div class="prayer-name">${currentPrayer.name}</div>
            <div class="prayer-time">${currentPrayer.time}</div>
            <div class="time-remaining">${t("endTime")} – ${nextPrayer.time}</div>
          </div>
          <div class="prayer-card next">
            <div class="prayer-label">${t("nextPrayer")}</div>
            <div class="prayer-name">${nextPrayer.name}</div>
            <div class="prayer-time">${nextPrayer.time}</div>
            <div class="countdown" id="countdown">${formatTime(timeRemaining)}</div>
          </div>`;
      } else {
        // Only the countdown changes — single textContent update, no DOM churn
        const el = document.getElementById("countdown");
        if (el) el.textContent = formatTime(timeRemaining);
      }
    }

    if (currentActivePrayer !== currentPrayer.key) {
      currentActivePrayer = currentPrayer.key;
      _renderPrayerUI();
    }
  } catch (err) {
    console.error("[Prayer] tick error:", err);
  }
}

// ── Adhan toggle ──────────────────────────────────────────────────────────────

function _toggleAdhan(key) {
  const cur = adhanByPrayer[key];
  adhanByPrayer[key] =
    cur === true || cur === undefined
      ? "silent"
      : cur === "silent"
        ? false
        : true;
  state.settings.adhanEnabledByPrayer = adhanByPrayer;
  ipcRenderer.invoke("save-settings", state.settings);
  _renderPrayerUI();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// Connection recovery — re-fetch on restore.
ipcRenderer.on("connection-restored", () => loadPrayerTimes());

module.exports = {
  loadPrayerTimes,
  updateCurrentAndNextPrayer,
  updatePrayerUI,
  formatTime,
};
