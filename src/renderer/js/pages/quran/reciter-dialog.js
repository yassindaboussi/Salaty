"use strict";

// The reciter list (a dialog): the recordings with ayah timings for the riwaya being read,
// searchable, each with its photo; the chosen one in white. Choosing one remembers it for that
// riwaya and, when that riwaya is playing, goes on with it at the same ayah.
const { t } = require("../../core/i18n");
const { byId } = require("../../core/dom");
const { showToast } = require("../../core/toast");
const { html, setHtml } = require("../../utils/html");
const { normalizeForSearch } = require("../../utils/search-text");
const { reciterPhotoHtml } = require("../../components/reciter-photo");
const { recitersFor, chosenReciter, chooseReciter } = require("./recitation");

/** @typedef {import("../../services/api/ayah-timing").TimedReciter} TimedReciter */

/** @type {TimedReciter[]} */
let shown = [];
let chosenRead = 0;

function renderList() {
  const query = normalizeForSearch(
    byId("reciterSearch", HTMLInputElement).value,
  );
  const list = shown.filter(
    (r) => !query || normalizeForSearch(r.name).includes(query),
  );
  const box = byId("reciterList", HTMLElement);
  if (!list.length) {
    setHtml(box, html`<p class="q-empty-line">${t("quranNoReciters")}</p>`);
    return;
  }
  setHtml(
    box,
    html`${list.map(
      (
        r,
      ) => html`<button type="button" class="q-reciter" data-read="${r.read}" aria-current="${String(r.read === chosenRead)}">
        ${reciterPhotoHtml(r.reciterId, r.name, "is-small")}
        <span class="q-reciter-name">${r.name}</span>
        ${r.mujawwad ? html`<span class="q-reciter-tag">${t("quranMujawwad")}</span>` : ""}
        ${r.read === chosenRead ? html`<i class="fas fa-check q-reciter-check" aria-hidden="true"></i>` : ""}
      </button>`,
    )}`,
  );
}

/** @param {import("./state").Riwaya} riwaya */
async function openReciterDialog(riwaya) {
  const dialog = byId("reciterDialog", HTMLDialogElement);
  try {
    shown = await recitersFor(riwaya);
    chosenRead = (await chosenReciter(riwaya))?.read ?? 0;
  } catch (err) {
    console.error("Reciters failed:", err);
    showToast(t("quranAudioError"), "error");
    return;
  }
  byId("reciterSearch", HTMLInputElement).value = "";
  renderList();
  dialog.showModal();
  // the chosen one in view and focused, like an open list
  const current = dialog.querySelector(".q-reciter[aria-current='true']");
  if (current instanceof HTMLElement) {
    current.scrollIntoView({ block: "center" });
    current.focus();
  }
}

function bindReciterDialog() {
  const dialog = byId("reciterDialog", HTMLDialogElement);
  byId("reciterDialogClose", HTMLButtonElement).addEventListener("click", () =>
    dialog.close(),
  );
  // a click on the backdrop (outside the box) closes it
  dialog.addEventListener("click", (e) => {
    if (e.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    const inside =
      e.clientX >= r.left &&
      e.clientX <= r.right &&
      e.clientY >= r.top &&
      e.clientY <= r.bottom;
    if (!inside) dialog.close();
  });
  byId("reciterSearch", HTMLInputElement).addEventListener("input", renderList);
  byId("reciterList", HTMLElement).addEventListener("click", (e) => {
    const row = /** @type {Element} */ (e.target).closest(".q-reciter");
    if (!(row instanceof HTMLElement)) return;
    const reciter = shown.find((r) => r.read === Number(row.dataset.read));
    if (!reciter) return;
    dialog.close();
    chooseReciter(reciter).catch((err) => {
      console.error("Changing reciter failed:", err);
      showToast(t("quranAudioError"), "error");
    });
  });
}

module.exports = { openReciterDialog, bindReciterDialog };
