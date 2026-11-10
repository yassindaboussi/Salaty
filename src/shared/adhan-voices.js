"use strict";

// The adhan recordings the app plays (Settings → Notifications → Adhan voice). Bundled in
// src/assets/adhan/: mono MP3, 96 kbps, all at the same loudness (-12 LUFS), so switching
// voice does not change the volume. Sources and licences: src/assets/adhan/CREDITS.md.
// Texts: locales/<lang>/app/settings.json, keys adhanVoice_<id> (name) and adhanVoiceBy_<id>.

/**
 * @typedef {{ id: string, file: string, seconds: number,
 *   source?: string, licence?: string }} AdhanVoice
 */

/** @type {readonly AdhanVoice[]} */
const ADHAN_VOICES = Object.freeze([
  {
    id: "makkah",
    file: "makkah.mp3",
    seconds: 189,
    source:
      "https://commons.wikimedia.org/wiki/File:Adhan,_Great_Mosque_of_Mecca_-_Jan_21,_2013.webm",
    licence: "CC BY 3.0",
  },
  {
    id: "madinah",
    file: "madinah.mp3",
    seconds: 186,
    source:
      "https://commons.wikimedia.org/wiki/File:33937_ejaz215_call-to-prayer-from-the-prophet-s-mo.ogg",
    licence: "CC BY 3.0",
  },
  { id: "algiers", file: "algiers.mp3", seconds: 173 },
  {
    id: "aleppo",
    file: "aleppo.mp3",
    seconds: 156,
    source:
      "https://commons.wikimedia.org/wiki/File:Call_to_prayer_by_Sabah_Fakhry.mp3",
    licence: "Public domain",
  },
  {
    id: "short",
    file: "short.mp3",
    seconds: 86,
    source:
      "https://commons.wikimedia.org/wiki/File:The_Adhan_-_Muslim_Call_to_Prayer_-_Aaqib_Azeez.mp3",
    licence: "CC BY-SA 4.0",
  },
]);

const DEFAULT_ADHAN_VOICE = "makkah"; // first in the list
/** the user's own audio file, copied to <userData>/adhan/ */
const CUSTOM_ADHAN_VOICE = "custom";
/** Fajr plays the same voice as the other prayers */
const FAJR_SAME_VOICE = "same";

/** Audio files "Your own file" accepts (what Chromium plays), and the largest size. */
const CUSTOM_ADHAN_EXTENSIONS = Object.freeze([
  "mp3",
  "m4a",
  "aac",
  "ogg",
  "oga",
  "opus",
  "wav",
  "flac",
  "webm",
]);
const CUSTOM_ADHAN_MAX_BYTES = 30 * 1024 * 1024;

/** @param {unknown} id */
const isAdhanVoice = (id) =>
  id === CUSTOM_ADHAN_VOICE || ADHAN_VOICES.some((v) => v.id === id);

/**
 * The voice a prayer plays with the saved settings.
 * @param {string | undefined} prayerKey "Fajr", "Dhuhr"...
 * @param {{ adhanVoice?: string, adhanVoiceFajr?: string }} settings
 */
function voiceForPrayer(prayerKey, settings) {
  const fajr = settings?.adhanVoiceFajr;
  const id =
    prayerKey === "Fajr" && fajr && fajr !== FAJR_SAME_VOICE
      ? fajr
      : settings?.adhanVoice;
  return isAdhanVoice(id) ? String(id) : DEFAULT_ADHAN_VOICE;
}

module.exports = {
  ADHAN_VOICES,
  DEFAULT_ADHAN_VOICE,
  CUSTOM_ADHAN_VOICE,
  FAJR_SAME_VOICE,
  CUSTOM_ADHAN_EXTENSIONS,
  CUSTOM_ADHAN_MAX_BYTES,
  isAdhanVoice,
  voiceForPrayer,
};
