"use strict";

const { t } = require("../core/i18n");
const { applyTheme } = require("../core/theme");
const { state } = require("../core/store");
const { daysBetween, parseDmy } = require("../core/date-format");
const { ipcRenderer } = require("electron");

/** @type {{ year: number, gregorian: any } | null} */
let ramadanDateCache = null;

// The Ramadan theme is a seasonal default, not an override: someone who picked a theme in
// Settings keeps it. (Settings saved before the themeChosen flag existed don't have it; a
// theme other than the default there was picked by the user as well.)
function _userChoseTheme(settings) {
  return (
    settings.themeChosen === true ||
    Boolean(settings.theme && settings.theme !== "navy")
  );
}

async function updateRamadanCountdown(prayerData) {
  const countdownEl = document.getElementById("ramadanCountdown");
  if (!countdownEl || !prayerData) return;

  countdownEl.textContent = "";

  const hijriDate = prayerData.date.hijri;
  const currentHijriMonth = hijriDate.month.number;
  const currentHijriYear = parseInt(hijriDate.year);

  if (currentHijriMonth === 9) {
    countdownEl.textContent = t("ramadanMubarak");
    if (!_userChoseTheme(state.settings)) applyTheme("ramadan");
    return;
  }

  let targetYear = currentHijriYear;
  if (currentHijriMonth > 9) {
    targetYear++;
  }

  if (!ramadanDateCache || ramadanDateCache.year !== targetYear) {
    try {
      // 1 Ramadan as a Gregorian date, from the main process's cache (works offline)
      const data = await ipcRenderer.invoke(
        "hijri-to-gregorian",
        1,
        9,
        targetYear,
      );
      if (!data?.gregorian) return;
      ramadanDateCache = { year: targetYear, gregorian: data.gregorian };
    } catch (e) {
      console.error("Error fetching Ramadan date", e);
      return;
    }
  }

  if (ramadanDateCache) {
    // calendar days: a daylight-saving change in between does not count as one more day
    const diffDays = daysBetween(
      new Date(),
      parseDmy(ramadanDateCache.gregorian.date),
    );

    if (diffDays > 0 && diffDays <= 60) {
      countdownEl.textContent = t("daysUntilRamadan").replace(
        "{days}",
        diffDays,
      );
    } else if (diffDays === 0) {
      countdownEl.textContent = t("ramadanMubarak");
    }
  }
}

module.exports = {
  updateRamadanCountdown,
};
