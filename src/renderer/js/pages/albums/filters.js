"use strict";

// The Recitations tab's filters: one chip per riwaya group (aria-pressed) and the "complete Quran
// only" switch. Both are remembered (state.js) and redraw the reciters.
const { t } = require("../../core/i18n");
const { byId } = require("../../core/dom");
const { html, setHtml } = require("../../utils/html");
const { state, savePrefs } = require("./state");
const { CHIPS, LABEL_KEYS } = require("./riwaya");

function renderChips() {
  if (!CHIPS.includes(state.riwaya)) state.riwaya = "all";
  setHtml(
    byId("acRiwaya", HTMLElement),
    html`${CHIPS.map(
      (key) =>
        html`<button type="button" class="ac-chip" data-riwaya="${key}" aria-pressed="${String(state.riwaya === key)}">${t(LABEL_KEYS[key])}</button>`,
    )}`,
  );
}

/** @param {() => void} onChange */
function bindFilters(onChange) {
  renderChips();
  byId("acRiwaya", HTMLElement).addEventListener("click", (e) => {
    const chip = /** @type {Element} */ (e.target).closest(".ac-chip");
    if (!(chip instanceof HTMLButtonElement) || !chip.dataset.riwaya) return;
    state.riwaya = chip.dataset.riwaya;
    savePrefs();
    renderChips();
    // the chips were redrawn: keep the focus on the one chosen
    const again = byId("acRiwaya", HTMLElement).querySelector(
      `[data-riwaya="${state.riwaya}"]`,
    );
    if (again instanceof HTMLElement) again.focus();
    onChange();
  });

  const complete = byId("acComplete", HTMLInputElement);
  complete.checked = state.completeOnly;
  complete.addEventListener("change", () => {
    state.completeOnly = complete.checked;
    savePrefs();
    onChange();
  });
}

module.exports = { bindFilters };
