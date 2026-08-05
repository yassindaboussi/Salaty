"use strict";
const { ipcRenderer } = require("electron");
const { state } = require("../../core/globalStore");
const { t, getLanguage } = require("../../core/i18n/translations");
const analytics = require("../../utils/analytics");
const {
  setupConnectionRecovery,
} = require("../../services/connection-recovery");

const HIJRI_MONTHS = {
  en: [
    "Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani", "Jumada al-Awwal",
    "Jumada al-Thani", "Rajab", "Shaban", "Ramadan", "Shawwal", "Dhul-Qadah",
    "Dhul-Hijjah",
  ],
  ar: [
    "محرم", "صفر", "ربيع الأول", "ربيع الثاني", "جمادى الأولى",
    "جمادى الثانية", "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة",
  ],
  fr: [
    "Mouharram", "Safar", "Rabia al-Awal", "Rabia ath-Thani", "Joumada al-Oula",
    "Joumada ath-Thania", "Rajab", "Chaabane", "Ramadan", "Chawwal",
    "Dhou al-Qiada", "Dhou al-Hijja",
  ],
};

const OCCASION_META = {
  whiteDays: { icon: "fa-moon", titleKey: "whiteDaysTitle", descKey: "whiteDaysDesc" },
  tasua: { icon: "fa-mosque", titleKey: "tasuaTitle", descKey: "tasuaDesc" },
  ashura: { icon: "fa-mosque", titleKey: "ashuraTitle", descKey: "ashuraDesc" },
  dhulHijjahFirst9: { icon: "fa-star-and-crescent", titleKey: "dhulHijjahFirst9Title", descKey: "dhulHijjahFirst9Desc" },
  arafah: { icon: "fa-mountain", titleKey: "arafahTitle", descKey: "arafahDesc" },
  shawwal6: { icon: "fa-utensils", titleKey: "shawwal6Title", descKey: "shawwal6Desc" },
};

let occasionsCache = [];

function initFastingPage() {
  setupConnectionRecovery(initFastingPage, "Fasting");
  analytics.featureOpen("fasting");

  document.getElementById("backBtn")?.addEventListener("click", () => {
    ipcRenderer.invoke("navigate-to", "features");
  });

  _applyStaticTranslations();
  _setupLeadSelector();
  _setupWeeklyToggle();
  _loadOccasions();
}


function _applyStaticTranslations() {
  const map = {
    fastingTitle: "sunnahFastingTitle",
    vfHeroLabel: "nextFastingDay",
    vfWeeklyTitle: "weeklySunnah",
    vfWeeklyDesc: "weeklyMonThuDesc",
    vfUpcomingTitle: "upcomingFastingDays",
    vfLoadingText: "loadingFastingDays",
    vfRamadanNote: "ramadanNote",
    vfHeroToggleLabel: "remindMe",
    vfLeadLabel: "remindMe",
    vfLeadOpt1: "leadOption1",
    vfLeadOpt2: "leadOption2",
    vfLeadOpt3: "leadOption3",
    vfLeadOpt7: "leadOption7",
  };
  for (const [id, key] of Object.entries(map)) {
    const el = document.getElementById(id);
    const text = t(key);
    if (el && text) el.textContent = text;
  }
}


function _setupLeadSelector() {
  const select = document.getElementById("vfLeadSelect");
  if (!select) return;

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
  const key = days >= 7 ? "leadOption7" : days === 3 ? "leadOption3" : days === 2 ? "leadOption2" : "leadOption1";
  return t(key) || "";
}


