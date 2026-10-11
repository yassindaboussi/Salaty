"use strict";

const { t } = require("../../core/i18n");
const { refreshTooltips } = require("../../core/tooltips");
const { byId, queryAll } = require("../../core/dom");
const { state } = require("./state");
const { loadAyahs } = require("./reader");

// ---- Translation picker (custom combobox: trigger button + listbox) ----
const translationOptions = () => queryAll(".translation-option", HTMLElement);

const isOptionDisabled = (opt) => opt.getAttribute("aria-disabled") === "true";

const translationList = () => document.getElementById("translationList");

const translationTrigger = () => document.getElementById("translationTrigger");

const isTranslationListOpen = () => !translationList()?.hidden;

// The bundled offline Quran data only has the English Sahih International text, so the other
// translations need the internet. They are marked unavailable (not removed) while offline.
// aria-disabled is used instead of `disabled` so the "needs internet" tooltip still shows.

function updateTranslationAvailability() {
  const offline = !navigator.onLine;
  translationOptions().forEach((opt) => {
    const blocked = offline && opt.dataset.needsInternet === "1";
    if (blocked) {
      opt.setAttribute("aria-disabled", "true");
      opt.setAttribute("data-tooltip", "translationOnlineOnly");
    } else {
      opt.removeAttribute("aria-disabled");
      opt.removeAttribute("data-tooltip");
      opt.removeAttribute("data-tip");
    }
  });
  if (offline) refreshTooltips();
}

// Shows the selected choice (name + language tag) on the trigger and marks it in the list.
function updateTranslationUI() {
  const label = t("translation");
  translationTrigger()?.setAttribute("aria-label", label);
  translationList()?.setAttribute("aria-label", label);
  const none = document.getElementById("translationNoneLabel");
  if (none) none.textContent = t("translationNone");

  /** @type {HTMLElement | null} */
  let selected = null;
  for (const opt of translationOptions()) {
    const isSelected = opt.dataset.translation === state.translationId;
    opt.setAttribute("aria-selected", String(isSelected));
    if (isSelected) selected = opt;
  }
  if (selected) {
    const name = selected.querySelector(".combo-name")?.textContent || "";
    const lang = selected.querySelector(".pill-lang")?.textContent || "";
    byId("translationCurrentName", HTMLElement).textContent = name;
    const langEl = byId("translationCurrentLang", HTMLElement);
    langEl.textContent = lang;
    langEl.hidden = !lang;
  }
  updateTranslationAvailability();
}

function setActiveTranslationOption(opt) {
  translationOptions().forEach((o) =>
    o.classList.toggle("highlighted", o === opt),
  );
  const trigger = translationTrigger();
  if (opt) {
    trigger?.setAttribute("aria-activedescendant", opt.id);
    opt.scrollIntoView({ block: "nearest" });
  } else {
    trigger?.removeAttribute("aria-activedescendant");
  }
}

function closeTranslationList() {
  const list = translationList();
  if (!list || list.hidden) return;
  list.hidden = true;
  setActiveTranslationOption(null);
  translationTrigger()?.setAttribute("aria-expanded", "false");
}

function openTranslationList() {
  const list = translationList();
  if (!list || !list.hidden) return;
  list.hidden = false;
  translationTrigger()?.setAttribute("aria-expanded", "true");
  setActiveTranslationOption(
    translationOptions().find(
      (o) => o.getAttribute("aria-selected") === "true",
    ) || null,
  );
}

async function setTranslation(id) {
  if (id === state.translationId) return;
  state.translationId = id;
  updateTranslationUI();
  if (state.currentSurah) {
    await loadAyahs(state.currentSurah.n);
  }
}

function chooseTranslationOption(opt) {
  if (!opt || isOptionDisabled(opt)) return;
  closeTranslationList();
  translationTrigger()?.focus();
  setTranslation(opt.dataset.translation);
}

// Moves the highlight by one enabled option (wraps around).
function moveTranslationHighlight(step) {
  const options = translationOptions().filter((o) => !isOptionDisabled(o));
  if (!options.length) return;
  const current = options.findIndex((o) => o.classList.contains("highlighted"));
  const next =
    current === -1
      ? step > 0
        ? 0
        : options.length - 1
      : (current + step + options.length) % options.length;
  setActiveTranslationOption(options[next]);
}

function onTranslationTriggerKeydown(e) {
  const open = isTranslationListOpen();
  switch (e.key) {
    case "ArrowDown":
    case "ArrowUp":
      e.preventDefault();
      if (!open) openTranslationList();
      else moveTranslationHighlight(e.key === "ArrowDown" ? 1 : -1);
      break;
    case "Home":
    case "End": {
      if (!open) return;
      e.preventDefault();
      const options = translationOptions().filter((o) => !isOptionDisabled(o));
      setActiveTranslationOption(
        e.key === "Home" ? options[0] : options[options.length - 1],
      );
      break;
    }
    case "Enter":
    case " ":
      e.preventDefault();
      if (!open) openTranslationList();
      else
        chooseTranslationOption(
          translationOptions().find((o) => o.classList.contains("highlighted")),
        );
      break;
    case "Escape":
      if (open) {
        e.preventDefault();
        closeTranslationList();
      }
      break;
    case "Tab":
      closeTranslationList();
      break;
    default:
  }
}

function bindTranslationCombo() {
  const trigger = translationTrigger();
  const list = translationList();
  if (!trigger || !list) return;

  trigger.addEventListener("click", () => {
    if (isTranslationListOpen()) closeTranslationList();
    else openTranslationList();
  });
  trigger.addEventListener("keydown", onTranslationTriggerKeydown);
  list.addEventListener("click", (e) => {
    if (e.target instanceof Element)
      chooseTranslationOption(e.target.closest(".translation-option"));
  });
  list.addEventListener("mouseover", (e) => {
    if (!(e.target instanceof Element)) return;
    const opt = e.target.closest(".translation-option");
    if (opt && !isOptionDisabled(opt)) setActiveTranslationOption(opt);
  });
  // Clicking anywhere else, or losing window focus, closes the list.
  document.addEventListener("mousedown", (e) => {
    const combo = document.getElementById("translationCombo");
    if (!(e.target instanceof Node && combo?.contains(e.target)))
      closeTranslationList();
  });
  window.addEventListener("blur", closeTranslationList);
  window.addEventListener("online", updateTranslationAvailability);
  window.addEventListener("offline", updateTranslationAvailability);
}

module.exports = { bindTranslationCombo, updateTranslationUI };
