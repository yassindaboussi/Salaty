"use strict";

// Adding and editing the user's own dhikr: a native <dialog> (Escape closes it, the focus stays
// inside), with the words, an optional meaning and the target (33, 100, another number, or no
// limit). Deleting asks first; the dhikr's count goes with it.
const { t } = require("../../core/i18n");
const { byId, queryAll } = require("../../core/dom");
const analytics = require("../../services/analytics");
const { showConfirmDialog } = require("../../components/confirm-dialog");
const { pageState, SUNNAH_DHIKR } = require("./state");
const storage = require("./storage");

/** @type {string | null} the dhikr being edited (null: a new one) */
let editingId = null;
/** @type {(() => void) | null} */
let onSaved = null;

const dialog = () => byId("tbEditor", HTMLDialogElement);
const field = (/** @type {string} */ id) => byId(id, HTMLInputElement);

/** @param {string} value */
function setTarget(value) {
  for (const radio of queryAll('input[name="tbTarget"]', HTMLInputElement)) {
    radio.checked = radio.value === value;
  }
  byId("tbOtherStepper", HTMLElement).classList.toggle(
    "is-on",
    value === "other",
  );
}

const MAX_TARGET = 100_000;

/** The "other" number moved by `by` (the − / + buttons): it becomes the chosen target. */
function stepOther(/** @type {number} */ by) {
  const input = field("tbFieldOther");
  const now = parseInt(input.value, 10) || 0;
  input.value = String(Math.min(MAX_TARGET, Math.max(1, now + by)));
  setTarget("other");
}

// − / +: a click steps by one; holding the button repeats, faster after a moment.
function bindStepper() {
  const input = field("tbFieldOther");
  for (const button of queryAll(
    "#tbOtherStepper [data-step]",
    HTMLButtonElement,
  )) {
    const by = Number(button.dataset.step);
    /** @type {ReturnType<typeof setTimeout> | null} */
    let hold = null;
    const stop = () => {
      if (hold) clearTimeout(hold);
      hold = null;
    };
    const repeat = (/** @type {number} */ delay) => {
      hold = setTimeout(() => {
        stepOther(by);
        repeat(Math.max(40, delay * 0.85));
      }, delay);
    };
    button.addEventListener("pointerdown", (e) => {
      e.preventDefault(); // keep the focus where it is
      stepOther(by);
      repeat(450);
    });
    for (const end of ["pointerup", "pointerleave", "pointercancel"]) {
      button.addEventListener(end, stop);
    }
  }
  // digits only; typing a number chooses "other"
  input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, "").slice(0, 6);
    setTarget("other");
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      stepOther(e.key === "ArrowUp" ? 1 : -1);
    }
  });
}

/** @param {string | null} id null to add one */
function openEditor(id) {
  editingId = id;
  const dhikr = id ? pageState.custom.find((d) => d.id === id) : null;
  byId("tbEditorTitle", HTMLElement).textContent = t(
    dhikr ? "tbEditorEditTitle" : "tbEditorAddTitle",
  );
  byId("tbFieldText", HTMLTextAreaElement).value = dhikr?.name ?? "";
  field("tbFieldMeaning").value = dhikr?.meaning ?? "";
  const count = dhikr?.count ?? 33;
  const unlimited = dhikr ? Boolean(pageState.unlimited[dhikr.id]) : false;
  field("tbFieldOther").value = String(count);
  setTarget(
    unlimited
      ? "none"
      : count === 33 || count === 100
        ? String(count)
        : "other",
  );
  byId("tbEditorError", HTMLElement).hidden = true;
  dialog().showModal();
  byId("tbFieldText", HTMLTextAreaElement).focus();
}

function save() {
  const name = byId("tbFieldText", HTMLTextAreaElement).value.trim();
  const error = byId("tbEditorError", HTMLElement);
  if (!name) {
    error.textContent = t("tbTextRequired");
    error.hidden = false;
    byId("tbFieldText", HTMLTextAreaElement).focus();
    return;
  }
  const choice =
    queryAll('input[name="tbTarget"]', HTMLInputElement).find((r) => r.checked)
      ?.value ?? "33";
  const other = Math.round(Number(field("tbFieldOther").value));
  if (choice === "other" && !(other >= 1 && other <= 100_000)) {
    error.textContent = t("tbTargetInvalid");
    error.hidden = false;
    field("tbFieldOther").focus();
    return;
  }
  const count = choice === "other" ? other : choice === "100" ? 100 : 33;
  const meaning = field("tbFieldMeaning").value.trim();
  let dhikr = editingId
    ? pageState.custom.find((d) => d.id === editingId)
    : undefined;
  if (dhikr) {
    Object.assign(dhikr, { name, meaning, count });
    analytics.tasbihCustomDhikr("edited");
  } else {
    dhikr = {
      id: `my-${Date.now().toString(36)}`,
      name,
      meaning,
      count,
      custom: true,
    };
    pageState.custom.push(dhikr);
    analytics.tasbihCustomDhikr("added");
  }
  pageState.unlimited[dhikr.id] = choice === "none";
  storage.saveCustom();
  storage.saveUnlimited();
  dialog().close();
  // a new or edited dhikr is the one counted next
  pageState.sequence = null;
  storage.saveSequence();
  pageState.currentId = dhikr.id;
  storage.saveCounts();
  onSaved?.();
}

/** A name cut to 40 characters for a question ("Delete …?"). @param {string} name */
function shortName(name) {
  const chars = Array.from(name);
  return chars.length > 40 ? `${chars.slice(0, 40).join("")}…` : name;
}

/**
 * Deletes one of the user's own dhikr (the bin next to its pencil), after asking.
 * @param {string} id
 */
async function removeDhikr(id) {
  const dhikr = pageState.custom.find((d) => d.id === id);
  if (!dhikr) return;
  const sure = await showConfirmDialog(
    t("tbDeleteConfirm").replace("{name}", shortName(dhikr.name)),
    { confirmText: t("delete"), confirmClass: "btn-danger" },
  );
  if (!sure) return;
  pageState.custom = pageState.custom.filter((d) => d.id !== dhikr.id);
  delete pageState.counts[dhikr.id];
  delete pageState.unlimited[dhikr.id];
  if (pageState.currentId === dhikr.id)
    pageState.currentId = SUNNAH_DHIKR[0].id;
  storage.saveCustom();
  storage.saveUnlimited();
  storage.saveCounts();
  analytics.tasbihCustomDhikr("deleted");
  onSaved?.();
}

/** @param {() => void} savedListener the list and counter to draw again */
function bindEditor(savedListener) {
  onSaved = savedListener;
  byId("tbEditorForm", HTMLFormElement).addEventListener("submit", (e) => {
    e.preventDefault();
    save();
  });
  byId("tbEditorCancel", HTMLButtonElement).addEventListener("click", () =>
    dialog().close(),
  );
  byId("tbEditorClose", HTMLButtonElement).addEventListener("click", () =>
    dialog().close(),
  );
  for (const radio of queryAll('input[name="tbTarget"]', HTMLInputElement)) {
    radio.addEventListener("change", () => {
      setTarget(radio.value);
      if (radio.value === "other") field("tbFieldOther").focus();
    });
  }
  bindStepper();
  // a click on the backdrop (outside the box) closes it
  dialog().addEventListener("click", (e) => {
    if (e.target === dialog()) dialog().close();
  });
}

module.exports = { openEditor, bindEditor, removeDhikr };
