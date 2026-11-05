"use strict";

// Where the reader stopped: the first ayah at the top of the reader, saved while scrolling (a
// moment after the scroll stops), so "Continue reading" on the surah list opens it there.
const { state } = require("./state");
const { saveLastRead } = require("./storage");

/** @param {number} surah @param {number} ayah */
const rememberAyah = (surah, ayah) => saveLastRead({ surah, ayah });

/** The number of the first ayah still showing at the top of the reader. @param {HTMLElement} content */
function topAyah(content) {
  const top = content.getBoundingClientRect().top + 8;
  for (const el of content.querySelectorAll(".ayah-text, .ayah-card")) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.getBoundingClientRect().bottom > top) return Number(el.dataset.ayah);
  }
  return 0;
}

/** @param {HTMLElement} content  the reader's scrolling box */
function trackReading(content) {
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  content.addEventListener(
    "scroll",
    () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const surah = state.currentSurah?.n;
        const ayah = topAyah(content);
        if (surah && ayah) rememberAyah(surah, ayah);
      }, 400);
    },
    { passive: true },
  );
}

module.exports = { trackReading, rememberAyah };
