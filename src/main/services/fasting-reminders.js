"use strict";

// Sunnah fasting reminders, for the kinds of fast turned on in the Sunnah fasting page
// (settings.fastingReminders = { types, evening, suhoor, suhoorMinutes }):
//   evening   the evening before, after Isha (from the location's prayer times): make the
//             intention, plan suhoor
//   suhoor    on the day, N minutes before Fajr
// One popup per reminder with every reason of that day ("Thursday fast · White Day"). The six
// days of Shawwal are reminded once, for the 2nd (the user picks the other days).
//
// The next reminder is planned again at least every 30 minutes and when the computer wakes up,
// so a changed clock, a new day or a sleep never makes one fire at the wrong time. A reminder
// missed while the computer was off still comes, but only before that day's Fajr.
const { app, powerMonitor } = require("electron");
const fs = require("fs");
const path = require("path");
const fastingDays = require("./fasting-days");
const prayerTimes = require("./prayer-times");
const { t } = require("./i18n");
const { TYPES, reasonName } = require("../../shared/fasting-rules");
const log = require("./logger").logger("Fasting");

/** @typedef {import("./fasting-days").FastingDay} FastingDay */
/** @typedef {{ types: string[], evening: boolean, suhoor: boolean, suhoorMinutes: number }} Prefs */
/**
 * @typedef {object} Reminder
 * @property {string} key       "evening:<iso>" or "suhoor:<iso>" (the fired log)
 * @property {"evening" | "suhoor"} kind
 * @property {Date} at          when it is shown
 * @property {Date} deadline    Fajr of the fasting day: after it, too late to remind
 * @property {FastingDay} day
 * @property {string} [fajr]    "HH:MM"
 */

const MINUTE = 60_000;
const AFTER_ISHA_MS = 15 * MINUTE;
const PLAN_AGAIN_MS = 30 * MINUTE;
const KEEP_LOG_MS = 7 * 24 * 60 * MINUTE;

/** @type {() => any} */
let getSettings = () => ({});
/** @type {ReturnType<typeof setTimeout> | null} */
let timer = null;

const pad2 = (/** @type {number} */ n) => String(n).padStart(2, "0");
/** @param {Date} d */
const isoOf = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
/** @param {string} iso */
const dateOf = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
/** @param {Date} day @param {number} n */
const addDays = (day, n) =>
  new Date(day.getFullYear(), day.getMonth(), day.getDate() + n);
/** @param {Date} day @param {string} time "HH:MM" */
const timeOn = (day, time) => {
  const [h, m] = time.split(":").map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
};

/** @param {any} settings @returns {Prefs} */
function prefsOf(settings) {
  const fr = settings?.fastingReminders ?? {};
  const minutes = Number(fr.suhoorMinutes);
  return {
    types: Array.isArray(fr.types)
      ? fr.types.filter((x) => TYPES.includes(x))
      : [],
    evening: fr.evening !== false,
    suhoor: fr.suhoor === true,
    suhoorMinutes: Number.isInteger(minutes) ? minutes : 30,
  };
}

/**
 * The reasons of a day that are reminded (the six of Shawwal: only for the 2nd).
 * @param {FastingDay} day @param {string[]} types
 */
const remindedReasons = (day, types) =>
  day.reasons.filter(
    (r) => types.includes(r) && (r !== "shawwal6" || day.hijri.day === 2),
  );

/**
 * The reminders for some days, in time order. Pure (tested on its own).
 * @param {Date} now
 * @param {FastingDay[]} days
 * @param {(iso: string) => Record<string, string> | undefined} timesFor a day's prayer times
 * @param {Prefs} prefs
 * @returns {Reminder[]}
 */
function planReminders(now, days, timesFor, prefs) {
  /** @type {Reminder[]} */
  const reminders = [];
  for (const day of days) {
    if (!remindedReasons(day, prefs.types).length) continue;
    const date = dateOf(day.iso);
    const fajr = timesFor(day.iso)?.Fajr;
    const deadline = timeOn(date, fajr ?? "04:00");
    if (deadline <= now) continue; // the fast has begun
    if (prefs.evening) {
      const eve = addDays(date, -1);
      const isha = timesFor(isoOf(eve))?.Isha;
      const at = isha
        ? new Date(timeOn(eve, isha).getTime() + AFTER_ISHA_MS)
        : timeOn(eve, "21:00");
      reminders.push({
        key: `evening:${day.iso}`,
        kind: "evening",
        at,
        deadline,
        day,
      });
    }
    if (prefs.suhoor && fajr) {
      reminders.push({
        key: `suhoor:${day.iso}`,
        kind: "suhoor",
        at: new Date(deadline.getTime() - prefs.suhoorMinutes * MINUTE),
        deadline,
        day,
        fajr,
      });
    }
  }
  return reminders.sort((a, b) => a.at.getTime() - b.at.getTime());
}

// ── Fired log: which reminders were shown, kept a week ──────────────────────

const logFile = () =>
  path.join(app.getPath("userData"), "fasting-reminders-log.json");

/** @returns {Record<string, string>} */
function readFired() {
  try {
    const data = JSON.parse(fs.readFileSync(logFile(), "utf8"));
    return data?.v === 2 && data.fired ? data.fired : {};
  } catch {
    return {}; // none yet, or the old format
  }
}

