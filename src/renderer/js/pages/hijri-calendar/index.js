"use strict";

// The Hijri calendar page. Its parts:
//   month-data.js   a Hijri month's days (main process: Aladhan, cached; calculated offline)
//   grid.js         the month grid, weeks starting on the user's first day (core/week.js)
//   panel.js        the selected day in full, and the month's occasions
//   state.js        the month shown and the selected day
// Dates are written by core/date-format.js. They follow the Settings correction (-2…+2 days),
// applied by the main process.
const { t } = require("../../core/i18n");
const { state } = require("../../core/store");
const { firstDayOfWeek } = require("../../core/week");
const { hijriMonthName } = require("../../core/dates");
const { byId } = require("../../core/dom");
const analytics = require("../../services/analytics");
const {
  setupConnectionRecovery,
} = require("../../services/connection-recovery");
const { view } = require("./state");
const {
  loadMonth,
  forgetCalculated,
  todaysMonth,
  shiftMonth,
} = require("./month-data");
const {
  columnOf,
  renderWeekdays,
  renderGrid,
  renderMessage,
  showSelection,
} = require("./grid");
const { renderDayCard, renderOccasions, renderNote } = require("./panel");
const fmt = require("../../core/date-format");

let requestId = 0;

async function initHijriCalendar() {
  view.firstDay = firstDayOfWeek(state.settings);
  view.todayIso = fmt.todayIso();
  renderWeekdays();
  bindControls();
  // back online: the months calculated offline are downloaded
  setupConnectionRecovery(() => {
    forgetCalculated();
    return showMonth(view.month, view.year, { iso: view.selectedIso });
  }, "HijriCalendar");
  await showToday();
}

/**
 * Shows a Hijri month and selects a day of it: `want` if it is in the month, else today,
 * else the 1st.
 * @param {number} month
 * @param {number} year
 * @param {{ iso?: string, hijriDay?: number }} [want]
 * @param {boolean} [focus] move the keyboard focus to the selected day
 */
async function showMonth(month, year, want = {}, focus = false) {
  const request = ++requestId;
  view.month = month;
  view.year = year;
  byId("currentMonth", HTMLElement).textContent = hijriMonthName(month);
  byId("currentYear", HTMLElement).textContent = `${year} ${t("ah")}`;

  // a month not loaded yet (first time, slow connection): the old days dim until it arrives
  const grid = byId("hcGrid", HTMLElement);
  grid.setAttribute("aria-busy", "true");
  const data = await loadMonth(month, year);
  if (request !== requestId) return; // another month was asked for meanwhile
  grid.removeAttribute("aria-busy");
  view.data = data;
  const range = byId("gregorianRange", HTMLElement);
  if (!data) {
    range.textContent = "";
    renderMessage();
  } else {
    const byIso = (/** @type {string | undefined} */ iso) =>
      iso ? data.days.find((d) => d.iso === iso) : undefined;
    const day =
      byIso(want.iso) ??
      (want.hijriDay
        ? data.days[Math.min(want.hijriDay, data.days.length) - 1]
        : undefined) ??
      byIso(view.todayIso) ??
      data.days[0];
    view.selectedIso = day.iso;
    range.textContent = fmt.gregorianRange(
      data.days[0].date,
      data.days[data.days.length - 1].date,
    );
    renderGrid();
    showSelection(focus);
  }
  renderDayCard();
  renderOccasions();
  renderNote();
}

async function showToday() {
  view.todayIso = fmt.todayIso();
  const today = await todaysMonth();
  if (today) await showMonth(today.month, today.year, { iso: view.todayIso });
  else await showMonth(view.month, view.year);
}

/**
 * The previous (-1) or next (+1) month.
 * @param {number} by
 * @param {{ iso?: string, hijriDay?: number }} [want]
 * @param {boolean} [focus]
 */
function goToMonth(by, want = {}, focus = false) {
  analytics.calendarMonthNavigated(by < 0 ? "prev" : "next");
  const next = shiftMonth(view.month, view.year, by);
  return showMonth(next.month, next.year, want, focus);
}

/**
 * Selects a day; one outside the month shown opens its month.
 * @param {string} iso
 * @param {boolean} focus
 */
async function select(iso, focus) {
  const days = view.data?.days;
  if (!days) return;
  if (days.some((d) => d.iso === iso)) {
    view.selectedIso = iso;
    showSelection(focus);
    renderDayCard();
  } else {
    await goToMonth(iso < days[0].iso ? -1 : 1, { iso }, focus);
  }
}

// Keys on the grid (WAI-ARIA date grid): arrows move a day / a week (mirrored right to left),
// Home / End go to the week's first / last day, Page Up / Page Down to the same day of the
// previous / next month.
/** @param {KeyboardEvent} e */
function onGridKey(e) {
  const days = view.data?.days;
  const day = days?.find((d) => d.iso === view.selectedIso);
  if (!days || !day) return;
  const rtl = document.documentElement.dir === "rtl";
  /** @type {Record<string, number>} */
  const moves = {
    ArrowLeft: rtl ? 1 : -1,
    ArrowRight: rtl ? -1 : 1,
    ArrowUp: -7,
    ArrowDown: 7,
  };
  if (Object.hasOwn(moves, e.key)) {
    e.preventDefault();
    select(fmt.isoOf(fmt.addDays(day.date, moves[e.key])), true);
  } else if (e.key === "Home" || e.key === "End") {
    e.preventDefault();
    const column = columnOf(day.date);
    const target = fmt.isoOf(
      fmt.addDays(day.date, e.key === "Home" ? -column : 6 - column),
    );
    // stays in the month: an empty cell selects the month's first / last day
    const first = days[0].iso;
    const last = days[days.length - 1].iso;
    select(target < first ? first : target > last ? last : target, true);
  } else if (e.key === "PageUp" || e.key === "PageDown") {
    e.preventDefault();
    goToMonth(e.key === "PageUp" ? -1 : 1, { hijriDay: day.hijriDay }, true);
  }
}

function bindControls() {
  byId("prevMonthBtn", HTMLButtonElement).addEventListener("click", () =>
    goToMonth(-1),
  );
  byId("nextMonthBtn", HTMLButtonElement).addEventListener("click", () =>
    goToMonth(1),
  );
  byId("todayBtn", HTMLButtonElement).addEventListener("click", () => {
    analytics.calendarMonthNavigated("today");
    showToday();
  });

  const grid = byId("calendarDays", HTMLElement);
  grid.addEventListener("click", (e) => {
    const button = /** @type {Element} */ (e.target).closest(".hc-day");
    if (button instanceof HTMLElement && button.dataset.iso) {
      select(button.dataset.iso, true);
    }
  });
  grid.addEventListener("keydown", onGridKey);

  byId("eventsList", HTMLElement).addEventListener("click", (e) => {
    const button = /** @type {Element} */ (e.target).closest(".hc-occasion");
    if (button instanceof HTMLElement && button.dataset.iso) {
      select(button.dataset.iso, false);
    }
  });

  // left open past midnight: today moves to the new day
  window.addEventListener("focus", () => {
    if (view.data && fmt.todayIso() !== view.todayIso) {
      view.todayIso = fmt.todayIso();
      renderGrid();
      showSelection();
      renderDayCard();
    }
  });
}

module.exports = { initHijriCalendar };
