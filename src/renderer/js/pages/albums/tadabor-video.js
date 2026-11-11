"use strict";

// A Tadabor video, played in a dialog, with previous / next through the cards shown (buttons on
// the video's sides, Shift+P / Shift+N, like YouTube; the plain arrows still seek). Fullscreen is
// our own button: it puts the video *with* those buttons fullscreen (the video's own fullscreen
// would hide them). The archive's audio is paused while a video plays; closing stops the video.
// The video watched and its second are remembered for "Continue watching" (listening-resume.js).
const { ipcRenderer } = require("electron");
const { t } = require("../../core/i18n");
const { byId } = require("../../core/dom");
const { updateTooltip } = require("../../core/tooltips");
const { saveResume } = require("../../services/listening-resume");

/** @typedef {{ url: string, poster: string, title: string, meta: string }} Clip */

const dialog = () => byId("acVideoDialog", HTMLDialogElement);
const video = () => byId("acVideo", HTMLVideoElement);
const stage = () => byId("acVideoStage", HTMLElement);

/** @type {Clip[]} */
let list = [];
let at = 0;
let savedAt = -Infinity;
/** @type {() => void} */
let onClosed = () => {};

/** @param {number} [startAt]  seconds into the video */
function show(startAt = 0) {
  const clip = list[at];
  if (!clip) return;
  byId("acVideoTitle", HTMLElement).textContent = clip.title;
  byId("acVideoMeta", HTMLElement).textContent = clip.meta;
  byId("acVideoCount", HTMLElement).textContent = `${at + 1} / ${list.length}`;
  byId("acVideoPrev", HTMLButtonElement).disabled = at <= 0;
  byId("acVideoNext", HTMLButtonElement).disabled = at >= list.length - 1;
  const v = video();
  v.poster = clip.poster;
  v.src = clip.url;
  savedAt = -Infinity;
  if (startAt > 5)
    v.addEventListener(
      "loadedmetadata",
      () => {
        v.currentTime = Math.min(startAt, (v.duration || startAt) - 2);
      },
      { once: true },
    );
  v.play().catch(() => {
    // blocked or no network: the controls stay, the user can press play
  });
}

/** @param {number} step  -1 previous, +1 next */
function go(step) {
  const next = at + step;
  if (next < 0 || next >= list.length) return;
  at = next;
  show();
}

/** @param {Clip[]} clips @param {number} index @param {number} [startAt] */
function playVideo(clips, index, startAt = 0) {
  list = clips;
  at = index;
  ipcRenderer.send("player-command", { type: "pause" });
  if (!dialog().open) dialog().showModal();
  show(startAt);
}

/** Saves where the video is (every few seconds while it plays). */
function savePosition() {
  const clip = list[at];
  const time = video().currentTime;
  // (no src: closing, its time is back to 0)
  if (!clip || !video().getAttribute("src") || Math.abs(time - savedAt) < 5)
    return;
  savedAt = time;
  saveResume({
    kind: "tadabor",
    mode: "video",
    url: clip.url,
    title: clip.title,
    artist: clip.meta,
    time,
  });
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else
    stage()
      .requestFullscreen()
      .catch(() => {});
}

/** @param {() => void} closed  called when the dialog closes (the Continue card changed) */
function bindVideoDialog(closed) {
  onClosed = closed;
  const d = dialog();
  video().addEventListener("timeupdate", savePosition);
  byId("acVideoClose", HTMLButtonElement).addEventListener("click", () =>
    d.close(),
  );
  byId("acVideoPrev", HTMLButtonElement).addEventListener("click", () =>
    go(-1),
  );
  byId("acVideoNext", HTMLButtonElement).addEventListener("click", () => go(1));
  const full = byId("acVideoFull", HTMLButtonElement);
  full.addEventListener("click", toggleFullscreen);
  video().addEventListener("dblclick", (e) => {
    e.preventDefault();
    toggleFullscreen();
  });
  document.addEventListener("fullscreenchange", () => {
    const on = document.fullscreenElement === stage();
    full.dataset.tooltip = on ? "acExitFullscreen" : "acFullscreen";
    full.firstElementChild?.classList.toggle("fa-expand", !on);
    full.firstElementChild?.classList.toggle("fa-compress", on);
    full.setAttribute("aria-label", t(full.dataset.tooltip));
    updateTooltip(full);
  });
  d.addEventListener("keydown", (e) => {
    if (!e.shiftKey || e.ctrlKey || e.altKey) return;
    const step = { N: 1, P: -1 }[e.key.toUpperCase()];
    if (!step) return;
    e.preventDefault();
    go(step);
  });
  // Escape in fullscreen leaves fullscreen only (the browser does it), not the dialog too
  d.addEventListener("cancel", (e) => {
    if (document.fullscreenElement) e.preventDefault();
  });
  // a click on the backdrop closes it
  d.addEventListener("click", (e) => {
    if (e.target === d) d.close();
  });
  d.addEventListener("close", () => {
    if (document.fullscreenElement) document.exitFullscreen();
    savedAt = -Infinity;
    savePosition(); // where it stopped, exactly
    const v = video();
    v.pause();
    v.removeAttribute("src");
    v.load();
    onClosed();
  });
}

module.exports = { playVideo, bindVideoDialog };
