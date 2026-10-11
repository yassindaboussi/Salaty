"use strict";

const { ipcRenderer } = require("electron");
const { t, getLocaleTag } = require("../core/i18n");
const { state } = require("../core/store");

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
  let content;
  if (occasion.type === "weekly") {
    const lang = getLocaleTag();
    const dayName = _parseLocalISO(occasion.gregorianDate).toLocaleDateString(
      lang,
      { weekday: "long" },
    );
    content = t("fastingReminderWeeklyContent")
      .replace("{when}", _relativeWhen(occasion.gregorianDate))
      .replace("{day}", dayName);
  } else {
    const titleKey = OCCASION_TITLE_KEYS[occasion.type];
    const occasionName = (titleKey && t(titleKey)) || occasion.type;
    content = t("fastingReminderContent")
      .replace("{when}", _relativeWhen(occasion.gregorianDate))
      .replace("{occasion}", occasionName);
  }

  ipcRenderer.send("show-athkar-popup", {
    icon: "fa-utensils",
    theme: _currentThemeGuess(),
    title: t("fastingReminderPopupTitle"),
    content,
  });
}

function _parseLocalISO(isoDate) {
  const [y, m, d] = String(isoDate)
    .split("-")
    .map((n) => parseInt(n, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

function _relativeWhen(gregorianDate) {
  const target = _parseLocalISO(gregorianDate);
  if (isNaN(target.getTime())) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diffDays <= 0) return t("today");
  if (diffDays === 1) return t("tomorrow");
  return t("inDays").replace("{days}", diffDays);
}

function _currentThemeGuess() {
  return state?.settings?.theme || "navy";
}

module.exports = { initFastingReminderListener };
