"use strict";

// The Sunnah fasting page. Its parts:
//   data.js          the fasting days (main process, shared/fasting-rules.js), prayer times,
//                    the seasons
//   hero.js          the next fast in full
//   list.js          the recent and coming days, then the seasons of the next months
//   panel.js         the reminders by kind, Ramadan make-up, your fasts, days not to fast
//   names.js         names, reasons and hadith sources in the UI language
//   sunnah-store.js  the fasts marked as done
//   state.js         what is shown
// The reminders themselves are shown by the main process (services/fasting-reminders.js).
const { ipcRenderer } = require("electron");
const { t } = require("../../core/i18n");
const { state } = require("../../core/store");
const { byId } = require("../../core/dom");
const fmt = require("../../core/date-format");
const analytics = require("../../services/analytics");
const { changeMadeUp } = require("../../services/ramadan-fasts");
const {
  setupConnectionRecovery,
} = require("../../services/connection-recovery");
const { TYPES } = require("../../../../shared/fasting-rules");
const { view } = require("./state");
const { loadDays } = require("./data");
const { renderHero, renderHeroMessage } = require("./hero");
const { renderLists } = require("./list");
const { renderPanel, renderMakeUp, renderMine } = require("./panel");
const store = require("./sunnah-store");

function initFastingPage() {
  const saved = state.settings.fastingReminders ?? {};
  view.prefs = {
    types: Array.isArray(saved.types)
      ? saved.types.filter((x) => TYPES.includes(x))
      : [],
    evening: saved.evening !== false,
    suhoor: saved.suhoor === true,
    suhoorMinutes: Number.isInteger(saved.suhoorMinutes)
      ? saved.suhoorMinutes
      : 30,
  };
  bindPage();
  setupConnectionRecovery(load, "Fasting");
  load();
}

async function load() {
  view.todayIso = fmt.todayIso();
  try {
    const now = new Date();
    const [days, today] = await Promise.all([
      loadDays(),
      ipcRenderer.invoke(
        "gregorian-to-hijri",
        now.getDate(),
        now.getMonth() + 1,
        now.getFullYear(),
      ),
    ]);
    view.days = days;
    const h = today?.hijri;
    view.todayHijri = h
      ? {
          day: Number(h.day),
          month: Number(h.month.number),
          year: Number(h.year),
        }
      : null;
  } catch (error) {
    console.error("Error loading the fasting days:", error);
    analytics.error("fasting_fetch", error.message || String(error));
    renderHeroMessage(t("fastError"));
    return;
  }
  byId("vfLayout", HTMLElement).classList.remove("is-loading");
  renderHero();
  renderLists();
  renderPanel();
}

/** Saves the reminders (the main process plans them again). */
async function savePrefs() {
  state.settings.fastingReminders = { ...view.prefs };
  try {
    await ipcRenderer.invoke("save-settings", { fastingReminders: view.prefs });
  } catch (err) {
    console.error("Error saving the fasting reminders:", err);
  }
  renderHero(); // its "reminder" line
}

function bindPage() {
  const page = byId("vfLayout", HTMLElement);

  page.addEventListener("change", (e) => {
    const input = e.target;
    if (input instanceof HTMLInputElement && input.dataset.type) {
      const type = input.dataset.type;
      view.prefs.types = input.checked
        ? [...new Set([...view.prefs.types, type])]
        : view.prefs.types.filter((x) => x !== type);
      analytics.fastingReminderToggled(type, input.checked);
    } else if (input instanceof HTMLInputElement && input.id === "vfEvening") {
      view.prefs.evening = input.checked;
    } else if (input instanceof HTMLInputElement && input.id === "vfSuhoor") {
      view.prefs.suhoor = input.checked;
      byId("vfSuhoorMinutes", HTMLSelectElement).disabled = !input.checked;
    } else if (
      input instanceof HTMLSelectElement &&
      input.id === "vfSuhoorMinutes"
    ) {
      view.prefs.suhoorMinutes = Number(input.value);
    } else {
      return;
    }
    savePrefs();
  });

  page.addEventListener("click", (e) => {
    const target = /** @type {Element} */ (e.target);
    const source = target.closest("[data-source]");
    if (source instanceof HTMLElement && source.dataset.source) {
      ipcRenderer.invoke("open-external", source.dataset.source);
      return;
    }
    const button = target.closest("[data-action]");
    if (!(button instanceof HTMLButtonElement) || button.disabled) return;
    if (button.dataset.action === "fasted") {
      const day = view.days.find((d) => d.iso === button.dataset.iso);
      if (!day) return;
      const fasted = !store.isFasted(day.iso);
      store.setFasted(day, fasted);
      analytics.sunnahFastMarked(fasted ? "mark" : "unmark");
      const inHero = Boolean(button.closest("#vfHero"));
      renderHero();
      renderLists();
      renderMine();
      // the button was drawn again: keep the focus on it
      const again = document.querySelector(
        `${inHero ? "#vfHero" : "#vfNear"} [data-action="fasted"][data-iso="${day.iso}"]`,
      );
      if (again instanceof HTMLElement) again.focus();
    } else if (button.dataset.action === "made-up") {
      changeMadeUp((view.todayHijri?.year ?? 9999) + 1, 1);
      renderMakeUp();
      renderHero();
      const again = document.querySelector('[data-action="made-up"]');
      if (again instanceof HTMLElement) again.focus();
    }
  });

  // left open past midnight: today moves on
  window.addEventListener("focus", () => {
    if (view.days.length && fmt.todayIso() !== view.todayIso) load();
  });
}

module.exports = { initFastingPage };
