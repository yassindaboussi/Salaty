"use strict";

// The two lists:
//   recent and coming days   the last 7 days and the next 14: one row per date with every
//                            reason it is a fast (or the ban); a past day or today can be
//                            marked as fasted
//   coming up                the seasons of the next months: White Days, Tasu'a & Ashura,
//                            Dhul-Hijjah, Arafah, Shawwal, and the days not to fast
const { t } = require("../../core/i18n");
const { html, setHtml } = require("../../utils/html");
const { byId } = require("../../core/dom");
const { hijriMonthName } = require("../../core/dates");
const fmt = require("../../core/date-format");
const { view } = require("./state");
const { shownReasons, seasonsOf } = require("./data");
const { dayName, kindName, iconOf } = require("./names");
const store = require("./sunnah-store");

const BACK_DAYS = 7;
const AHEAD_DAYS = 14;

/** "22 October · 11 Jumada al-Awwal" @param {import("./data").FastDay} day */
const bothDates = (day) =>
  `${fmt.gregorian(day.date, { day: "numeric", month: "long" })} · ${day.hijri.day} ${hijriMonthName(day.hijri.month)}`;

/** @param {import("./data").FastDay} day */
function dayRow(day) {
  const past = day.iso <= view.todayIso;
  const fasted = store.isFasted(day.iso);
  const title = day.forbidden
    ? t("fastDoNotFast").replace("{name}", kindName(day.forbidden))
    : shownReasons(day)
        .map((r) => dayName(r, day))
        .join(" · ");
  const classes = [
    "vf-row",
    day.iso === view.todayIso && "is-today",
    day.iso < view.todayIso && "is-past",
    day.forbidden && "is-forbidden",
  ]
    .filter(Boolean)
    .join(" ");
  return html`<li class="${classes}">
    <span class="vf-row-date" aria-hidden="true">
      <span class="vf-row-weekday">${fmt.gregorian(day.date, { weekday: "short" })}</span>
      <span class="vf-row-day">${fmt.gregorian(day.date, { day: "numeric" })}</span>
    </span>
    <span class="vf-row-text">
      <span class="vf-row-title">${day.forbidden && html`<i class="fas fa-ban" aria-hidden="true"></i> `}${title}</span>
      <span class="vf-row-sub">${fmt.gregorian(day.date, { weekday: "long" })}, ${bothDates(day)}</span>
    </span>
    <span class="vf-row-end">
      ${
        day.forbidden
          ? ""
          : past
            ? html`<button type="button" class="vf-done-btn${fasted ? " is-on" : ""}" data-action="fasted" data-iso="${day.iso}" aria-pressed="${fasted}" aria-label="${t("fastFasted")}: ${title}, ${bothDates(day)}">
                <i class="fas fa-check" aria-hidden="true"></i><span>${fasted ? t("fastFasted") : t("fastIFasted")}</span>
              </button>`
            : html`<span class="vf-when">${fmt.relativeDays(fmt.daysBetween(new Date(), day.date))}</span>`
      }
    </span>
  </li>`;
}

/** @param {import("./data").Season} season */
function seasonRow(season) {
  const { first, last, kind } = season;
  const one = first.iso === last.iso;
  const hijri = one
    ? `${first.hijri.day} ${hijriMonthName(first.hijri.month)}`
    : `${first.hijri.day}–${last.hijri.day} ${hijriMonthName(first.hijri.month)}`;
  const gregorian = one
    ? fmt.gregorian(first.date, {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    : fmt.gregorianRange(first.date, last.date, { year: undefined });
  const forbidden =
    kind === "eidFitr" || kind === "eidAdha" || kind === "tashreeq";
  const until = fmt.daysBetween(new Date(), first.date);
  return html`<li class="vf-season${forbidden ? " is-forbidden" : ""}">
    <span class="vf-season-icon" aria-hidden="true"><i class="fas fa-${iconOf(kind)}"></i></span>
    <span class="vf-row-text">
      <span class="vf-row-title">${forbidden ? t("fastDoNotFast").replace("{name}", kindName(kind)) : kindName(kind)}</span>
      <span class="vf-row-sub">${hijri} · ${gregorian}</span>
    </span>
    <span class="vf-when">${until <= 0 ? t("fastNow") : fmt.relativeDays(until)}</span>
  </li>`;
}

function renderLists() {
  const today = new Date();
  const from = fmt.isoOf(fmt.addDays(today, -BACK_DAYS));
  const to = fmt.isoOf(fmt.addDays(today, AHEAD_DAYS));
  // A coming day whose only reason is Shawwal stays in the season row ("Six days of Shawwal"):
  // otherwise every day of the month would be listed. Past ones stay, to be marked.
  const near = view.days.filter(
    (d) =>
      d.iso >= from &&
      d.iso <= to &&
      !(
        d.iso > view.todayIso &&
        d.reasons.every((r) => r === "shawwal6") &&
        !d.forbidden
      ),
  );
  setHtml(
    byId("vfNear", HTMLElement),
    near.length
      ? html`${near.map(dayRow)}`
      : html`<li class="vf-empty">${t("fastNone")}</li>`,
  );
  // seasons still to come or under way
  const seasons = seasonsOf(view.days).filter(
    (s) => s.last.iso >= view.todayIso,
  );
  setHtml(
    byId("vfSeasons", HTMLElement),
    seasons.length
      ? html`${seasons.map(seasonRow)}`
      : html`<li class="vf-empty">${t("fastNone")}</li>`,
  );
  byId("vfCalculated", HTMLElement).hidden = !view.days.some(
    (d) => d.calculated,
  );
}

module.exports = { renderLists };
