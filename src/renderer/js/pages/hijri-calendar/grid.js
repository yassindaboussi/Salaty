"use strict";

// The month grid: one row per week, starting on the user's first day of the week
// (core/week.js), right to left in Arabic. Each day is a button showing the Hijri day and,
// smaller, the Gregorian one. The selected day is the grid's only Tab stop; index.js moves it
// with the arrow keys (WAI-ARIA grid pattern: role grid > row > gridcell, laid out with CSS
// grid so the weeks share the height).
const { t } = require("../../core/i18n");
const { html, setHtml } = require("../../utils/html");
const { byId, queryAll } = require("../../core/dom");
const { view } = require("./state");
const fmt = require("../../core/date-format");

const FRIDAY = 5;

/** The column a day goes in. @param {Date} date */
const columnOf = (date) => (date.getDay() - view.firstDay + 7) % 7;

function renderWeekdays() {
  const days = Array.from({ length: 7 }, (_, i) => (view.firstDay + i) % 7);
  setHtml(
    byId("hcWeekdays", HTMLElement),
    html`${days.map(
      (
        day,
      ) => html`<div role="columnheader" class="hc-weekday${day === FRIDAY ? " is-friday" : ""}" aria-label="${fmt.weekdayName(day, "long")}">
        <span class="hc-weekday-short">${fmt.weekdayName(day, "short")}</span>
        <span class="hc-weekday-narrow">${fmt.weekdayName(day, "narrow")}</span>
      </div>`,
    )}`,
  );
}

/** The day's full name for screen readers. @param {import("./month-data").CalendarDay} day */
function dayLabel(day) {
  const data = /** @type {import("./month-data").MonthData} */ (view.data);
  return [
    fmt.gregorian(day.date, { weekday: "long" }),
    fmt.hijriDate(day.hijriDay, data.month, data.year),
    fmt.gregorian(day.date, { day: "numeric", month: "long", year: "numeric" }),
    day.iso === view.todayIso && t("today"),
    day.event,
    day.whiteDay && t("calendarWhiteDays"),
  ]
    .filter(Boolean)
    .join(", ");
}

/** @param {import("./month-data").CalendarDay} day */
function dayCell(day) {
  const isToday = day.iso === view.todayIso;
  const classes = [
    "hc-day",
    isToday && "is-today",
    day.date.getDay() === FRIDAY && "is-friday",
  ]
    .filter(Boolean)
    .join(" ");
  // the Gregorian month's name on its 1st and on the Hijri month's 1st
  const gregorian =
    day.date.getDate() === 1 || day.hijriDay === 1
      ? fmt.gregorian(day.date, { day: "numeric", month: "short" })
      : day.date.getDate();
  const mark = day.event
    ? html`<span class="hc-dot" aria-hidden="true"></span>`
    : day.whiteDay &&
      html`<span class="hc-dot hc-dot--white" aria-hidden="true"></span>`;
  return html`<div role="gridcell" class="hc-cell" aria-selected="false">
    <button type="button" class="${classes}" data-iso="${day.iso}" tabindex="-1" aria-label="${dayLabel(day)}" ${isToday && html`aria-current="date"`}>
      <span class="hc-day-hijri">${day.hijriDay}</span>
      <span class="hc-day-greg">${gregorian}</span>
      ${mark}
    </button>
  </div>`;
}

/** The weeks of the month shown, with empty cells before the 1st and after the last day. */
function renderGrid() {
  const data = view.data;
  if (!data) return;
  /** @type {(import("./month-data").CalendarDay | null)[]} */
  const cells = [
    ...Array(columnOf(data.days[0].date)).fill(null),
    ...data.days,
  ];
  while (cells.length % 7) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(
      html`<div role="row" class="hc-week">${cells
        .slice(i, i + 7)
        .map((day) =>
          day
            ? dayCell(day)
            : html`<div role="gridcell" class="hc-cell is-empty"></div>`,
        )}</div>`,
    );
  }
  setHtml(byId("calendarDays", HTMLElement), html`${weeks}`);
}

/** No month to show (outside the calendar's range): a message instead of the days. */
function renderMessage() {
  setHtml(
    byId("calendarDays", HTMLElement),
    html`<div role="row" class="hc-message"><div role="gridcell">${t("calendarMonthUnavailable")}</div></div>`,
  );
}

/**
 * Marks the selected day and makes it the grid's Tab stop.
 * @param {boolean} [focus] also move the keyboard focus to it
 */
function showSelection(focus = false) {
  for (const button of queryAll(".hc-day", HTMLButtonElement)) {
    const selected = button.dataset.iso === view.selectedIso;
    button.classList.toggle("is-selected", selected);
    button.tabIndex = selected ? 0 : -1;
    button.parentElement?.setAttribute("aria-selected", String(selected));
    if (selected && focus) button.focus();
  }
}

module.exports = {
  columnOf,
  renderWeekdays,
  renderGrid,
  renderMessage,
  showSelection,
};
