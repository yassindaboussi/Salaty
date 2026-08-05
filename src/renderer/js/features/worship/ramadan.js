const { t } = require("../../core/i18n/translations");
const { applyTheme } = require("../../core/theme");

let ramadanDateCache = null;

async function updateRamadanCountdown(prayerData) {
  const countdownEl = document.getElementById("ramadanCountdown");
  if (!countdownEl || !prayerData) return;

  countdownEl.textContent = "";

  const hijriDate = prayerData.date.hijri;
  const currentHijriMonth = hijriDate.month.number;
  const currentHijriYear = parseInt(hijriDate.year);

  if (currentHijriMonth === 9) {
    countdownEl.textContent = t("ramadanMubarak");
    applyTheme("ramadan");
    return;
  }

  let targetYear = currentHijriYear;
  if (currentHijriMonth > 9) {
    targetYear++;
  }

  if (!ramadanDateCache || ramadanDateCache.year !== targetYear) {
    try {
      const response = await fetch(
        `https://api.aladhan.com/v1/hToG?date=01-09-${targetYear}`,
      );
      const data = await response.json();
      if (data && data.code === 200 && data.data && data.data.gregorian) {
        ramadanDateCache = {
          year: targetYear,
          gregorian: data.data.gregorian,
        };
      } else {
        return;
      }
    } catch (e) {
      console.error("Error fetching Ramadan date", e);
      return;
    }
  }

  if (ramadanDateCache) {
    const goalDateStr = ramadanDateCache.gregorian.date;
    const [d, m, y] = goalDateStr.split("-");
    const goalDate = new Date(y, m - 1, d);

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const diffTime = goalDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

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
