"use strict";

// "Facing the Qibla": a computer has no compass, so the panel says how to turn from North, and
// how to check with the sun. Twice a year the sun is right above the Kaaba: 27/28 May at
// 09:18 UTC and 15/16 July at 09:27 UTC; then every shadow points away from it, and the same
// time a day or two before or after is still accurate
// (https://en.wikipedia.org/wiki/Qibla_observation_by_shadows). It only works where the sun is
// up at that moment: less than a quarter of the globe (90°) from the Kaaba.
const { byId } = require("../../core/dom");
const { t } = require("../../core/i18n");
const { gregorian, gregorianRange } = require("../../core/date-format");

const RIGHT_ANGLE = Math.PI / 2;
/** @type {Intl.DateTimeFormatOptions} */
const DAY = { day: "numeric", month: "long", year: undefined };
/** @type {Intl.DateTimeFormatOptions} */
const TIME = { hour: "numeric", minute: "2-digit" };

/**
 * @param {string} degrees the bearing as shown, "112.7°"
 * @param {string} point its compass point, "South-east"
 * @param {number} arc the distance to the Kaaba (radians of arc)
 */
function showHowTo(degrees, point, arc) {
  byId("qbStepTurn", HTMLElement).textContent = t("qbStepTurn")
    .replace("{degrees}", degrees)
    .replace("{point}", point.toLocaleLowerCase());

  const sun = byId("qbSun", HTMLElement);
  sun.hidden = arc >= RIGHT_ANGLE;
  if (sun.hidden) return;
  const year = new Date().getFullYear();
  const may = [
    new Date(Date.UTC(year, 4, 27, 9, 18)),
    new Date(Date.UTC(year, 4, 28, 9, 18)),
  ];
  const july = [
    new Date(Date.UTC(year, 6, 15, 9, 27)),
    new Date(Date.UTC(year, 6, 16, 9, 27)),
  ];
  byId("qbSunText", HTMLElement).textContent = t("qbSunCheck")
    .replace("{may}", gregorianRange(may[0], may[1], DAY))
    .replace("{mayTime}", gregorian(may[1], TIME))
    .replace("{july}", gregorianRange(july[0], july[1], DAY))
    .replace("{julyTime}", gregorian(july[1], TIME));
}

module.exports = { showHowTo };
