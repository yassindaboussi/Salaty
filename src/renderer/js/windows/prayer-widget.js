"use strict";

const { ipcRenderer } = require("electron");
const {
  PRAYER_KEYS,
  cleanTime,
  secondsFromTime,
  secondsSinceMidnight,
  formatTime,
  isFridayIn,
  displayPrayerKey,
} = require("../../../shared/prayerUtils");
const { t } = require("../core/i18n");
const { loadSettings } = require("../core/bootstrap");
const { setThemeClass } = require("../core/theme");
const { escapeHtml } = require("../utils/html");
const { byId } = require("../core/dom");

const PRAYER_ICONS = {
  Fajr: "fa-cloud-moon",
  Dhuhr: "fa-sun",
  Asr: "fa-cloud-sun",
  Maghrib: "fa-cloud",
  Isha: "fa-moon",
};

/** @type {Awaited<ReturnType<typeof loadSettings>> | null} */
let settings = null;
/** @type {any} */
let prayerData = null;
let lang = "en";
/** @type {ReturnType<typeof setInterval> | null} */
let tickTimer = null;
let isPinned = true;

const appEl = byId("app", HTMLElement);
const timerEl = byId("timerDisplay", HTMLElement);
const prayerListEl = byId("prayerList", HTMLElement);
const closeBtnEl = byId("closeBtn", HTMLButtonElement);
const pinBtnEl = byId("pinBtn", HTMLButtonElement);

function applyTheme(theme) {
  if (!theme) return;
  setThemeClass([appEl], theme);
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  document.documentElement.lang = lang;
}

function computePrayers() {
  if (!prayerData?.timings) return null;
  const now = secondsSinceMidnight();
  const prayers = PRAYER_KEYS.map((key) => {
    const raw = prayerData.timings[key];
    if (!raw) return null;
    const sec = secondsFromTime(raw);
    return {
      key,
      time: cleanTime(raw),
      sec,
      wrapped: sec < now ? sec + 86400 : sec,
    };
  })
    .filter((p) => p !== null)
    .sort((a, b) => a.wrapped - b.wrapped);

  if (!prayers.length) return null;
  const nextIdx = prayers.findIndex((p) => p.wrapped > now);
  const nextPrayer = nextIdx >= 0 ? prayers[nextIdx] : prayers[0];
  const activePrayer =
    nextIdx > 0 ? prayers[nextIdx - 1] : prayers[prayers.length - 1];
  return {
    prayers,
    nextPrayer,
    activePrayer,
    timeRemaining: nextPrayer.wrapped - now,
  };
}

function renderList() {
  const result = computePrayers();
  if (!result) {
    prayerListEl.innerHTML =
      '<div class="tb-spin"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i></div>';
    return;
  }
  const { nextPrayer, activePrayer } = result;
  const ordered = PRAYER_KEYS.map((k) =>
    result.prayers.find((p) => p.key === k),
  ).filter((p) => p !== undefined);

  // Tooltip text for each column: the prayer's name in the app language. On Fridays
  // (in the location's own time zone) Dhuhr reads "Jumu'ah", like the rest of the app.
  const isFriday = isFridayIn(prayerData?.meta?.timezone);
  const prayerName = (key) => {
    const shownKey = displayPrayerKey(key, { isFriday });
    return t(shownKey, "prayerNames");
  };

  prayerListEl.innerHTML = ordered
    .map((p) => {
      const isActive = p.key === activePrayer.key;
      const isNext = p.key === nextPrayer.key && !isActive;
      const name = prayerName(p.key);
      return `<div class="tb-col${isActive ? " active" : ""}${isNext ? " next" : ""}" data-tip="${name}" aria-label="${name}">
      <i class="fas ${PRAYER_ICONS[p.key] ?? "fa-clock"} tb-col-icon" aria-hidden="true"></i>
      <span class="tb-col-time">${escapeHtml(p.time)}</span>
      <div class="tb-col-dot"></div>
    </div>`;
    })
    .join("");
}

function tick() {
  const result = computePrayers();
  if (!result) return;
  timerEl.textContent = formatTime(Math.max(0, result.timeRemaining));
  if (result.timeRemaining % 60 === 0) renderList();
}

// Today's times from the main process (saved on disk, so also offline).
async function showPrayerData() {
  try {
    const data = await ipcRenderer.invoke("get-prayer-data");
    if (data?.timings) {
      prayerData = data;
      renderList();
      tick();
      return true;
    }
  } catch (e) {
    console.error("[widget] reading prayer times failed:", e);
  }
  return false;
}

// Starts the slide-in and tells main to show the window (see popup-handlers.js). Called
// once the bar has its theme, direction and times, so it never appears in the wrong
// colours or the wrong direction first.
function reveal() {
  if (appEl.classList.contains("is-shown")) return;
  appEl.classList.add("is-shown");
  ipcRenderer.send("prayer-widget-ready");
}

pinBtnEl.addEventListener("click", () => {
  isPinned = !isPinned;
  ipcRenderer.send("widget-set-always-on-top", isPinned);
  pinBtnEl.classList.toggle("pinned", isPinned);
});

closeBtnEl.addEventListener("click", () => {
  appEl.classList.add("closing");
  setTimeout(() => ipcRenderer.send("close-prayer-widget"), 230);
});

