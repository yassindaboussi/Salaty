const { t } = require("../../core/i18n/translations");
const { applyTheme } = require("../../core/theme");

let ramadanDateCache = null;

/**
 * Met à jour le compte à rebours pour le Ramadan
 * Affiche le compteur seulement s'il reste 60 jours ou moins
 * @param {object} prayerData Données de prière contenant la date Hijri
 */
async function updateRamadanCountdown(prayerData) {
  const countdownEl = document.getElementById("ramadanCountdown");
  if (!countdownEl || !prayerData) return;

  // Clear content by default (hidden if > 60 days)
  countdownEl.textContent = "";

  const hijriDate = prayerData.date.hijri;
  const currentHijriMonth = hijriDate.month.number; // 1-12
  const currentHijriYear = parseInt(hijriDate.year);

  // Si c'est le Ramadan (Mois 9)
  if (currentHijriMonth === 9) {
    countdownEl.textContent = t("ramadanMubarak");
    applyTheme("ramadan");
    return;
  }

  let targetYear = currentHijriYear;
  // Si on a dépassé Ramadan, on vise l'année prochaine
  if (currentHijriMonth > 9) {
    targetYear++;
  }

  // Vérifier le cache pour éviter les appels API inutiles
  if (!ramadanDateCache || ramadanDateCache.year !== targetYear) {
    try {
      // Récupérer la date grégorienne pour le 1er Ramadan de l'année cible
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
    const goalDateStr = ramadanDateCache.gregorian.date; // DD-MM-YYYY
    // Parse DD-MM-YYYY
    const [d, m, y] = goalDateStr.split("-");
    // Créer la date à minuit pour une comparaison correcte des jours
    const goalDate = new Date(y, m - 1, d);

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const diffTime = goalDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Afficher seulement si diffDays <= 60
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
