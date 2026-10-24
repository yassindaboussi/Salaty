"use strict";

// Which days are Sunnah (voluntary) fasts and which must not be fasted, from the Hijri date.
// One set of rules for the main process (reminders) and the pages (Sunnah fasting page, home
// banner, Hijri calendar). Every rule cites its hadith on sunnah.com.
//
//   monThu      Mondays and Thursdays: deeds are presented to Allah (Tirmidhi 747; Muslim 1162)
//   whiteDays   the 13th, 14th and 15th of each month (Tirmidhi 761); in Dhu al-Hijja only the
//               14th and 15th, the 13th being a day of Tashreeq
//   ashura      9 and 10 Muharram, Tasu'a and Ashura (Muslim 1162, Muslim 1134)
//   arafah      9 Dhu al-Hijja, for those not on Hajj (Muslim 1162)
//   dhulHijjah  the first nine days of Dhu al-Hijja (Abu Dawud 2437)
//   shawwal6    six days of Shawwal, from the 2nd (Muslim 1164)
// Never fasted: the two Eids (Bukhari 1992) and the days of Tashreeq, 11-13 Dhu al-Hijja
// (Muslim 1141). Ramadan is obligatory, so it has no Sunnah fasts here.

/** @typedef {"monThu" | "whiteDays" | "ashura" | "arafah" | "dhulHijjah" | "shawwal6"} FastType */
/** @typedef {"eidFitr" | "eidAdha" | "tashreeq"} Forbidden */

/** @type {FastType[]} */
const TYPES = [
  "monThu",
  "whiteDays",
  "ashura",
  "arafah",
  "dhulHijjah",
  "shawwal6",
];

/** The hadith behind each rule ("Collection number", as sunnah.com names them). */
const SOURCES = {
  monThu: ["Tirmidhi 747", "Muslim 1162"],
  whiteDays: ["Tirmidhi 761"],
  ashura: ["Muslim 1162", "Muslim 1134"],
  arafah: ["Muslim 1162"],
  dhulHijjah: ["Abu Dawud 2437"],
  shawwal6: ["Muslim 1164"],
  eid: ["Bukhari 1992"],
  tashreeq: ["Muslim 1141"],
  friday: ["Bukhari 1985"],
};

const COLLECTIONS = {
  Bukhari: "bukhari",
  Muslim: "muslim",
  Tirmidhi: "tirmidhi",
  "Abu Dawud": "abudawud",
};

/**
 * The sunnah.com page of a reference ("Muslim 1162" → https://sunnah.com/muslim:1162).
 * @param {string} reference
 */
function sourceUrl(reference) {
  const match = /^(.+) (\d+)$/.exec(reference);
  const book =
    match && COLLECTIONS[/** @type {keyof typeof COLLECTIONS} */ (match[1])];
  return book ? `https://sunnah.com/${book}:${match[2]}` : null;
}

/**
 * A day on which fasting is not allowed, or null.
 * @param {number} month Hijri month 1-12
 * @param {number} day
 * @returns {Forbidden | null}
 */
function forbiddenOn(month, day) {
  if (month === 10 && day === 1) return "eidFitr";
  if (month === 12 && day === 10) return "eidAdha";
  if (month === 12 && day >= 11 && day <= 13) return "tashreeq";
  return null;
}

/** @param {number} month @param {number} day */
const isWhiteDay = (month, day) =>
  day >= 13 && day <= 15 && !forbiddenOn(month, day);

/**
 * The Sunnah fasts of a day: none on a day not to fast, nor in Ramadan.
 * @param {number} month Hijri month 1-12
 * @param {number} day Hijri day
 * @param {number} weekday Date#getDay (0 = Sunday)
 * @returns {FastType[]}
 */
function reasonsOn(month, day, weekday) {
  if (month === 9 || forbiddenOn(month, day)) return [];
  /** @type {FastType[]} */
  const reasons = [];
  if (month === 12 && day === 9) reasons.push("arafah");
  if (month === 12 && day <= 9) reasons.push("dhulHijjah");
  if (month === 1 && (day === 9 || day === 10)) reasons.push("ashura");
  if (isWhiteDay(month, day)) reasons.push("whiteDays");
  if (month === 10 && day >= 2) reasons.push("shawwal6");
  if (weekday === 1 || weekday === 4) reasons.push("monThu");
  return reasons;
}

/**
 * The name of a reason on its day, for the texts: "monday" / "thursday" for monThu, "tasua" /
 * "ashura" for the two days of Ashura, else the type itself.
 * @param {FastType} type @param {number} day Hijri day @param {number} weekday
 */
function reasonName(type, day, weekday) {
  if (type === "monThu") return weekday === 1 ? "monday" : "thursday";
  if (type === "ashura") return day === 9 ? "tasua" : "ashura";
  return type;
}

/**
 * Fasting a Friday on its own is disliked (Bukhari 1985), unless it is a fast one keeps anyway
 * (Muslim 1144): only a day of Shawwal chosen alone on a Friday needs the note.
 * @param {number} weekday @param {FastType[]} reasons
 */
const fridayAlone = (weekday, reasons) =>
  weekday === 5 && reasons.length > 0 && reasons.every((r) => r === "shawwal6");

module.exports = {
  TYPES,
  SOURCES,
  sourceUrl,
  forbiddenOn,
  isWhiteDay,
  reasonsOn,
  reasonName,
  fridayAlone,
};
