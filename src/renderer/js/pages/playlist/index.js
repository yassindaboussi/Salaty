"use strict";

// The playlist page: what was opened in the Audio Archive, its tracks beside the player. Its parts:
//   list.js     the tracks, searchable; a click plays one
//   player.js   the photo, what is playing, position, controls, volume
//   state.js    the album, its tracks, what is playing
// The audio plays in the background player window (windows/background-player.js), so it goes on
// when this page closes; this page sends it commands and shows what it reports.
const { ipcRenderer } = require("electron");
const screenSizeManager = require("../../core/screen-size");
const mp3quranApi = require("../../services/api/mp3quran");
const { t } = require("../../core/i18n");
const { byId } = require("../../core/dom");
const { html, setHtml } = require("../../utils/html");
const analytics = require("../../services/analytics");
const { state } = require("./state");
const { renderList, markCurrent, bindList } = require("./list");
const player = require("./player");

function readAlbum() {
  try {
    return JSON.parse(localStorage.getItem("selectedAlbum") ?? "null");
  } catch {
    return null;
  }
}

async function loadTracks() {
  const album = state.album;
  const list = byId("plList", HTMLElement);
  setHtml(
    list,
    html`<p class="pl-empty"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i> ${t("loadingTracks")}</p>`,
  );
  try {
    if (album.source === "mp3quran") {
      state.tracks = await mp3quranApi.getReciterTracks(
        album.reciterName,
        { server: album.server, surah_list: album.surahList },
        mp3quranApi.apiLanguage(),
      );
    } else if (album.source === "mp3quran-tracks") {
      state.tracks = Array.isArray(album.tracks) ? album.tracks : [];
    } else {
      throw new Error("Unsupported album source");
    }
    // a recitation: how many surahs (the tafsir and tadabor lists speak for themselves)
    byId("plCount", HTMLElement).textContent =
      album.source === "mp3quran"
        ? t("acSurahCount").replace("{count}", String(state.tracks.length))
        : "";
    renderList();
  } catch (error) {
    console.error("Error loading tracks:", error);
    analytics.error("playlist_load_tracks", error.message || String(error));
    setHtml(
      list,
      html`<p class="pl-empty" role="alert">${t("errorLoadingTracks").replace("{album}", album.title ?? "")}</p>`,
    );
  }
}

function bindPlayerUpdates() {
  ipcRenderer.on("player-update", (_event, arg) => {
    if (arg.type === "state") {
      const s = arg.state;
      state.current = s.currentTrack ?? null;
      state.playing = Boolean(s.isPlaying);
      player.renderNowPlaying();
      markCurrent();
      if (s.volume !== undefined) player.showVolume(s.volume);
    } else if (arg.type === "time-update") {
      player.showTime(arg.currentTime, arg.duration);
    }
  });
}

async function initPlaylistPage() {
  // The mini player opens this page at a fixed size: go back to full screen if that is the
  // saved choice (the shell does not touch the size here, see entries/playlist.js).
  await screenSizeManager.applyScreenSize();
  screenSizeManager.initPageScreenSize("playlist-container");

  state.album = readAlbum();
  player.bindPlayer();
  bindList();
  bindPlayerUpdates();
  player.renderNowPlaying();
  ipcRenderer.send("player-command", { type: "get-state" });

  if (!state.album) {
    setHtml(
      byId("plList", HTMLElement),
      html`<p class="pl-empty">${t("noAlbumSelected")}</p>`,
    );
    return;
  }
  byId("plHeading", HTMLElement).textContent = state.album.title ?? "";
  byId("plSubtitle", HTMLElement).textContent = state.album.artist ?? "";
  player.renderArt();
  await loadTracks();
}

module.exports = { initPlaylistPage };
