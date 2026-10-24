"use strict";

// The Ramadan page. Its parts:
//   data.js          the Ramadan days and their times (main process, cached; corrected Hijri)
//   (services/ramadan-fasts.js: what was marked, fasted / missed, and the fasts made up since)
//   hero.js          the top card: days until Ramadan, or the live iftar / suhoor countdown
//   tracker.js       the days in three tens (the last ten and its odd nights marked)
//   panel.js         the selected day, the summary, the fasts to make up, Eid al-Fitr
//   timetable.js     Imsak, Fajr, Maghrib and the fast's length for every day
//   state.js         the Ramadan shown and the selected day
const { t } = require("../../core/i18n");
const { state } = require("../../core/store");
const { byId, queryAll } = require("../../core/dom");
const fmt = require("../../core/date-format");
const analytics = require("../../services/analytics");
const {
  setupConnectionRecovery,
} = require("../../services/connection-recovery");
const { view } = require("./state");
const { loadRamadan } = require("./data");
const store = require("../../services/ramadan-fasts");
const hero = require("./hero");
const { renderTracker, showSelection } = require("./tracker");
const { renderPanel, renderDayCard } = require("./panel");
const { renderTimetable, scrollToToday } = require("./timetable");

/** @type {ReturnType<typeof setInterval> | null} */
let ticker = null;

function initRamadanPage() {
  bindTabs();
  bindTracker();
  bindPanel();
  // Only the times come from the network: reload them when the connection is back.
  setupConnectionRecovery(load, "Ramadan");
  load();
}

async function load() {
  const { city, country } = state.settings;
  if (!city || !country) {
    showOnlyMessage(t("locationNotSet"));
    return;
  }
  try {
    const data = await loadRamadan();
    view.year = data.year;
    view.days = data.days;
    view.eidToday = data.eidToday;
  } catch (error) {
    console.error("Error loading Ramadan:", error);
    analytics.error("ramadan_fetch", error.message || String(error));
    showOnlyMessage(t("ramadanError"));
    return;
  }
  const title = document.querySelector(".ramadan-title");
  if (title) title.textContent = `${t("ramadhan")} ${view.year}`;
  view.todayIso = fmt.todayIso();
  // today, or the 1st before Ramadan (its times), or the last day after it
  const today = view.days.find((d) => d.iso === view.todayIso);
  const last = view.days[view.days.length - 1];
  view.selectedDay = today
    ? today.day
    : view.todayIso > last.iso
      ? last.day
      : 1;
  byId("rmLayout", HTMLElement).classList.remove("is-empty");
  renderAll();
  startTicker();
}

function renderAll() {
  hero.render(new Date());
  renderTracker();
  renderPanel();
  renderTimetable();
}

/** @param {string} message */
function showOnlyMessage(message) {
  byId("rmLayout", HTMLElement).classList.add("is-empty");
  hero.renderMessage(message);
}

// Every second: the countdown; a new moment (Fajr, Maghrib, midnight) draws the page again.
function startTicker() {
  if (ticker) clearInterval(ticker);
  ticker = setInterval(() => {
    if (document.hidden || !view.days.length) return;
    const now = new Date();
    if (fmt.isoOf(now) !== view.todayIso) {
      view.todayIso = fmt.isoOf(now);
      renderAll();
    } else if (!hero.tick(now)) {
      hero.render(now);
    }
  }, 1000);
}

/**
 * Selects a Ramadan day.
 * @param {number} day
 * @param {boolean} focus move the keyboard focus to it in the grid
 */
function select(day, focus) {
  if (!view.days.some((d) => d.day === day)) return;
  view.selectedDay = day;
  showSelection(focus);
  renderDayCard();
}

// Keys on the grid (WAI-ARIA grid): arrows move a day / a row (mirrored right to left),
// Home / End go to the first / last day of the row.
/** @param {KeyboardEvent} e */
function onGridKey(e) {
  const rtl = document.documentElement.dir === "rtl";
  const perRow = matchMedia("(width <= 700px)").matches ? 5 : 10;
  const column = (view.selectedDay - 1) % perRow;
  /** @type {Record<string, number>} */
  const moves = {
    ArrowLeft: rtl ? 1 : -1,
    ArrowRight: rtl ? -1 : 1,
    ArrowUp: -perRow,
    ArrowDown: perRow,
    Home: -column,
    End: perRow - 1 - column,
  };
  if (!Object.hasOwn(moves, e.key)) return;
  e.preventDefault();
  const last = view.days[view.days.length - 1].day;
  select(Math.min(last, Math.max(1, view.selectedDay + moves[e.key])), true);
}

function bindTracker() {
  const grid = byId("rmGrid", HTMLElement);
  grid.addEventListener("click", (e) => {
    const button = /** @type {Element} */ (e.target).closest(".rm-day");
    if (button instanceof HTMLElement) select(Number(button.dataset.day), true);
  });
  grid.addEventListener("keydown", onGridKey);
}

function bindPanel() {
  byId("rmPanel", HTMLElement).addEventListener("click", (e) => {
    const button = /** @type {Element} */ (e.target).closest("[data-action]");
    if (!(button instanceof HTMLButtonElement) || button.disabled) return;
    const action = button.dataset.action;
    if (action === "status") {
      const current = store.read(view.year).days[view.selectedDay];
      const chosen = button.dataset.status === "missed" ? "missed" : "fasted";
      // a second click on the chosen one clears the day
      const status = current === chosen ? null : chosen;
      store.setStatus(view.year, view.selectedDay, status);
      analytics.ramadanDayTracked(view.selectedDay, status ?? "clear");
    } else if (action === "made-up" || action === "undo-made-up") {
      store.changeMadeUp(view.year, action === "made-up" ? 1 : -1);
    } else {
      return;
    }
    renderTracker();
    renderPanel();
    // the panel was redrawn: keep the focus on the same button
    const selector =
      action === "status"
        ? `[data-action="status"][data-status="${button.dataset.status}"]`
        : `[data-action="${action}"], [data-action="made-up"]`;
    const again = byId("rmPanel", HTMLElement).querySelector(selector);
    if (again instanceof HTMLElement) again.focus();
  });
}

// WAI-ARIA tabs: one tab stop, arrows switch, the panel follows.
function bindTabs() {
  const tabs = queryAll(".rm-tab", HTMLButtonElement);
  /** @param {HTMLButtonElement} tab @param {boolean} focus */
  const show = (tab, focus) => {
    for (const other of tabs) {
      const on = other === tab;
      other.setAttribute("aria-selected", String(on));
      other.tabIndex = on ? 0 : -1;
      byId(other.getAttribute("aria-controls") ?? "", HTMLElement).hidden = !on;
    }
    if (focus) tab.focus();
    if (tab.dataset.tab === "table") scrollToToday();
    analytics.ramadanTabSwitch(tab.dataset.tab);
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => show(tab, false));
    tab.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      show(tabs[(i + 1) % tabs.length], true);
    });
  });
}

module.exports = { initRamadanPage };