/** @param {Record<string, string>} fired */
function writeFired(fired) {
  const keep = Date.now() - KEEP_LOG_MS;
  const recent = Object.fromEntries(
    Object.entries(fired).filter(([, at]) => Date.parse(at) > keep),
  );
  try {
    fs.writeFileSync(logFile(), JSON.stringify({ v: 2, fired: recent }));
  } catch (err) {
    log.warn("saving the reminder log failed:", err.message);
  }
}

// ── Showing one ─────────────────────────────────────────────────────────────

/** Texts (locales/<lang>/app/desktop.json) of each reason, by reasonName(). */
/** @type {Record<string, string>} */
const REASON_KEYS = {
  monday: "fastReasonMonday",
  thursday: "fastReasonThursday",
  whiteDays: "fastReasonWhiteDays",
  tasua: "fastReasonTasua",
  ashura: "fastReasonAshura",
  arafah: "fastReasonArafah",
  dhulHijjah: "fastReasonDhulHijjah",
  shawwal6: "fastReasonShawwal6",
};

/** @param {Reminder} reminder @param {any} settings */
function show(reminder, settings) {
  const lang = settings.language || "en";
  const { day } = reminder;
  // all the day's reasons; on Arafah the "first nine days" go without saying
  const reasons = day.reasons
    .filter((r) => r !== "shawwal6" || day.hijri.day === 2)
    .filter((r) => !(r === "dhulHijjah" && day.reasons.includes("arafah")))
    .map((r) => t(REASON_KEYS[reasonName(r, day.hijri.day, day.weekday)], lang))
    .join(" · ");
  const date = new Intl.DateTimeFormat(`${lang}-u-nu-latn`, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(dateOf(day.iso));
  const evening = reminder.kind === "evening";
  const content = (
    evening ? t("fastingEveningText", lang) : t("fastingSuhoorText", lang)
  )
    .replace("{date}", date)
    .replace("{reasons}", reasons)
    .replace("{time}", reminder.fajr ?? "");
  const { showThemedPopup } = require("../ipc/handlers/popup-handlers");
  showThemedPopup(
    {
      icon: evening ? "fa-moon" : "fa-utensils",
      theme: settings.theme || "navy",
      title: `Salaty Time · ${t(evening ? "fastingEveningTitle" : "fastingSuhoorTitle", lang)}`,
      content,
    },
    "athkar",
  );
}

// ── Planning ────────────────────────────────────────────────────────────────

/**
 * Prayer times by day for the days around these ones (from the cached monthly timetables).
 * @param {any} settings @param {FastingDay[]} days
 */
async function timesLookup(settings, days) {
  /** @type {Map<string, Record<string, string>>} */
  const times = new Map();
  const months = new Set(
    days
      .flatMap((d) => [d.iso, isoOf(addDays(dateOf(d.iso), -1))])
      .map((iso) => iso.slice(0, 7)),
  );
  for (const ym of months) {
    const [y, m] = ym.split("-").map(Number);
    const month = await prayerTimes.getMonth(settings, y, m).catch(() => null);
    for (const pd of month ?? []) {
      // Aladhan's "DD-MM-YYYY" → "YYYY-MM-DD"
      times.set(
        String(pd.date.gregorian.date).split("-").reverse().join("-"),
        pd.timings,
      );
    }
  }
  return (/** @type {string} */ iso) => times.get(iso);
}

async function plan() {
  if (timer) clearTimeout(timer);
  timer = null;
  const settings = getSettings() ?? {};
  const prefs = prefsOf(settings);
  if (prefs.types.length && (prefs.evening || prefs.suhoor)) {
    const now = new Date();
    const from = isoOf(now);
    const to = isoOf(addDays(now, 3));
    const days = (await fastingDays.getDays()).filter(
      (d) => d.iso >= from && d.iso <= to,
    );
    const reminders = planReminders(
      now,
      days,
      await timesLookup(settings, days),
      prefs,
    );
    const fired = readFired();
    // reached (or missed while the computer was off), still before Fajr: the latest per day
    const due = reminders.filter(
      (r) => r.at <= now && now < r.deadline && !fired[r.key],
    );
    /** @type {Map<string, Reminder>} */
    const latest = new Map(due.map((r) => [r.day.iso, r]));
    for (const reminder of latest.values()) show(reminder, settings);
    if (due.length) {
      for (const r of due) fired[r.key] = now.toISOString();
      writeFired(fired);
    }
    const next = reminders.find((r) => r.at > now && !fired[r.key]);
    if (next) {
      const wait = Math.min(next.at.getTime() - now.getTime(), PLAN_AGAIN_MS);
      timer = setTimeout(replan, Math.max(1000, wait));
      return;
    }
  }
  timer = setTimeout(replan, PLAN_AGAIN_MS);
}

/** Plans the next reminder again (settings, location or times changed). */
function replan() {
  plan().catch((err) =>
    log.warn("planning the fasting reminders failed:", err.message),
  );
}

/** The days themselves changed (Hijri correction, back online): rebuild them, then plan. */
function reload() {
  fastingDays.reload().then(replan);
}

/** @param {() => any} settingsFn returns the current settings */
function init(settingsFn) {
  getSettings = settingsFn;
  fastingDays.init(settingsFn).then(replan);
  powerMonitor.on("resume", replan);
}

function cleanup() {
  if (timer) clearTimeout(timer);
  timer = null;
}

module.exports = { init, cleanup, replan, reload, planReminders, prefsOf };
