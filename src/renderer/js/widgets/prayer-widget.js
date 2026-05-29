// src/renderer/js/prayer-widget.js
"use strict";

const { ipcRenderer } = require("electron");
const { secondsFromTime } = require("../../../shared/prayerUtils");
const { t, setLanguage } = require("../../js/core/i18n/translations");

const PRAYER_KEYS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

const PRAYER_ICONS = {
  Fajr: "fa-cloud-moon",
  Dhuhr: "fa-sun",
  Asr: "fa-cloud-sun",
  Maghrib: "fa-cloud",
  Isha: "fa-moon",
};

const THEME_CLASSES = [
  "theme-dark",
  "theme-blue",
  "theme-green",
  "theme-brown",
  "theme-gold",
  "theme-pink",
  "theme-purple",
  "theme-emerald",
  "theme-ocean",
  "theme-royal",
  "theme-indigo",
  "theme-classic",
  "theme-navy",
  "theme-ramadan",
];

/* ── State ── */
let settings = null;
let prayerData = null;
let lang = "en";
let tickTimer = null;
let fetchTimer = null;
let isPinned = true;

/* ── DOM refs ── */
const appEl = document.getElementById("app");
const timerEl = document.getElementById("timerDisplay");
const prayerListEl = document.getElementById("prayerList");
const closeBtnEl = document.getElementById("closeBtn");
const pinBtnEl = document.getElementById("pinBtn");

/* ── Utils ── */
function formatCountdown(s) {
  if (s <= 0) return "00:00:00";
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}

function nowSeconds() {
  const d = new Date();
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
}

/* ── Theme ── */
function applyTheme(theme) {
  if (!theme) return;
  appEl.classList.remove(...THEME_CLASSES);
  appEl.classList.add(`theme-${theme}`);
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  document.documentElement.lang = lang;
}

/* ── Compute ── */
function computePrayers() {
  if (!prayerData?.timings) return null;
  const now = nowSeconds();
  const prayers = PRAYER_KEYS.map((key) => {
    const raw = prayerData.timings[key];
    if (!raw) return null;
    const sec = secondsFromTime(raw.split(" ")[0]);
    return {
      key,
      time: raw.split(" ")[0],
      sec,
      wrapped: sec < now ? sec + 86400 : sec,
    };
  })
    .filter(Boolean)
    .sort((a, b) => a.wrapped - b.wrapped);

  if (!prayers.length) return null;
  const nextIdx = prayers.findIndex((p) => p.wrapped > now);
  const nextPrayer = nextIdx >= 0 ? prayers[nextIdx] : prayers[0];
  const activePrayer = nextIdx > 0 ? prayers[nextIdx - 1] : prayers.at(-1);
  return {
    prayers,
    nextPrayer,
    activePrayer,
    timeRemaining: nextPrayer.wrapped - now,
  };
}

/* ── Render ── */
function renderList() {
  const result = computePrayers();
  if (!result) {
    prayerListEl.innerHTML =
      '<div class="tb-spin"><i class="fas fa-spinner fa-spin"></i></div>';
    return;
  }
  const { nextPrayer, activePrayer } = result;
  const ordered = PRAYER_KEYS.map((k) =>
    result.prayers.find((p) => p.key === k),
  ).filter(Boolean);

  prayerListEl.innerHTML = ordered
    .map((p) => {
      const isActive = p.key === activePrayer.key;
      const isNext = p.key === nextPrayer.key && !isActive;
      return `<div class="tb-col${isActive ? " active" : ""}${isNext ? " next" : ""}">
      <i class="fas ${PRAYER_ICONS[p.key] ?? "fa-clock"} tb-col-icon"></i>
      <span class="tb-col-time">${p.time}</span>
      <div class="tb-col-dot"></div>
    </div>`;
    })
    .join("");
}

/* ── Tick ── */
function tick() {
  const result = computePrayers();
  if (!result) return;
  timerEl.textContent = formatCountdown(result.timeRemaining);
  if (result.timeRemaining % 60 === 0) renderList();
}

