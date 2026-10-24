"use strict";

// The top of the counter card: the words being counted, their meaning and source with the
// hadith links, and, during the after-prayer tasbih, its three steps.
const { t } = require("../../core/i18n");
const { html, setHtml } = require("../../utils/html");
const { byId } = require("../../core/dom");
const { pageState, AFTER_PRAYER, counting } = require("./state");
const { meaningOf, sourceOf, referenceLinks } = require("./texts");

function renderActive() {
  const { dhikr } = counting();
  const name = byId("activeDhikrName", HTMLElement);
  name.textContent = dhikr.name;
  name.classList.toggle("is-long", dhikr.name.length > 40);
  const meaning = byId("activeDhikrMeaning", HTMLElement);
  meaning.textContent = meaningOf(dhikr);
  meaning.hidden = !meaning.textContent;
  setHtml(
    byId("activeDhikrSource", HTMLElement),
    html`<span>${sourceOf(dhikr)}</span> ${referenceLinks(dhikr)}`,
  );
  renderSequenceBar();
}

function renderSequenceBar() {
  const bar = byId("tbSequence", HTMLElement);
  const seq = pageState.sequence;
  bar.hidden = !seq;
  if (!seq) return;
  setHtml(
    bar,
    html`<span class="tb-seq-label">${t("tbAfterPrayer")} · ${
      seq.done
        ? t("tbSequenceDoneShort")
        : t("tbStepOf")
            .replace("{n}", String(seq.step + 1))
            .replace("{total}", String(AFTER_PRAYER.length))
    }</span>
      <span class="tb-seq-steps" aria-hidden="true">${AFTER_PRAYER.map(
        (step, i) =>
          html`<span class="tb-seq-step${seq.counts[i] >= step.count ? " is-done" : i === seq.step ? " is-now" : ""}"></span>`,
      )}</span>
      ${seq.done && html`<button type="button" class="tb-chip-btn" data-action="sequence-again">${t("tbStartAgain")}</button>`}
      <button type="button" class="tb-chip-btn" data-action="sequence-stop">${t("tbStop")}</button>`,
  );
}

module.exports = { renderActive };
