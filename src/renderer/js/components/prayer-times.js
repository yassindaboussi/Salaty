"use strict";

const { ipcRenderer } = require("electron");
const { t } = require("../core/i18n");
const { showToast } = require("../core/toast");
const { clock } = require("../core/time-format");
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
const { playShortTone } = require("./adhan-player");
const screenSizeManager = require("../core/screen-size");
const { html, setHtml } = require("../utils/html");
const { refreshTooltips } = require("../core/tooltips");
const {
  AFTER_SUNRISE_SEC,
  BEFORE_DHUHR_SEC,
  prayerPhase,
  nightMiddle,
  shiftTime,
} = require("./prayer-phase");

/** @type {any} */
let prayerData = null;
/** @type {string | null} */
let currentActivePrayer = null;
/** @type {string | null} */
let currentCardKey = null; // the prayer and its phase (see prayer-phase.js): the cards are drawn again when it changes
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

// Settings → Time format changed: 24-hour or 12-hour
ipcRenderer.on("time-format-changed", (_e, timeFormat) => {
  state.settings.timeFormat = timeFormat;
  if (!prayerData?.timings) return;
  currentActivePrayer = null; // the current / next cards are drawn again too
  currentCardKey = null;
  _renderPrayerUI();
  updateCurrentAndNextPrayer();
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
      const look = ADHAN_LOOK[_lookOf(state_)];
      const btnIcon = look.icon;
      // tooltip: the mode now and what a click does; name: which prayer and its mode
      const btnTip = t(look.tip);
      const btnLabel = t(look.label).replace("{prayer}", name);
      return html`<div class="prayer-item${cur ? " current-prayer" : ""}" data-prayer="${key}">
      <i class="fas fa-${icon}" aria-hidden="true"></i>
      <span class="prayer-name">${name}</span>
      <span class="prayer-time">${cur ? html`<span class="current-indicator">${t("now")}</span>` : ""}${clock(time)}</span>
      <button type="button" class="adhan-toggle-btn" data-prayer="${key}" aria-label="${btnLabel}" data-tip="${btnTip}">
        <i class="fas fa-${btnIcon} adhan-toggle-icon" aria-hidden="true"></i>
      </button>
    </div>`;
    })}`,
  );

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
      <span class="prayer-time">${clock(prayerData.timings[key])}</span>
      <span class="adhan-toggle-btn is-placeholder" aria-hidden="true"></span>
    </div>`;
}

/** The "current prayer" card: the prayer and when its time ends (see prayer-phase.js). */
function _currentCard(currentPrayer, nextPrayer, phase) {
  const tm = prayerData.timings;
  // sunrise to Dhuhr: no prayer is due; what this part of the morning is
  const morning = {
    sunrise: [
      t("Sunrise", "prayerNames"),
      tm.Sunrise,
      `${t("duhaFrom")} – ${clock(shiftTime(tm.Sunrise, AFTER_SUNRISE_SEC))}`,
    ],
    duha: [
      t("duhaTime"),
      shiftTime(tm.Sunrise, AFTER_SUNRISE_SEC),
      `${t("until")} – ${clock(shiftTime(tm.Dhuhr, -BEFORE_DHUHR_SEC))}`,
    ],
    zawal: [
      t("beforeDhuhr"),
      shiftTime(tm.Dhuhr, -BEFORE_DHUHR_SEC),
      t("noNaflNow"),
    ],
  }[phase];
  if (morning)
    return html`<div class="prayer-card current">
            <div class="prayer-label">${t("now")}</div>
            <div class="prayer-name">${morning[0]}</div>
            <div class="prayer-time">${clock(morning[1])}</div>
            <div class="time-remaining">${morning[2]}</div>
          </div>`;
  let end = `${t("endTime")} – ${clock(nextPrayer.time)}`;
  if (currentPrayer.key === "Fajr" && tm.Sunrise)
    end = `${t("endTime")} – ${clock(tm.Sunrise)}`;
  else if (
    currentPrayer.key === "Isha" &&
    nightMiddle(tm) &&
    phase !== "ishaLate"
  )
    end = `${t("bestBefore")} – ${clock(nightMiddle(tm))}`;
  return html`<div class="prayer-card current">
            <div class="prayer-label">${t("currentPrayer")}</div>
            <div class="prayer-name">${currentPrayer.name}</div>
            <div class="prayer-time">${clock(currentPrayer.time)}</div>
            <div class="time-remaining">${end}</div>
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

    const phase = prayerPhase(currentPrayer.key, nowSec, prayerData.timings);
    // after sunrise no prayer is due until Dhuhr: no row is "Now"
    const activeKey =
      currentPrayer.key === "Fajr" && phase ? "" : currentPrayer.key;
    const cardKey = `${currentPrayer.key}:${phase}`;

    const cardsEl = document.getElementById("prayerCards");
    if (cardsEl) {
      if (currentCardKey !== cardKey) {
        currentCardKey = cardKey;
        setHtml(
          cardsEl,
          html`
          ${_currentCard(currentPrayer, nextPrayer, phase)}
          <div class="prayer-card next">
            <div class="prayer-label">${t("nextPrayer")}</div>
            <div class="prayer-name">${nextPrayer.name}</div>
            <div class="prayer-time">${clock(nextPrayer.time)}</div>
            <div class="countdown" id="countdown">${formatTime(timeRemaining)}</div>
          </div>`,
        );
      } else {
        const el = document.getElementById("countdown");
        if (el) el.textContent = formatTime(timeRemaining);
      }
    }

    if (currentActivePrayer !== activeKey) {
      currentActivePrayer = activeKey;
      _renderPrayerUI();
    }
  } catch (err) {
    console.error("[Prayer] tick error:", err);
  }
}

// The adhan of a prayer: sound → short tone → notification only → off → sound.
const ADHAN_LOOK = {
  sound: { icon: "volume-up", tip: "adhanTipSound", label: "adhanLabelSound" },
  tone: { icon: "volume-down", tip: "adhanTipTone", label: "adhanLabelTone" },
  silent: { icon: "bell", tip: "adhanTipSilent", label: "adhanLabelSilent" },
  off: { icon: "volume-mute", tip: "adhanTipOff", label: "adhanLabelOff" },
};

/** @param {boolean | "silent" | "tone" | undefined} mode */
const _lookOf = (mode) =>
  mode === true || mode === undefined
    ? "sound"
    : mode === "tone" || mode === "silent"
      ? mode
      : "off";

/** @type {Record<string, boolean | "silent" | "tone">} */
const NEXT_MODE = { sound: "tone", tone: "silent", silent: false, off: true };

function _toggleAdhan(key) {
  adhanByPrayer[key] = NEXT_MODE[_lookOf(adhanByPrayer[key])];
  if (adhanByPrayer[key] === "tone") playShortTone(); // let the user hear it
  state.settings.adhanEnabledByPrayer = adhanByPrayer;
  ipcRenderer.invoke("save-settings", state.settings);
  _renderPrayerUI();
  // the list is drawn again: keep the focus on the same button, its tooltip shows the new mode
  document
    .querySelector(`.adhan-toggle-btn[data-prayer="${key}"]`)
    ?.closest("button")
    ?.focus();
}

function _setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

module.exports = {
  loadPrayerTimes,
  updateCurrentAndNextPrayer,
};
