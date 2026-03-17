// src/renderer/js/prayer.js
// Utilitaires pour la gestion de la date de prière (calcul, formatage, etc.)
const { ipcRenderer } = require('electron');
const { translations, getLanguage, t } = require('../js/translations');
const {   showToast, } = require('../js/toast');
const { getSecondsFromTime, formatTime, getGregorianDate, getHijriDate, checkUpcomingEvent } = require('./utils/dateUtils');
const { state, prayerIcons } = require('../js/globalStore');
const { notifyPrayer } = require('../js/adhan');
const { updateRamadanCountdown } = require('../js/ramadan');

let prayerData = null;
let currentActivePrayer = null;
let lastPreAdhanNotificationPrayer = null;
let isFirstLoad = true;
let adhanEnabled = true;
let adhanEnabledByPrayer = {};

/**
 * Retourne la prière courante et la suivante, ainsi que le temps restant
 * @param {object} prayerData
 * @param {object} translations
 * @param {string} lang
 * @param {number} nowSeconds
 * @returns {object} { currentPrayer, nextPrayer, timeRemaining }
 */
function getCurrentAndNextPrayer(prayerData, translations, lang, nowSeconds) {
    if (!prayerData || !prayerData.timings) return {};
    const prayers = Object.keys(translations[lang].prayerNames)
        .filter((key) => prayerData.timings[key])
        .map((key) => {
            const name = translations[lang].prayerNames[key];
            const time = prayerData.timings[key];
            if (!time) return null;
            let prayerSeconds = getSecondsFromTime(time);
            if (prayerSeconds < nowSeconds) prayerSeconds += 86400;
            return {
                key,
                name,
                time,
                seconds: prayerSeconds,
                timeUntil: prayerSeconds - nowSeconds
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.seconds - b.seconds);
    if (prayers.length === 0) return {};
    const currentPrayerIndex = prayers.findIndex(p => p.seconds > nowSeconds) - 1;
    const currentPrayer = currentPrayerIndex >= 0 ? prayers[currentPrayerIndex] : prayers[prayers.length - 1];
    const nextPrayer = prayers[(currentPrayerIndex + 1) % prayers.length] || prayers[0];
    let timeRemaining = nextPrayer.seconds - nowSeconds;
    if (timeRemaining < 0) timeRemaining = 0;
    return { currentPrayer, nextPrayer, timeRemaining };
}

/**
 * Charge les horaires de prière depuis l'API et met à jour l'UI
 */
async function loadPrayerTimes() {
    try {
        const locationEl = document.getElementById('location');
        if (!state.settings.city || !state.settings.country) {
            if (locationEl) {
                locationEl.textContent = t('locationNotSet');
            }
            const loadingEl = document.getElementById('loadingText');
            if (loadingEl) {
                loadingEl.textContent = t('loadingPrayerTimes');
            }
            return;
        }
        if (locationEl) {
            locationEl.textContent = t('loading');
        }
        const url = `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(state.settings.city)}&country=${encodeURIComponent(state.settings.country)}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data && data.code === 200) {
            prayerData = data.data;
            updatePrayerUI();
            updateRamadanCountdown(prayerData);
        } else {
            throw new Error('Invalid response from server');
        }
    } catch (error) {
        console.error('Error loading prayer times:', error);
        const locationEl = document.getElementById('location');
        if (locationEl) {
            locationEl.textContent = t('errorLoading');
        }
        showToast(t('errorLoading'), 'error');
    }
}

/**
 * Met à jour l'UI avec les horaires de prière
 */
function updatePrayerUI() {
    if (!prayerData) return;
    const lang = getLanguage();
    const locationEl = document.getElementById('location');
    const gregorianDateEl = document.getElementById('gregorianDate');
    const hijriDateEl = document.getElementById('hijriDate');
    const prayerListEl = document.getElementById('prayerList');
    if (locationEl) {
        locationEl.textContent = `${state.settings.city}, ${state.settings.country}`;
    }
    if (gregorianDateEl && hijriDateEl) {
        gregorianDateEl.textContent = getGregorianDate(prayerData);
        hijriDateEl.textContent = getHijriDate(prayerData, lang, t);

        // Check for upcoming Islamic events
        if (prayerData.date?.hijri) {
            const now = new Date();
            const dayOfWeek = now.getDay(); // 0 is Sunday
            const eventKey = checkUpcomingEvent(prayerData.date.hijri.day, prayerData.date.hijri.month.number, dayOfWeek);
            const eventsBanner = document.getElementById('eventsBanner');
            const eventText = document.getElementById('eventText');

            if (eventsBanner && eventText) {
                if (eventKey) {
                   const eventObj = t(eventKey, 'islamicEvents');
                   // eventObj used to be a string, now it's an object with {event, date, description, note}
                   const isObj = typeof eventObj === 'object';
                   const eventName = isObj ? eventObj.event : eventObj;
                   const eventDate = isObj ? eventObj.date : '';
                   const eventDesc = isObj ? eventObj.description : '';
                   const eventNote = isObj ? eventObj.note : '';

                   const tomorrowLabel = t('tomorrowIs', 'islamicEvents').split(':')[0]; // "Tomorrow" or "Demain" or "غداً"

                   let htmlContent = `<div class="event-title">${tomorrowLabel}: ${eventName}</div>`;
                   if (eventDate) {
                       htmlContent += `<div class="event-date"><i class="far fa-calendar-alt"></i> ${eventDate}</div>`;
                   }
                   if (eventDesc) {
                       htmlContent += `<div class="event-desc">${eventDesc}</div>`;
                   }
                   if (eventNote) {
                       htmlContent += `<div class="event-note"><i class="fas fa-info-circle"></i> ${eventNote}</div>`;
                   }

                   eventText.innerHTML = htmlContent;
                   eventsBanner.style.display = 'flex';
                } else {
                   eventsBanner.style.display = 'none';
                }
            }
        }
    }
    const loadingEl = document.getElementById('loadingText');
    if (loadingEl) {
        loadingEl.textContent = t('loadingPrayerTimes');
    }




    // Correction : charger l'état adhanEnabled depuis les settings
    adhanEnabled = typeof state.settings.adhanEnabled === 'boolean' ? state.settings.adhanEnabled : true;

    // Charger l'état adhanEnabledByPrayer depuis les settings ou initialiser à true
    if (state.settings.adhanEnabledByPrayer) {
        adhanEnabledByPrayer = { ...state.settings.adhanEnabledByPrayer };
    } else {
        adhanEnabledByPrayer = {};
        Object.keys(translations[getLanguage()].prayerNames).forEach(key => {
            adhanEnabledByPrayer[key] = true;
        });
    }

    const prayerTimesHTML = Object.keys(translations[lang].prayerNames).map((key) => {
        const name = t(key, 'prayerNames');
        const time = prayerData.timings[key];
        const icon = prayerIcons[key] || 'clock';
        const isCurrent = key === currentActivePrayer;

        // Gestion des 3 états : true (sonore), 'silent' (silencieux), false (désactivé)
        let adhanState = adhanEnabledByPrayer[key];
        if (adhanState === undefined) adhanState = true; // Par défaut actif

        let adhanBtnIcon, adhanBtnTitle;

        if (adhanState === true) {
            adhanBtnIcon = 'volume-up';
            adhanBtnTitle = `${t('soundAdhan')} - ${t('disableAdhan')}`; // Ex: Mode Sonore - Désactiver...
        } else if (adhanState === 'silent') {
            adhanBtnIcon = 'bell';
            adhanBtnTitle = `${t('silentAdhan')} - ${t('disableAdhan')}`;
        } else {
            adhanBtnIcon = 'volume-mute';
            adhanBtnTitle = `${t('disableAdhan')} - ${t('enableAdhan')}`;
        }

        return `
      <div class="prayer-item ${isCurrent ? 'current-prayer' : ''}" data-prayer="${key}">
        <i class="fas fa-${icon}"></i>
        <span class="prayer-name">${name}</span>
        <span class="prayer-time">${time} ${isCurrent ? `<span class="current-indicator">${t('now')}</span>` : ''}</span>
        <button class="adhan-toggle-btn" data-prayer="${key}" title="${adhanBtnTitle}">
            <i class="fas fa-${adhanBtnIcon} adhan-toggle-icon"></i>
        </button>
      </div>
    `;
    }).join('');
    if (prayerListEl) {
        prayerListEl.innerHTML = prayerTimesHTML;
        // Ajouter les listeners sur chaque bouton
        prayerListEl.querySelectorAll('.adhan-toggle-btn').forEach(btn => {
            btn.onclick = (e) => {
                const key = btn.getAttribute('data-prayer');
                toggleAdhanForPrayer(key);
            };
        });
    }
}

/**
 * Met à jour la prière courante et la suivante, et l'UI associée
 */
function updateCurrentAndNextPrayer() {
    try {
        if (!prayerData || !prayerData.timings) return;
        const lang = getLanguage();
        const now = new Date();
        const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
        const { currentPrayer, nextPrayer, timeRemaining: remaining } = getCurrentAndNextPrayer(prayerData, translations, lang, currentSeconds);
        if (!nextPrayer || !currentPrayer) return;
        let timeRemaining = remaining;

        // Notification X minutes avant
        const preAdhanMinutes = state.settings.preAdhanMinutes || 5;
        const preAdhanSeconds = preAdhanMinutes * 60;
        const preAdhanEnabled = state.settings.preAdhanNotificationEnabled !== false; // Default true

        if (preAdhanEnabled && nextPrayer && timeRemaining <= preAdhanSeconds && timeRemaining > 0) {
            if (lastPreAdhanNotificationPrayer !== nextPrayer.key) {
                const notificationBody = t('adhanInXmin')
                    .replace('{prayer}', nextPrayer.name)
                    .replace('{minutes}', preAdhanMinutes);

                // Themed popup instead of native OS notification
                ipcRenderer.send('show-adhan-popup', {
                    theme:   state.settings.theme || 'navy',
                    title:   'Salaty Time · تنبيه الصلاة',
                    content: notificationBody
                });

                lastPreAdhanNotificationPrayer = nextPrayer.key;
            }
        }

        const prayerChanged = currentActivePrayer !== currentPrayer.key;
        currentActivePrayer = currentPrayer.key;
        const prayerCardsContainer = document.getElementById('prayerCards');
        if (prayerCardsContainer) {
            prayerCardsContainer.innerHTML = `
        <div class="prayer-card current">
          <div class="prayer-label">${t('currentPrayer')}</div>
          <div class="prayer-name">${currentPrayer?.name || '--'}</div>
          <div class="prayer-time">${currentPrayer?.time || '--:--'}</div>
          <div class="time-remaining">${t('endTime')} - ${nextPrayer?.time || '--:--'}</div>
        </div>
        <div class="prayer-card next">
          <div class="prayer-label">${t('nextPrayer')}</div>
          <div class="prayer-name">${nextPrayer?.name || '--'}</div>
          <div class="prayer-time">${nextPrayer?.time || '--:--'}</div>
          <div class="countdown" id="countdown">${formatTime(timeRemaining)}</div>
        </div>
      `;
        }
        if (prayerChanged) {
            updatePrayerUI();
            if (!isFirstLoad) {
                checkAndPlayAdhan(currentPrayer, currentSeconds);
            }
            isFirstLoad = false;
        }
    } catch (error) {
        console.error('Error in updateCurrentAndNextPrayer:', error);
    }
}

/**
 * Vérifie si l'Adhan doit être joué ou ignoré (bypass) en fonction du temps écoulé.
 *
 * Cette fonction résout le problème où l'Adhan se lance avec retard (ex: 1h après)
 * lorsque l'ordinateur sort de veille.
 *
 * Fonctionnement :
 * 1. Elle calcule la différence entre l'heure actuelle (sortie de veille) et l'heure de la prière.
 * 2. Si ce délai dépasse une tolérance (15 minutes), l'Adhan est ignoré.
 * 3. Sinon, l'Adhan est joué normalement.
 *
 * @param {object} prayer - L'objet prière courant.
 * @param {number} currentSeconds - L'heure actuelle en secondes.
 */
function checkAndPlayAdhan(prayer, currentSeconds) {
    const prayerSecondsRaw = getSecondsFromTime(prayer.time);
    let diff = currentSeconds - prayerSecondsRaw;

    // Gestion du cas minuit (wraparound)
    // Si diff est très négatif (ex: -12h), c'est qu'on a passé minuit
    if (diff < -43200) {
        diff += 86400;
    }

    // Tolérance de 15 minutes (900 secondes)
    const ADHAN_TOLERANCE = 900;

    if (diff >= 0 && diff <= ADHAN_TOLERANCE) {
        // Passer l'état de l'adhan à notifyPrayer
        let adhanState = adhanEnabledByPrayer[prayer.key];
        if (adhanState === undefined) adhanState = true;

        if (adhanState !== false) {
             notifyPrayer(prayer, adhanState); // adhanState est true ou 'silent'
        }
    } else {
        console.log(`Adhan ignoré pour ${prayer.name} : heure passée de ${diff}s (> tolérance ${ADHAN_TOLERANCE}s)`);
    }
}

function toggleAdhanForPrayer(prayerKey) {
    const currentState = adhanEnabledByPrayer[prayerKey];
    let nextState;

    // Cycle : true (Sound) -> 'silent' (Silent) -> false (Off) -> true ...
    if (currentState === true || currentState === undefined) {
        nextState = 'silent';
    } else if (currentState === 'silent') {
        nextState = false;
    } else {
        nextState = true;
    }

    adhanEnabledByPrayer[prayerKey] = nextState;
    state.settings.adhanEnabledByPrayer = adhanEnabledByPrayer;
    ipcRenderer.invoke('save-settings', state.settings);
    updatePrayerUI();
}

module.exports = {
    getCurrentAndNextPrayer,
    getSecondsFromTime,
    formatTime,
    loadPrayerTimes,
    updateCurrentAndNextPrayer,
    updateRamadanCountdown // Export for completeness if needed
};