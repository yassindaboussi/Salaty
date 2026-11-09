"use strict";

// How the prayer times are calculated: the method ("Automatic" = the authority closest to the
// location, or one of Aladhan's methods) and the Asr rule (standard or Hanafi). Main reloads
// the times when either changes (settings-handlers.js), like after a new location.
const { ipcRenderer } = require("electron");
const { t, getLanguage } = require("../../core/i18n");
const { state } = require("../../core/store");
const { byId, queryAll } = require("../../core/dom");
const TomSelect = require("tom-select").default;
const { METHOD_IDS } = require("../../../../shared/aladhan");
const {
  DEFAULT_EXTRA_TIMES,
  displayTime,
} = require("../../../../shared/prayerUtils");
const { persistSettings } = require("./persist");

/** The method's name in the UI language (Aladhan's for one the app has no name for). */
function methodName(
  /** @type {number} */ id,
  /** @type {string} */ fallback = "",
) {
  const key = `mpMethod${id}`;
  return t(key) === key ? fallback || String(id) : t(key);
}

/** @type {InstanceType<typeof TomSelect> | null} */
let picker = null;

/** Fills the list: Automatic first, then the methods by name. */
function renderOptions() {
  const sorted = [...METHOD_IDS].sort((a, b) =>
    methodName(a).localeCompare(methodName(b)),
  );
  const options = [
    { value: "auto", text: t("calcMethodAuto") },
    ...sorted.map((id) => ({ value: String(id), text: methodName(id) })),
  ];
  const current = String(state.settings.prayerMethod ?? "auto");
  if (!picker) {
    // The app's own list (like Country / City): Windows draws a native <select> list wider
    // than its box, 20 rows tall and in its own colours.
    picker = new TomSelect("#prayerMethodInput", {
      options,
      items: [current],
      maxOptions: 100,
      // a plain list: no typing to filter (only 24 methods)
      controlInput: null,
      dropdownClass: "ts-dropdown calc-dropdown",
      // keep "Automatic" first, the rest by name
      sortField: [{ field: "$order" }, { field: "$score" }],
    });
    return;
  }
  picker.clearOptions();
  picker.addOptions(options);
  picker.setValue(current, true);
}

/** Under the label: which method Automatic uses here, or that a fixed one is used. */
async function renderDescription() {
  const desc = byId("prayerMethodDesc", HTMLElement);
  if ((state.settings.prayerMethod ?? "auto") !== "auto") {
    desc.textContent = t("calcMethodFixedDesc");
    return;
  }
  const data = await ipcRenderer.invoke("get-prayer-data").catch(() => null);
  const method = data?.meta?.method;
  desc.textContent =
    method && method.id !== undefined
      ? t("calcMethodAutoDesc").replace(
          "{method}",
          methodName(method.id, method.name),
        )
      : t("calcMethodAutoHint");
}

async function save() {
  await persistSettings();
  // main reloads the times first: then the description names the method really used
  setTimeout(renderDescription, 1500);
}

function initCalculationSettings() {
  renderOptions();
  renderDescription();

  picker?.on("change", (/** @type {string} */ raw) => {
    // a cleared box (Backspace) goes back to the saved method
    if (!raw)
      return picker?.setValue(
        String(state.settings.prayerMethod ?? "auto"),
        true,
      );
    const value = raw === "auto" ? "auto" : Number(raw);
    if (value === (state.settings.prayerMethod ?? "auto")) return;
    state.settings.prayerMethod = value;
    renderDescription();
    save();
  });

  const current = state.settings.asrSchool ?? "standard";
  queryAll('input[name="asrSchool"]', HTMLInputElement).forEach((input) => {
    input.checked = input.value === current;
    input.addEventListener("change", () => {
      if (!input.checked) return;
      state.settings.asrSchool = input.value;
      save();
    });
  });
  initShowTimes();
  initTimeFormat();
}

// Show times: the extra times (Sunrise, Midnight...) on the home page and the widget. Main
// tells both, the widget resizes (settings-handlers.js).
function initShowTimes() {
  const on = { ...DEFAULT_EXTRA_TIMES, ...(state.settings.extraTimes ?? {}) };
  queryAll('input[name="extraTime"]', HTMLInputElement).forEach((input) => {
    input.checked = on[input.value] === true;
    input.addEventListener("change", () => {
      state.settings.extraTimes = {
        ...DEFAULT_EXTRA_TIMES,
        ...(state.settings.extraTimes ?? {}),
        [input.value]: input.checked,
      };
      persistSettings();
    });
  });
}

// 24-hour or 12-hour times; main tells the home page and the widget (settings-handlers.js)
function initTimeFormat() {
  const current = state.settings.timeFormat ?? "24";
  queryAll('input[name="timeFormat"]', HTMLInputElement).forEach((input) => {
    input.checked = input.value === current;
    input.addEventListener("change", () => {
      if (!input.checked) return;
      state.settings.timeFormat = input.value;
      persistSettings();
    });
  });
  renderTimeSamples();
}

/** Each choice shows how 17:05 looks with it, in the UI language ("5:05 م" in Arabic). */
function renderTimeSamples() {
  queryAll("[data-time-sample]", HTMLElement).forEach((el) => {
    el.textContent = displayTime("17:05", el.dataset.timeSample, getLanguage());
  });
}

/** After a language change (names) or a location change (the automatic method). */
function updateCalculationText() {
  renderOptions();
  renderDescription();
  renderTimeSamples();
}

module.exports = { initCalculationSettings, updateCalculationText };
