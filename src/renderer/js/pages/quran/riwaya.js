"use strict";

// The riwaya switch in the display panel: Hafs, Qalun or Warsh. Qalun and Warsh are the riwayat
// of Nafi' read in North Africa; their text and font come from the King Fahd Complex. They count
// the ayahs the Madani way, so the translations (numbered like Hafs) are only offered with Hafs.
const { t } = require("../../core/i18n");
const { byId, queryAll } = require("../../core/dom");
const { state, isRiwaya, riwayaName } = require("./state");
const { saveRiwaya } = require("./storage");

/** @typedef {import("./state").Riwaya} Riwaya */

function updateRiwayaUI() {
  for (const btn of queryAll(".riwaya-btn", HTMLButtonElement)) {
    const on = btn.dataset.riwaya === state.riwaya;
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-pressed", String(on));
    if (isRiwaya(btn.dataset.riwaya))
      btn.textContent = riwayaName(btn.dataset.riwaya);
  }
  byId("riwayaGroup", HTMLElement).setAttribute("aria-label", t("quranRiwaya"));
  // the reader's font follows the riwaya (quran.css)
  byId("viewSurahReader", HTMLElement).dataset.riwaya = state.riwaya;

  const hafs = state.riwaya === "hafs";
  byId("translationTrigger", HTMLButtonElement).disabled = !hafs;
  byId("translationCombo", HTMLElement).classList.toggle("is-off", !hafs);
  byId("riwayaTranslationNote", HTMLElement).hidden = hafs;
}

/**
 * @param {Riwaya} riwaya
 * @param {{ save?: boolean }} [options]  save: remember it (not when another page opened an ayah)
 * @returns {boolean} whether it changed
 */
function setRiwaya(riwaya, { save = true } = {}) {
  if (save) saveRiwaya(riwaya);
  if (riwaya === state.riwaya) return false;
  state.riwaya = riwaya;
  updateRiwayaUI();
  return true;
}

/** @param {() => void} onChange  re-draws what depends on the riwaya */
function bindRiwaya(onChange) {
  for (const btn of queryAll(".riwaya-btn", HTMLButtonElement)) {
    btn.addEventListener("click", () => {
      if (isRiwaya(btn.dataset.riwaya) && setRiwaya(btn.dataset.riwaya))
        onChange();
    });
  }
}

module.exports = { updateRiwayaUI, setRiwaya, bindRiwaya };
