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

/** The title bar player shows `url` (playing or paused, not closed with its ✕): the card would
 * be a second control for the same thing, so it gives way (back once the player is closed).
 * @param {string} [url] */
const inTitleBarPlayer = (url) =>
  Boolean(url) &&
  url === playingUrl &&
  sessionStorage.getItem("miniPlayerDismissedTrackKey") !== url;

function followPlayer() {
  // the title bar player closed with its ✕: the cards come back
  window.addEventListener("mini-player-closed", () => {
    for (const changed of listeners) changed();
  });
  ipcRenderer.on("player-update", (_e, arg) => {
    if (arg?.type === "state") {
      const url = arg.state?.currentTrack?.url ?? "";
      const playing = Boolean(arg.state?.isPlaying);
      if (url === playingUrl && playing === isPlaying) return;
      playingUrl = url;
      isPlaying = playing;
      // after the title bar player has handled the same update (it may forget a ✕ close)
      setTimeout(() => {
        for (const changed of listeners) changed();
      });
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
 * The card. `started` false: "Start listening" (nothing heard yet). `url`: what it plays
 * (hidden while the title bar player has it). `open`: the action of the card itself (the
 * Recitations tab opens the reciter's surahs), shown with a › at its end.
 * @param {{ title: string, sub: string, playing: boolean, started: boolean, video?: boolean,
 *   action: string, url?: string, open?: string }} card
 */
function continueHtml(card) {
  if (inTitleBarPlayer(card.url)) return html``;
  const label = t(
    !card.started
      ? "tafsirStart"
      : card.video
        ? "acContinueWatching"
        : "tafsirContinue",
  );
  const playButton = html`<button type="button" class="ac-continue-play" data-action="${card.action}" aria-label="${label}${t("acSep")}${card.title}"><i class="fas ${card.playing ? "fa-pause" : "fa-play"}" aria-hidden="true"></i></button>`;
  const text = html`<span class="ac-continue-text"><span class="ac-continue-label">${label}</span><span class="ac-continue-title" dir="auto">${card.title}</span><span class="ac-continue-sub">${card.sub}</span></span>`;
  const body = card.open
    ? html`<button type="button" class="ac-continue-open" data-action="${card.open}" aria-label="${t("acOpenList")}${t("acSep")}${card.sub}">${text}<i class="fas fa-chevron-right ac-continue-chevron" aria-hidden="true"></i></button>`
    : text;
  return html`<section class="ac-continue">${playButton}${body}</section>`;
}

module.exports = {
  playingNow,
  playFrom,
  pause,
  onPlayingChange,
  followPlayer,
  continueHtml,
};
