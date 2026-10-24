"use strict";

// The top card. What it shows depends on the moment:
//   before      days until Ramadan, its expected date (confirmed by the moon sighting)
//   tomorrow    the eve of the 1st: countdown to the end of the first suhoor
//   suhoor      a Ramadan night after midnight: countdown to Fajr (suhoor ends)
//   fasting     Fajr to Maghrib: countdown to iftar, and how much of the fast is done
//   evening     after iftar: countdown to the end of tomorrow's suhoor
//   lastEvening after the last iftar: Eid is tomorrow
//   eid         1 Shawwal: Eid Mubarak, and the next Ramadan
// index.js calls tick() every second; render() again when the moment changes kind.
const { t } = require("../../core/i18n");
const { html, setHtml } = require("../../utils/html");
const { byId } = require("../../core/dom");
const fmt = require("../../core/date-format");
const { view } = require("./state");
const { fastMinutes } = require("./data");

/**
 * @typedef {import("./data").RamadanDay} RamadanDay
 * @typedef {{ kind: string, day?: RamadanDay, target?: Date, start?: Date, daysLeft?: number }} Moment
 */

/** @param {Date} now @returns {Moment} */
function momentAt(now) {
  const days = view.days;
  if (!days.length) return { kind: "none" };
  const first = days[0];
  if (view.eidToday) {
    return { kind: "eid", daysLeft: fmt.daysBetween(now, first.date) };
  }
  const index = days.findIndex((d) => d.iso === fmt.isoOf(now));
  if (index >= 0) {
    const day = days[index];
    const fajr = fmt.timeOn(day.date, day.fajr);
    const maghrib = fmt.timeOn(day.date, day.maghrib);
    if (now < fajr) return { kind: "suhoor", day, target: fajr };
    if (now < maghrib) {
      return { kind: "fasting", day, target: maghrib, start: fajr };
    }
    const next = days[index + 1];
    return next
      ? { kind: "evening", day: next, target: fmt.timeOn(next.date, next.fajr) }
      : { kind: "lastEvening", day };
  }
  if (now < first.date) {
    const daysLeft = fmt.daysBetween(now, first.date);
    return daysLeft === 1
      ? {
          kind: "tomorrow",
          day: first,
          target: fmt.timeOn(first.date, first.fajr),
        }
      : { kind: "before", day: first, daysLeft };
  }
  return { kind: "after" };
}

/** "3:05:12" until the target. @param {Date} now @param {Date} target */
function countdown(now, target) {
  const seconds = Math.max(
    0,
    Math.floor((target.getTime() - now.getTime()) / 1000),
  );
  return fmt.duration(
    {
      hours: Math.floor(seconds / 3600),
      minutes: Math.floor((seconds % 3600) / 60),
      seconds: seconds % 60,
    },
    "digital",
  );
}

/** Imsak, suhoor end and iftar of a day, as small tiles. @param {RamadanDay} day */
const timeTiles = (day) => html`
  <div class="rm-hero-times">
    <div class="rm-tile"><span class="rm-tile-label">${t("ramadanImsak")}</span><span class="rm-tile-time">${day.imsak}</span></div>
    <div class="rm-tile"><span class="rm-tile-label">${t("ramadanSuhoorEnds")}</span><span class="rm-tile-time">${day.fajr}</span></div>
    <div class="rm-tile is-iftar"><span class="rm-tile-label">${t("iftar")}</span><span class="rm-tile-time">${day.maghrib}</span></div>
  </div>`;

/** The Ramadan day as a ring: how far into the month. @param {number} day */
function dayRing(day) {
  const total = view.days.length;
  const r = 26;
  const length = 2 * Math.PI * r;
  return html`<div class="rm-ring" role="img" aria-label="${t("ramadanDayOf").replace("{day}", String(day)).replace("{total}", String(total))}">
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <circle class="rm-ring-track" cx="32" cy="32" r="${r}"></circle>
      <circle class="rm-ring-fill" cx="32" cy="32" r="${r}" stroke-dasharray="${length}" stroke-dashoffset="${length * (1 - day / total)}"></circle>
    </svg>
    <span class="rm-ring-text"><strong>${day}</strong><span>/${total}</span></span>
  </div>`;
}

let shownKey = "";

/** @param {Moment} m */
const keyOf = (m) => `${m.kind}:${m.day?.day ?? ""}:${view.todayIso}`;

