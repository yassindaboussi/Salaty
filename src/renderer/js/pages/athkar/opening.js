"use strict";

// The category the page opens on. Back from a verse in the Quran page: the category it was
// opened from. Otherwise, with today's prayer times: the morning athkar from Fajr until
// Dhuhr, the evening athkar from Asr until Isha (their times, and the time after them they may
// still be made up in). Otherwise the category opened last, else the morning athkar.
// https://islamqa.info/en/answers/22765
const { ipcRenderer } = require("electron");
const { cleanTime } = require("../../../../shared/prayerUtils");
const { state, lastCategory, RETURN_KEY } = require("./state");
const { MORNING, EVENING } = require("./categories");

/** @param {string} time  "05:12" → minutes after midnight */
function minutesOf(time) {
  const [h, m] = cleanTime(time).split(":").map(Number);
  return h * 60 + m;
}

/** @returns {Promise<string>} a category of the data */
async function openingCategory(now = new Date()) {
  const has = (/** @type {string} */ name) => Boolean(name && state.data[name]);
  try {
    const back = sessionStorage.getItem(RETURN_KEY) ?? "";
    sessionStorage.removeItem(RETURN_KEY);
    if (has(back)) return back;
  } catch {
    // storage unavailable
  }
  try {
    const timings = (await ipcRenderer.invoke("get-prayer-data"))?.timings;
    if (timings) {
      const minute = now.getHours() * 60 + now.getMinutes();
      const at = (/** @type {string} */ key) => minutesOf(timings[key]);
      if (minute >= at("Fajr") && minute < at("Dhuhr") && has(MORNING)) {
        return MORNING;
      }
      if (minute >= at("Asr") && minute < at("Isha") && has(EVENING)) {
        return EVENING;
      }
    }
  } catch {
    // no prayer times (offline, never loaded): the last category
  }
  const last = lastCategory();
  if (has(last)) return last;
  return has(MORNING) ? MORNING : Object.keys(state.data)[0];
}

module.exports = { openingCategory };
