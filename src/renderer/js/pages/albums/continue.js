"use strict";

// "Continue listening" on the archive's tabs: the card (the same on every tab), playing a list
// from a track and a second, and what plays now (the background player reports it). Where each
// tab stopped is saved by services/listening-resume.js.
const { ipcRenderer } = require("electron");
const { t } = require("../../core/i18n");
const { html } = require("../../utils/html");

let playingUrl = "";
let isPlaying = false;
/** @type {{ url: string, time: number } | null} a second to jump to once the track loads */
let pendingSeek = null;
/** @type {(() => void)[]} */
const listeners = [];

/** The url playing now ("" when paused or nothing plays). */
const playingNow = () => (isPlaying ? playingUrl : "");

/** Plays `tracks` from one, `startAt` seconds into it; `album` is kept for the mini player's
 * "go to" (the playlist page).
 * @param {any[]} tracks @param {number} index @param {number} [startAt] @param {any} [album] */
function playFrom(tracks, index, startAt = 0, album = null) {
  if (!tracks[index]) return;
  if (album) {
    try {
      localStorage.setItem(
        "selectedAlbum",
        JSON.stringify({ ...album, tracks }),
      );
    } catch {
      // the mini player's "go to" just won't find the list
    }
  }
  pendingSeek = startAt > 5 ? { url: tracks[index].url, time: startAt } : null;
  ipcRenderer.send("player-command", {
    type: "set-playlist",
    tracks,
    startIndex: index,
  });
}

/** Pauses what plays (the card's button while its track plays). */
const pause = () => ipcRenderer.send("player-command", { type: "pause" });

/** @param {() => void} changed  called when what plays (or play / pause) changes */
const onPlayingChange = (changed) => listeners.push(changed);

function followPlayer() {
  ipcRenderer.on("player-update", (_e, arg) => {
    if (arg?.type === "state") {
      const url = arg.state?.currentTrack?.url ?? "";
      const playing = Boolean(arg.state?.isPlaying);
      if (url === playingUrl && playing === isPlaying) return;
      playingUrl = url;
      isPlaying = playing;
      for (const changed of listeners) changed();
    } else if (arg?.type === "time-update" && pendingSeek?.url === playingUrl) {
      const duration = Number(arg.duration) || 0;
      if (duration <= 0) return;
      ipcRenderer.send("player-command", {
        type: "seek",
        value: Math.min(pendingSeek.time, duration - 2),
      });
      pendingSeek = null;
    }
  });
  ipcRenderer.send("player-command", { type: "get-state" });
}

/**
 * The card. `started` false: "Start listening" (nothing heard yet).
 * @param {{ title: string, sub: string, playing: boolean, started: boolean, video?: boolean,
 *   action: string }} card
 */
function continueHtml(card) {
  const label = t(
    !card.started
      ? "tafsirStart"
      : card.video
        ? "acContinueWatching"
        : "tafsirContinue",
  );
  return html`<section class="ac-continue"><button type="button" class="ac-continue-play" data-action="${card.action}" aria-label="${label}${t("acSep")}${card.title}"><i class="fas ${card.playing ? "fa-pause" : "fa-play"}" aria-hidden="true"></i></button><div class="ac-continue-text"><p class="ac-continue-label">${label}</p><p class="ac-continue-title" dir="auto">${card.title}</p><p class="ac-continue-sub">${card.sub}</p></div></section>`;
}

module.exports = {
  playingNow,
  playFrom,
  pause,
  onPlayingChange,
  followPlayer,
  continueHtml,
};
