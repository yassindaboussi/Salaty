const { ipcRenderer } = require('electron');
const { t } = require('../js/translations');
const { state } = require('../js/globalStore');
const path = require('path');

let adhanAudio = null;
let fadeInterval = null;

function showAdhanStopBtn(show) {
    const btn = document.getElementById('adhanStopBtn');
    if (btn) {
        if (show) {
            btn.classList.remove('adhan-stop-btn-hidden');
        } else {
            btn.classList.add('adhan-stop-btn-hidden');
        }
    }
    setAdhanStopText();
}

function notifyPrayer(prayer, mode = true) {
    const prayerName = t(prayer.key, 'prayerNames');

    // Themed popup instead of native OS notification
    ipcRenderer.send('show-adhan-popup', {
        theme:   state.settings.theme || 'navy',
        title:   'Salaty Time · الأذان',
        content: `${t('currentPrayer')}: ${prayerName}`
    });

    // Si mode silencieux, on s'arrête là (pas de son)
    if (mode === 'silent') {
        return;
    }

    if (fadeInterval) {
        clearInterval(fadeInterval);
        fadeInterval = null;
    }

    if (adhanAudio && !adhanAudio.paused) {
        adhanAudio.pause();
        adhanAudio.currentTime = 0;
    }
    const soundPath = path.join(__dirname, '../../assets/adhan.mp3'); // Correction du chemin
    adhanAudio = new Audio(soundPath);
    adhanAudio.volume = 0; // Commencer avec le volume à 0 pour le fade-in

    adhanAudio.play().then(() => {
        showAdhanStopBtn(true);

        // Effet de fade-in sur 60 secondes
        const step = 0.0015; // Augmenter de ~0.15%
        const intervalTime = 100; // Toutes les 100ms
        // Durée totale = (1 / 0.0015) * 100ms ≈ 66000ms ≈ 66 secondes

        fadeInterval = setInterval(() => {
            if (!adhanAudio) {
                clearInterval(fadeInterval);
                return;
            }
            if (adhanAudio.paused) {
                clearInterval(fadeInterval);
                return;
            }

            let newVol = adhanAudio.volume + step;
            if (newVol >= 1.0) {
                newVol = 1.0;
                clearInterval(fadeInterval);
            }
            adhanAudio.volume = newVol;
        }, intervalTime);

    }).catch(error => {
        console.warn('Could not play adhan sound:', error);
    });
    if (adhanAudio) {
        adhanAudio.onended = () => {
            showAdhanStopBtn(false);
            if (fadeInterval) {
                clearInterval(fadeInterval);
                fadeInterval = null;
            }
        };
    }
}

function stopAdhan() {
    if (fadeInterval) {
        clearInterval(fadeInterval);
        fadeInterval = null;
    }
    if (adhanAudio) {
        adhanAudio.pause();
        adhanAudio.currentTime = 0;
        showAdhanStopBtn(false);
    }
}

function setAdhanStopText() {
    const textEl = document.getElementById('adhanStopText');
    if (textEl) {
        textEl.textContent = t('stopAdhan');
    }
}

// Gestion du bouton d'arrêt de l'Adhan
const adhanStopBtn = document.getElementById('adhanStopBtn');
if (adhanStopBtn) {
    adhanStopBtn.addEventListener('click', () => {
        stopAdhan();
    });
    showAdhanStopBtn(false);
    setAdhanStopText();
}

module.exports = { notifyPrayer };