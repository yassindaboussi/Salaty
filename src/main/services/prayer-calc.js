"use strict";

// Prayer times calculated on this computer, with the settings Aladhan used for the location
// (its answer's `meta`: method angles, high-latitude rule, Asr school, minute offsets, time
// zone). Aladhan's own engine is a PHP port of PrayTimes (praytimes.org), the library used
// here, so both give the same times (checked: ±1 min). Used only when Aladhan can't be
// reached and nothing is cached (prayer-times.js).
//
// No Electron here: plain functions of their inputs.
const { PrayTime } = require("praytime");

/**
 * @typedef {{ lat: number, lng: number }} Coords
 * @typedef {{ timings: Record<string, string>, date: any, meta: any }} PrayerDay
 */

const HIGH_LATS = /** @type {Record<string, string>} */ ({
  ANGLE_BASED: "AngleBased",
  ONE_SEVENTH: "OneSeventh",
  MIDDLE_OF_THE_NIGHT: "NightMiddle",
  NONE: "None",
});

// Moonsighting Committee (15) uses seasonal angles that PrayTimes lacks: its 18° base is
// the closest fixed angle.
const MOONSIGHTING_FALLBACK = { Fajr: 18, Isha: 18 };
const UMM_AL_QURA = 4;

// Aladhan's Asr reads the sun's position ~30 h after the usual moment (measured on 20 cities
// over a year: Asr was 1-6 min apart, seasonally; with this shift ±1 min like the others).
// Matching it keeps the offline times the same as the times shown online.
const ALADHAN_ASR_SHIFT_HOURS = 30;

class AladhanPrayTime extends PrayTime {
  /** @param {string} method */
  constructor(method) {
    super(method);
  }

  /** @param {string} asrParam @param {number} time */
  asrAngle(asrParam, time) {
    return super.asrAngle(asrParam, time + ALADHAN_ASR_SHIFT_HOURS);
  }
}

/** @param {unknown} n */
const isNumber = (n) => typeof n === "number" && Number.isFinite(n);

/** @param {any} coords @returns {coords is Coords} */
const isCoords = (coords) =>
  isNumber(coords?.lat) &&
  isNumber(coords?.lng) &&
  Math.abs(coords.lat) <= 90 &&
  Math.abs(coords.lng) <= 180;

/** @param {string} timeZone */
function isTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** @param {any} meta an Aladhan answer's meta @returns {boolean} */
const isUsableMeta = (meta) =>
  typeof meta?.timezone === "string" &&
  isTimeZone(meta.timezone) &&
  meta?.method?.params != null &&
  typeof meta.method.params === "object";

/**
 * "18" / 18 / "90 min" as PrayTimes reads them; undefined when absent.
 * @param {unknown} value
 */
const param = (value) =>
  isNumber(value) || typeof value === "string" ? value : undefined;

/** @param {any} meta */
function settingsOf(meta) {
  const params =
    meta.method?.id === 15 ? MOONSIGHTING_FALLBACK : meta.method.params;
  const midnight =
    String(meta.midnightMode ?? params.Midnight ?? "").toUpperCase() ===
    "JAFARI"
      ? "Jafari"
      : "Standard";
  /** @type {Record<string, number>} */
  const tune = {};
  for (const [name, minutes] of Object.entries(meta.offset ?? {})) {
    if (isNumber(minutes) && minutes !== 0) tune[name.toLowerCase()] = minutes;
  }
  // Aladhan gives Umm al-Qura's Ramadan Isha as a +30 min offset on those days only: the
  // saved meta may be from Ramadan, so the rule is applied per day (calculateDay) instead
  if (meta.method?.id === UMM_AL_QURA) delete tune.isha;
  return {
    fajr: param(params.Fajr) ?? 18,
    isha: param(params.Isha) ?? 17,
    // Aladhan's Maghrib is sunset unless the method says otherwise (PrayTimes adds 1 min)
    maghrib: param(params.Maghrib) ?? "0 min",
    midnight,
    asr: String(meta.school).toUpperCase() === "HANAFI" ? "Hanafi" : "Standard",
    highLats: HIGH_LATS[meta.latitudeAdjustmentMethod] ?? "AngleBased",
    tune,
  };
}

