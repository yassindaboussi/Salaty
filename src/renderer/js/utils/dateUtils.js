
function getGregorianDate(prayerData) {
  if (!prayerData?.date?.readable) return "";
  return prayerData.date.readable;
}

function getHijriDate(prayerData, lang, t) {
  if (!prayerData?.date?.hijri) return "";
  const hijri = prayerData.date.hijri;
  const hijriMonth = lang === "ar" ? hijri.month.ar : hijri.month.en;
  return `${hijri.day} ${hijriMonth} ${hijri.year} ${t("ah")}`;
}

function getSecondsFromTime(time) {
  if (!time) return 0;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 3600 + minutes * 60;
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

const islEvents = [
  {
    month: 1,
    day: 1,
    key: "muharramStart",
    checkMonth: 12,
    checkDays: [29, 30],
  },
  {
    month: 1,
    day: 9,
    key: "tasua",
    checkMonth: 1,
    checkDays: [8],
  },
  {
    month: 1,
    day: 10,
    key: "ashura",
    checkMonth: 1,
    checkDays: [9],
  },
  {
    month: 3,
    day: 12,
    key: "mawlid",
    checkMonth: 3,
    checkDays: [11],
  },
  {
    month: 7,
    day: 27,
    key: "israMiraj",
    checkMonth: 7,
    checkDays: [26],
  },
  {
    month: 8,
    day: 1,
    key: "shabanStart",
    checkMonth: 7,
    checkDays: [29, 30],
  },
  {
    month: 9,
    day: 1,
    key: "ramadanStart",
    checkMonth: 8,
    checkDays: [29, 30],
  },
  {
    month: 9,
    day: 27,
    key: "laylatAlQadr",
    checkMonth: 9,
    checkDays: [26],
  },
  {
    month: 10,
    day: 1,
    key: "eidAlFitr",
    checkMonth: 9,
    checkDays: [29, 30],
  },
  {
    month: 12,
    day: 9,
    key: "arafat",
    checkMonth: 12,
    checkDays: [8],
  },
  {
    month: 12,
    day: 10,
    key: "eidAlAdha",
    checkMonth: 12,
    checkDays: [9],
  },
];

function checkUpcomingEvent(hijriDay, hijriMonth, dayOfWeek = -1) {
  const day = Number.parseInt(hijriDay, 10);
  const month = Number.parseInt(hijriMonth, 10);

  for (const event of islEvents) {
    if (event.checkMonth === month && event.checkDays.includes(day)) {
      return event.key;
    }
  }

  if ([12, 13, 14].includes(day)) {
    return "whiteDays";
  }

  if (dayOfWeek === 0) return "fastingMonday";
  if (dayOfWeek === 3) return "fastingThursday";

  return null;
}

module.exports = {
  getGregorianDate,
  getHijriDate,
  getSecondsFromTime,
  formatTime,
  checkUpcomingEvent,
};
