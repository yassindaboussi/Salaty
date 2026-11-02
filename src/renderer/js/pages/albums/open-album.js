"use strict";

// Opening something to listen to: it is left in localStorage ("selectedAlbum") for the playlist
// page, which this opens. The tab and filters are saved first, so "back" returns to them.
const { ipcRenderer } = require("electron");
const { savePrefs } = require("./state");

/**
 * @param {{ source: "mp3quran" | "mp3quran-tracks", id: string, title: string,
 *   artist: string, icon: string, reciterId?: number, reciterName?: string,
 *   server?: string, surahList?: string, tracks?: any[] }} album
 */
async function openAlbum(album) {
  savePrefs();
  try {
    localStorage.setItem("selectedAlbum", JSON.stringify(album));
  } catch {
    return; // nothing to open
  }
  await ipcRenderer.invoke("navigate-to", "playlist");
}

/**
 * @param {import("./state").Reciter} reciter
 * @param {import("./state").Moshaf} moshaf
 */
function openRecitation(reciter, moshaf) {
  return openAlbum({
    source: "mp3quran",
    id: `${reciter.id}-${moshaf.id}`,
    title: reciter.name,
    artist: moshaf.name,
    icon: "fas fa-microphone-lines",
    reciterId: reciter.id,
    reciterName: reciter.name,
    server: moshaf.server,
    surahList: moshaf.surah_list,
  });
}

module.exports = { openAlbum, openRecitation };
