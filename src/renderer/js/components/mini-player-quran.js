"use strict";

// The mini players (the one in the pages and the floating window) while a Quran surah plays (a track from the Quran reader): previous / next
// move by ayah (from the ayah timings, like the reader's bar; off at the first and last ayah),
// the list button becomes "Open in the reader" (a book), and the riwaya follows the reciter's
// name when it is not Hafs. Other tracks keep the mini player as it is.
const { ipcRenderer } = require("electron");
const { t, getLanguage } = require("../core/i18n");
const { updateTooltip } = require("../core/tooltips");
const { html, setHtml } = require("../utils/html");
const {
  getAyahTimings,
  ayahAt,
  ayahStep,
} = require("../services/api/ayah-timing");

/** @typedef {import("../services/api/ayah-timing").AyahTime} AyahTime */

/** @param {any} track */
const isQuranTrack = (track) =>
  track?.page === "quran" &&
  Number.isInteger(track.surah) &&
  Number.isInteger(track.read);

/** @param {HTMLButtonElement} button @param {string} icon @param {string} tooltip */
function setButton(button, icon, tooltip) {
  if (button.dataset.tooltip !== tooltip) {
    button.dataset.tooltip = tooltip;
    updateTooltip(button);
  }
  setHtml(button, html`<i class="fas fa-${icon}" aria-hidden="true"></i>`);
}

/**
 * @param {{ prev: HTMLButtonElement, next: HTMLButtonElement, open: HTMLButtonElement, artist: HTMLElement }} ui
 */
function quranMiniPlayer(ui) {
  /** @type {AyahTime[]} */
  let timings = [];
  let key = "";
  let on = false;
  let playing = false;
  let time = 0;
  let stamp = 0;

  const now = () =>
    playing ? time + (performance.now() - stamp) / 1000 : time;

  /** ⏮ off at the first ayah (and before it), ⏭ off at the last one */
  function renderSteps() {
    if (!on) return;
    const ayah = ayahAt(timings, now());
    ui.prev.disabled = !timings.length || ayah <= 1;
    ui.next.disabled = !timings.length || ayah >= (timings.at(-1)?.ayah ?? 0);
  }

  /** @param {any} track */
  async function loadTimings(track) {
    const k = `${track.read}/${track.surah}`;
    if (k === key) return;
    key = k;
    timings = [];
    try {
      const list = await getAyahTimings(track.read, track.surah);
      if (key === k) timings = list;
    } catch {
      // no timings: previous / next stay off
    }
    renderSteps();
  }

  /** @param {any} state  the player's state; returns whether it is a Quran surah */
  function apply(state) {
    const track = state.currentTrack;
    const wasOn = on;
    on = isQuranTrack(track);
    playing = Boolean(state.isPlaying && !state.loading);
    time = state.currentTime || 0;
    stamp = performance.now();
    if (on) {
      setButton(ui.prev, "step-backward", "quranPrevAyah");
      setButton(ui.next, "step-forward", "quranNextAyah");
      setButton(ui.open, "book-open", "quranOpenInReader");
      const riwaya = String(track.riwaya ?? "hafs");
      ui.artist.textContent =
        riwaya === "hafs"
          ? track.artist
          : `${track.artist}${getLanguage() === "ar" ? "، " : " · "}${t(`quranRiwaya${riwaya[0].toUpperCase()}${riwaya.slice(1)}`)}`;
      loadTimings(track);
      renderSteps();
    } else if (wasOn) {
      // back to the usual buttons for other tracks
      setButton(ui.prev, "step-backward", "tooltipPrev");
      setButton(ui.next, "step-forward", "tooltipNext");
      setButton(ui.open, "list", "tooltipPlaylist");
      ui.prev.disabled = ui.next.disabled = false;
      key = "";
      timings = [];
    }
    return on;
  }

  /** @param {number} currentTime  a time report */
  function onTime(currentTime) {
    time = currentTime;
    stamp = performance.now();
    renderSteps();
  }

  /** Handles ⏮ / ⏭ for a surah; returns false for other tracks. @param {-1 | 1} stepBy */
  function step(stepBy) {
    if (!on) return false;
    const start = ayahStep(timings, now(), stepBy);
    if (start !== null) {
      time = start;
      stamp = performance.now();
      ipcRenderer.send("player-command", { type: "seek", value: start });
      renderSteps();
    }
    return true;
  }

  return { apply, onTime, step, isOn: () => on };
}

/**
 * A mini player's buttons: previous / next by ayah for a surah, else `other`'s; the list button
 * opens the Quran reader for a surah, else does `other.open`.
 * @param {{ prev: HTMLButtonElement, next: HTMLButtonElement, open: HTMLButtonElement, artist: HTMLElement }} ui
 * @param {{ prev: () => void, next: () => void, open: () => void }} other
 */
function bindQuranMiniPlayer(ui, other) {
  const quran = quranMiniPlayer(ui);
  ui.prev.addEventListener("click", () => quran.step(-1) || other.prev());
  ui.next.addEventListener("click", () => quran.step(1) || other.next());
  ui.open.addEventListener("click", () => {
    if (quran.isOn()) openQuranReader();
    other.open();
  });
  return quran;
}

/**
 * Asks the Quran page to open its reader on the surah playing, then opens it in the main
 * window. The page reads the request once: in this window's sessionStorage, or (from the
 * floating window, another window) a fresh time in localStorage.
 */
function openQuranReader() {
  try {
    sessionStorage.setItem("quranOpenPlaying", "1");
    localStorage.setItem("quranOpenPlayingAt", String(Date.now()));
  } catch {
    // storage unavailable: the page opens on its surah list
  }
  ipcRenderer.invoke("navigate-to", "quran", 850, 600);
}

module.exports = { bindQuranMiniPlayer };