/** Draws the card for the moment. @param {Date} now */
function render(now) {
  const m = momentAt(now);
  shownKey = keyOf(m);
  const el = byId("rmHero", HTMLElement);
  const day = m.day;
  const dayOf = (/** @type {number} */ n) =>
    t("ramadanDayOf")
      .replace("{day}", String(n))
      .replace("{total}", String(view.days.length));

  if (m.kind === "before" && day) {
    setHtml(
      el,
      html`<div class="rm-hero-main">
          <i class="fas fa-moon rm-hero-icon" aria-hidden="true"></i>
          <div class="rm-hero-text">
            <p class="rm-hero-kicker">${t("ramadanBeginsIn").replace("{year}", String(view.year))}</p>
            <p class="rm-hero-big">${fmt.duration({ days: m.daysLeft }, "long")}</p>
            <p class="rm-hero-note">${t("ramadanExpected").replace("{date}", fmt.gregorian(day.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" }))} ${t("ramadanMoonNote")}</p>
          </div>
        </div>
        ${timeTiles(day)}`,
    );
  } else if (m.kind === "eid") {
    setHtml(
      el,
      html`<div class="rm-hero-main">
        <i class="fas fa-star-and-crescent rm-hero-icon" aria-hidden="true"></i>
        <div class="rm-hero-text">
          <p class="rm-hero-big">${t("ramadanEidMubarak")}</p>
          <p class="rm-hero-note">${t("ramadanNextIn")
            .replace("{year}", String(view.year))
            .replace("{days}", fmt.duration({ days: m.daysLeft }, "long"))}</p>
        </div>
      </div>`,
    );
  } else if (m.kind === "lastEvening" || m.kind === "after") {
    setHtml(
      el,
      html`<div class="rm-hero-main">
        <i class="fas fa-star-and-crescent rm-hero-icon" aria-hidden="true"></i>
        <div class="rm-hero-text">
          <p class="rm-hero-big">${m.kind === "after" ? t("ramadanEnded").replace("{year}", String(view.year)) : t("ramadanComplete")}</p>
          <p class="rm-hero-note">${m.kind === "after" ? "" : t("ramadanEidTomorrow")}</p>
        </div>
      </div>`,
    );
  } else if (day && m.target) {
    // tomorrow, suhoor, fasting, evening: a countdown
    const kicker = {
      tomorrow: t("ramadanBeginsTomorrow"),
      suhoor: dayOf(day.day),
      fasting: dayOf(day.day),
      evening: t("ramadanFastDone"),
    }[m.kind];
    const label =
      m.kind === "fasting" ? t("ramadanIftarIn") : t("ramadanSuhoorEndsIn");
    const fastingDay = m.kind === "evening" ? day.day - 1 : day.day;
    setHtml(
      el,
      html`<div class="rm-hero-main">
          ${m.kind === "tomorrow" ? html`<i class="fas fa-moon rm-hero-icon" aria-hidden="true"></i>` : dayRing(fastingDay)}
          <div class="rm-hero-text">
            <p class="rm-hero-kicker">${kicker}</p>
            <p class="rm-hero-label">${label}</p>
            <p class="rm-hero-big rm-countdown" id="rmCountdown">${countdown(now, m.target)}</p>
            ${
              m.kind === "fasting" &&
              html`<div class="rm-fast-bar" aria-hidden="true"><span id="rmFastFill"></span></div>
              <p class="rm-hero-note">${t("ramadanFastLength")}: ${fmt.duration({ hours: Math.floor(fastMinutes(day) / 60), minutes: fastMinutes(day) % 60 }, "short")}</p>`
            }
          </div>
        </div>
        ${timeTiles(day)}`,
    );
    tick(now);
  } else {
    setHtml(el, html``);
  }
}

/**
 * Updates the countdown. Returns false when the moment changed kind (index.js then draws
 * the page again).
 * @param {Date} now
 */
function tick(now) {
  const m = momentAt(now);
  if (keyOf(m) !== shownKey) return false;
  const counter = document.getElementById("rmCountdown");
  if (counter && m.target) counter.textContent = countdown(now, m.target);
  const fill = document.getElementById("rmFastFill");
  if (fill && m.start && m.target) {
    const done =
      (now.getTime() - m.start.getTime()) /
      (m.target.getTime() - m.start.getTime());
    fill.style.width = `${Math.round(Math.min(1, Math.max(0, done)) * 1000) / 10}%`;
  }
  return true;
}

/** Shown instead of the card when there is nothing to show. @param {string} message */
function renderMessage(message) {
  setHtml(
    byId("rmHero", HTMLElement),
    html`<p class="rm-message">${message}</p>`,
  );
}

module.exports = { momentAt, render, tick, renderMessage };
