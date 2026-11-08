"use strict";

// The reciters whose surah recordings come with the time of every ayah (mp3quran.net
// "ayat_timing"), so the Quran reader can mark the ayah being recited. Each one is a recording
// (a "read"): one reciter can have several (Hafs, Warsh, a mujawwad style). The names and photos
// come from the reciter list of the Audio Archive, matched by the recording's folder.
const {
  apiLanguage,
  getReciters,
  cacheGet,
  cacheSet,
  fetchJson,
} = require("./mp3quran");

const BASE_URL = "https://mp3quran.net/api/v3/ayat_timing";

/** The riwayat the reader has, by the Arabic name mp3quran gives the recording. */
const RIWAYA_OF = {
  "حفص عن عاصم": "hafs",
  "المصحف المجود": "hafs", // mujawwad recordings, all Hafs
  "ورش عن نافع": "warsh",
  "قالون عن نافع": "qalun",
};

/**
 * @typedef {object} TimedReciter
 * @property {number} read        the recording's id (for its timings)
 * @property {number} reciterId   the reciter's id (photo)
 * @property {string} name        in the app's language
 * @property {"hafs" | "warsh" | "qalun"} riwaya
 * @property {boolean} mujawwad   the slow, melodic style
 * @property {string} server      the folder of the surah files, ending with "/"
 *
 * @typedef {{ ayah: number, start: number, end: number }} AyahTime  seconds; ayah 0 = the opening
 */

/** @param {string} url */
const folderKey = (url) =>
  String(url)
    .replace(/^http:/, "https:")
    .replace(/\/+$/, "");

/** @returns {Promise<TimedReciter[]>} the recordings of the 114 surahs, by name */
async function getTimedReciters() {
  const language = apiLanguage();
  const key = `ayat-timing:reciters:${language}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const [reads, reciters] = await Promise.all([
    fetchJson(`${BASE_URL}/reads`),
    getReciters(language),
  ]);
  /** @type {Map<string, { id: number, name: string, moshaf: string }>} */
  const byFolder = new Map();
  for (const r of reciters) {
    for (const m of r.moshaf ?? []) {
      byFolder.set(folderKey(m.server), {
        id: r.id,
        name: r.name,
        moshaf: m.name,
      });
    }
  }
  /** @type {TimedReciter[]} */
  const list = [];
  for (const read of Array.isArray(reads) ? reads : []) {
    const riwaya = RIWAYA_OF[String(read.rewaya).replace(/\s+/g, " ").trim()];
    const match = byFolder.get(folderKey(read.folder_url));
    if (!riwaya || !match || read.soar_count !== 114) continue;
    list.push({
      read: read.id,
      reciterId: match.id,
      name: match.name,
      riwaya,
      mujawwad: /mojawwad|mujawwad|مجود/i.test(
        `${match.moshaf} ${read.rewaya}`,
      ),
      server: `${folderKey(read.folder_url)}/`,
    });
  }
  list.sort((a, b) => a.name.localeCompare(b.name, language));
  cacheSet(key, list);
  return list;
}

/**
 * When each ayah of a surah starts and ends in a recording.
 * @param {number} read @param {number} surah @returns {Promise<AyahTime[]>}
 */
async function getAyahTimings(read, surah) {
  const key = `ayat-timing:${read}:${surah}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  const data = await fetchJson(`${BASE_URL}?surah=${surah}&read=${read}`);
  /** @type {AyahTime[]} */
  const times = (Array.isArray(data) ? data : [])
    .filter((a) => Number.isInteger(a?.ayah) && a.end_time > a.start_time)
    .map((a) => ({
      ayah: a.ayah,
      start: a.start_time / 1000,
      end: a.end_time / 1000,
    }))
    .sort((a, b) => a.start - b.start);
  if (!times.length) throw new Error(`No ayah timings for ${read}/${surah}`);
  cacheSet(key, times);
  return times;
}

/** The ayah recited at a time (0 during the opening before ayah 1).
 * @param {AyahTime[]} timings @param {number} t  seconds */
function ayahAt(timings, t) {
  let found = 0;
  for (const a of timings) {
    if (a.start > t) break;
    found = a.ayah;
  }
  return found;
}

/** Where the ayah before or after the one recited at a time starts, or null (none there).
 * @param {AyahTime[]} timings @param {number} t @param {-1 | 1} step */
function ayahStep(timings, t, step) {
  const target = Math.max(1, ayahAt(timings, t) + step);
  return timings.find((a) => a.ayah === target)?.start ?? null;
}

/** The surah's file in a recording. @param {TimedReciter} reciter @param {number} surah */
const surahUrl = (reciter, surah) =>
  `${reciter.server}${String(surah).padStart(3, "0")}.mp3`;

module.exports = {
  getTimedReciters,
  getAyahTimings,
  surahUrl,
  ayahAt,
  ayahStep,
};
