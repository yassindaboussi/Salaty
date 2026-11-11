"use strict";

// Where listening stopped, for the Audio Archive's "Continue listening" cards: one entry per kind
// ("recite", "tafsir", "tadabor"), with what to play again and the second it stopped at. A track
// that carries `resume: { kind, ... }` is saved by the background player while it plays; the
// Tadabor video dialog saves its videos itself. localStorage "listenResume" (every app page and
// the background player share it: same app:// origin).

const KEY = "listenResume";
const SAVE_EVERY = 5; // seconds between two saves while playing

/** @typedef {{ kind: string, url: string, title?: string, artist?: string, time: number } & Record<string, any>} ResumeEntry */

let lastUrl = "";
let lastTime = -Infinity;

/** @returns {Record<string, ResumeEntry>} */
function readAll() {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return all && typeof all === "object" ? all : {};
  } catch {
    return {};
  }
}

/** @param {string} kind @returns {ResumeEntry | null} */
function getResume(kind) {
  const entry = readAll()[kind];
  return entry && typeof entry.url === "string" ? entry : null;
}

/** @param {ResumeEntry} entry */
function saveResume(entry) {
  const all = readAll();
  all[entry.kind] = entry;
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // storage unavailable: nothing to continue next time
  }
}

/** Saves a playing track that asks for it (a new track at once, then every few seconds).
 * @param {any} track @param {number} time */
function saveTrackPosition(track, time) {
  if (!track?.resume?.kind || !track.url) return;
  if (track.url === lastUrl && Math.abs(time - lastTime) < SAVE_EVERY) return;
  lastUrl = track.url;
  lastTime = time;
  saveResume({
    ...track.resume,
    url: track.url,
    title: track.title,
    artist: track.artist,
    time,
  });
}

module.exports = { getResume, saveResume, saveTrackPosition };
