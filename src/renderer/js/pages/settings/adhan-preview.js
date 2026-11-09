"use strict";

// The ▶ buttons of Settings → Adhan voice: one voice plays at a time, a second press (or
// another voice, or leaving the page) stops it with a short fade-out.
const { ipcRenderer } = require("electron");

/** @type {HTMLAudioElement | null} */
let audio = null;
/** @type {string | null} the voice playing */
let playing = null;
/** @type {(id: string | null) => void} */
let onChange = () => {};

/** @param {(id: string | null) => void} listener told which voice plays (null: none) */
function onPreviewChange(listener) {
  onChange = listener;
}

/** @param {string | null} id */
function setPlaying(id) {
  playing = id;
  onChange(id);
}

/** Stops the voice playing, fading out over ~0.3 s. */
function stopPreview() {
  const old = audio;
  audio = null;
  setPlaying(null);
  if (!old || old.paused) return;
  const fade = setInterval(() => {
    old.volume = Math.max(0, old.volume - 0.1);
    if (old.volume <= 0) {
      old.pause();
      clearInterval(fade);
    }
  }, 30);
}

/**
 * Plays a voice, or stops it when it is the one playing.
 * @param {string} id
 * @returns {Promise<boolean>} false when the audio could not be played (a broken file)
 */
async function togglePreview(id) {
  if (playing === id) {
    stopPreview();
    return true;
  }
  stopPreview();
  const src = await ipcRenderer.invoke("get-adhan-voice-src", id);
  const next = new Audio(src);
  audio = next;
  setPlaying(id);
  next.addEventListener("ended", () => {
    if (audio === next) stopPreview();
  });
  try {
    await next.play();
    return true;
  } catch {
    if (audio === next) stopPreview();
    return false;
  }
}

/**
 * Whether an audio file can be played: loads its first bytes. For the user's own file
 * right after it was chosen.
 * @param {string} id
 */
async function canPlay(id) {
  const src = await ipcRenderer.invoke("get-adhan-voice-src", id);
  return new Promise((resolve) => {
    const probe = new Audio();
    probe.preload = "metadata";
    probe.addEventListener("loadedmetadata", () => resolve(true), {
      once: true,
    });
    probe.addEventListener("error", () => resolve(false), { once: true });
    probe.src = src;
  });
}

window.addEventListener("pagehide", stopPreview);

/** The voice playing now, or null. */
const previewing = () => playing;

module.exports = {
  togglePreview,
  stopPreview,
  onPreviewChange,
  previewing,
  canPlay,
};
