// qibla.js
const { ipcRenderer } = require('electron');
const { state } = require('./globalStore');
const { t } = require('./translations');
const { showToast } = require('./toast');
const QiblaMap = require('salaty-qibla-map');
const screenSizeManager = require('./screenSize');
const analytics = require('./utils/analytics');

let qiblaMapInstance = null;
let currentUserLat = null;
let currentUserLng = null;

async function initQiblaPage() {
    console.log('Initializing Qibla page with Map...');

    // SCREEN SIZE IS NOW HANDLED IN renderer.js

    // Setup back button
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            const currentSize = screenSizeManager.getWindowSize();
            ipcRenderer.invoke('resize-window', currentSize.width, currentSize.height);
            ipcRenderer.invoke('navigate-to', 'features');
        });
    }

    // Setup Zoom Button
    const zoomBtn = document.getElementById('zoomLocationBtn');
    if (zoomBtn) {
        zoomBtn.addEventListener('click', zoomToUserLocation);
    }

    // Set UI text
    const title = document.getElementById('qiblaTitle');
    if (title) title.textContent = t('qiblaFinder') || 'Qibla Finder';

    const directionLabel = document.getElementById('qiblaDirectionLabel');
    if (directionLabel) directionLabel.textContent = t('fromNorth', 'from (N) North');

    const locationText = document.getElementById('locationText');
    if (locationText) {
        locationText.textContent = t('loading') || 'Loading...';
    }

    const instructionText = document.getElementById('instructionText');
    if (instructionText) {
        instructionText.textContent = t('dragToAdjustInfo') || 'Vous pouvez déplacer le marqueur pour corriger votre position.';
    }

    let lat = null;
    let lng = null;

    try {
        if (locationText) locationText.textContent = t('loading') || 'Loading...';

        const city = state.settings?.city;
        const country = state.settings?.country;
        const latitude = state.settings?.latitude || state.settings?.lat;
        const longitude = state.settings?.longitude || state.settings?.lng;

        const result = await QiblaMap.detectLocation({ city, country, lat: latitude, lng: longitude });

        lat = result.lat;
        lng = result.lng;

        console.log(`Location detected via ${result.source}:`, lat, lng);

        // ── Track how the location was resolved ──────────────────────────────
        analytics.qiblaLocationResolved(result.source); // ← ANALYTICS

        if (locationText) {
        let label = `${result.city}, ${result.country}`;
        if (result.source !== 'settings-photon') label += ' (Approx)';
        locationText.textContent = label;
        }
    } catch (err) {
        console.warn('All location detection methods failed:', err);
        analytics.error('qibla_location', err.message || String(err)); // ← ANALYTICS
    }

    // Final check and Map Init
    if (lat && lng) {
        initMap(lat, lng);
        if (locationText && locationText.textContent.includes('Approx')) {
             showToast(t('locationApprox', 'Location is approximate. Drag marker to adjust.'), 'info');
        }
    } else {
        console.error('No location found.');
        if (locationText) locationText.textContent = t('locationNotSet') || 'Location not found. Please check settings.';
    }
}

function initMap(userLat, userLng) {
    currentUserLat = userLat;
    currentUserLng = userLng;

    console.log('Initializing Map at:', userLat, userLng);

    qiblaMapInstance = new QiblaMap('qiblaMap', {
        onAngleUpdate: (angle) => {
            const degreeText = document.getElementById('qiblaDegree');
            if (degreeText) {
                degreeText.textContent = Math.round(angle) + '°';
            }
        },
        onDragEnd: (lat, lng) => {
             // Optional: update local state if needed
             currentUserLat = lat;
             currentUserLng = lng;
        },
        markerPopupText: t('dragToAdjust') || 'You are here. Drag to adjust.',
        kaabaPopupText: 'Kaaba'
    });

    qiblaMapInstance.init(userLat, userLng);
}

function zoomToUserLocation() {
    if (qiblaMapInstance && currentUserLat != null && currentUserLng != null) {
        qiblaMapInstance.flyTo(currentUserLat, currentUserLng, 15);
    } else {
        console.warn("Cannot zoom: Map or location not ready.");
    }
}

module.exports = { initQiblaPage };