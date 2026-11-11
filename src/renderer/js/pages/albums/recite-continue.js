"use strict";

// "Continue listening" on the Recitations tab: the last surah played from a reciter's recitation
// (saved while it played, services/listening-resume.js), played again here from the second it
// stopped at. Nothing shows until something was played.
const mp3quranApi = require("../../services/api/mp3quran");
const { getResume } = require("../../services/listening-resume");
const { t } = require("../../core/i18n");
const { byId } = require("../../core/dom");
const { html, setHtml } = require("../../utils/html");
const { state } = require("./state");
const { playingNow, playFrom, pause, continueHtml } = require("./continue");

const box = () => byId("acReciteContinue", HTMLElement);

function renderReciteContinue() {
  const entry = getResume("recite");
  if (!entry) {
    setHtml(box(), html``);
    return;
  }
  // the reciter's name in the app language when the list has him
  const reciter = state.reciters.find(
    (r) => String(r.id) === String(entry.reciterId),
  );
  setHtml(
    box(),
    continueHtml({
      title: entry.title || "",
      sub: [reciter?.name || entry.reciterName, entry.moshafName]
        .filter(Boolean)
        .join(t("acSep")),
      playing: playingNow() === entry.url,
      started: true,
      action: "recite-continue",
    }),
  );
}

async function continueRecitation() {
  const entry = getResume("recite");
  if (!entry) return;
  if (playingNow() === entry.url) {
    pause();
    return;
  }
  try {
    const tracks = await mp3quranApi.getReciterTracks(
      entry.reciterName,
      { server: entry.server, surah_list: entry.surahList },
      mp3quranApi.apiLanguage(),
    );
    const index = Math.max(
      0,
      tracks.findIndex((track) => track.url === entry.url),
    );
    const resume = {
      kind: "recite",
      reciterId: entry.reciterId,
      reciterName: entry.reciterName,
      moshafName: entry.moshafName,
      server: entry.server,
      surahList: entry.surahList,
    };
    playFrom(
      tracks.map((track) => ({ ...track, reciterId: entry.reciterId, resume })),
      index,
      tracks[index]?.url === entry.url ? entry.time : 0,
      {
        source: "mp3quran",
        id: `${entry.reciterId}-continue`,
        title: entry.reciterName,
        artist: entry.moshafName,
        icon: "fas fa-microphone-lines",
        reciterId: entry.reciterId,
        reciterName: entry.reciterName,
        server: entry.server,
        surahList: entry.surahList,
      },
    );
  } catch (error) {
    console.error("Failed to continue the recitation:", error);
  }
}

module.exports = { renderReciteContinue, continueRecitation };
