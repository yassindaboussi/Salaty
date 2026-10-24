"use strict";

// The top card: the next Sunnah fast (today's, until the day ends): its date in both
// calendars, every reason it is a fast, suhoor end / iftar, whether a reminder will come, and
// on the day an "I fasted" button. Notes: a Friday on its own, Ramadan fasts still owed.
const { t } = require("../../core/i18n");
const { html, setHtml } = require("../../utils/html");
const { byId } = require("../../core/dom");
const fmt = require("../../core/date-format");
const { fridayAlone } = require("../../../../shared/fasting-rules");
const { makeUpTotals } = require("../../services/ramadan-fasts");
const { view } = require("./state");
const { timesOn, shownReasons } = require("./data");
const { dayName } = require("./names");
const store = require("./sunnah-store");

/** The day shown: today if it is a fast, else the next one. */
const nextFast = () =>
  view.days.find((d) => d.iso >= view.todayIso && d.reasons.length > 0);

/** Whether a reminder will come for a day, as one line. @param {import("./data").FastDay} day */
function reminderLine(day) {
  const { types, evening, suhoor, suhoorMinutes } = view.prefs;
  const on = day.reasons.some(
    (r) => types.includes(r) && (r !== "shawwal6" || day.hijri.day === 2),
  );
  if (!on || (!evening && !suhoor)) return t("fastRemindOff");
  const key =
    evening && suhoor
      ? "fastRemindBoth"
      : evening
        ? "fastRemindEvening"
        : "fastRemindSuhoor";
  return t(key).replace("{minutes}", String(suhoorMinutes));
}

let request = 0;

async function renderHero() {
  const el = byId("vfHero", HTMLElement);
  const day = nextFast();
  if (!day) {
    setHtml(el, html`<p class="vf-message">${t("fastNone")}</p>`);
    return;
  }
  const isToday = day.iso === view.todayIso;
  const fasted = store.isFasted(day.iso);
  const owed = makeUpTotals((view.todayHijri?.year ?? 9999) + 1).owed;
  setHtml(
    el,
    html`<div class="vf-hero-main">
        <div class="vf-date-block" aria-hidden="true">
          <span class="vf-date-weekday">${fmt.gregorian(day.date, { weekday: "short" })}</span>
          <span class="vf-date-day">${fmt.gregorian(day.date, { day: "numeric" })}</span>
          <span class="vf-date-month">${fmt.gregorian(day.date, { month: "short" })}</span>
        </div>
        <div class="vf-hero-text">
          <p class="vf-kicker">${isToday ? t("fastToday") : html`${t("fastNext")} · <span class="vf-kicker-when">${fmt.relativeDays(fmt.daysBetween(new Date(), day.date))}</span>`}</p>
          <p class="vf-hero-title">${fmt.gregorian(day.date, { weekday: "long", day: "numeric", month: "long" })}</p>
          <p class="vf-hero-hijri">${fmt.hijriDate(day.hijri.day, day.hijri.month, day.hijri.year)}</p>
          <ul class="vf-chips">${shownReasons(day).map((r) => html`<li class="vf-chip">${dayName(r, day)}</li>`)}</ul>
          ${!isToday && html`<p class="vf-hero-note"><i class="fas fa-bell" aria-hidden="true"></i> ${reminderLine(day)}</p>`}
          ${fridayAlone(day.weekday, day.reasons) && html`<p class="vf-hero-note"><i class="fas fa-circle-info" aria-hidden="true"></i> ${t("fastFridayNote")}</p>`}
          ${owed > 0 && html`<p class="vf-hero-note"><i class="fas fa-rotate-left" aria-hidden="true"></i> ${t("fastMakeUpHint").replace("{count}", String(owed))}</p>`}
        </div>
      </div>
      <div class="vf-hero-side">
        <div class="vf-tiles">
          <div class="vf-tile"><span class="vf-tile-label">${t("fastSuhoorEnds")}</span><span class="vf-tile-time" id="vfFajr">--:--</span></div>
          <div class="vf-tile is-iftar"><span class="vf-tile-label">${t("fastIftar")}</span><span class="vf-tile-time" id="vfMaghrib">--:--</span></div>
        </div>
        ${
          isToday &&
          html`<button type="button" class="vf-done-btn is-big${fasted ? " is-on" : ""}" data-action="fasted" data-iso="${day.iso}" aria-pressed="${fasted}">
          <i class="fas fa-check" aria-hidden="true"></i><span>${fasted ? t("fastFasted") : t("fastIFasted")}</span>
        </button>`
        }
      </div>`,
  );
  const mine = ++request;
  const times = await timesOn(day.iso);
  if (mine !== request || !times) return;
  byId("vfFajr", HTMLElement).textContent = times.fajr;
  byId("vfMaghrib", HTMLElement).textContent = times.maghrib;
}

/** @param {string} message */
function renderHeroMessage(message) {
  setHtml(
    byId("vfHero", HTMLElement),
    html`<p class="vf-message">${message}</p>`,
  );
}

module.exports = { renderHero, renderHeroMessage };
