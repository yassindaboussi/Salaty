// src/renderer/js/athkar-popup.js
// Renderer script for the themed notification popup window (athkar & adhan).

const { ipcRenderer } = require('electron');

const CLOSE_DELAY_MS = 10000; // 10 seconds auto-close

const app        = document.getElementById('app');
const athkarText = document.getElementById('athkarText');
const closeBtn   = document.getElementById('closeBtn');
const titleEl    = document.getElementById('popupTitle');
const iconEl     = document.querySelector('.popup-icon i');
const openAppBtn = document.getElementById('openAppBtn');

/* All supported theme classes (must match themes.css) */
const THEME_CLASSES = [
    'theme-dark', 'theme-blue', 'theme-green', 'theme-brown',
    'theme-gold', 'theme-pink', 'theme-purple', 'theme-emerald',
    'theme-ocean', 'theme-royal', 'theme-indigo', 'theme-classic',
    'theme-navy', 'theme-ramadan'
];

/**
 * Apply a theme to the #app element.
 * @param {string} theme  e.g. 'navy', 'green', 'ramadan' …
 */
function applyTheme(theme) {
    if (!theme) return;
    app.classList.remove(...THEME_CLASSES);
    app.classList.add(`theme-${theme}`);
}

/**
 * Animate the window out, then ask the main process to close it.
 */
function closePopup() {
    app.classList.add('closing');
    setTimeout(() => {
        ipcRenderer.send('close-themed-popup');
    }, 380); // match CSS fadeOut duration
}

/* ── Receive initialisation data from the main process ── */
ipcRenderer.once('init-themed-popup', (_event, data) => {
    const { theme, content, title, icon, type } = data;

    applyTheme(theme);

    if (content)  athkarText.textContent = content;
    if (title)    titleEl.textContent    = title;

    if (icon && iconEl) {
        iconEl.className = `fas ${icon}`;
    }

    // Show "Open App" button only for adhan popups
    if (type === 'adhan' && openAppBtn) {
        openAppBtn.classList.remove('hidden');
        openAppBtn.addEventListener('click', () => {
            ipcRenderer.send('show-main-window'); // focus + affiche la fenêtre principale
            closePopup();
        });
    }

    // Wait for the browser to fully paint the content, then measure the true height
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            // document.body.scrollHeight is reliable here because html/body are height:auto
            const neededHeight = Math.ceil(document.body.scrollHeight) + 2;
            // Ask main to resize the window to fit the content and then show it
            ipcRenderer.send('show-themed-popup-ready', { height: neededHeight });

            // Start auto-close timer only after the window is shown
            const autoCloseTimer = setTimeout(closePopup, CLOSE_DELAY_MS);

            closeBtn.addEventListener('click', () => {
                clearTimeout(autoCloseTimer);
                closePopup();
            });
        });
    });
});
