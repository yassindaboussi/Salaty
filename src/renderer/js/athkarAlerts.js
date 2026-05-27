const { ipcRenderer } = require('electron');
const { state } = require('./globalStore');
const { getAdkar } = require('./config-api/api');
let adkarData = require('../data/adkar.json');

let alertIntervalId = null;

function initAthkarAlertsSystem() {
    // Update data from API
    getAdkar().then(data => {
        adkarData = data;
    }).catch(err => console.error(err));

    // Clear any existing interval
    if (alertIntervalId) {
        clearInterval(alertIntervalId);
        alertIntervalId = null;
    }

    if (state.settings.athkarAlertEnabled) {
        initAlertTimer();
    }
}

function initAlertTimer() {
    const minutes = state.settings.athkarAlertInterval || 30;
    const intervalMs = minutes * 60 * 1000;

    console.log(`Athkar alerts initialized. Interval: ${minutes} min.`);

    alertIntervalId = setInterval(() => {
        showAthkarAlert();
    }, intervalMs);
}

function showAthkarAlert() {
    const tasbih = adkarData['تسابيح'];
    if (!tasbih || tasbih.length === 0) return;

    const randomAthkar = tasbih[Math.floor(Math.random() * tasbih.length)];

    // Send to the main process to open a themed BrowserWindow popup
    ipcRenderer.send('show-athkar-popup', {
        theme:   state.settings.theme || 'navy',
        content: randomAthkar.content,
        title:   'Salaty Time · أذكار'
    });
}

module.exports = {
    initAthkarAlertsSystem
};
