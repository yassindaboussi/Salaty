"use strict";

// Downloads on the playlist page of a recitation: each surah's button and the "Download all" bar
// at the end of the title row (components/download-group.js). Downloaded surahs play from the
// disk, so without internet; offline, the others are greyed out.
const { byId } = require("../../core/dom");
const dl = require("../../services/downloads");
const { createDownloadGroup } = require("../../components/download-group");
const { state } = require("./state");

/** @type {ReturnType<typeof createDownloadGroup> | null} */
let group = null;

/** @param {any} track → its file name ("001.mp3") */
const nameOf = (track) => dl.fileNameOf(track.url);

const items = () =>
  state.tracks.map((track) => ({
    name: nameOf(track),
    url: track.url,
    title: track.title,
  }));

/** The URL to play: the file on disk when downloaded. @param {any} track */
const urlFor = (track) =>
  group
    ? group.urlFor({ name: nameOf(track), url: track.url, title: "" })
    : track.url;

/** @param {number} index  false when offline and not downloaded */
const canPlay = (index) =>
  !group || group.canPlay(nameOf(state.tracks[index] ?? {}));

/** @param {any} track */
const rowButtonHtml = (track) =>
  group ? group.rowButtonHtml(nameOf(track)) : "";

const paintRows = () => group?.paint();

/** Greys out the rows that can't play (offline, not downloaded). */
function markPlayable() {
  for (const row of byId("plList", HTMLElement).querySelectorAll(".pl-track")) {
    if (row instanceof HTMLButtonElement)
      row.disabled = !canPlay(Number(row.dataset.index));
  }
}

/** Sets up the group for a recitation (synchronously, so the rows get their buttons), then
 * loads what is on disk and the sizes. */
async function initDownloads() {
  const album = state.album;
  if (album?.source !== "mp3quran" || !/^\d+-\d+$/.test(album.id ?? "")) return;
  const [reciterId, moshafId] = album.id.split("-").map(Number);
  group = createDownloadGroup({
    key: album.id,
    info: {
      reciterId,
      moshafId,
      reciterName: album.reciterName ?? album.title ?? "",
      moshafName: album.artist ?? "",
      server: album.server ?? "",
      surahList: album.surahList ?? "",
    },
    items,
    bar: byId("plDl", HTMLElement),
    list: byId("plList", HTMLElement),
    note: byId("plOffline", HTMLElement),
    title: () => album.title ?? "",
    onPaint: markPlayable,
  });
  await group.refresh();
  group.loadSizes();
}

module.exports = {
  rowButtonHtml,
  paintRows,
  urlFor,
  canPlay,
  initDownloads,
};
