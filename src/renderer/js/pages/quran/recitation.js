"use strict";

// Listening while reading: a surah recited by the chosen reciter, the ayah being recited marked
// in the text. The audio plays in the app's background player (it goes on on other pages, with
// the mini player); this module sends it the surah (alone: it stops at the end of the surah)
// and gets the playing time back about once a second. Between two reports the
// time is counted on here, so a short ayah is marked when it starts, not up to a second later.
// Where each ayah starts comes from services/api/ayah-timing.js.
const { ipcRenderer } = require("electron");
const {
  getTimedReciters,
  getAyahTimings,
  surahUrl,
} = require("../../services/api/ayah-timing");
const { state, surahMeta, surahName } = require("./state");
const { loadReciter, saveReciter } = require("./storage");

/** @typedef {import("../../services/api/ayah-timing").TimedReciter} TimedReciter */
/** @typedef {import("../../services/api/ayah-timing").AyahTime} AyahTime */
/** @typedef {import("./state").Riwaya} Riwaya */
/** @typedef {{ surah: number, riwaya: Riwaya, read: number, reciterId: number, title: string, artist: string, url: string, page: string }} QuranTrack */

/** Well-known recordings to start with: Mishary Alafasy (Hafs), Al-Hussary (Warsh, Qalun). */
const DEFAULT_READ = { hafs: 123, warsh: 120, qalun: 270 };

const rec = {
  /** @type {TimedReciter[]} */
  reciters: [],
  /** @type {QuranTrack | null}  what the background player has, when it is a surah */
  track: null,
  playing: false,
  loading: false,
  failed: false, // the file could not be played (the bar says so)
  time: 0,
  duration: 0,
  stamp: 0, // performance.now() of the last time report
  /** @type {AyahTime[]} */
  timings: [],
  timingsKey: "",
  timingsFailed: false,
  /** @type {number | null}  where a new file must start: sent once it plays, and again until
   * the player reports it there (a jump sent while the file starts can be dropped) */
  startAt: null,
  startTries: 0,
};

/** @type {Set<() => void>} */
const listeners = new Set();
const changed = () => listeners.forEach((fn) => fn());

/** @param {() => void} fn  called when what is playing (or its state) changes */
const onRecitationChange = (fn) => listeners.add(fn);

/** @param {string} type @param {object} [extra] */
const send = (type, extra = {}) =>
  ipcRenderer.send("player-command", { type, ...extra });

/** The playing time now, counted on from the last report. */
function currentTime() {
  if (!rec.playing) return rec.time;
  const t = rec.time + (performance.now() - rec.stamp) / 1000;
  return rec.duration ? Math.min(t, rec.duration) : t;
}

/** The ayah recited at a time (0 for the opening before ayah 1). @param {number} t */
function ayahAt(t) {
  let found = 0;
  for (const a of rec.timings) {
    if (a.start > t) break;
    found = a.ayah;
  }
  return found;
}

/** @param {number} ayah @returns {AyahTime | undefined} */
const timingOf = (ayah) => rec.timings.find((a) => a.ayah === ayah);

/** The reciters of the riwaya being read (loads them the first time). */
async function recitersFor(riwaya = state.riwaya) {
  if (!rec.reciters.length) rec.reciters = await getTimedReciters();
  return rec.reciters.filter((r) => r.riwaya === riwaya);
}

/** The chosen recording for the riwaya, else the default one, else the first. @param {Riwaya} riwaya */
async function chosenReciter(riwaya = state.riwaya) {
  const list = await recitersFor(riwaya);
  const want = loadReciter(riwaya) ?? DEFAULT_READ[riwaya];
  return list.find((r) => r.read === want) ?? list[0] ?? null;
}

/** Loads the timings of the playing surah (once per surah and recording). */
/** @type {Promise<void>} the timings being loaded (everyone asking waits for the same one) */
let timingsLoad = Promise.resolve();

function loadTimings() {
  const track = rec.track;
  if (!track) return Promise.resolve();
  const key = `${track.read}/${track.surah}`;
  if (key === rec.timingsKey) return timingsLoad;
  rec.timingsKey = key;
  rec.timings = [];
  rec.timingsFailed = false;
  timingsLoad = getAyahTimings(track.read, track.surah)
    .then((timings) => {
      if (rec.timingsKey === key) rec.timings = timings;
    })
    .catch((err) => {
      console.warn("Ayah timings failed:", err);
      if (rec.timingsKey === key) rec.timingsFailed = true;
    })
    .then(changed);
  return timingsLoad;
}

/** @param {TimedReciter} reciter @param {number} surah  @returns {QuranTrack} */
function trackOf(reciter, surah) {
  const meta = surahMeta(surah);
  return {
    title: meta ? surahName(meta) : String(surah),
    artist: reciter.name,
    url: surahUrl(reciter, surah),
    page: "quran",
    surah,
    riwaya: reciter.riwaya,
    read: reciter.read,
    reciterId: reciter.reciterId,
  };
}

/**
 * Plays a surah of the reader (the open one by default) from an ayah.
 * @param {{ surah?: number, ayah?: number, reciter?: TimedReciter | null }} [options]
 */
