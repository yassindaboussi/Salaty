"use strict";

const { ipcRenderer } = require("electron");

let isRegistered = false;

const OCCASION_TITLE_KEYS = {
  whiteDays: "whiteDaysTitle",
  tasua: "tasuaTitle",
  ashura: "ashuraTitle",
  dhulHijjahFirst9: "dhulHijjahFirst9Title",
  arafah: "arafahTitle",
  shawwal6: "shawwal6Title",
};

function initFastingReminderListener() {
  if (isRegistered) return;
  isRegistered = true;

  ipcRenderer.on("fasting-reminder-due", (_ev, occasion) => {
    _showReminderPopup(occasion);
  });
}

function _showReminderPopup(occasion) {
  let _t = (key) => key;
  try {
    ({ t: _t } = require("../../core/i18n/translations"));
  } catch {
  }

  let content;
  if (occasion.type === "weekly") {
    const lang = _currentLangTag();
    const dayName = _parseLocalISO(occasion.gregorianDate).toLocaleDateString(
      lang,
      { weekday: "long" },
    );
    content = (_t("fastingReminderWeeklyContent") || "{when} {day}")
      .replace("{when}", _relativeWhen(occasion.gregorianDate, _t))
      .replace("{day}", dayName);
  } else {
    const titleKey = OCCASION_TITLE_KEYS[occasion.type];
    const occasionName = (titleKey && _t(titleKey)) || occasion.type;
    content = (_t("fastingReminderContent") || "{when} {occasion}")
      .replace("{when}", _relativeWhen(occasion.gregorianDate, _t))
      .replace("{occasion}", occasionName);
  }

  ipcRenderer.send("show-athkar-popup", {
    icon: "fa-utensils",
    theme: _currentThemeGuess(),
    title: _t("fastingReminderPopupTitle") || "Sunnah Fasting Reminder",
    content,
  });
}

function _parseLocalISO(isoDate) {
  const [y, m, d] = String(isoDate).split("-").map((n) => parseInt(n, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

function _relativeWhen(gregorianDate, _t) {
  const target = _parseLocalISO(gregorianDate);
  if (isNaN(target.getTime())) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.round((target - today) / 86400000);
  if (diffDays <= 0) return _t("today") || "Today";
  if (diffDays === 1) return _t("tomorrow") || "Tomorrow";
  return (_t("inDays") || "In {days} days").replace("{days}", diffDays);
}

function _currentLangTag() {
  try {
    const { getLanguage } = require("../../core/i18n/translations");
    const lang = getLanguage?.() || "en";
    return lang === "ar" ? "ar" : lang === "fr" ? "fr" : "en";
  } catch {
    return "en";
  }
}

function _currentThemeGuess() {
  try {
    const { state } = require("../../core/globalStore");
    return state?.settings?.theme || "navy";
  } catch {
    return "navy";
  }
}

module.exports = { initFastingReminderListener };
