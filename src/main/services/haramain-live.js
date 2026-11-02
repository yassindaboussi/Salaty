"use strict";

// The live broadcasts from the Two Holy Mosques: the official channels of the Saudi Broadcasting
// Authority on YouTube (Quran TV from al-Masjid al-Haram, Sunnah TV from al-Masjid an-Nabawi).
// A channel's live video changes when a broadcast restarts, so its id is read from the
// channel's /live page (kept 30 minutes). The page plays it in YouTube's embedded player.
const log = require("./logger").logger("Live");

const CHANNELS = {
  makkah: "UCos52azQNBgW63_9uDJoPDA", // youtube.com/@SaudiQuranTv
  madina: "UCROKYPep-UuODNwyipe6JMw", // youtube.com/@SaudiSunnahTv
};
const KEEP_MS = 30 * 60 * 1000;
const TIMEOUT_MS = 12000;
const VIDEO_ID = /^[\w-]{11}$/;

/** @type {Map<string, { id: string, at: number }>} */
const known = new Map();

/** The id of the video the /live page shows, if it is live now. @param {string} page */
function liveIdIn(page) {
  // the page's player data: "videoDetails":{"videoId":"…",…"isLive":true
  const details = page.match(/"videoDetails":\{"videoId":"([\w-]{11})"/);
  const isLive = /"isLive(Now)?":true/.test(page);
  return details && isLive ? details[1] : null;
}

/**
 * @param {string} key "makkah" | "madina"
 * @returns {Promise<string | null>} null when unknown (offline, YouTube changed its page)
 */
async function getLiveVideoId(key) {
  const channel = CHANNELS[/** @type {keyof typeof CHANNELS} */ (key)];
  if (!channel) return null;
  const saved = known.get(key);
  if (saved && Date.now() - saved.at < KEEP_MS) return saved.id;
  try {
    const res = await fetch(`https://www.youtube.com/channel/${channel}/live`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // SOCS: the cookie-consent answer, so a European connection gets the page, not the form
      headers: { "Accept-Language": "en", Cookie: "SOCS=CAI" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const id = liveIdIn(await res.text());
    if (!id || !VIDEO_ID.test(id)) throw new Error("no live video found");
    known.set(key, { id, at: Date.now() });
    return id;
  } catch (err) {
    log.warn(`the ${key} live video could not be found:`, err.message);
    return saved?.id ?? null;
  }
}

module.exports = { getLiveVideoId, liveIdIn };