function _setupWeeklyToggle() {
  const toggle = document.getElementById("vfWeeklyToggle");
  if (!toggle) return;

  const fr = state.settings.fastingReminders || {};
  toggle.checked = !!fr.weeklyMonThu;

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
    hero.classList.add("vf-hidden");
    return;
  }
  hero.classList.remove("vf-hidden");

  const meta = OCCASION_META[next.type] || {};
  document.getElementById("vfHeroIcon").innerHTML =
    `<i class="fas ${meta.icon || "fa-utensils"}"></i>`;
  document.getElementById("vfHeroTitle").textContent =
    (meta.titleKey && t(meta.titleKey)) || next.type;
  document.getElementById("vfHeroDate").textContent = _formatDateLine(next);
  document.getElementById("vfHeroCountdown").textContent = _relativeLabel(
    next.gregorianDate,
  );
  document.getElementById("vfHeroDesc").textContent =
    (meta.descKey && t(meta.descKey)) || "";

  const btn = document.getElementById("vfHeroToggle");
  const label = document.getElementById("vfHeroToggleLabel");
  const isOn = _isReminderOn(next.id);
  btn.classList.toggle("vf-active", isOn);
  btn.title = _currentLeadLabel();
  label.textContent = t(isOn ? "reminderOn" : "remindMe");
  btn.onclick = () => {
    _toggleReminder(next.id);
    const nowOn = _isReminderOn(next.id);
    btn.classList.toggle("vf-active", nowOn);
    label.textContent = t(nowOn ? "reminderOn" : "remindMe");
    _renderList();
  };
}

function _renderList() {
  const listEl = document.getElementById("vfList");
  if (!listEl) return;

  const rest = occasionsCache.slice(1);

  if (rest.length === 0 && occasionsCache.length === 0) {
    listEl.innerHTML = `<div class="vf-empty">${_escape(t("noUpcomingFastingDays") || "")}</div>`;
    return;
  }
  if (rest.length === 0) {
    listEl.innerHTML = "";
    return;
  }

  listEl.innerHTML = rest.map((o) => _renderItem(o)).join("");

  listEl.querySelectorAll("[data-occasion-id]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.dataset.occasionId;
      _toggleReminder(id);
      const nowOn = _isReminderOn(id);
      el.classList.toggle("vf-active", nowOn);
    });
  });
}

function _renderItem(o) {
  const meta = OCCASION_META[o.type] || {};
  const title = (meta.titleKey && t(meta.titleKey)) || o.type;
  const desc = (meta.descKey && t(meta.descKey)) || "";
  const isOn = _isReminderOn(o.id);

  return `
    <div class="vf-item">
      <div class="vf-item-icon"><i class="fas ${meta.icon || "fa-utensils"}"></i></div>
      <div class="vf-item-info">
        <div class="vf-item-title">${_escape(title)}</div>
        <div class="vf-item-meta">
          <span class="vf-item-date-chip">${_escape(_relativeLabel(o.gregorianDate))}</span>
          <span>•</span>
          <span>${_escape(_formatDateLine(o))}</span>
        </div>
        <div class="vf-item-desc">${_escape(desc)}</div>
      </div>
      <button
        type="button"
        class="vf-bell-btn${isOn ? " vf-active" : ""}"
        data-occasion-id="${_escape(o.id)}"
        aria-label="${_escape(t("remindMe") || "Remind me")}"
        title="${_escape(_currentLeadLabel())}"
      >
        <i class="fas fa-bell"></i>
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


function _hijriMonthName(monthNumber) {
  const lang = getLanguage?.() || "en";
  const arr = HIJRI_MONTHS[lang] || HIJRI_MONTHS.en;
  return arr[monthNumber - 1] || "";
}

function _formatDateLine(o) {
  const hijri = `${o.hijriDay} ${_hijriMonthName(o.hijriMonth)}`;
  const greg = _formatGregorian(o.gregorianDate);
  return `${greg} — ${hijri}`;
}

function _formatGregorian(isoDate) {
  const lang = getLanguage?.() || "en";
  const langTag = lang === "ar" ? "ar" : lang === "fr" ? "fr" : "en";
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

  const diffDays = Math.round((target - today) / 86400000);
  if (diffDays === 0) return t("today") || "Today";
  if (diffDays === 1) return t("tomorrow") || "Tomorrow";
  return (t("inDays") || "In {days} days").replace("{days}", diffDays);
}

function _parseISO(isoDate) {
  if (!isoDate) return null;
  const [y, m, d] = isoDate.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function _escape(str) {
  return String(str ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

module.exports = { initFastingPage };
