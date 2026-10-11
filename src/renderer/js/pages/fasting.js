"use strict";
const { ipcRenderer } = require("electron");
const { state } = require("../core/store");
const { t, getLocaleTag } = require("../core/i18n");
const { hijriMonthName } = require("../core/dates");
const { html, setHtml } = require("../utils/html");
const { setupConnectionRecovery } = require("../services/connection-recovery");
const { byId, queryAll } = require("../core/dom");

const OCCASION_META = {
  whiteDays: {
    icon: "fa-moon",
    titleKey: "whiteDaysTitle",
    descKey: "whiteDaysDesc",
  },
  tasua: { icon: "fa-mosque", titleKey: "tasuaTitle", descKey: "tasuaDesc" },
  ashura: { icon: "fa-mosque", titleKey: "ashuraTitle", descKey: "ashuraDesc" },
  dhulHijjahFirst9: {
    icon: "fa-star-and-crescent",
    titleKey: "dhulHijjahFirst9Title",
    descKey: "dhulHijjahFirst9Desc",
  },
  arafah: {
    icon: "fa-mountain",
    titleKey: "arafahTitle",
    descKey: "arafahDesc",
  },
  shawwal6: {
    icon: "fa-utensils",
    titleKey: "shawwal6Title",
    descKey: "shawwal6Desc",
  },
};

let occasionsCache = [];

function initFastingPage() {
  // Only the occasions come from main; re-running the whole init would add every listener twice.
  setupConnectionRecovery(_loadOccasions, "Fasting");

  _setupLeadSelector();
  _setupWeeklyToggle();
  _loadOccasions();
}

function _setupLeadSelector() {
  const select = document.getElementById("vfLeadSelect");
  if (!(select instanceof HTMLSelectElement)) return;

  const fr = state.settings.fastingReminders || {};
  select.value = String(fr.leadDays || 1);

  select.addEventListener("change", () => {
    const current = state.settings.fastingReminders || {
      occasions: [],
      weeklyMonThu: false,
    };
    const updated = { ...current, leadDays: parseInt(select.value, 10) || 1 };
    state.settings.fastingReminders = updated;
    ipcRenderer.invoke("save-settings", { fastingReminders: updated });
    _renderHero();
    _renderList();
  });
}

function _currentLeadLabel() {
  const fr = state.settings.fastingReminders || {};
  const days = fr.leadDays || 1;
  const key =
    days >= 7
      ? "leadOption7"
      : days === 3
        ? "leadOption3"
        : days === 2
          ? "leadOption2"
          : "leadOption1";
  return t(key);
}

function _setupWeeklyToggle() {
  const toggle = document.getElementById("vfWeeklyToggle");
  if (!(toggle instanceof HTMLInputElement)) return;

  const fr = state.settings.fastingReminders || {};
  toggle.checked = Boolean(fr.weeklyMonThu);

  toggle.addEventListener("change", () => {
    const current = state.settings.fastingReminders || {
      occasions: [],
      weeklyMonThu: false,
    };
    const updated = { ...current, weeklyMonThu: toggle.checked };
    state.settings.fastingReminders = updated;
    ipcRenderer.invoke("save-settings", { fastingReminders: updated });
  });
}

async function _loadOccasions() {
  try {
    const occasions = await ipcRenderer.invoke("get-fasting-occasions");
    occasionsCache = Array.isArray(occasions) ? occasions : [];
  } catch {
    occasionsCache = [];
  }

  _renderHero();
  _renderList();
}

