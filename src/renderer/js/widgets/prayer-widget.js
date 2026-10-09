"use strict";

const { ipcRenderer } = require("electron");
const {
  secondsFromTime,
  isFridayIn,
  displayPrayerKey,
} = require("../../../shared/prayerUtils");
const { ALADHAN_API, locationQuery } = require("../../../shared/aladhan");
const { t, setLanguage, whenReady } = require("../../js/core/i18n/translations");

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

let settings = null;
let prayerData = null;
let lang = "en";
let tickTimer = null;
let fetchTimer = null;
let isPinned = true;

const appEl = document.getElementById("app");
const timerEl = document.getElementById("timerDisplay");
const prayerListEl = document.getElementById("prayerList");
const closeBtnEl = document.getElementById("closeBtn");
const pinBtnEl = document.getElementById("pinBtn");

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

function applyTheme(theme) {
  if (!theme) return;
  appEl.classList.remove(...THEME_CLASSES);
  appEl.classList.add(`theme-${theme}`);
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  document.documentElement.lang = lang;
}

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

  // Tooltip text for each column: the prayer's name in the app language. On Fridays
  // (in the location's own time zone) Dhuhr reads "Jumu'ah", like the rest of the app.
  const isFriday = isFridayIn(prayerData?.meta?.timezone);
  const prayerName = (key) => {
    const shownKey = displayPrayerKey(key, { isFriday });
    return t(shownKey, "prayerNames") || shownKey;
  };

  prayerListEl.innerHTML = ordered
    .map((p) => {
      const isActive = p.key === activePrayer.key;
      const isNext = p.key === nextPrayer.key && !isActive;
      const name = prayerName(p.key);
      return `<div class="tb-col${isActive ? " active" : ""}${isNext ? " next" : ""}" data-tip="${name}" aria-label="${name}">
      <i class="fas ${PRAYER_ICONS[p.key] ?? "fa-clock"} tb-col-icon"></i>
      <span class="tb-col-time">${p.time}</span>
      <div class="tb-col-dot"></div>
    </div>`;
    })
    .join("");
}

function tick() {
  const result = computePrayers();
  if (!result) return;
  timerEl.textContent = formatCountdown(result.timeRemaining);
  if (result.timeRemaining % 60 === 0) renderList();
}

async function loadPrayerData() {
  try {
    const cached = await ipcRenderer.invoke("get-prayer-data");
    if (cached?.timings) {
      prayerData = cached;
      renderList();
      tick();
      return;
    }
  } catch (e) {
    console.error("Error reading cached prayer data:", e);
  }

  await fetchPrayerData();
}

async function fetchPrayerData() {
  // Re-read settings so the hourly refresh uses the current city and calculation method,
  // not the ones from when the widget opened.
  try {
    settings = (await ipcRenderer.invoke("get-settings")) || settings;
  } catch {
    /* keep the settings we have */
  }
  if (!settings?.city || !settings?.country) return;
  try {
    const url = `${ALADHAN_API}/timingsByCity?${locationQuery(settings)}`;
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
    el.setAttribute("data-tip", t(key) || key);
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

  function show(el) {
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
    tip.style.left = x + "px";
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

  // Prayer columns are re-rendered every minute (renderList), so they can't keep their own
  // listeners; one delegated listener on the list covers whatever columns exist now.
  prayerListEl.addEventListener("mouseover", (e) => {
    const col = e.target.closest(".tb-col[data-tip]");
    if (col) show(col);
  });
  prayerListEl.addEventListener("mouseout", (e) => {
    const to = e.relatedTarget;
    if (!to || !prayerListEl.contains(to) || !to.closest(".tb-col[data-tip]")) hide();
  });
}

async function init() {
  try {
    await whenReady();
    settings = await ipcRenderer.invoke("get-settings");
    if (settings) {
      lang = settings.language || "en";
      setLanguage(lang);
      applyTheme(settings.theme || "navy");
    }
    initWidgetTooltips();

    await loadPrayerData();

    if (tickTimer) clearInterval(tickTimer);
    if (fetchTimer) clearInterval(fetchTimer);
    tickTimer = setInterval(tick, 1000);
    fetchTimer = setInterval(fetchPrayerData, 3_600_000);
  } catch (e) {
    console.error("[widget] init error:", e);
  }
}

document.addEventListener("DOMContentLoaded", init);
