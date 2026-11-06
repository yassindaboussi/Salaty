"use strict";

// How the prayer times are calculated: the method ("Automatic" = the authority closest to the
// location, or one of Aladhan's methods) and the Asr rule (standard or Hanafi). Main reloads
// the times when either changes (settings-handlers.js), like after a new location.
const { ipcRenderer } = require("electron");
const { t } = require("../../core/i18n");
const { state } = require("../../core/store");
const { byId, queryAll } = require("../../core/dom");
const { html, setHtml } = require("../../utils/html");
const { METHOD_IDS } = require("../../../../shared/aladhan");
const { persistSettings } = require("./persist");

/** The method's name in the UI language (Aladhan's for one the app has no name for). */
function methodName(
  /** @type {number} */ id,
  /** @type {string} */ fallback = "",
) {
  const key = `mpMethod${id}`;
  return t(key) === key ? fallback || String(id) : t(key);
}

/** Fills the list: Automatic first, then the methods by name. */
function renderOptions() {
  const select = byId("prayerMethodInput", HTMLSelectElement);
  const sorted = [...METHOD_IDS].sort((a, b) =>
    methodName(a).localeCompare(methodName(b)),
  );
  setHtml(
    select,
    html`<option value="auto">${t("calcMethodAuto")}</option>${sorted.map(
      (id) => html`<option value="${String(id)}">${methodName(id)}</option>`,
    )}`,
  );
  select.value = String(state.settings.prayerMethod ?? "auto");
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

  const select = byId("prayerMethodInput", HTMLSelectElement);
  select.addEventListener("change", () => {
    const value = select.value === "auto" ? "auto" : Number(select.value);
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
}

/** After a language change (names) or a location change (the automatic method). */
function updateCalculationText() {
  renderOptions();
  renderDescription();
}

module.exports = { initCalculationSettings, updateCalculationText };
