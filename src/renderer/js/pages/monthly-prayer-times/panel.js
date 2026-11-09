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
const { clock } = require("../../core/time-format");

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
        <span class="mp-time-value">${clock(day.times[k])}</span>
      </li>`;
    })}`,
  );
}

/** [method, Asr rule] of this month's times (in the UI language), null when unknown. */
function methodParts() {
  const method = view.method;
  if (!method) return null;
  const key = `mpMethod${method.id}`;
  const translated = method.id === null ? key : t(key);
  return [
    translated === key ? method.name : translated, // an id newer than the app: Aladhan's name
    t(method.hanafi ? "mpAsrHanafi" : "mpAsrStandard"),
  ];
}

/** "Tunisia · Asr: majority view…" for the PDF heading, "" when unknown. */
const methodText = () => methodParts()?.filter(Boolean).join(" · ") ?? "";

function renderLocation() {
  const { city, country } = state.settings;
  byId("mpLocation", HTMLElement).textContent =
    [city, country].filter(Boolean).join(", ") || "—";
  const parts = methodParts();
  byId("mpMethodBox", HTMLElement).hidden = !parts;
  byId("mpMethod", HTMLElement).textContent = parts?.[0] ?? "";
  byId("mpAsr", HTMLElement).textContent = parts?.[1] ?? "";
}

module.exports = { renderDay, renderLocation, methodText };