/* ── Data loading — main process first, HTTP fallback ── */
async function loadPrayerData() {
  // FIX: First try to get already-fetched data from the main process.
  // This avoids a duplicate HTTP request and fixes the spinner-forever bug
  // when the widget opens before its own fetch completes or when the API
  // is slow / unreachable.
  try {
    const cached = await ipcRenderer.invoke("get-prayer-data");
    if (cached?.timings) {
      prayerData = cached;
      renderList();
      tick();
      return; // got data — no need for HTTP fetch
    }
  } catch (e) {}

  // Fallback: fetch directly if main process has no data yet (cold start)
  await fetchPrayerData();
}

async function fetchPrayerData() {
  if (!settings?.city || !settings?.country) return;
  try {
    const url = `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(settings.city)}&country=${encodeURIComponent(settings.country)}`;
    const data = await (await fetch(url)).json();
    if (data?.code === 200 && data?.data) {
      prayerData = data.data;
      renderList();
      tick();
    }
  } catch (e) {
    console.error("[widget] HTTP fetch failed:", e);
  }
}

/* ── Controls ── */
pinBtnEl.addEventListener("click", () => {
  isPinned = !isPinned;
  ipcRenderer.send("widget-set-always-on-top", isPinned);
  pinBtnEl.classList.toggle("pinned", isPinned);
});

closeBtnEl.addEventListener("click", () => {
  appEl.classList.add("closing");
  setTimeout(() => ipcRenderer.send("close-prayer-widget"), 230);
});

/* ── IPC ── */
ipcRenderer.on("theme-changed", (_e, theme) => applyTheme(theme));

// FIX: Listen for prayer data pushed from main process (updated every hour
// or on location change) so the widget stays in sync without re-fetching.
ipcRenderer.on("prayer-data-from-main", (_e, data) => {
  if (data?.timings) {
    prayerData = data;
    renderList();
    tick();
  }
});

/* ── Tooltips ── */
function initWidgetTooltips() {
  // Resolve data-tooltip keys using the already-set language
  document.querySelectorAll("[data-tooltip]").forEach((el) => {
    const key = el.getAttribute("data-tooltip");
    el.setAttribute("data-tip", t(key) || key);
  });

  // Single floating tooltip div appended to body (avoids overflow:hidden clipping)
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

  function show(el) {
    const text = el.getAttribute("data-tip");
    if (!text) return;
    tip.textContent = text;
    // Measure width while invisible
    tip.style.visibility = "hidden";
    tip.style.opacity = "1";
    const tipW = tip.offsetWidth;
    const r = el.getBoundingClientRect();
    tip.style.visibility = "";
    const isRTL = document.documentElement.dir === "rtl";
    // LTR → left of button | RTL → right of button (always inside the bar)
    tip.style.left = isRTL ? r.right + 8 + "px" : r.left - tipW - 8 + "px";
    tip.style.top = r.top + r.height / 2 + "px";
    tip.style.transform = "translateY(-50%) scale(1)";
    tip.style.opacity = "1";
  }
  function hide() {
    tip.style.opacity = "0";
    tip.style.transform = "translateY(-50%) scale(0.85)";
  }

  document.querySelectorAll("[data-tip]").forEach((el) => {
    el.addEventListener("mouseenter", () => show(el));
    el.addEventListener("mouseleave", hide);
    el.addEventListener("click", hide);
  });
}

/* ── Init ── */
async function init() {
  try {
    settings = await ipcRenderer.invoke("get-settings");
    if (settings) {
      lang = settings.language || "en";
      setLanguage(lang);
      applyTheme(settings.theme || "navy");
    }
    initWidgetTooltips(); // language is now set — tooltips resolve correctly

    // Load prayer data (from main process cache first, HTTP fallback)
    await loadPrayerData();

    // Start 1-second tick and hourly refresh
    if (tickTimer) clearInterval(tickTimer);
    if (fetchTimer) clearInterval(fetchTimer);
    tickTimer = setInterval(tick, 1000);
    fetchTimer = setInterval(fetchPrayerData, 3_600_000);
  } catch (e) {
    console.error("[widget] init error:", e);
  }
}

document.addEventListener("DOMContentLoaded", init);
