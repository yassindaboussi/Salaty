"use strict";

// The two live channels: the official ones of the Saudi Broadcasting Authority on YouTube.
// Their current live video comes from the main process (services/haramain-live.js).

/** @typedef {"makkah" | "madina"} ChannelKey */

const CHANNELS = /** @type {const} */ ([
  {
    key: "makkah",
    icon: "fa-kaaba",
    name: "makkahLive", // Al-Masjid al-Haram
    place: "makkahLocation",
    tv: "lvQuranTv",
    youtube: "https://www.youtube.com/@SaudiQuranTv/live",
  },
  {
    key: "madina",
    icon: "fa-mosque",
    name: "madinaLive", // Al-Masjid an-Nabawi
    place: "madinaLocation",
    tv: "lvSunnahTv",
    youtube: "https://www.youtube.com/@SaudiSunnahTv/live",
  },
]);

/** @param {string} key */
const channelOf = (key) => CHANNELS.find((c) => c.key === key) ?? CHANNELS[0];

/** YouTube's privacy-enhanced player (no cookies until it plays), starting at once, its buttons
 * in the app's language. @param {string} videoId @param {string} lang "en" | "ar" | "fr" */
const embedUrl = (videoId, lang) =>
  `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0&playsinline=1&hl=${encodeURIComponent(lang)}`;

module.exports = { CHANNELS, channelOf, embedUrl };
