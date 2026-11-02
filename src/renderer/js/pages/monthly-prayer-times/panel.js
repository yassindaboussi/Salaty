"use strict";

// The panel: the chosen day (its dates and six times; for today, the next prayer is marked)
// and the location the times are for.
const { t } = require("../../core/i18n");
const { byId } = require("../../core/dom");
const { html, setHtml } = require("../../utils/html");
const fmt = require("../../core/date-format");
const { state, prayerIcons } = require("../../core/store");
const {
  displayPrayerKey,
  secondsFromTime,
  secondsSinceMidnight,
} = require("../../../../shared/prayerUtils");
const { view, TIME_KEYS } = require("./state");

const ICONS = { ...prayerIcons, Sunrise: "sun" };

/** The next prayer of today (Sunrise is not a prayer), or null after Isha. @param {import("./state").MonthDay} day */
function nextPrayer(day) {
  if (day.iso !== view.todayIso) return null;
  const now = secondsSinceMidnight();
  return (
    TIME_KEYS.find(
      (k) => k !== "Sunrise" && secondsFromTime(day.times[k]) > now,
    ) ?? null
  );
}

function renderDay() {
  const day = view.days.find((d) => d.iso === view.selectedIso);
  const title = byId("mpDayTitle", HTMLElement);
  const list = byId("mpDayTimes", HTMLElement);
  if (!day) {
    title.textContent = "—";
    byId("mpDayHijri", HTMLElement).textContent = "";
    setHtml(list, html``);
    return;
  }
  title.textContent = fmt.gregorian(day.date, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  byId("mpDayHijri", HTMLElement).textContent = fmt.hijriDate(
    day.hijri.day,
    day.hijri.month,
    day.hijri.year,
  );
  const next = nextPrayer(day);
  setHtml(
    list,
    html`${TIME_KEYS.map((k) => {
      const name = t(
        displayPrayerKey(k, { isFriday: day.friday }),
        "prayerNames",
      );
      return html`<li class="mp-time${k === next ? " is-next" : ""}${k === "Sunrise" ? " is-sunrise" : ""}">
        <i class="fas fa-${ICONS[k] ?? "clock"}" aria-hidden="true"></i>
        <span class="mp-time-name">${name}</span>
        ${k === next ? html`<span class="mp-next-tag">${t("mpNext")}</span>` : ""}
        <span class="mp-time-value">${day.times[k]}</span>
      </li>`;
    })}`,
  );
}

function renderLocation() {
  const { city, country } = state.settings;
  byId("mpLocation", HTMLElement).textContent =
    [city, country].filter(Boolean).join(", ") || "—";
}

module.exports = { renderDay, renderLocation };
