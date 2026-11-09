"use strict";

// Prayer times as the user reads them: Settings → Time format, 24-hour (default) or 12-hour.
// Pages call clock("17:05") → "17:05" or "5:05 PM" (Arabic "5:05 م").
const { displayTime } = require("../../../shared/prayerUtils");
const { getLanguage } = require("./i18n");
const { state } = require("./store");

/** @param {string | undefined} raw "HH:MM", a suffix allowed */
function clock(raw) {
  return displayTime(raw, state.settings.timeFormat, getLanguage());
}

module.exports = { clock };
