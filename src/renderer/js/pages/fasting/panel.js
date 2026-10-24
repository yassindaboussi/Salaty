"use strict";

// The side panel:
//   remind me           a switch per kind of fast (with why and its hadith), and when: the
//                       evening before (after Isha) and / or N minutes before Fajr
//   Ramadan make-up     the missed Ramadan fasts still owed (same count as the Ramadan page)
//   your fasts          marked this Hijri month; the six of Shawwal in Shawwal
//   days not to fast    the two Eids, Tashreeq, and a Friday on its own
// index.js handles the inputs (data-type, #vfEvening…) and buttons (data-action, data-source).
const { t } = require("../../core/i18n");
const { html, setHtml } = require("../../utils/html");
const { byId } = require("../../core/dom");
const { hijriMonthName } = require("../../core/dates");
const { TYPES } = require("../../../../shared/fasting-rules");
const { makeUpTotals } = require("../../services/ramadan-fasts");
const { view } = require("./state");
const { kindName, whyOf, sourceLinks } = require("./names");
const store = require("./sunnah-store");

const MINUTE_CHOICES = [15, 30, 45, 60, 90];

/** @param {string} id @param {boolean} on @param {string} [data] extra attributes */
const switchInput = (id, on, data = "") =>
  html`<label class="toggle-switch"><input type="checkbox" role="switch" id="${id}" ${data ? html`data-type="${data}"` : ""} ${on && html`checked`} /><span class="toggle-slider"></span></label>`;

function renderReminders() {
  const { types, evening, suhoor, suhoorMinutes } = view.prefs;
  setHtml(
    byId("vfReminders", HTMLElement),
    html`<h2 class="vf-box-title">${t("fastRemindTitle")}</h2>
      <ul class="vf-types">
        ${TYPES.map(
          (type) => html`<li class="vf-type">
            <span class="vf-type-text">
              <label class="vf-type-name" for="vfType-${type}">${kindName(type)}</label>
              <span class="vf-type-why">${whyOf(type)} ${sourceLinks(type)}</span>
            </span>
            ${switchInput(`vfType-${type}`, types.includes(type), type)}
          </li>`,
        )}
      </ul>
      <h3 class="vf-box-subtitle">${t("fastWhenTitle")}</h3>
      <div class="vf-when-row">
        <label class="vf-type-name" for="vfEvening">${t("fastEvening")}</label>
        ${switchInput("vfEvening", evening)}
      </div>
      <div class="vf-when-row">
        <span class="vf-when-text">
          <label class="vf-type-name" for="vfSuhoor">${t("fastSuhoorAlert")}</label>
          <select class="vf-select" id="vfSuhoorMinutes" aria-label="${t("fastSuhoorAlert")}" ${!suhoor && html`disabled`}>
            ${MINUTE_CHOICES.map((m) => html`<option value="${m}" ${m === suhoorMinutes && html`selected`}>${t("fastMinutesBefore").replace("{minutes}", String(m))}</option>`)}
          </select>
        </span>
        ${switchInput("vfSuhoor", suhoor)}
      </div>
      <p class="vf-box-note">${t("fastRemindersHint")}</p>`,
  );
}

function renderMakeUp() {
  const box = byId("vfMakeUp", HTMLElement);
  const year = (view.todayHijri?.year ?? 9999) + 1;
  const { owed } = makeUpTotals(year);
  box.hidden = owed === 0;
  if (!owed) return;
  // a make-up fast is never in Ramadan
  const ramadan = view.todayHijri?.month === 9;
  setHtml(
    box,
    html`<h2 class="vf-box-title">${t("fastMakeUpTitle")}</h2>
      <p class="vf-big-number">${owed}</p>
      <p class="vf-box-note">${t("fastMakeUpNote")}</p>
      <button type="button" class="vf-action-btn" data-action="made-up" ${ramadan && html`disabled`}>
        <i class="fas fa-check" aria-hidden="true"></i><span>${t("fastMadeUpOne")}</span>
      </button>`,
  );
}

function renderMine() {
  const box = byId("vfMine", HTMLElement);
  const hijri = view.todayHijri;
  if (!hijri) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  const thisMonth = store.countIn(hijri.year, hijri.month);
  const shawwal =
    hijri.month === 10 ? Math.min(6, store.countIn(hijri.year, 10, 2)) : -1;
  setHtml(
    box,
    html`<h2 class="vf-box-title">${t("fastMineTitle")}</h2>
      <div class="vf-stat">
        <span class="vf-stat-label">${hijriMonthName(hijri.month)} ${hijri.year}</span>
        <span class="vf-stat-value">${thisMonth}</span>
      </div>
      ${
        shawwal >= 0 &&
        html`<div class="vf-shawwal" role="img" aria-label="${kindName("shawwal6")}: ${shawwal} / 6">
          <span class="vf-stat-label">${kindName("shawwal6")}</span>
          <span class="vf-dots" aria-hidden="true">${[1, 2, 3, 4, 5, 6].map((n) => html`<span class="vf-dot${n <= shawwal ? " is-on" : ""}"></span>`)}</span>
          <span class="vf-stat-value">${shawwal}/6</span>
        </div>
        <p class="vf-box-note">${t("fastShawwalNote")}</p>`
      }`,
  );
}

function renderNotToFast() {
  setHtml(
    byId("vfNotToFast", HTMLElement),
    html`<h2 class="vf-box-title">${t("fastNotToFastTitle")}</h2>
      <ul class="vf-rules">
        <li><i class="fas fa-ban" aria-hidden="true"></i><span>${t("fastNotToFastEids")} ${sourceLinks("eid")}</span></li>
        <li><i class="fas fa-ban" aria-hidden="true"></i><span>${t("fastNotToFastTashreeq")} ${sourceLinks("tashreeq")}</span></li>
        <li><i class="fas fa-circle-info" aria-hidden="true"></i><span>${t("fastFridayNote")} ${sourceLinks("friday")}</span></li>
      </ul>`,
  );
}

function renderPanel() {
  renderReminders();
  renderMakeUp();
  renderMine();
  renderNotToFast();
}

module.exports = { renderPanel, renderMakeUp, renderMine };
