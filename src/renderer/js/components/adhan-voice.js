"use strict";

// Spoken reminders around the adhan (src/assets/adhan/voice, credits in CREDITS.md):
// before: "the prayer is near" for that prayer and / or a short hadith (each its own switch);
// after: a short hadith once the full adhan has ended by itself.
// Each clip is spoken in the app language when that recording exists ("near-fajr-en.mp3"),
// else in Arabic ("near-fajr-ar.mp3").

const { getLanguage } = require("../core/i18n");

const VOICE_DIR = "../../../assets/adhan/voice/";
const NEAR_FILES = {
  Fajr: "near-fajr",
  Dhuhr: "near-dhuhr",
  Asr: "near-asr",
  Maghrib: "near-maghrib",
  Isha: "near-isha",
};
const ALL_CLIPS = [
  ...Object.values(NEAR_FILES),
  "hadith-before",
  "hadith-after",
];
/** Recordings that exist in each language other than Arabic. @type {Record<string, string[]>} */
const TRANSLATED = { en: ALL_CLIPS, fr: ALL_CLIPS };

/** @param {string} name clip name without language or extension */
function fileFor(name) {
  const lang = getLanguage();
  return TRANSLATED[lang]?.includes(name)
    ? `${name}-${lang}.mp3`
    : `${name}-ar.mp3`;
}
const GAP_MS = 600;
const VOLUME = 0.9;

/** @type {HTMLAudioElement | null} */
let current = null;
// bumped by stopVoice() so a queued next clip never starts after a stop
let runId = 0;

/**
 * Plays the clips one after the other. Resolves when done or stopped.
 * @param {string[]} files
 */
async function _playQueue(files) {
  stopVoice();
  const id = runId;
  for (const [i, file] of files.entries()) {
    if (id !== runId) return;
    if (i > 0) await new Promise((r) => setTimeout(r, GAP_MS));
    if (id !== runId) return;
    const audio = new Audio(VOICE_DIR + file);
    audio.volume = VOLUME;
    current = audio;
    try {
      await audio.play();
      await new Promise((resolve) => {
        audio.addEventListener("ended", resolve, { once: true });
        audio.addEventListener("error", resolve, { once: true });
        audio.addEventListener("pause", resolve, { once: true });
      });
    } catch (err) {
      console.error("Error playing voice reminder:", err);
      return;
    } finally {
      if (current === audio) current = null;
    }
  }
}

/**
 * Before the adhan: "the prayer is near" and / or the hadith, in that order.
 * @param {string} prayerKey
 * @param {{ near: boolean, hadith: boolean }} parts
 */
function playBeforeAdhan(prayerKey, { near, hadith }) {
  const files = [];
  if (near && NEAR_FILES[prayerKey]) files.push(fileFor(NEAR_FILES[prayerKey]));
  if (hadith) files.push(fileFor("hadith-before"));
  return files.length ? _playQueue(files) : Promise.resolve();
}

function playAfterAdhan() {
  return _playQueue([fileFor("hadith-after")]);
}

function stopVoice() {
  runId++;
  if (current) {
    try {
      current.pause();
    } catch {}
    current = null;
  }
}

module.exports = { playBeforeAdhan, playAfterAdhan, stopVoice };