async function listen({
  surah = state.currentSurah?.n,
  ayah = 1,
  reciter,
} = {}) {
  if (!surah) return;
  const chosen = reciter ?? (await chosenReciter());
  if (!chosen) throw new Error("No reciter for this riwaya");
  const sameTrack =
    rec.track?.read === chosen.read && rec.track.surah === surah;
  if (!sameTrack) {
    // the surah alone: it stops at its end (the next surah is the user's choice)
    const track = trackOf(chosen, surah);
    send("set-playlist", { tracks: [track], startIndex: 0 });
    rec.track = track;
    rec.loading = true;
    rec.time = 0;
    rec.playing = false;
  }
  await loadTimings();
  const start = ayah > 1 ? timingOf(ayah)?.start : 0;
  if (start !== undefined && (ayah > 1 || sameTrack)) {
    if (sameTrack && !rec.loading) seek(start);
    else {
      rec.startAt = start; // sent when the player says the file plays
      rec.startTries = 0;
      rec.time = start;
      rec.stamp = performance.now();
    }
  }
  if (sameTrack && !rec.playing) send("resume");
  changed();
}

/** @param {number} seconds */
/** Until when a reported time far from the one jumped to is a late report (taken before the
 * jump) and is not shown. performance.now() ms. */
let seekGuardUntil = 0;

/** @param {number} seconds */
function seek(seconds) {
  rec.time = Math.max(0, seconds);
  rec.stamp = performance.now();
  seekGuardUntil = rec.stamp + 2000;
  send("seek", { value: rec.time });
}

/** Whether a time the player reports can be shown (not a late one from before a jump).
 * @param {number} reported */
const believable = (reported) =>
  performance.now() > seekGuardUntil ||
  Math.abs(reported - currentTime()) < 1.5;

/** The ayah before or after the one recited. @param {-1 | 1} step */
function stepAyah(step) {
  const now = ayahAt(currentTime());
  const target = timingOf(Math.max(1, now + step));
  if (target) seek(target.start);
}

const togglePlay = () => send(rec.playing ? "pause" : "resume");
/** Stops and forgets the surah (the bar hides on the player's answer). */
function stop() {
  rec.loading = false;
  rec.startAt = null;
  send("stop");
}

/** A new recording for the riwaya; plays it at the same ayah when this riwaya is playing.
 * @param {TimedReciter} reciter */
async function chooseReciter(reciter) {
  saveReciter(reciter.riwaya, reciter.read);
  const track = rec.track;
  if (!track || track.riwaya !== reciter.riwaya) return changed();
  const ayah = ayahAt(currentTime()) || 1;
  await listen({ surah: track.surah, ayah, reciter });
}

/** @param {any} t @returns {t is QuranTrack} */
const isQuranTrack = (t) =>
  t?.page === "quran" && Number.isInteger(t.surah) && Number.isInteger(t.read);

/**
 * Whether the player is at the start asked for; if not, the jump is sent (again). After a few
 * tries it gives up and follows the player where it is.
 * @param {number} reported  the player's time
 */
function startReached(reported) {
  const at = rec.startAt;
  if (at === null) return true;
  if (reported >= at - 0.5 || rec.startTries >= 5) {
    rec.startAt = null;
    return true;
  }
  rec.startTries += 1;
  seek(at);
  return false;
}

/** @param {(track: QuranTrack) => void} [onFirstTrack]  a surah was already playing when the page opened */
function bindRecitation(onFirstTrack) {
  let first = true;
  ipcRenderer.on("player-update", (_e, msg) => {
    if (msg?.type === "time-update") {
      if (rec.startAt !== null && !startReached(msg.currentTime || 0)) return;
      if (!believable(msg.currentTime || 0)) return;
      rec.time = msg.currentTime || 0;
      rec.duration = msg.duration || rec.duration;
      rec.stamp = performance.now();
      return;
    }
    if (msg?.type !== "state") return;
    const s = msg.state;
    const track = isQuranTrack(s.currentTrack) ? s.currentTrack : null;
    // the background player starting (the first time) says "nothing" before it takes the
    // surah just sent: not a stop, the surah and its start are kept
    if (!track && rec.track && rec.loading) return;
    rec.track = track;
    const estimate = currentTime(); // before the playing state changes
    rec.playing = Boolean(track && s.isPlaying && !s.loading);
    rec.loading = Boolean(track && s.loading);
    const reported = s.currentTime || 0;
    if (rec.startAt !== null) rec.time = rec.startAt;
    else rec.time = believable(reported) ? reported : estimate;
    rec.duration = s.duration || 0;
    rec.stamp = performance.now();
    // the new file plays now: it can jump to the ayah asked for
    if (rec.playing) startReached(s.currentTime || 0);
    if (!track) rec.startAt = null;
    // a file that fails would make the player try every next surah: stop instead
    if (track && s.failed) {
      stop();
      rec.failed = true;
    } else rec.failed = false;
    if (track && first) {
      onFirstTrack?.(track);
      // the reciter's name in the page's language
      recitersFor(track.riwaya)
        .then(changed)
        .catch(() => {});
    }
    first = false;
    loadTimings();
    changed();
  });
  send("get-state");
}

module.exports = {
  rec,
  currentTime,
  ayahAt,
  recitersFor,
  chosenReciter,
  listen,
  seek,
  stepAyah,
  togglePlay,
  stop,
  chooseReciter,
  onRecitationChange,
  bindRecitation,
};