ipcRenderer.on("theme-changed", (_e, theme) => applyTheme(theme));

ipcRenderer.on("prayer-data-from-main", (_e, data) => {
  if (data?.timings) {
    prayerData = data;
    renderList();
    tick();
  }
});

function initWidgetTooltips() {
  document.querySelectorAll("[data-tooltip]").forEach((el) => {
    const key = el.getAttribute("data-tooltip");
    el.setAttribute("data-tip", t(key));
  });

  let tip = document.getElementById("appTooltip");
  if (!tip) {
    tip = document.createElement("div");
    tip.id = "appTooltip";
    tip.style.cssText = [
      "position:fixed",
      "z-index:99999",
      "pointer-events:none",
      "opacity:0",
      "transition:opacity 0.15s ease,transform 0.15s ease",
      "transform:translateY(-50%) scale(0.85)",
      "background:rgba(10,15,35,0.92)",
      "backdrop-filter:blur(8px)",
      "-webkit-backdrop-filter:blur(8px)",
      "color:#fff",
      "font-size:11px",
      "font-weight:600",
      "letter-spacing:0.03em",
      "white-space:nowrap",
      "padding:5px 10px",
      "border-radius:7px",
      "border:1px solid rgba(255,255,255,0.1)",
      "box-shadow:0 4px 16px rgba(0,0,0,0.4)",
    ].join(";");
    document.body.appendChild(tip);
  }

  // Horizontal edges of what the user actually sees under the pointer. A plain prayer column
  // is wider than its centred icon + time, so measuring the column itself would leave a
  // bigger gap than on the pin/close buttons; highlighted columns (active/next) show their
  // whole pill, and buttons are only as wide as they look.
  function visibleEdges(el) {
    const plainCol =
      el.classList.contains("tb-col") &&
      !el.classList.contains("active") &&
      !el.classList.contains("next");
    if (plainCol) {
      const parts = [...el.querySelectorAll(".tb-col-icon, .tb-col-time")]
        .map((n) => n.getBoundingClientRect())
        .filter((p) => p.width > 0);
      if (parts.length) {
        return {
          left: Math.min(...parts.map((p) => p.left)),
          right: Math.max(...parts.map((p) => p.right)),
        };
      }
    }
    return el.getBoundingClientRect();
  }

  const show = (el) => {
    const text = el.getAttribute("data-tip");
    if (!text) return;
    tip.textContent = text;
    tip.style.visibility = "hidden";
    tip.style.opacity = "1";
    const tipW = tip.offsetWidth;
    const r = el.getBoundingClientRect();
    const edges = visibleEdges(el);
    tip.style.visibility = "";
    const isRTL = document.documentElement.dir === "rtl";
    // The widget is a 36px-high bar, so the tip goes beside the element, never above or
    // below, at the same 8px gap for every element. Keep it inside the bar: flip sides when
    // the preferred side has no room (e.g. the first prayer column is next to the edge).
    const gap = 8;
    const pad = 4;
    const leftSide = edges.left - tipW - gap;
    const rightSide = edges.right + gap;
    let x = isRTL ? rightSide : leftSide;
    if (x < pad) x = rightSide;
    if (x + tipW > window.innerWidth - pad) x = Math.max(pad, leftSide);
    tip.style.left = `${x}px`;
    tip.style.top = `${r.top + r.height / 2}px`;
    tip.style.transform = "translateY(-50%) scale(1)";
    tip.style.opacity = "1";
  };
  const hide = () => {
    tip.style.opacity = "0";
    tip.style.transform = "translateY(-50%) scale(0.85)";
  };

  document.querySelectorAll("[data-tip]").forEach((el) => {
    el.addEventListener("mouseenter", () => show(el));
    el.addEventListener("mouseleave", hide);
    el.addEventListener("click", hide);
  });

  // Prayer columns are re-rendered every minute (renderList), so they can't keep their own
  // listeners; one delegated listener on the list covers whatever columns exist now.
  prayerListEl.addEventListener("mouseover", (e) => {
    if (!(e.target instanceof Element)) return;
    const col = e.target.closest(".tb-col[data-tip]");
    if (col) show(col);
  });
  prayerListEl.addEventListener("mouseout", (e) => {
    const to = e.relatedTarget;
    if (
      !(to instanceof Element) ||
      !prayerListEl.contains(to) ||
      !to.closest(".tb-col[data-tip]")
    )
      hide();
  });
}

async function init() {
  try {
    settings = await loadSettings();
    lang = settings.language || "en";
    applyTheme(settings.theme || "navy");
    initWidgetTooltips();

    // Main usually has today's times already (a few ms). On a first run it may still be
    // downloading them: show the bar with its spinner meanwhile, the times fill in after.
    const times = showPrayerData();
    await Promise.race([times, new Promise((r) => setTimeout(r, 300))]);
    reveal();
    await times;

    if (tickTimer) clearInterval(tickTimer);
    tickTimer = setInterval(tick, 1000);
  } catch (e) {
    console.error("[widget] init error:", e);
  } finally {
    reveal(); // even after an error: never leave an open but invisible widget
  }
}

document.addEventListener("DOMContentLoaded", init);
