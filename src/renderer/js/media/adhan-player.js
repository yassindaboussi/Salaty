/**
 * adhan-player.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Global adhan player that works on EVERY page.
 *
 * Contract with main process:
 *   IN  ← 'trigger-adhan'         { prayer, mode, theme }
 *   IN  ← 'force-stop-adhan'      {}
 *   IN  ← 'show-pre-adhan-notification' { prayer, minutes }
 *   OUT → 'stop-adhan'            (user clicked stop)
 *   OUT → 'prayer-data-updated'   (after renderer fetches prayer data)
 *
 * The overlay is injected into document.body dynamically so it works
 * on every page without touching any HTML template.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { ipcRenderer } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");

// Try to import translations safely (may not be available on all pages)
let _t = (key, ns) => key;
try {
  const { t } = require("../core/i18n/translations");
  _t = t;
} catch (_) {}

// ── State ─────────────────────────────────────────────────────────────────────
let adhanAudio = null;
let fadeTimer = null;
let overlayEl = null;
let isRegistered = false; // guard: register IPC listeners only once per process

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Call once per page from renderer.js initializeApp().
 * Safe to call multiple times – idempotent per page load.
 */
function initAdhanPlayer() {
  _injectOverlay();
  _registerIpcListeners();

  // If adhan was playing before page navigation → fully resume: audio + UI
  ipcRenderer
    .invoke("get-adhan-state")
    .then(({ isPlaying, session }) => {
      if (!isPlaying || !session) return;

      const elapsedSec = (Date.now() - session.startedAt) / 1000;
      const audioDurSec = 300; // adhan mp3 is ~5 min; skip resume if already finished

      if (session.mode !== "silent" && elapsedSec < audioDurSec) {
        // Resume audio from the correct position
        _playAdhan(session.prayer, session.mode, elapsedSec);
      } else {
        // Silent mode or audio already ended — just show the bar
        const nameEl = document.getElementById("__adhan-prayer-name__");
        const timeEl = document.getElementById("__adhan-prayer-time__");
        const labelEl = document.getElementById("__adhan-stop-label__");
        if (nameEl)
          nameEl.textContent =
            _t(session.prayer.key, "prayerNames") || session.prayer.key;
        if (timeEl) timeEl.textContent = session.prayer.time || "";
        if (labelEl) labelEl.textContent = _t("stopAdhan") || "Stop";
        _showOverlay(true);
      }
    })
    .catch(() => {});
}

// ─────────────────────────────────────────────────────────────────────────────
// Overlay injection
// ─────────────────────────────────────────────────────────────────────────────