/**
 * "HH:MM" of a moment in a time zone.
 * @param {number} ms @param {string} timeZone
 */
const clock = (ms, timeZone) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(ms);

/**
 * The moments (ms) of one day's times.
 * @param {ReturnType<typeof settingsOf>} settings
 * @param {Coords} coords
 * @param {[number, number, number]} ymd
 */
function moments(settings, coords, ymd) {
  // praytime ships no types: its chainable setters are used as documented (praytimes.org)
  const praytime = /** @type {any} */ (new AladhanPrayTime("MWL"))
    .adjust(settings)
    .location([coords.lat, coords.lng])
    .format("x");
  return /** @type {Record<string, number>} */ (
    /** @type {unknown} */ (praytime.times(ymd))
  );
}

/** Times in the day's order, each after the one before (polar days can break it). */
const ORDER = ["fajr", "sunrise", "dhuhr", "asr", "sunset", "isha"];

/** @param {Record<string, number>} t */
const inOrder = (t) =>
  ORDER.every((name) => isNumber(t[name])) &&
  ORDER.every((name, i) => i === 0 || t[ORDER[i - 1]] < t[name]);

const HIJRI_MONTHS = {
  en: [
    "Muḥarram",
    "Ṣafar",
    "Rabīʿ al-awwal",
    "Rabīʿ al-thānī",
    "Jumādá al-ūlá",
    "Jumādá al-ākhirah",
    "Rajab",
    "Shaʿbān",
    "Ramaḍān",
    "Shawwāl",
    "Dhū al-Qaʿdah",
    "Dhū al-Ḥijjah",
  ],
  ar: [
    "مُحَرَّم",
    "صَفَر",
    "رَبيع الأوَّل",
    "رَبيع الثاني",
    "جُمادى الأولى",
    "جُمادى الآخرة",
    "رَجَب",
    "شَعْبان",
    "رَمَضان",
    "شَوّال",
    "ذوالقعدة",
    "ذوالحجة",
  ],
};

/**
 * The Hijri date of a Gregorian day (Umm al-Qura, the calendar Aladhan's dates follow), in
 * the shape of Aladhan's `hijri` object (the fields the pages read).
 * @param {[number, number, number]} ymd
 */
function hijriOf([year, month, day]) {
  const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).formatToParts(Date.UTC(year, month - 1, day, 12));
  /** @param {Intl.DateTimeFormatPartTypes} type */
  const get = (type) => Number(parts.find((p) => p.type === type)?.value);
  const number = get("month");
  return {
    day: String(get("day")).padStart(2, "0"),
    month: {
      number,
      en: HIJRI_MONTHS.en[number - 1] ?? "",
      ar: HIJRI_MONTHS.ar[number - 1] ?? "",
    },
    year: String(get("year")),
    holidays: [],
  };
}

const pad = (/** @type {number} */ n) => String(n).padStart(2, "0");

// prettier-ignore
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * One day in the shape of Aladhan's calendar days, or null when the sun's path gives no valid
 * times there that day (near the poles).
 * @param {any} meta the meta of an Aladhan answer for this location
 * @param {Coords} coords
 * @param {number} year @param {number} month 1-12 @param {number} day
 * @returns {PrayerDay | null}
 */
