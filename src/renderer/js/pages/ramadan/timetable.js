"use strict";

// The timetable (imsakiya): for each day Imsak, Fajr (suhoor ends), Maghrib (iftar) and how
// long the fast lasts. Today's row is marked and scrolled into view; the last ten are banded.
const { t } = require("../../core/i18n");
const { html, setHtml } = require("../../utils/html");
const { byId } = require("../../core/dom");
const fmt = require("../../core/date-format");
const { view } = require("./state");
const { fastMinutes, isOddNight } = require("./data");

function renderTimetable() {
  setHtml(
    byId("rmTableBody", HTMLElement),
    html`${view.days.map((day) => {
      const minutes = fastMinutes(day);
      const classes = [
        day.iso === view.todayIso && "is-today",
        day.day > 20 && "is-last-ten",
      ]
        .filter(Boolean)
        .join(" ");
      return html`<tr class="${classes}" ${day.iso === view.todayIso && html`aria-current="date"`}>
        <th scope="row">${day.day}${isOddNight(day.day) && html` <i class="fas fa-moon rm-table-night" role="img" aria-label="${t("ramadanLegendOddNights")}"></i>`}</th>
        <td>${fmt.gregorian(day.date, { weekday: "short", day: "numeric", month: "short" })}</td>
        <td class="rm-muted">${day.imsak}</td>
        <td>${day.fajr}</td>
        <td class="rm-strong">${day.maghrib}</td>
        <td class="rm-muted">${fmt.duration({ hours: Math.floor(minutes / 60), minutes: minutes % 60 }, "narrow")}</td>
      </tr>`;
    })}`,
  );
}

// Today's row in view when the tab opens (like the monthly prayer times).
function scrollToToday() {
  const row = document.querySelector("#rmTableBody tr.is-today");
  if (row instanceof HTMLElement) row.scrollIntoView({ block: "center" });
}

module.exports = { renderTimetable, scrollToToday };