function _renderHero() {
  const hero = document.getElementById("vfHero");
  if (!hero) return;

  const next = occasionsCache[0];
  if (!next) {
    hero.classList.add("hidden");
    return;
  }
  hero.classList.remove("hidden");

  const meta = OCCASION_META[next.type] || {};
  setHtml(
    byId("vfHeroIcon", HTMLElement),
    html`<i class="fas ${meta.icon || "fa-utensils"}" aria-hidden="true"></i>`,
  );
  byId("vfHeroTitle", HTMLElement).textContent =
    (meta.titleKey && t(meta.titleKey)) || next.type;
  byId("vfHeroDate", HTMLElement).textContent = _formatDateLine(next);
  byId("vfHeroCountdown", HTMLElement).textContent = _relativeLabel(
    next.gregorianDate,
  );
  byId("vfHeroDesc", HTMLElement).textContent =
    (meta.descKey && t(meta.descKey)) || "";

  const btn = byId("vfHeroToggle", HTMLButtonElement);
  const label = byId("vfHeroToggleLabel", HTMLElement);
  const isOn = _isReminderOn(next.id);
  btn.classList.toggle("fasting-active", isOn);
  btn.title = _currentLeadLabel();
  label.textContent = t(isOn ? "reminderOn" : "remindMe");
  btn.onclick = () => {
    _toggleReminder(next.id);
    const nowOn = _isReminderOn(next.id);
    btn.classList.toggle("fasting-active", nowOn);
    label.textContent = t(nowOn ? "reminderOn" : "remindMe");
    _renderList();
  };
}

function _renderList() {
  const listEl = document.getElementById("vfList");
  if (!listEl) return;

  const rest = occasionsCache.slice(1);

  if (rest.length === 0 && occasionsCache.length === 0) {
    setHtml(
      listEl,
      html`<div class="fasting-empty">${t("noUpcomingFastingDays")}</div>`,
    );
    return;
  }
  if (rest.length === 0) {
    listEl.innerHTML = "";
    return;
  }

  setHtml(listEl, html`${rest.map((o) => _renderItem(o))}`);

  queryAll("[data-occasion-id]", HTMLElement, listEl).forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.dataset.occasionId;
      _toggleReminder(id);
      const nowOn = _isReminderOn(id);
      el.classList.toggle("fasting-active", nowOn);
    });
  });
}

function _renderItem(o) {
  const meta = OCCASION_META[o.type] || {};
  const title = (meta.titleKey && t(meta.titleKey)) || o.type;
  const desc = (meta.descKey && t(meta.descKey)) || "";
  const isOn = _isReminderOn(o.id);

  return html`
    <div class="fasting-item">
      <div class="fasting-item-icon"><i class="fas ${meta.icon || "fa-utensils"}" aria-hidden="true"></i></div>
      <div class="fasting-item-info">
        <div class="fasting-item-title">${title}</div>
        <div class="fasting-item-meta">
          <span class="fasting-item-date-chip">${_relativeLabel(o.gregorianDate)}</span>
          <span>•</span>
          <span>${_formatDateLine(o)}</span>
        </div>
        <div class="fasting-item-desc">${desc}</div>
      </div>
      <button
        type="button"
        class="fasting-bell-btn${isOn ? " fasting-active" : ""}"
        data-occasion-id="${o.id}"
        aria-label="${t("remindMe")}"
        title="${_currentLeadLabel()}"
      >
        <i class="fas fa-bell" aria-hidden="true"></i>
      </button>
    </div>
  `;
}

function _isReminderOn(occasionId) {
  const fr = state.settings.fastingReminders || {};
  return Array.isArray(fr.occasions) && fr.occasions.includes(occasionId);
}

function _toggleReminder(occasionId) {
  const current = state.settings.fastingReminders || {
    occasions: [],
    weeklyMonThu: false,
  };
  const set = new Set(current.occasions || []);
  if (set.has(occasionId)) set.delete(occasionId);
  else set.add(occasionId);

  const updated = { ...current, occasions: Array.from(set) };
  state.settings.fastingReminders = updated;
  ipcRenderer.invoke("save-settings", { fastingReminders: updated });
}

function _formatDateLine(o) {
  const hijri = `${o.hijriDay} ${hijriMonthName(o.hijriMonth)}`;
  const greg = _formatGregorian(o.gregorianDate);
  return `${greg} — ${hijri}`;
}

function _formatGregorian(isoDate) {
  const langTag = getLocaleTag();
  const d = _parseISO(isoDate);
  if (!d) return isoDate;
  return d.toLocaleDateString(langTag, {
    day: "numeric",
    month: "long",
  });
}

function _relativeLabel(isoDate) {
  const target = _parseISO(isoDate);
  if (!target) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return t("today");
  if (diffDays === 1) return t("tomorrow");
  return t("inDays").replace("{days}", diffDays);
}

function _parseISO(isoDate) {
  if (!isoDate) return null;
  const [y, m, d] = isoDate.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

module.exports = { initFastingPage };
