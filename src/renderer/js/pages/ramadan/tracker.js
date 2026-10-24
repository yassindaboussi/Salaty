"use strict";

// The tracker grid: the month in its three tens, the last ten banded and its odd nights
// marked. Each day is a button (WAI-ARIA grid: one row per ten); the selected day is the only
// Tab stop and the arrow keys move it (index.js). A day shows its number, its Gregorian date
// and what was marked: fasted (a check) or missed (to make up).
const { t } = require("../../core/i18n");
const { html, setHtml } = require("../../utils/html");
const { byId, queryAll } = require("../../core/dom");
const fmt = require("../../core/date-format");
const { view } = require("./state");
const { isOddNight } = require("./data");
const store = require("../../services/ramadan-fasts");

/** @param {import("./data").RamadanDay} day @param {string | undefined} status */
function dayLabel(day, status) {
  return [
    t("ramadanDayLabel").replace("{day}", String(day.day)),
    fmt.gregorian(day.date, { weekday: "long", day: "numeric", month: "long" }),
    day.iso === view.todayIso && t("today"),
    status === "fasted" && t("ramadanFasted"),
    status === "missed" && t("ramadanLegendMissed"),
    isOddNight(day.day) && t("ramadanLegendOddNights"),
  ]
    .filter(Boolean)
    .join(", ");
}

/** @param {import("./data").RamadanDay} day @param {string | undefined} status */
function dayCell(day, status) {
  const classes = [
    "rm-day",
    status === "fasted" && "is-fasted",
    status === "missed" && "is-missed",
    day.iso === view.todayIso && "is-today",
    day.iso > view.todayIso && "is-future",
  ]
    .filter(Boolean)
    .join(" ");
  const mark =
    status === "fasted"
      ? html`<span class="rm-day-mark" aria-hidden="true"><i class="fas fa-check"></i></span>`
      : status === "missed" &&
        html`<span class="rm-day-mark is-missed" aria-hidden="true"><i class="fas fa-rotate-left"></i></span>`;
  return html`<div role="gridcell" class="rm-cell" aria-selected="false">
    <button type="button" class="${classes}" data-day="${day.day}" tabindex="-1" aria-label="${dayLabel(day, status)}" ${day.iso === view.todayIso && html`aria-current="date"`}>
      <span class="rm-day-num">${day.day}</span>
      <span class="rm-day-date">${fmt.gregorian(day.date, { day: "numeric", month: "short" })}</span>
      ${mark}
      ${isOddNight(day.day) && html`<span class="rm-night" aria-hidden="true"><i class="fas fa-moon"></i></span>`}
    </button>
  </div>`;
}

function renderTracker() {
  const { days } = store.read(view.year);
  const tens = [0, 10, 20].map((from) => view.days.slice(from, from + 10));
  setHtml(
    byId("rmGrid", HTMLElement),
    html`${tens.map(
      (ten, i) =>
        html`<div role="row" class="rm-ten${i === 2 ? " is-last-ten" : ""}">${ten.map((day) => dayCell(day, days[day.day]))}</div>`,
    )}`,
  );
  showSelection();
}

/**
 * Marks the selected day and makes it the grid's Tab stop.
 * @param {boolean} [focus] also move the keyboard focus to it
 */
function showSelection(focus = false) {
  for (const button of queryAll(".rm-day", HTMLButtonElement)) {
    const selected = Number(button.dataset.day) === view.selectedDay;
    button.classList.toggle("is-selected", selected);
    button.tabIndex = selected ? 0 : -1;
    button.parentElement?.setAttribute("aria-selected", String(selected));
    if (selected && focus) button.focus();
  }
}

module.exports = { renderTracker, showSelection };
