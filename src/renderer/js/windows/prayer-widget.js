"use strict";

require("../core/error-watch"); // first: errors while the page starts are logged too
const { ipcRenderer } = require("electron");
const {
  PRAYER_KEYS,
  secondsFromTime,
  secondsSinceMidnight,
  isFridayIn,
  displayPrayerKey,
  shownTimeKeys,
  isExtraTime,
  displayTime,
} = require("../../../shared/prayerUtils");
const { t } = require("../core/i18n");
const { loadSettings } = require("../core/bootstrap");
const { setThemeClass } = require("../core/theme");
const { duration } = require("../core/date-format");
const { html, setHtml } = require("../utils/html");
const { byId } = require("../core/dom");
const { initWidgetTips } = require("../components/widget-tip");

/** @type {any} */
let prayerData = null;
let lang = "en";
/** Settings → Time format: "24" or "12" */
let timeFormat = "24";
// pinned (always on top) when it opens; "#unpinned" after a reload for a new language
let isPinned = location.hash !== "#unpinned";
/** Settings → Show times: Sunrise, Midnight... as extra columns (main resizes the bar) */
/** @type {Record<string, boolean> | undefined} */
let extraTimes;
/** minute the list was last drawn for, so it is redrawn once a minute */
let drawnMinute = -1;

const appEl = byId("app", HTMLElement);
const nextBlockEl = byId("nextBlock", HTMLElement);
const timerEl = byId("timerDisplay", HTMLElement);
const prayerListEl = byId("prayerList", HTMLElement);
const closeBtnEl = byId("closeBtn", HTMLButtonElement);
const pinBtnEl = byId("pinBtn", HTMLButtonElement);

const SPINNER = html`<li class="pw-spin">
  <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
</li>`;

function applyTheme(theme) {
  if (!theme) return;
  setThemeClass([appEl], theme);
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  document.documentElement.lang = lang;
}

/** "2:14:33", or "14:33" under an hour: short like a clock, no leading zero hour. */
function countdown(total) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// Today's prayers in time order, which one is next, and the seconds until it. After Isha
// the next one is tomorrow's Fajr (same time as today's, close enough for a countdown).
function computePrayers() {
  if (!prayerData?.timings) return null;
  const now = secondsSinceMidnight();
  const prayers = PRAYER_KEYS.filter((k) => prayerData.timings[k]).map(
    (key) => {
      const raw = prayerData.timings[key];
      return {
        key,
        time: displayTime(raw, timeFormat, lang),
        sec: secondsFromTime(raw),
      };
    },
  );
  if (!prayers.length) return null;
  const next = prayers.find((p) => p.sec > now) ?? prayers[0];
  const remaining = (next.sec - now + 86400) % 86400 || 86400;
  // the columns: prayers and extra times. Midnight and the last third can fall after 00:00:
  // they belong to tonight (later than Isha), not to this morning.
  const fajr = prayers[0].sec;
  const columns = shownTimeKeys(extraTimes)
    .filter((k) => prayerData.timings[k])
    .map((key) => {
      const raw = prayerData.timings[key];
      let sec = secondsFromTime(raw);
      if (isExtraTime(key) && key !== "Sunrise" && sec < fajr) sec += 86400;
      return { key, time: displayTime(raw, timeFormat, lang), sec };
    });
  return { prayers, columns, next, remaining, now };
}

function prayerName(key) {
  if (isExtraTime(key)) return t(`widget${key}`);
  const isFriday = isFridayIn(prayerData?.meta?.timezone);
  return t(displayPrayerKey(key, { isFriday }), "prayerNames");
}

function renderList(result) {
  const { columns, next, now } = result;
  setHtml(
    prayerListEl,
    html`${columns.map((p) => {
      const isNext = p.key === next.key;
      const isPast = !isNext && p.sec <= now;
      const extra = isExtraTime(p.key) ? " is-extra" : "";
      const cls = (isNext ? " is-next" : isPast ? " is-past" : "") + extra;
      const name = prayerName(p.key);
      return html`<li class="pw-col${cls}"${isNext ? html` aria-current="time"` : ""}>
        <span class="pw-col-name">${name}</span>
        <span class="pw-col-time">${p.time}</span>
      </li>`;
    })}`,
  );
}

function tick() {
  const result = computePrayers();
  if (!result) {
    setHtml(prayerListEl, SPINNER);
    return;
  }
  timerEl.textContent = countdown(result.remaining);
  const minute = Math.floor(result.now / 60);
  if (minute === drawnMinute) return;
  drawnMinute = minute;
  renderList(result);
  // screen readers: a sentence per minute, not a number changing every second
  const left = Math.ceil(result.remaining / 60);
  const remaining = duration(
    { hours: Math.floor(left / 60), minutes: left % 60 },
    "long",
  );
  nextBlockEl.setAttribute(
    "aria-label",
    t("widgetNextLabel")
      .replace("{prayer}", prayerName(result.next.key))
      .replace("{time}", result.next.time)
      .replace("{remaining}", remaining),
  );
}

function setPrayerData(data) {
  if (!data?.timings) return false;
  prayerData = data;
  drawnMinute = -1;
  tick();
  return true;
}

// Today's times from the main process (saved on disk, so also offline).
async function showPrayerData() {
  try {
    return setPrayerData(await ipcRenderer.invoke("get-prayer-data"));
  } catch (e) {
    console.error("[widget] reading prayer times failed:", e);
    return false;
  }
}

// Starts the fade-in and tells main to show the window (see popup-handlers.js), once the
// bar has its theme, direction and times: it never appears in the wrong colours first.
function reveal() {
  if (appEl.classList.contains("is-shown")) return;
  appEl.classList.add("is-shown");
  ipcRenderer.send("prayer-widget-ready");
}

function showPin() {
  pinBtnEl.classList.toggle("is-pinned", isPinned);
  pinBtnEl.setAttribute("aria-pressed", String(isPinned));
}
showPin();

pinBtnEl.addEventListener("click", () => {
  isPinned = !isPinned;
  ipcRenderer.send("widget-set-always-on-top", isPinned);
  showPin();
});

closeBtnEl.addEventListener("click", () => {
  appEl.classList.add("closing");
  setTimeout(() => ipcRenderer.send("close-prayer-widget"), 200);
});

ipcRenderer.on("theme-changed", (_e, theme) => applyTheme(theme));
ipcRenderer.on("prayer-data-from-main", (_e, data) => setPrayerData(data));
ipcRenderer.on("time-format-changed", (_e, value) => {
  timeFormat = value;
  drawnMinute = -1;
  tick();
});
ipcRenderer.on("extra-times-changed", (_e, value) => {
  extraTimes = value;
  drawnMinute = -1;
  tick();
});

async function init() {
  try {
    const settings = await loadSettings();
    lang = settings.language || "en";
    extraTimes = settings.extraTimes;
    timeFormat = settings.timeFormat ?? "24";
    applyTheme(settings.theme || "navy");
    initWidgetTips();

    // Main usually has today's times already (a few ms). On a first run it may still be
    // downloading them: show the bar with its spinner meanwhile, the times fill in after.
    const times = showPrayerData();
    await Promise.race([times, new Promise((r) => setTimeout(r, 300))]);
    reveal();
    await times;
    setInterval(tick, 1000);
  } catch (e) {
    console.error("[widget] init error:", e);
  } finally {
    reveal(); // even after an error: never leave an open but invisible widget
  }
}

document.addEventListener("DOMContentLoaded", init);
