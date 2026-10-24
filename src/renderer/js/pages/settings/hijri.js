"use strict";

// The Hijri calendar card: the first day of the week (automatic = the country's, core/week.js)
// and the Hijri date correction (-2…+2 days), which the main process applies to every Hijri
// date in the app: home page, calendar, Ramadan, fasting reminders.
const { ipcRenderer } = require("electron");
const { t } = require("../../core/i18n");
const { state } = require("../../core/store");
const { firstDayOfWeek } = require("../../core/week");
const { hijriMonthName } = require("../../core/dates");
const { weekdayName } = require("../../core/date-format");
const { queryAll } = require("../../core/dom");
const { persistSettings } = require("./persist");

function initHijriSettings() {
  const current = state.settings.weekStart ?? "auto";
  queryAll('input[name="weekStart"]', HTMLInputElement).forEach((input) => {
    input.checked = input.value === current;
    input.addEventListener("change", () => {
      if (!input.checked) return;
      state.settings.weekStart = input.value;
      updateHijriText();
      persistSettings();
    });
  });

  const adjustment = document.getElementById("hijriAdjustmentInput");
  if (adjustment instanceof HTMLInputElement) {
    adjustment.value = String(state.settings.hijriAdjustment ?? 0);
    adjustment.addEventListener("change", async () => {
      const days = Math.max(
        -2,
        Math.min(2, parseInt(adjustment.value, 10) || 0),
      );
      adjustment.value = String(days);
      if (days === (state.settings.hijriAdjustment ?? 0)) return;
      state.settings.hijriAdjustment = days;
      await persistSettings();
      showTodayPreview();
    });
  }

  updateHijriText();
}

// The texts built from the language and the location: the weekday names, the automatic
// first day, today's Hijri date. Called again after a language or location change.
function updateHijriText() {
  queryAll("[data-weekday]", HTMLElement).forEach((el) => {
    el.textContent = weekdayName(Number(el.dataset.weekday), "short");
  });
  const description = document.getElementById("weekStartDesc");
  if (description) {
    description.textContent =
      (state.settings.weekStart ?? "auto") === "auto"
        ? t("weekStartAutoDesc").replace(
            "{day}",
            weekdayName(firstDayOfWeek(state.settings), "long"),
          )
        : t("weekStartFixedDesc");
  }
  showTodayPreview();
}

let previewRequest = 0;

// "Today: 8 Jumada al-Awwal 1448 AH", with the saved correction: the user sees its effect.
async function showTodayPreview() {
  const el = document.getElementById("hijriTodayPreview");
  if (!el) return;
  const request = ++previewRequest;
  const now = new Date();
  /** @type {any} Aladhan's { hijri, gregorian } */
  let data = null;
  try {
    data = await ipcRenderer.invoke(
      "gregorian-to-hijri",
      now.getDate(),
      now.getMonth() + 1,
      now.getFullYear(),
    );
  } catch (err) {
    console.error("Error loading today's Hijri date:", err);
  }
  if (request !== previewRequest) return;
  const hijri = data?.hijri;
  el.textContent = hijri
    ? t("hijriTodayPreview").replace(
        "{date}",
        `${hijri.day} ${hijriMonthName(Number(hijri.month.number))} ${hijri.year} ${t("ah")}`,
      )
    : "";
}

module.exports = { initHijriSettings, updateHijriText };
