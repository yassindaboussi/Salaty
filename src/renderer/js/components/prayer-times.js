"use strict";

const { ipcRenderer } = require("electron");
const { t } = require("../core/i18n");
const { showToast } = require("../core/toast");
const {
  PRAYER_KEYS,
  formatTime,
  secondsSinceMidnight,
  getCurrentAndNext,
  isFridayIn,
  displayPrayerKey,
} = require("../../../shared/prayerUtils");
const {
  getGregorianDate,
  getHijriDate,
  checkUpcomingEvent,
} = require("../core/dates");
const { state, prayerIcons } = require("../core/store");
const { updateRamadanCountdown } = require("./ramadan-countdown");
const screenSizeManager = require("../core/screen-size");
const { escapeHtml } = require("../utils/html");

/** @type {any} */
let prayerData = null;
let currentActivePrayer = null;
let adhanByPrayer = {};

async function loadPrayerTimes() {
  const locationEl = document.getElementById("location");

  if (!state.settings.city || !state.settings.country) {
    if (locationEl) locationEl.textContent = t("locationNotSet");
    return;
  }

  try {
    // from the main process, which keeps them on disk (works offline, same data as the adhan)
    const data = await ipcRenderer.invoke("get-prayer-data");
    if (!data?.timings)
      throw new Error("no prayer times yet (offline, nothing saved)");
    showPrayerData(data);
  } catch (err) {
    console.error("[Prayer] loadPrayerTimes:", err);
    if (locationEl) locationEl.textContent = t("errorLoading");
    showToast(t("errorLoading"), "error");
  }
}

function showPrayerData(data) {
  prayerData = data;
  _renderPrayerUI();
  updateRamadanCountdown(prayerData);
}

// Main sends new times by itself: a new day, another location, back online.
ipcRenderer.on("prayer-data-from-main", (_e, data) => {
  if (data?.timings) showPrayerData(data);
});

// Name shown for a prayer. On Fridays (in the prayer location's own time zone) Dhuhr reads
// "Jumu'ah". Only the label changes: timings and the per-prayer adhan settings stay keyed by
// the original key ("Dhuhr").
function prayerDisplayName(key) {
  const shownKey = displayPrayerKey(key, {
    isFriday: isFridayIn(prayerData?.meta?.timezone),
  });
  return t(shownKey, "prayerNames");
}

function _renderPrayerUI() {
  _setText("location", `${state.settings.city}, ${state.settings.country}`);
  _setText("gregorianDate", getGregorianDate(prayerData));
  _setText("hijriDate", getHijriDate(prayerData));

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
        const prefix = t("tomorrowIs", "islamicEvents").split(":")[0];
        let html = `<div class="event-title">${prefix}: ${name}</div>`;
        if (date)
          html += `<div class="event-date"><i class="far fa-calendar-alt" aria-hidden="true"></i> ${date}</div>`;
        if (desc) html += `<div class="event-desc">${desc}</div>`;
        if (note)
          html += `<div class="event-note"><i class="fas fa-info-circle" aria-hidden="true"></i> ${note}</div>`;
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

  adhanByPrayer = { ...(state.settings.adhanEnabledByPrayer ?? {}) };
  // The five daily prayers. (Not the translation keys: prayerNames also holds the
  // "Jumuah" label, which is a name for Friday's Dhuhr, not a sixth prayer.)
  const prayerKeys = PRAYER_KEYS;
  prayerKeys.forEach((k) => {
    if (adhanByPrayer[k] === undefined) adhanByPrayer[k] = true;
  });

  const listEl = document.getElementById("prayerList");
  if (!listEl) return;

  listEl.innerHTML = prayerKeys
    .map((key) => {
      const name = prayerDisplayName(key);
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
      <i class="fas fa-${icon}" aria-hidden="true"></i>
      <span class="prayer-name">${name}</span>
      <span class="prayer-time">${escapeHtml(time)}${cur ? ` <span class="current-indicator">${t("now")}</span>` : ""}</span>
      <button type="button" class="adhan-toggle-btn" data-prayer="${key}" title="${btnTitle}">
        <i class="fas fa-${btnIcon} adhan-toggle-icon" aria-hidden="true"></i>
      </button>
    </div>`;
    })
    .join("");

  listEl.onclick = (e) => {
    if (!(e.target instanceof Element)) return;
    const btn = e.target.closest(".adhan-toggle-btn");
    if (btn instanceof HTMLElement) _toggleAdhan(btn.dataset.prayer);
  };
}

function updateCurrentAndNextPrayer() {
  if (!prayerData?.timings) return;
  try {
    const nowSec = secondsSinceMidnight();
    const { currentPrayer, nextPrayer, timeRemaining } = getCurrentAndNext(
      nowSec,
      prayerData.timings,
      PRAYER_KEYS,
      prayerDisplayName,
    );

    if (!currentPrayer || !nextPrayer) return;

    const cardsEl = document.getElementById("prayerCards");
    if (cardsEl) {
      if (currentActivePrayer !== currentPrayer.key) {
        cardsEl.innerHTML = `
          <div class="prayer-card current">
            <div class="prayer-label">${t("currentPrayer")}</div>
            <div class="prayer-name">${currentPrayer.name}</div>
            <div class="prayer-time">${escapeHtml(currentPrayer.time)}</div>
            <div class="time-remaining">${t("endTime")} – ${escapeHtml(nextPrayer.time)}</div>
          </div>
          <div class="prayer-card next">
            <div class="prayer-label">${t("nextPrayer")}</div>
            <div class="prayer-name">${nextPrayer.name}</div>
            <div class="prayer-time">${escapeHtml(nextPrayer.time)}</div>
            <div class="countdown" id="countdown">${formatTime(timeRemaining)}</div>
          </div>`;
      } else {
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

function _toggleAdhan(key) {
  const cur = adhanByPrayer[key];
  adhanByPrayer[key] =
    cur === true || cur === undefined ? "silent" : cur !== "silent";
  state.settings.adhanEnabledByPrayer = adhanByPrayer;
  ipcRenderer.invoke("save-settings", state.settings);
  _renderPrayerUI();
}

function _setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

module.exports = {
  loadPrayerTimes,
  updateCurrentAndNextPrayer,
};
