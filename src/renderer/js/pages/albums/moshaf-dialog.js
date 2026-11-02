"use strict";

// The dialog listing a reciter's recitations (those that pass the filters) when there are several:
// the riwaya and style ("Rewayat Hafs A'n Assem - Murattal") and how many surahs it has.
const { t } = require("../../core/i18n");
const { byId } = require("../../core/dom");
const { html, setHtml } = require("../../utils/html");
const { reciterPhotoHtml } = require("../../components/reciter-photo");
const { openRecitation } = require("./open-album");

/** @type {{ reciter: import("./state").Reciter, moshafs: import("./state").Moshaf[] } | null} */
let open = null;

/**
 * @param {import("./state").Reciter} reciter
 * @param {import("./state").Moshaf[]} moshafs
 */
function openMoshafDialog(reciter, moshafs) {
  open = { reciter, moshafs };
  setHtml(
    byId("acDialogHead", HTMLElement),
    html`${reciterPhotoHtml(reciter.id, reciter.name, "is-small")}<span>${reciter.name}</span>`,
  );
  setHtml(
    byId("acDialogList", HTMLElement),
    html`${moshafs.map(
      (m, i) =>
        html`<li><button type="button" class="ac-moshaf" data-index="${i}"><i class="fas fa-play" aria-hidden="true"></i><span class="ac-moshaf-name">${m.name}</span><span class="ac-moshaf-count">${t("acSurahCount").replace("{count}", String(m.surah_total))}</span></button></li>`,
    )}`,
  );
  byId("acDialog", HTMLDialogElement).showModal();
}

function bindMoshafDialog() {
  const dialog = byId("acDialog", HTMLDialogElement);
  byId("acDialogClose", HTMLButtonElement).addEventListener("click", () =>
    dialog.close(),
  );
  // a click on the backdrop closes it
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
  byId("acDialogList", HTMLElement).addEventListener("click", (e) => {
    const button = /** @type {Element} */ (e.target).closest(".ac-moshaf");
    if (!(button instanceof HTMLButtonElement) || !open) return;
    const moshaf = open.moshafs[Number(button.dataset.index)];
    dialog.close();
    if (moshaf) openRecitation(open.reciter, moshaf);
  });
}

module.exports = { openMoshafDialog, bindMoshafDialog };