function _injectOverlay() {
  // Remove stale overlay from previous navigation
  document.getElementById("__adhan-overlay__")?.remove();

  overlayEl = document.createElement("div");
  overlayEl.id = "__adhan-overlay__";
  overlayEl.className = "adhan-player-overlay adhan-player-overlay--hidden";
  // NOTE: do NOT put theme-X class on the overlay — it would inherit the full
  // theme background (gradients, SVG lanterns, etc.) and create a solid rectangle.
  // Instead we copy only the CSS variable values from #app via _syncThemeVars().
  overlayEl.innerHTML = `
    <div class="adhan-player-bar">
      <div class="adhan-player-bar__icon-wrap">
        <i class="fas fa-mosque adhan-player-bar__mosque-icon"></i>
        <div class="adhan-player-bar__pulse"></div>
      </div>

      <div class="adhan-player-bar__text">
        <div class="adhan-player-bar__prayer-name" id="__adhan-prayer-name__"></div>
        <div class="adhan-player-bar__time"         id="__adhan-prayer-time__"></div>
      </div>

      <button class="adhan-player-bar__stop-btn" id="__adhan-stop-btn__"
              aria-label="Stop Adhan">
        <i class="fas fa-stop-circle"></i>
        <span id="__adhan-stop-label__">Stop</span>
      </button>
    </div>
  `;

  document.body.appendChild(overlayEl);

  // Copy CSS variable values (not the background) from the themed #app element
  _syncThemeVars();

  document
    .getElementById("__adhan-stop-btn__")
    ?.addEventListener("click", () => {
      _stopAdhan(true);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// IPC
// ─────────────────────────────────────────────────────────────────────────────

function _registerIpcListeners() {
  // Remove previous listeners to avoid accumulation across hot-reloads
  ipcRenderer.removeAllListeners("trigger-adhan");
  ipcRenderer.removeAllListeners("force-stop-adhan");
  ipcRenderer.removeAllListeners("show-pre-adhan-notification");

  ipcRenderer.on("trigger-adhan", (_ev, { prayer, mode, theme }) => {
    _playAdhan(prayer, mode);
  });

  ipcRenderer.on("force-stop-adhan", () => {
    _stopAdhan(false); // false → don't echo back to main (avoid loop)
  });

  ipcRenderer.on("show-pre-adhan-notification", (_ev, { prayer, minutes }) => {
    _showPreAdhanNotification(prayer, minutes);
  });

  // Keep overlay CSS vars in sync when user changes theme in settings.
  // Use requestAnimationFrame so theme.js has already updated #app's class.
  ipcRenderer.on("theme-changed", () => {
    requestAnimationFrame(_syncThemeVars);
  });
}

/**
 * Resolve adhan.mp3 from the real project asset folder.
 *
 * In development, this file is stored in:
 *   src/assets/adhan.mp3
 * not in:
 *   src/renderer/assets/adhan.mp3
 *
 * In packaged builds, electron-builder may expose extraResources under
 * process.resourcesPath, so we check those locations too.
 */
function _getAdhanAudioSrc() {
  const candidates = [];

  if (process.resourcesPath) {
    candidates.push(
      path.join(process.resourcesPath, "src", "assets", "adhan.mp3"),
      path.join(process.resourcesPath, "assets", "adhan.mp3"),
    );
  }

  candidates.push(
    path.join(__dirname, "../../../assets/adhan.mp3"), // dev path: src/assets/adhan.mp3
    path.join(__dirname, "../../assets/adhan.mp3"), // old fallback path
  );

  const foundPath =
    candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
  return pathToFileURL(foundPath).href;
}

// ─────────────────────────────────────────────────────────────────────────────
// Playback
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} prayer       - { key, time, ... }
 * @param {string|boolean} mode - true | 'silent'
 * @param {number} [seekSec=0]  - seconds into the audio to start from (page-navigation resume)
 */
function _playAdhan(prayer, mode, seekSec = 0) {
  const prayerName = _t(prayer.key, "prayerNames") || prayer.key;
  const prayerTime = prayer.time || "";

  // Always update overlay text (including on navigation resume)
  const nameEl = document.getElementById("__adhan-prayer-name__");
  const timeEl = document.getElementById("__adhan-prayer-time__");
  const labelEl = document.getElementById("__adhan-stop-label__");

  if (nameEl) nameEl.textContent = prayerName;
  if (timeEl) timeEl.textContent = prayerTime;
  if (labelEl) labelEl.textContent = _t("stopAdhan") || "Stop";

  _showOverlay(true);

  if (mode === "silent") {
    // Notification only — no audio
    return;
  }

  // ── Audio ──────────────────────────────────────────────────────────────────
  _cleanupAudio();

  const soundSrc = _getAdhanAudioSrc();
  adhanAudio = new Audio(soundSrc);

  // When resuming after navigation, jump to the correct position.
  // Start volume at 0 to avoid a click on seek, then fade in.
  adhanAudio.volume = 0.01;

  if (seekSec > 0) {
    // Set currentTime once the audio is ready to avoid a NotSupportedError
    adhanAudio.addEventListener(
      "loadedmetadata",
      () => {
        if (adhanAudio)
          adhanAudio.currentTime = Math.min(seekSec, adhanAudio.duration - 1);
      },
      { once: true },
    );
  }

  adhanAudio
    .play()
    .then(() => {
      const targetVol = 1.0;
      const fadeDurMs = seekSec > 0 ? 3000 : 12000; // quick re-fade when resuming
      const stepPerTick = targetVol / (fadeDurMs / 80);

      fadeTimer = setInterval(() => {
        if (!adhanAudio || adhanAudio.paused) {
          clearInterval(fadeTimer);
          fadeTimer = null;
          return;
        }
        const next = Math.min(targetVol, adhanAudio.volume + stepPerTick);
        adhanAudio.volume = next;
        if (next >= targetVol) {
          clearInterval(fadeTimer);
          fadeTimer = null;
        }
      }, 80);
    })
    .catch((err) => {});

  adhanAudio.addEventListener(
    "ended",
    () => {
      _showOverlay(false);
      ipcRenderer.send("stop-adhan");
    },
    { once: true },
  );
}

function _stopAdhan(notifyMain = true) {
  // Quick fade-out then stop
  if (adhanAudio && !adhanAudio.paused) {
    const audio = adhanAudio;
    const fadeOut = setInterval(() => {
      if (!audio || audio.paused) {
        clearInterval(fadeOut);
        return;
      }
      const next = Math.max(0, audio.volume - 0.06);
      audio.volume = next;
      if (next <= 0) {
        audio.pause();
        audio.currentTime = 0;
        clearInterval(fadeOut);
      }
    }, 25);
  }

  _cleanupAudio();
  _showOverlay(false);

  if (notifyMain) ipcRenderer.send("stop-adhan");
}

function _cleanupAudio() {
  if (fadeTimer) {
    clearInterval(fadeTimer);
    fadeTimer = null;
  }
  if (adhanAudio) {
    try {
      adhanAudio.pause();
      adhanAudio.currentTime = 0;
    } catch (_) {}
    adhanAudio = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Theme variable sync
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Read the resolved CSS variable values from #app (which carries the theme class)
 * and set them as inline custom properties on the overlay element.
 *
 * This gives the overlay the correct theme colours WITHOUT inheriting the theme's
 * background-image/gradient, which would make it look like a solid rectangle.
 */
function _syncThemeVars() {
  if (!overlayEl) return;
  const appEl = document.getElementById("app");
  if (!appEl) return;

  const cs = getComputedStyle(appEl);
  const vars = [
    "--accent-color",
    "--accent-rgb",
    "--bg-primary",
    "--bg-surface",
    "--border-color",
    "--text-primary",
    "--text-secondary",
  ];

  vars.forEach((v) => {
    const val = cs.getPropertyValue(v).trim();
    if (val) overlayEl.style.setProperty(v, val);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Overlay visibility
// ─────────────────────────────────────────────────────────────────────────────

function _showOverlay(visible) {
  if (!overlayEl) return;
  if (visible) {
    overlayEl.classList.remove("adhan-player-overlay--hidden");
    overlayEl.classList.add("adhan-player-overlay--visible");
  } else {
    overlayEl.classList.remove("adhan-player-overlay--visible");
    overlayEl.classList.add("adhan-player-overlay--hidden");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-adhan notification (rendered via the popup system)
// ─────────────────────────────────────────────────────────────────────────────

function _showPreAdhanNotification(prayer, minutes) {
  const prayerName = _t(prayer.key, "prayerNames") || prayer.key;
  let body = _t("adhanInXmin") || "{prayer} in {minutes} minutes";
  body = body.replace("{prayer}", prayerName).replace("{minutes}", minutes);

  const { state } = (() => {
    try {
      return require("../core/globalStore");
    } catch {
      return { state: { settings: {} } };
    }
  })();

  ipcRenderer.send("show-adhan-popup", {
    theme: state?.settings?.theme || "navy",
    title: "Salaty · تنبيه الصلاة",
    content: body,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
module.exports = { initAdhanPlayer };
