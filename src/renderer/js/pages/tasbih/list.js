"use strict";

// The dhikr to choose from: the after-prayer tasbih, the dhikr of the Sunnah, and the user's
// own with "Add your own dhikr". Each row shows its progress ("12 / 33"); the buttons carry
// data-action (index.js).
const { t } = require("../../core/i18n");
const { html, setHtml } = require("../../utils/html");
const { byId, queryAll } = require("../../core/dom");
const { pageState, SUNNAH_DHIKR, AFTER_PRAYER, findDhikr } = require("./state");
const { meaningOf } = require("./texts");

/** "12 / 33", or "12" with no limit @param {import("./state").Dhikr} dhikr */
function progressOf(dhikr) {
  const count = pageState.counts[dhikr.id] ?? 0;
  return pageState.unlimited[dhikr.id]
    ? `${count} · ∞`
    : `${count} / ${dhikr.count}`;
}

/** @param {import("./state").Dhikr} dhikr */
function row(dhikr) {
  const active = !pageState.sequence && pageState.currentId === dhikr.id;
  const meaning = meaningOf(dhikr);
  return html`<li class="tb-item${active ? " is-active" : ""}">
    <button type="button" class="tb-item-main" data-action="choose" data-id="${dhikr.id}" aria-pressed="${active}">
      <span class="tb-item-text">
        <span class="tb-item-name${dhikr.custom ? "" : " is-arabic"}" dir="auto">${dhikr.name}</span>
        ${meaning && html`<span class="tb-item-meaning" dir="auto">${meaning}</span>`}
      </span>
      <span class="tb-item-count" data-count-for="${dhikr.id}">${progressOf(dhikr)}</span>
    </button>
    ${
      dhikr.custom &&
      html`<button type="button" class="tb-item-edit" data-action="edit" data-id="${dhikr.id}" aria-label="${t("edit")}: ${dhikr.name}"><i class="fas fa-pen" aria-hidden="true"></i></button>
      <button type="button" class="tb-item-edit is-delete" data-action="delete" data-id="${dhikr.id}" aria-label="${t("delete")}: ${dhikr.name}"><i class="fas fa-trash" aria-hidden="true"></i></button>`
    }
  </li>`;
}

function renderLists() {
  const seq = pageState.sequence;
  setHtml(
    byId("tbSequenceCard", HTMLElement),
    html`<button type="button" class="tb-seq-card${seq ? " is-active" : ""}" data-action="sequence-start" aria-pressed="${Boolean(seq)}">
        <span class="tb-seq-icon" aria-hidden="true"><i class="fas fa-mosque"></i></span>
        <span class="tb-item-text">
          <span class="tb-item-title">${t("tbAfterPrayer")}</span>
          <span class="tb-item-meaning">${t("tbAfterPrayerSteps")}</span>
        </span>
        <span class="tb-item-count">${seq ? (seq.done ? "✓" : `${seq.step + 1}/${AFTER_PRAYER.length}`) : t("tbStart")}</span>
      </button>
      <p class="tb-seq-source">${t("tbAfterPrayerNote")} <button type="button" class="tb-source" data-source="https://sunnah.com/muslim:596">Muslim 596</button></p>`,
  );
  setHtml(byId("tbSunnahList", HTMLElement), html`${SUNNAH_DHIKR.map(row)}`);
  byId("tbTotalSunnah", HTMLElement).textContent = String(SUNNAH_DHIKR.length);
  byId("tbTotalMine", HTMLElement).textContent = String(
    pageState.custom.length,
  );
  setHtml(
    byId("tbCustomList", HTMLElement),
    pageState.custom.length
      ? html`${pageState.custom.map(row)}`
      : html`<li class="tb-empty">${t("tbNoCustom")}</li>`,
  );
}

/** After a count: only the numbers change (the rows, and the focus, stay). */
function updateListCounts() {
  for (const el of queryAll("[data-count-for]", HTMLElement)) {
    const dhikr = findDhikr(el.dataset.countFor ?? "");
    if (dhikr) el.textContent = progressOf(dhikr);
  }
  const seq = pageState.sequence;
  const seqCount = document.querySelector(".tb-seq-card .tb-item-count");
  if (seq && seqCount) {
    seqCount.textContent = seq.done
      ? "✓"
      : `${seq.step + 1}/${AFTER_PRAYER.length}`;
  }
}

module.exports = { renderLists, updateListCounts };
