"use strict";

// A reciter's photo, or the first letter of the name when there is none. The photos are bundled
// (assets/images/reciters/<mp3quran.net reciter id>.jpg, 240 × 240; the list of ids is
// data/reciter-photos.json), so they show offline too. They come from MAWAQIT's CDN
// (cdn.mawaqit.net/quran/reciters-pictures), which names them by the same ids. The image is
// decorative: the name is always next to it.
const { html } = require("../utils/html");
const { ids } = require("../../data/reciter-photos.json");

// from the pages (pages/<section>/<page>.html), like the radio logos
const PHOTO_DIR = "../../../assets/images/reciters/";
const HAS_PHOTO = new Set(ids);

/** @param {string} name  its first letter (Arabic or Latin), "Al-"/"ال" skipped */
function initialOf(name) {
  const clean = String(name ?? "")
    .trim()
    .replace(/^(al[\s-]+|ال)/i, "");
  return (clean.match(/\p{L}/u)?.[0] ?? "?").toUpperCase();
}

/**
 * @param {number | null | undefined} id  the mp3quran.net reciter id (none: the letter only)
 * @param {string} name
 * @param {string} [className]  size variant
 */
function reciterPhotoHtml(id, name, className = "") {
  const photo =
    id && HAS_PHOTO.has(Number(id))
      ? html`<img class="reciter-photo-img" src="${PHOTO_DIR}${id}.jpg" alt="" loading="lazy" decoding="async">`
      : "";
  return html`<span class="reciter-photo ${className}" aria-hidden="true"><span class="reciter-photo-letter">${initialOf(name)}</span>${photo}</span>`;
}

module.exports = { reciterPhotoHtml };
