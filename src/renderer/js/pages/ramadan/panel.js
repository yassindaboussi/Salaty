"use strict";

// The side panel:
//   the selected day   its date, Imsak / suhoor end / iftar, the fast's length, the night it
//                      begins (odd nights of the last ten), and Fasted / Missed
//   your Ramadan       fasted, missed, not marked, days left
//   fasts to make up   the missed fasts of every Ramadan not made up yet (qada)
//   Eid al-Fitr        its expected date; Zakat al-Fitr in the last ten
// The buttons carry data-action; index.js handles them.
const { t } = require("../../core/i18n");
const { html, setHtml } = require("../../utils/html");
const { byId } = require("../../core/dom");
const fmt = require("../../core/date-format");
const { view } = require("./state");
const { fastMinutes, isOddNight } = require("./data");
const store = require("../../services/ramadan-fasts");

const longDate = (/** @type {Date} */ date) =>
  fmt.gregorian(date, { weekday: "long", day: "numeric", month: "long" });

/** @param {number} minutes */
const hoursAndMinutes = (minutes) =>
  fmt.duration(
    { hours: Math.floor(minutes / 60), minutes: minutes % 60 },
    "short",
  );

/** @param {string} label @param {string} time */
const timeRow = (label, time) =>
  html`<div class="rm-row"><dt>${label}</dt><dd>${time}</dd></div>`;

function renderDayCard() {
  const card = byId("rmDayCard", HTMLElement);
  const index = view.days.findIndex((d) => d.day === view.selectedDay);
  const day = view.days[index];
  if (!day) {
    setHtml(card, html``);
    return;
  }
  const status = store.read(view.year).days[day.day];
  const eve = view.days[index - 1];
  const future = day.iso > view.todayIso;
  const statusButton = (
    /** @type {"fasted" | "missed"} */ value,
    /** @type {string} */ icon,
  ) =>
    html`<button type="button" class="rm-status-btn${status === value ? " is-on" : ""}" data-action="status" data-status="${value}" aria-pressed="${status === value}" ${future && html`disabled`}>
      <i class="fas fa-${icon}" aria-hidden="true"></i><span>${value === "fasted" ? t("ramadanFasted") : t("ramadanMissed")}</span>
    </button>`;

  setHtml(
    card,
    html`<div class="rm-card-top">
        <span class="rm-kicker">${t("ramadanDayLabel").replace("{day}", String(day.day))}</span>
        ${day.iso === view.todayIso && html`<span class="rm-badge">${t("today")}</span>`}
      </div>
      <p class="rm-card-date">${fmt.gregorian(day.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
      <dl class="rm-times">
        ${timeRow(t("ramadanImsak"), day.imsak)}
        ${timeRow(t("ramadanSuhoorEnds"), day.fajr)}
        ${timeRow(t("iftar"), day.maghrib)}
        ${timeRow(t("ramadanFastLength"), hoursAndMinutes(fastMinutes(day)))}
      </dl>
      ${isOddNight(day.day) && html`<p class="rm-night-note"><i class="fas fa-moon" aria-hidden="true"></i><span>${t("ramadanOddNight").replace("{day}", String(day.day))} ${eve ? t("ramadanNightBegins").replace("{date}", longDate(eve.date)).replace("{time}", eve.maghrib) : ""}</span></p>`}
      <p class="rm-ask">${future ? t("ramadanFutureHint") : t("ramadanAskFasted")}</p>
      <div class="rm-status" role="group" aria-label="${t("ramadanAskFasted")}">
        ${statusButton("fasted", "check")}
        ${statusButton("missed", "rotate-left")}
      </div>`,
  );
}

function renderSummary() {
  const box = byId("rmSummary", HTMLElement);
  const started = view.days.some((d) => d.iso <= view.todayIso);
  const { days } = store.read(view.year);
  const marked = Object.values(days);
  if (!started && !marked.length) {
    box.hidden = true;
    return;
  }
  const fasted = marked.filter((s) => s === "fasted").length;
  const missed = marked.filter((s) => s === "missed").length;
  const left = view.days.filter((d) => d.iso > view.todayIso).length;
  const notMarked = Math.max(0, view.days.length - left - fasted - missed);
  const total = view.days.length;
  const part = (/** @type {number} */ n) => `${(n / total) * 100}%`;
  box.hidden = false;
  setHtml(
    box,
    html`<h2 class="rm-box-title">${t("ramadanYourRamadan")} ${view.year}</h2>
      <div class="rm-bar" aria-hidden="true">
        <span class="rm-bar-fasted" style="width: ${part(fasted)}"></span>
        <span class="rm-bar-missed" style="width: ${part(missed)}"></span>
      </div>
      <dl class="rm-counts">
        <div><dt>${t("ramadanFasted")}</dt><dd>${fasted}</dd></div>
        <div><dt>${t("ramadanMissed")}</dt><dd>${missed}</dd></div>
        <div><dt>${t("ramadanNotMarked")}</dt><dd>${notMarked}</dd></div>
        <div><dt>${t("ramadanDaysLeft")}</dt><dd>${left}</dd></div>
      </dl>`,
  );
}

function renderMakeUp() {
  const box = byId("rmMakeUp", HTMLElement);
  const { owed, madeUp } = store.makeUpTotals(view.year);
  if (!owed && !madeUp) {
    box.hidden = true;
    return;
  }
  // a missed fast is made up outside Ramadan
  const during =
    view.days.length > 0 &&
    view.days[0].iso <= view.todayIso &&
    view.todayIso <= view.days[view.days.length - 1].iso;
  box.hidden = false;
  setHtml(
    box,
    html`<h2 class="rm-box-title">${t("ramadanMakeUpTitle")}</h2>
      <p class="rm-makeup-count">${owed}</p>
      <p class="rm-box-note">${owed ? (during ? t("ramadanMakeUpDuring") : t("ramadanMakeUpNote")) : t("ramadanMakeUpDone")}</p>
      <div class="rm-makeup-actions">
        <button type="button" class="rm-action-btn" data-action="made-up" ${(!owed || during) && html`disabled`}>
          <i class="fas fa-check" aria-hidden="true"></i><span>${t("ramadanMadeUpOne")}</span>
        </button>
        ${madeUp > 0 && html`<button type="button" class="rm-action-btn is-quiet" data-action="undo-made-up">${t("ramadanMakeUpUndo")}</button>`}
      </div>`,
  );
}

function renderEid() {
  const box = byId("rmEid", HTMLElement);
  const last = view.days[view.days.length - 1];
  if (!last || view.todayIso > last.iso) {
    box.hidden = true;
    return;
  }
  const lastTen = view.days[20] && view.todayIso >= view.days[20].iso;
  box.hidden = false;
  setHtml(
    box,
    html`<h2 class="rm-box-title">${t("ramadanEidTitle")}</h2>
      <p class="rm-eid-date">${t("ramadanExpected").replace("{date}", longDate(fmt.addDays(last.date, 1)))}</p>
      ${lastTen && html`<p class="rm-box-note"><i class="fas fa-hand-holding-heart" aria-hidden="true"></i> ${t("ramadanZakatNote")}</p>`}`,
  );
}

function renderPanel() {
  renderDayCard();
  renderSummary();
  renderMakeUp();
  renderEid();
}

module.exports = { renderPanel, renderDayCard };
