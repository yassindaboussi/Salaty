"use strict";

// Monthly Prayer Times: a month's timetable (with Sunrise and the Hijri dates) and, in the
// panel, the chosen day's times. The month can be saved as a PDF (its print styles).
//   state.js       what is shown now
//   data.js        a month's days from the main process (saved on disk, works offline)
//   table.js       the timetable, choosing a day (click, arrow keys)
//   panel.js       the chosen day and the location
//   panel-fold.js  folding the panel to a strip of icons
const { ipcRenderer } = require("electron");
const { t } = require("../../core/i18n");
const { showToast } = require("../../core/toast");
const { byId } = require("../../core/dom");
const { state } = require("../../core/store");
const fmt = require("../../core/date-format");
const { hijriMonthName } = require("../../core/dates");
const {
  setupConnectionRecovery,
} = require("../../services/connection-recovery");
const { view } = require("./state");
const { loadMonth } = require("./data");
const {
  renderTable,
  markSelected,
  scrollToSelected,
  bindTable,
} = require("./table");
const { renderDay, renderLocation } = require("./panel");
const { bindPanelFold } = require("./panel-fold");

let loadId = 0; // a quicker later month wins over a slower earlier one

/** @param {string} text  "" hides the message and shows the timetable */
function showMessage(text) {
  const message = byId("mpMessage", HTMLElement);
  message.textContent = text;
  message.hidden = !text;
  byId("mpTableWrap", HTMLElement).hidden = Boolean(text);
  byId("mpLayout", HTMLElement).classList.toggle("is-empty", Boolean(text));
}

function renderMonthTitle() {
  const first = new Date(view.year, view.month - 1, 1);
  byId("mpMonth", HTMLElement).textContent = fmt.gregorian(first, {
    month: "long",
    year: "numeric",
  });
  const a = view.days[0]?.hijri;
  const b = view.days.at(-1)?.hijri;
  let hijri = "";
  if (a && b) {
    hijri =
      a.year === b.year
        ? `${hijriMonthName(a.month)} – ${hijriMonthName(b.month)} ${b.year} ${t("ah")}`
        : `${hijriMonthName(a.month)} ${a.year} – ${hijriMonthName(b.month)} ${b.year} ${t("ah")}`;
  }
  byId("mpMonthHijri", HTMLElement).textContent = hijri;
}

/** The heading printed above the table. */
function renderPrintHead() {
  const { city, country } = state.settings;
  byId("mpPrintHead", HTMLElement).textContent = [
    t("prayerTimesMonthly"),
    byId("mpMonth", HTMLElement).textContent,
    [city, country].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** @param {{ scroll?: boolean }} [options] */
async function showMonth({ scroll = true } = {}) {
  const id = ++loadId;
  view.days = [];
  renderMonthTitle();
  renderLocation();
  if (!state.settings.city || !state.settings.country) {
    showMessage(t("mpNoLocation"));
    renderDay();
    return;
  }
  showMessage(t("loadingMonthlyPrayerTimes"));
  /** @type {import("./state").MonthDay[] | null} */
  let days = null;
  try {
    days = await loadMonth(view.year, view.month);
  } catch (err) {
    console.error("[MonthlyPrayerTimes] could not load the month:", err);
  }
  if (id !== loadId) return;
  if (!days) {
    showMessage(t("mpOffline"));
    renderDay();
    return;
  }
  view.days = days;
  // today in its month, else the 1st
  if (!days.some((d) => d.iso === view.selectedIso)) {
    view.selectedIso = (
      days.find((d) => d.iso === view.todayIso) ?? days[0]
    ).iso;
  }
  showMessage("");
  renderMonthTitle();
  renderPrintHead();
  renderTable();
  renderDay();
  if (scroll) scrollToSelected();
}

/** @param {number} delta */
function changeMonth(delta) {
  const d = new Date(view.year, view.month - 1 + delta, 1);
  view.year = d.getFullYear();
  view.month = d.getMonth() + 1;
  showMonth();
}

function goToday() {
  const now = new Date();
  view.year = now.getFullYear();
  view.month = now.getMonth() + 1;
  view.selectedIso = view.todayIso;
  showMonth();
}

/** @param {string} iso */
function select(iso) {
  view.selectedIso = iso;
  markSelected(iso);
  renderDay();
  scrollToSelected(true);
}

// back to the page after midnight: today moves on (and the next prayer every minute)
function checkNewDay() {
  const today = fmt.todayIso();
  if (today === view.todayIso) {
    renderDay();
    return;
  }
  if (view.selectedIso === view.todayIso) view.selectedIso = today;
  view.todayIso = today;
  if (view.days.length) {
    renderTable();
    renderDay();
  }
}

async function exportPdf() {
  const { city } = state.settings;
  const name = [
    t("prayerTimesMonthly"),
    byId("mpMonth", HTMLElement).textContent,
    city,
  ]
    .filter(Boolean)
    .join(" - ");
  const result = await ipcRenderer.invoke("export-month-pdf", name);
  if (result === "saved") showToast(t("mpPdfSaved"), "success");
  else if (result === "failed") showToast(t("mpPdfFailed"), "error");
}

function initMonthlyPrayerTimesPage() {
  const now = new Date();
  view.year = now.getFullYear();
  view.month = now.getMonth() + 1;
  view.todayIso = fmt.todayIso();
  view.selectedIso = view.todayIso;

  byId("mpPrev", HTMLButtonElement).addEventListener("click", () =>
    changeMonth(-1),
  );
  byId("mpNext", HTMLButtonElement).addEventListener("click", () =>
    changeMonth(1),
  );
  byId("mpToday", HTMLButtonElement).addEventListener("click", goToday);
  byId("mpPdf", HTMLButtonElement).addEventListener("click", exportPdf);
  bindTable(select);
  bindPanelFold(exportPdf);

  window.addEventListener("focus", checkNewDay);
  document.addEventListener("visibilitychange", checkNewDay);
  setInterval(checkNewDay, 60_000);
  // back online: load the month being viewed again (a failed month is not kept)
  setupConnectionRecovery(
    () => showMonth({ scroll: false }),
    "MonthlyPrayerTimes",
  );

  showMonth();
}

module.exports = { initMonthlyPrayerTimesPage };
