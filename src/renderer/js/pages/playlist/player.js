"use strict";

// The player panel: the reciter's photo (or the book / reflection icon), what is playing, the
// position (a real slider: arrows and Home/End move it), previous / play / next and the volume.
// The audio itself plays in the background player window; this page sends it commands
// ("player-command") and shows what it reports ("player-update").
const { ipcRenderer } = require("electron");
const { t } = require("../../core/i18n");
const { byId } = require("../../core/dom");
const { html, setHtml } = require("../../utils/html");
const { updateTooltip } = require("../../core/tooltips");
const { reciterPhotoHtml } = require("../../components/reciter-photo");
const { state } = require("./state");

const send = (type, value) =>
  ipcRenderer.send(
    "player-command",
    value === undefined ? { type } : { type, value },
  );

/** @param {number} seconds  "4:05" / "1:02:03" */
function clock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  const two = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}

/** @param {HTMLInputElement} slider  the filled part, for the CSS (--fill) */
const paint = (slider) =>
  slider.style.setProperty(
    "--fill",
    `${(Number(slider.value) / Number(slider.max || 100)) * 100}%`,
  );

function renderArt() {
  const album = state.album ?? {};
  setHtml(
    byId("plArt", HTMLElement),
    album.reciterId
      ? reciterPhotoHtml(
          album.reciterId,
          album.reciterName ?? album.title,
          "is-large",
        )
      : html`<span class="pl-art-icon" aria-hidden="true"><i class="${album.icon || "fas fa-headphones"}"></i></span>`,
  );
}

function renderNowPlaying() {
  const track = state.current;
  byId("plTitle", HTMLElement).textContent = track
    ? track.title
    : t("noTrackSelected");
  byId("plArtist", HTMLElement).textContent = track ? track.artist : "";
  const play = byId("plPlay", HTMLButtonElement);
  setHtml(
    play,
    html`<i class="fas ${state.playing ? "fa-pause" : "fa-play"}" aria-hidden="true"></i>`,
  );
  play.dataset.tooltip = state.playing ? "tooltipPause" : "tooltipPlay";
  updateTooltip(play);
  for (const id of ["plPlay", "plPrev", "plNext", "plSeek"]) {
    const el = byId(id, HTMLElement);
    if (el instanceof HTMLButtonElement || el instanceof HTMLInputElement)
      el.disabled = !track;
  }
}

/** @param {number} current @param {number} duration */
function showTime(current, duration) {
  state.duration = duration;
  byId("plTime", HTMLElement).textContent = clock(current);
  byId("plDuration", HTMLElement).textContent = clock(duration);
  const seek = byId("plSeek", HTMLInputElement);
  if (state.seeking) return;
  seek.max = String(Math.max(1, Math.round(duration)));
  seek.value = String(Math.round(current));
  seek.setAttribute("aria-valuetext", `${clock(current)} / ${clock(duration)}`);
  paint(seek);
}

/** @param {number} volume  0..1 */
function showVolume(volume) {
  const slider = byId("plVolume", HTMLInputElement);
  const value = Math.round(volume * 100);
  if (Math.abs(Number(slider.value) - value) > 1) slider.value = String(value);
  paint(slider);
}

function bindPlayer() {
  byId("plPlay", HTMLButtonElement).addEventListener("click", () =>
    send(state.playing ? "pause" : "resume"),
  );
  byId("plPrev", HTMLButtonElement).addEventListener("click", () =>
    send("prev"),
  );
  byId("plNext", HTMLButtonElement).addEventListener("click", () =>
    send("next"),
  );

  const seek = byId("plSeek", HTMLInputElement);
  seek.addEventListener("input", () => {
    state.seeking = true;
    byId("plTime", HTMLElement).textContent = clock(Number(seek.value));
    paint(seek);
  });
  seek.addEventListener("change", () => {
    state.seeking = false;
    send("seek", Number(seek.value));
  });

  const volume = byId("plVolume", HTMLInputElement);
  volume.addEventListener("input", () => {
    send("volume", Number(volume.value) / 100);
    paint(volume);
  });
  paint(volume);
}

module.exports = {
  renderArt,
  renderNowPlaying,
  showTime,
  showVolume,
  bindPlayer,
};
