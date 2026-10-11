"use strict";

const { ipcRenderer } = require("electron");

const { t } = require("../core/i18n");
const { state } = require("../core/store");
const { html, setHtml } = require("../utils/html");

/** @type {HTMLAudioElement | null} */
let adhanAudio = null;
/** @type {ReturnType<typeof setInterval> | null} */
let fadeTimer = null;
/** @type {HTMLElement | null} */
let overlayEl = null;

// Name to show for a prayer sent by the main process. `displayKey` is set there (e.g.
// "Jumuah" for Friday's Dhuhr); `key` stays the prayer itself and is the fallback.
function _prayerName(prayer) {
  const key = prayer.displayKey || prayer.key;
  return t(key, "prayerNames");
}

function initAdhanPlayer() {
  _injectOverlay();
  _registerIpcListeners();

  ipcRenderer
    .invoke("get-adhan-state")
    .then(({ isPlaying, session }) => {
      if (!isPlaying || !session) return;

      const elapsedSec = (Date.now() - session.startedAt) / 1000;
      const audioDurSec = 300;

      if (session.mode !== "silent" && elapsedSec < audioDurSec) {
        _playAdhan(session.prayer, session.mode, elapsedSec);
      } else {
        const nameEl = document.getElementById("__adhan-prayer-name__");
        const timeEl = document.getElementById("__adhan-prayer-time__");
        const labelEl = document.getElementById("__adhan-stop-label__");
        if (nameEl) nameEl.textContent = _prayerName(session.prayer);
        if (timeEl) timeEl.textContent = session.prayer.time || "";
        if (labelEl) labelEl.textContent = t("stopAdhan");
        _showOverlay(true);
      }
    })
    .catch(() => {});
}

function _injectOverlay() {
  document.getElementById("__adhan-overlay__")?.remove();

  overlayEl = document.createElement("div");
  overlayEl.id = "__adhan-overlay__";
  overlayEl.className = "adhan-player-overlay adhan-player-overlay--hidden";
  setHtml(
    overlayEl,
    html`
    <div class="adhan-player-bar">
      <div class="adhan-player-bar__icon-wrap">
        <i class="fas fa-mosque adhan-player-bar__mosque-icon" aria-hidden="true"></i>
        <div class="adhan-player-bar__pulse"></div>
      </div>

      <div class="adhan-player-bar__text">
        <div class="adhan-player-bar__prayer-name" id="__adhan-prayer-name__"></div>
        <div class="adhan-player-bar__time"         id="__adhan-prayer-time__"></div>
      </div>

      <button type="button" class="adhan-player-bar__stop-btn" id="__adhan-stop-btn__">
        <i class="fas fa-stop-circle" aria-hidden="true"></i>
        <span id="__adhan-stop-label__">${t("stopAdhan")}</span>
      </button>
    </div>
  `,
  );

  document.body.appendChild(overlayEl);

  _syncThemeVars();

  document
    .getElementById("__adhan-stop-btn__")
    ?.addEventListener("click", () => {
      _stopAdhan(true);
    });
}

function _registerIpcListeners() {
  ipcRenderer.removeAllListeners("trigger-adhan");
  ipcRenderer.removeAllListeners("force-stop-adhan");
  ipcRenderer.removeAllListeners("show-pre-adhan-notification");

  ipcRenderer.on("trigger-adhan", (_ev, { prayer, mode }) => {
    if (mode === false) return;
    _playAdhan(prayer, mode);
  });

  ipcRenderer.on("force-stop-adhan", () => {
    _stopAdhan(false);
  });

  ipcRenderer.on("show-pre-adhan-notification", (_ev, { prayer, minutes }) => {
    _showPreAdhanNotification(prayer, minutes);
  });

  ipcRenderer.on("theme-changed", () => {
    requestAnimationFrame(_syncThemeVars);
  });
}

/** @type {Promise<any> | null} */
let _adhanAudioSrcPromise = null;
function _getAdhanAudioSrc() {
  if (!_adhanAudioSrcPromise) {
    _adhanAudioSrcPromise = ipcRenderer.invoke("get-adhan-audio-src");
  }
  return _adhanAudioSrcPromise;
}

async function _playAdhan(prayer, mode, seekSec = 0) {
  const prayerName = _prayerName(prayer);
  const prayerTime = prayer.time || "";

  const nameEl = document.getElementById("__adhan-prayer-name__");
  const timeEl = document.getElementById("__adhan-prayer-time__");
  const labelEl = document.getElementById("__adhan-stop-label__");

  if (nameEl) nameEl.textContent = prayerName;
  if (timeEl) timeEl.textContent = prayerTime;
  if (labelEl) labelEl.textContent = t("stopAdhan");

  _showOverlay(true);

  if (mode === "silent") {
    return;
  }

  _cleanupAudio();

  const soundSrc = await _getAdhanAudioSrc();
  adhanAudio = new Audio(soundSrc);

  adhanAudio.volume = 0.01;

  if (seekSec > 0) {
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
      const fadeDurMs = seekSec > 0 ? 3000 : 12000;
      const stepPerTick = targetVol / (fadeDurMs / 80);

      fadeTimer = setInterval(() => {
        if (!adhanAudio || adhanAudio.paused) {
          if (fadeTimer) clearInterval(fadeTimer);
          fadeTimer = null;
          return;
        }
        const next = Math.min(targetVol, adhanAudio.volume + stepPerTick);
        adhanAudio.volume = next;
        if (next >= targetVol) {
          if (fadeTimer) clearInterval(fadeTimer);
          fadeTimer = null;
        }
      }, 80);
    })
    .catch((err) => {
      console.error("Error playing adhan audio:", err);
    });

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
  // Detach the playing audio first: _cleanupAudio() pauses whatever adhanAudio points to,
  // which used to cut the sound before the fade-out below could run.
  const audio = adhanAudio;
  adhanAudio = null;
  _cleanupAudio();

  if (audio && !audio.paused) {
    const fadeOut = setInterval(() => {
      const next = Math.max(0, audio.volume - 0.06);
      audio.volume = next;
      if (next <= 0 || audio.paused) {
        audio.pause();
        clearInterval(fadeOut);
      }
    }, 25);
  }

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
    } catch {}
    adhanAudio = null;
  }
}

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

  for (const v of vars) {
    const val = cs.getPropertyValue(v).trim();
    if (val) overlayEl.style.setProperty(v, val);
  }
}

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

function _showPreAdhanNotification(prayer, minutes) {
  const prayerName = _prayerName(prayer);
  let body = t("adhanInXmin");
  body = body.replace("{prayer}", prayerName).replace("{minutes}", minutes);

  ipcRenderer.send("show-adhan-popup", {
    theme: state?.settings?.theme || "navy",
    title: `Salaty Time · ${t("adhanAlertTitle")}`,
    content: body,
  });
}

module.exports = { initAdhanPlayer };