function calculateDay(meta, coords, year, month, day) {
  if (!isUsableMeta(meta) || !isCoords(coords)) return null;
  /** @type {[number, number, number]} */
  const ymd = [year, month, day];
  const hijri = hijriOf(ymd);
  const settings = settingsOf(meta);
  // Umm al-Qura: Isha is 120 min after Maghrib in Ramadan (90 the rest of the year)
  if (meta.method?.id === UMM_AL_QURA && hijri.month.number === 9) {
    settings.isha = "120 min";
  }
  const t = moments(settings, coords, ymd);
  if (!inOrder(t) || !isNumber(t.maghrib) || !isNumber(t.midnight)) return null;

  // Aladhan: Imsak 10 min before Fajr; the night's thirds run from sunset to next sunrise
  const nextSunrise = moments(settings, coords, [year, month, day + 1]).sunrise;
  const night = isNumber(nextSunrise) ? nextSunrise - t.sunset : NaN;
  const zone = meta.timezone;
  const at = (/** @type {number} */ ms) =>
    isNumber(ms) ? clock(ms, zone) : "--:--";
  const timings = {
    Fajr: at(t.fajr),
    Sunrise: at(t.sunrise),
    Dhuhr: at(t.dhuhr),
    Asr: at(t.asr),
    Sunset: at(t.sunset),
    Maghrib: at(t.maghrib),
    Isha: at(t.isha),
    Imsak: at(t.fajr - 10 * 60_000),
    Midnight: at(t.midnight),
    Firstthird: at(t.sunset + night / 3),
    Lastthird: at(t.sunset + (2 * night) / 3),
  };
  const weekday = new Intl.DateTimeFormat("en", {
    weekday: "long",
    timeZone: "UTC",
  }).format(Date.UTC(year, month - 1, day, 12));
  return {
    timings,
    date: {
      // "07 Nov 2026", as Aladhan writes it (the home page shows it)
      readable: `${pad(day)} ${MONTHS_SHORT[month - 1]} ${year}`,
      timestamp: String(Math.floor(Date.UTC(year, month - 1, day) / 1000)),
      gregorian: {
        date: `${pad(day)}-${pad(month)}-${year}`,
        day: pad(day),
        weekday: { en: weekday },
        month: { number: month },
        year: String(year),
      },
      hijri,
    },
    meta: { ...meta, latitude: coords.lat, longitude: coords.lng },
  };
}

/**
 * Every day of a Gregorian month, or null when one of them has no valid times.
 * @param {any} meta @param {Coords} coords
 * @param {number} year @param {number} month 1-12
 * @returns {PrayerDay[] | null}
 */
function calculateMonth(meta, coords, year, month) {
  const length = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days = [];
  for (let day = 1; day <= length; day++) {
    const result = calculateDay(meta, coords, year, month, day);
    if (!result) return null;
    days.push(result);
  }
  return days;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const HIJRI_YEAR_DAYS = 354.367;
const HIJRI_EPOCH_MS = Date.UTC(622, 6, 19); // 1 Muharram 1 AH (Umm al-Qura, proleptic)

/**
 * The days of a Hijri month (Umm al-Qura), as { gregorian: { date }, hijri } like Aladhan's
 * hToG calendar: the offline answer when that calendar can't be downloaded.
 * @param {number} hijriYear @param {number} hijriMonth 1-12
 */
function hijriMonthDays(hijriYear, hijriMonth) {
  const guess =
    HIJRI_EPOCH_MS +
    ((hijriYear - 1) * HIJRI_YEAR_DAYS + (hijriMonth - 1) * 29.53) * DAY_MS;
  const days = [];
  for (let ms = guess - 20 * DAY_MS; ms < guess + 50 * DAY_MS; ms += DAY_MS) {
    const at = new Date(ms);
    /** @type {[number, number, number]} */
    const ymd = [at.getUTCFullYear(), at.getUTCMonth() + 1, at.getUTCDate()];
    const hijri = hijriOf(ymd);
    if (hijri.month.number !== hijriMonth || Number(hijri.year) !== hijriYear)
      continue;
    days.push({
      gregorian: { date: `${pad(ymd[2])}-${pad(ymd[1])}-${ymd[0]}` },
      hijri,
    });
  }
  return days;
}

module.exports = {
  calculateDay,
  calculateMonth,
  hijriMonthDays,
  isCoords,
  isUsableMeta,
};
