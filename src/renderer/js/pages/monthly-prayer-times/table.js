"use strict";

// The timetable: one row per day (the day, its Hijri date, Fajr, Sunrise and the prayers). The
// past days are dimmed, today is marked, and a click or the arrow keys choose the day shown in
// the panel (one row in the Tab order, as in a list).
const { t } = require("../../core/i18n");
const { byId } = require("../../core/dom");
const { html, setHtml } = require("../../utils/html");
const fmt = require("../../core/date-format");
const { hijriMonthName } = require("../../core/dates");
const { view, TIME_KEYS } = require("./state");

/** @param {import("./state").MonthDay} day @param {number} index */
function hijriCell(day, index) {
  // the month's name where a Hijri month starts (and on the first row), so the change shows
  if (day.hijri.day !== 1 && index !== 0) return html`${day.hijri.day}`;
  return html`${day.hijri.day} <span class="mp-hijri-month">${hijriMonthName(day.hijri.month)}</span>`;
}

function renderTable() {
  setHtml(
    byId("mpTableHead", HTMLElement),
    html`<th scope="col">${t("day", "common")}</th>
      <th scope="col">${t("mpHijri")}</th>
      ${TIME_KEYS.map((k) => html`<th scope="col">${t(k, "prayerNames")}</th>`)}`,
  );
  setHtml(
    byId("mpTableBody", HTMLElement),
    html`${view.days.map((day, i) => {
      const today = day.iso === view.todayIso;
      const selected = day.iso === view.selectedIso;
      const classes = [
        today && "is-today",
        day.iso < view.todayIso && "is-past",
      ]
        .filter(Boolean)
        .join(" ");
      return html`<tr class="${classes}" data-iso="${day.iso}" aria-selected="${String(selected)}" tabindex="${selected ? "0" : "-1"}" ${today && html`aria-current="date"`}>
        <th scope="row"><span class="mp-day-num">${day.date.getDate()}</span> <span class="mp-weekday">${fmt.gregorian(day.date, { weekday: "short" })}</span></th>
        <td class="mp-hijri">${hijriCell(day, i)}</td>
        ${TIME_KEYS.map((k) => html`<td class="${k === "Sunrise" ? "mp-muted" : ""}">${day.times[k]}</td>`)}
      </tr>`;
    })}`,
  );
}

/** Marks the chosen row (no redraw, so the focus stays). @param {string} iso */
function markSelected(iso) {
  for (const row of byId("mpTableBody", HTMLTableSectionElement).rows) {
    const on = row.dataset.iso === iso;
    row.setAttribute("aria-selected", String(on));
    row.tabIndex = on ? 0 : -1;
  }
}

/** @param {boolean} [smooth] */
function scrollToSelected(smooth = false) {
  const row = document.querySelector('#mpTableBody tr[aria-selected="true"]');
  if (row instanceof HTMLElement) {
    row.scrollIntoView({
      block: "nearest",
      behavior: smooth ? "smooth" : "auto",
    });
  }
}

/** @param {(iso: string) => void} select */
function bindTable(select) {
  const body = byId("mpTableBody", HTMLTableSectionElement);
  body.addEventListener("click", (e) => {
    const row = /** @type {Element} */ (e.target).closest("tr");
    if (row instanceof HTMLTableRowElement && row.dataset.iso)
      select(row.dataset.iso);
  });
  body.addEventListener("keydown", (e) => {
    const rows = [...body.rows];
    const at = rows.findIndex((r) => r.dataset.iso === view.selectedIso);
    const to = {
      ArrowDown: at + 1,
      ArrowUp: at - 1,
      Home: 0,
      End: rows.length - 1,
    }[e.key];
    if (to === undefined || !rows[to]) return;
    e.preventDefault();
    select(String(rows[to].dataset.iso));
    rows[to].focus();
  });
}

module.exports = { renderTable, markSelected, scrollToSelected, bindTable };
