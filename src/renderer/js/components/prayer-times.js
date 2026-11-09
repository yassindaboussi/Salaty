"use strict";

const { ipcRenderer } = require("electron");
const { t, getLanguage } = require("../core/i18n");
const { showToast } = require("../core/toast");
const {
  PRAYER_KEYS,
  formatTime,
  secondsSinceMidnight,
  getCurrentAndNext,
  isFridayIn,
  displayPrayerKey,
  shownTimeKeys,
  isExtraTime,
} = require("../../../shared/prayerUtils");
const {
  getGregorianDate,
  getHijriDate,
  checkUpcomingEvent,
} = require("../core/dates");
const { state, prayerIcons } = require("../core/store");
const { updateRamadanCountdown } = require("./ramadan-countdown");
const screenSizeManager = require("../core/screen-size");
const { html, setHtml } = require("../utils/html");
const { refreshTooltips } = require("../core/tooltips");

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

// Settings → Show times changed (in the settings page, another window)
ipcRenderer.on("extra-times-changed", (_e, extraTimes) => {
  state.settings.extraTimes = extraTimes;
  if (prayerData?.timings) _renderPrayerUI();
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
        const parts = [html`<div class="event-title">${prefix}: ${name}</div>`];
        if (date)
          parts.push(
            html`<div class="event-date"><i class="far fa-calendar-alt" aria-hidden="true"></i> ${date}</div>`,
          );
        if (desc) parts.push(html`<div class="event-desc">${desc}</div>`);
        if (note)
          parts.push(
            html`<div class="event-note"><i class="fas fa-info-circle" aria-hidden="true"></i> ${note}</div>`,
          );
        setHtml(textEl, html`${parts}`);
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

  setHtml(
    listEl,
    html`${shownTimeKeys(state.settings.extraTimes).map((key) => {
      if (isExtraTime(key)) return _extraRow(key);
      const name = prayerDisplayName(key);
      const time = prayerData.timings[key];
      const icon = prayerIcons[key] ?? "clock";
      const cur = key === currentActivePrayer;
      const state_ = adhanByPrayer[key] ?? true;
      const look =
        ADHAN_LOOK[
          state_ === true ? "sound" : state_ === "silent" ? "silent" : "off"
        ];
      const btnIcon = look.icon;
      // tooltip: the mode now and what a click does; name: which prayer and its mode
      const btnTip = t(look.tip);
      const btnLabel = t(look.label).replace("{prayer}", name);
      return html`<div class="prayer-item${cur ? " current-prayer" : ""}" data-prayer="${key}">
      <i class="fas fa-${icon}" aria-hidden="true"></i>
      <span class="prayer-name">${name}</span>
      <span class="prayer-time">${cur ? html`<span class="current-indicator">${t("now")}</span>` : ""}${time}</span>
      <button type="button" class="adhan-toggle-btn" data-prayer="${key}" aria-label="${btnLabel}" data-tip="${btnTip}">
        <i class="fas fa-${btnIcon} adhan-toggle-icon" aria-hidden="true"></i>
      </button>
    </div>`;
    })}`,
  );

  _renderMethod();

  refreshTooltips(); // binds the app tooltip to the new adhan buttons

  listEl.onclick = (e) => {
    if (!(e.target instanceof Element)) return;
    const btn = e.target.closest(".adhan-toggle-btn");
    if (btn instanceof HTMLElement) _toggleAdhan(btn.dataset.prayer);
  };
}

// Sunrise, Midnight...: a quieter row, no adhan button (an empty box keeps the times aligned)
function _extraRow(key) {
  return html`<div class="prayer-item is-extra" data-prayer="${key}">
      <i class="fas fa-${prayerIcons[key] ?? "clock"}" aria-hidden="true"></i>
      <span class="prayer-name">${t(key, "prayerNames")}</span>
      <span class="prayer-time">${prayerData.timings[key] ?? "--:--"}</span>
      <span class="adhan-toggle-btn is-placeholder" aria-hidden="true"></span>
    </div>`;
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
        setHtml(
          cardsEl,
          html`
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
          </div>`,
        );
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

// The adhan of a prayer: sound → notification only → off → sound (see _toggleAdhan).
const ADHAN_LOOK = {
  sound: { icon: "volume-up", tip: "adhanTipSound", label: "adhanLabelSound" },
  silent: { icon: "bell", tip: "adhanTipSilent", label: "adhanLabelSilent" },
  off: { icon: "volume-mute", tip: "adhanTipOff", label: "adhanLabelOff" },
};

function _toggleAdhan(key) {
  const cur = adhanByPrayer[key];
  adhanByPrayer[key] =
    cur === true || cur === undefined ? "silent" : cur !== "silent";
  state.settings.adhanEnabledByPrayer = adhanByPrayer;
  ipcRenderer.invoke("save-settings", state.settings);
  _renderPrayerUI();
  // the list is drawn again: keep the focus on the same button, its tooltip shows the new mode
  document
    .querySelector(`.adhan-toggle-btn[data-prayer="${key}"]`)
    ?.closest("button")
    ?.focus();
}

// The calculation method of today's times, in the UI language (Aladhan's own name for a
// method newer than the app), under the list. Same names as the monthly times page.
function _renderMethod() {
  const box = document.getElementById("prayerMethodBox");
  const nameEl = document.getElementById("prayerMethod");
  if (!box || !nameEl) return;
  const method = prayerData?.meta?.method;
  const key = `mpMethod${method?.id}`;
  const name = !method?.name ? "" : t(key) === key ? method.name : t(key);
  // and the Asr rule, from the same data (Settings → Asr time)
  const hanafi =
    String(prayerData?.meta?.school ?? "").toUpperCase() === "HANAFI";
  const asr = t(hanafi ? "calcAsrLineHanafi" : "calcAsrLineStandard");
  const sep = getLanguage() === "ar" ? "، " : " · ";
  nameEl.textContent = name ? `${name}${sep}${asr}` : "";
  box.hidden = !name;
}

function _setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

module.exports = {
  loadPrayerTimes,
  updateCurrentAndNextPrayer,
};
