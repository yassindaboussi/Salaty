"use strict";

// The panel: the two mosques (the one shown is white, "Live"), the time and date in Makkah
// (Saudi time, the Umm al-Qura Hijri date: the calendar Saudi Arabia uses), "Open on YouTube".
const { t, getLocaleTag } = require("../../core/i18n");
const { byId } = require("../../core/dom");
const { html, setHtml } = require("../../utils/html");
const { CHANNELS } = require("./channels");

const MAKKAH_ZONE = "Asia/Riyadh";

/** @param {string} current */
function renderChannels(current) {
  setHtml(
    byId("lvChannels", HTMLElement),
    html`${CHANNELS.map(
      (
        c,
      ) => html`<button type="button" class="lv-channel" data-channel="${c.key}" aria-pressed="${String(c.key === current)}">
        <span class="lv-channel-icon" aria-hidden="true"><i class="fas ${c.icon}"></i></span>
        <span class="lv-channel-text">
          <span class="lv-channel-name">${t(c.name)}</span>
          <span class="lv-channel-sub">${t(c.place)} · ${t(c.tv)}</span>
        </span>
        ${c.key === current ? html`<span class="lv-live"><i class="fas fa-circle" aria-hidden="true"></i> ${t("live")}</span>` : ""}
      </button>`,
    )}`,
  );
  setHtml(
    byId("lvRail", HTMLElement),
    html`${CHANNELS.map(
      (c) =>
        html`<button type="button" class="lv-panel-toggle" data-channel="${c.key}" aria-pressed="${String(c.key === current)}" data-tip="${t(c.name)}" aria-label="${t(c.name)}"><i class="fas ${c.icon}" aria-hidden="true"></i></button>`,
    )}`,
  );
}

function renderClock() {
  const now = new Date();
  const locale = `${getLocaleTag()}-u-nu-latn`;
  byId("lvClock", HTMLElement).textContent = new Intl.DateTimeFormat(locale, {
    timeZone: MAKKAH_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
  const day = new Intl.DateTimeFormat(locale, {
    timeZone: MAKKAH_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
  const hijri = new Intl.DateTimeFormat(
    `${getLocaleTag()}-u-ca-islamic-umalqura-nu-latn`,
    {
      timeZone: MAKKAH_ZONE,
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  ).format(now);
  byId("lvDate", HTMLElement).textContent = `${day} · ${hijri}`;
}

module.exports = { renderChannels, renderClock };
