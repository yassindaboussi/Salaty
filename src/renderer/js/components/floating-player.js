"use strict";

// The floating mini player (the background player's own window, shown while the main window is
// hidden). Head: the artwork (the reciter's photo, the radio's logo, else an icon), what plays,
// "Live" for a radio, close; only the head drags the window (background-player.css). A thin line
// shows how far the track is (not for a live radio). Controls: previous / play / next (the track
// or station before / after in the list, off at its ends; by ayah for a Quran surah,
// components/mini-player-quran.js), the volume (floating-volume.js) and the
// list button, which opens the main window on the page of what plays: the radio page, the
// playlist for an archive track, the Quran reader for a surah.
const { ipcRenderer } = require("electron");
const { t } = require("../core/i18n");
const { byId } = require("../core/dom");
const { html, setHtml } = require("../utils/html");
const { reciterPhotoHtml } = require("./reciter-photo");
const { bindQuranMiniPlayer } = require("./mini-player-quran");
const { bindFloatingVolume } = require("./floating-volume");

/** The artwork of a track: the reciter's photo, the radio's (bundled) logo, else an icon.
 * @param {any} track */
function artHtml(track) {
  if (track?.reciterId) return reciterPhotoHtml(track.reciterId, track.artist);
  if (typeof track?.image === "string" && track.image.startsWith("../"))
    return html`<img src="${track.image}" alt="" decoding="async">`;
  const icon = !track
    ? "music"
    : track.page === "quran"
      ? "book-quran"
      : track.live
        ? "tower-broadcast"
        : "music";
  return html`<i class="fas fa-${icon}"></i>`;
}

/**
 * @param {{ tracks: any[], currentTrackIndex: number, isPlaying: boolean, loading: boolean,
 *   sound: any, togglePlay: () => void, playPrevious: () => void, playNext: () => void }} player
 */
function createPlayerUi(player) {
  const title = byId("title", HTMLElement);
  const artist = byId("artist", HTMLElement);
  const art = byId("fpArt", HTMLElement);
  const live = byId("fpLive", HTMLElement);
  const progress = byId("fpProgress", HTMLElement);
  const fill = byId("fpProgressFill", HTMLElement);
  const playBtn = byId("playBtn", HTMLButtonElement);
  const prevBtn = byId("prevBtn", HTMLButtonElement);
  const nextBtn = byId("nextBtn", HTMLButtonElement);
  const listBtn = byId("miniPlaylistBtn", HTMLButtonElement);
  const current = () => player.tracks[player.currentTrackIndex] ?? null;

  /** The main window on the page of what plays (a surah: mini-player-quran.js opens the reader). */
  function openTrackPage() {
    const page = current()?.page;
    if (page !== "quran")
      ipcRenderer.invoke(
        "navigate-to",
        page === "radio" ? "radio" : "playlist",
        850,
        600,
      );
    ipcRenderer.send("show-main-window");
  }

  playBtn.addEventListener("click", () => player.togglePlay());
  const quran = bindQuranMiniPlayer(
    { prev: prevBtn, next: nextBtn, open: listBtn, artist },
    {
      prev: () => player.playPrevious(),
      next: () => player.playNext(),
      open: openTrackPage,
    },
  );
  byId("closeBtn", HTMLButtonElement).addEventListener("click", () =>
    ipcRenderer.send("close-mini-player"),
  );
  const renderVolume = bindFloatingVolume();

  /** The progress line. @param {number} [time]  seconds */
  function renderProgress(time = player.sound ? player.sound.seek() : 0) {
    const duration = player.sound ? player.sound.duration() : 0;
    const share =
      duration > 0 ? Math.min(1, (Number(time) || 0) / duration) : 0;
    fill.style.width = `${share * 100}%`;
  }

  let artKey = "";
  function render() {
    const track = current();
    title.textContent = track ? track.title : "Salaty Player";
    artist.textContent = track ? track.artist : t("waitingForTrack");
    // the artwork, drawn again only for another track
    const key = track
      ? `${track.reciterId ?? ""}|${track.image ?? ""}|${track.page ?? ""}`
      : "";
    if (key !== artKey) {
      artKey = key;
      setHtml(art, artHtml(track));
    }
    const isLive = Boolean(track?.live);
    live.hidden = !isLive;
    progress.hidden = isLive || !track;
    // after the artist: a surah adds its riwaya and changes previous / next and the list button
    const isSurah = quran.apply({
      currentTrack: track,
      isPlaying: player.isPlaying,
      loading: player.loading,
      currentTime: player.sound ? player.sound.seek() : 0,
    });
    if (!isSurah) {
      // off where the list has nothing before / after (radios: the stations as the radio
      // page lists them)
      const at = player.currentTrackIndex;
      prevBtn.disabled = !track || at <= 0;
      nextBtn.disabled = !track || at >= player.tracks.length - 1;
    }
    const icon = player.loading
      ? "spinner fa-spin"
      : player.isPlaying
        ? "pause"
        : "play";
    setHtml(playBtn, html`<i class="fas fa-${icon}" aria-hidden="true"></i>`);
    renderProgress();
    renderVolume();
  }

  /** A time report (about once a second). @param {number} time */
  function onTime(time) {
    quran.onTime(time);
    renderProgress(time);
  }

  return { render, onTime };
}

module.exports = { createPlayerUi };
