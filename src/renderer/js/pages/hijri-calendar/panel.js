"use strict";

// The side panel: the selected day in full (Hijri and Gregorian) with its occasion, then the
// month's occasions; index.js selects the day of the one that is clicked.
const { t } = require("../../core/i18n");
const { hijriMonthName } = require("../../core/dates");
const { html, setHtml } = require("../../utils/html");
const { byId } = require("../../core/dom");
const { view } = require("./state");
const fmt = require("../../core/date-format");

function renderDayCard() {
  const card = byId("hcDayCard", HTMLElement);
  const data = view.data;
  const day = data?.days.find((d) => d.iso === view.selectedIso);
  if (!data || !day) {
    setHtml(card, html``);
    return;
  }
  setHtml(
    card,
    html`
      <div class="hc-card-top">
        <span class="hc-card-weekday">${fmt.gregorian(day.date, { weekday: "long" })}</span>
        ${day.iso === view.todayIso && html`<span class="hc-badge">${t("today")}</span>`}
      </div>
      <div class="hc-card-hijri">
        <span class="hc-card-day">${day.hijriDay}</span>
        <span class="hc-card-month">
          ${hijriMonthName(data.month)}
          <span class="hc-card-year">${data.year} ${t("ah")}</span>
        </span>
      </div>
      <p class="hc-card-line">
        <i class="fas fa-calendar" aria-hidden="true"></i>
        <span>${fmt.gregorian(day.date, { day: "numeric", month: "long", year: "numeric" })}</span>
      </p>
      ${day.event && html`<p class="hc-card-line is-event"><i class="fas fa-star" aria-hidden="true"></i><span>${day.event}</span></p>`}
      ${day.whiteDay && html`<p class="hc-card-line is-white"><i class="fas fa-moon" aria-hidden="true"></i><span>${t("calendarWhiteDaysNote")}</span></p>`}
    `,
  );
}

/** The month's occasions in day order, the White Days as one entry. */
function renderOccasions() {
  const list = byId("eventsList", HTMLElement);
  const data = view.data;
  if (!data) {
    setHtml(list, html``);
    return;
  }
  const items = data.days
    .filter((d) => d.event)
    .map((d) => ({
      first: d,
      days: String(d.hijriDay),
      name: d.event,
      when: fmt.gregorian(d.date, {
        weekday: "short",
        day: "numeric",
        month: "short",
      }),
      white: false,
    }));
  const white = data.days.filter((d) => d.whiteDay);
  if (white.length) {
    const last = white[white.length - 1];
    items.push({
      first: white[0],
      days: `${white[0].hijriDay}–${last.hijriDay}`,
      name: t("calendarWhiteDays"),
      when: fmt.gregorianRange(white[0].date, last.date, { year: undefined }),
      white: true,
    });
  }
  items.sort((a, b) => a.first.hijriDay - b.first.hijriDay);

  setHtml(
    list,
    items.length
      ? html`${items.map(
          (item) => html`<li>
            <button type="button" class="hc-occasion${item.white ? " is-white" : ""}" data-iso="${item.first.iso}">
              <span class="hc-occasion-days">${item.days}</span>
              <span class="hc-occasion-text">
                <span class="hc-occasion-name">${item.name}</span>
                <span class="hc-occasion-when">${item.when}</span>
              </span>
            </button>
          </li>`,
        )}`
      : html`<li class="hc-occasion-none">${t("noEventsThisMonth")}</li>`,
  );
}

/** The note under the panel when the month was calculated offline. */
function renderNote() {
  byId("hcNote", HTMLElement).hidden = !view.data?.calculated;
}

module.exports = { renderDayCard, renderOccasions, renderNote };
