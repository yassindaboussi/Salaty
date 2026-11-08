"use strict";

// The volume in the reader's player bar: a speaker button (mute / unmute, back to the level it
// had) and a short slider (left out in a narrow window). It is the app's one volume, kept by the
// background player, so the radio and the archive share it and it shows the level they set.
const { ipcRenderer } = require("electron");
const { byId } = require("../../core/dom");
const { updateTooltip } = require("../../core/tooltips");
const { html, setHtml } = require("../../utils/html");

/** The level before muting, to go back to (this page's own memory of it). */
const MUTED_KEY = "quranVolumeBeforeMute";

let volume = 1; // 0..1
let dragging = false;
/** Until when a reported level is one from before the user's change (performance.now() ms). */
let changedUntil = 0;

function render() {
  const slider = byId("qPlayerVolume", HTMLInputElement);
  const percent = Math.round(volume * 100);
  if (!dragging) slider.value = String(percent);
  slider.style.setProperty("--fill", `${percent}%`);
  slider.setAttribute("aria-valuetext", `${percent}%`);
  const button = byId("qPlayerMute", HTMLButtonElement);
  const icon =
    volume === 0 ? "volume-xmark" : volume < 0.5 ? "volume-low" : "volume-high";
  setHtml(button, html`<i class="fas fa-${icon}" aria-hidden="true"></i>`);
  const tip = volume === 0 ? "tooltipUnmute" : "tooltipMute";
  button.setAttribute("aria-pressed", String(volume === 0));
  if (button.dataset.tooltip !== tip) {
    button.dataset.tooltip = tip;
    updateTooltip(button);
  }
}

/** @param {number} value  0..1 */
function setVolume(value) {
  volume = Math.min(1, Math.max(0, value));
  changedUntil = performance.now() + 1500;
  ipcRenderer.send("player-command", { type: "volume", value: volume });
  render();
}

function toggleMute() {
  if (volume > 0) {
    try {
      localStorage.setItem(MUTED_KEY, String(volume));
    } catch {
      // storage unavailable: unmuting goes back to full volume
    }
    setVolume(0);
    return;
  }
  let before = 1;
  try {
    before = Number(localStorage.getItem(MUTED_KEY)) || 1;
  } catch {
    // storage unavailable
  }
  setVolume(before);
}

function bindRecitationVolume() {
  byId("qPlayerMute", HTMLButtonElement).addEventListener("click", toggleMute);
  const slider = byId("qPlayerVolume", HTMLInputElement);
  slider.addEventListener("input", () => {
    dragging = true;
    setVolume(Number(slider.value) / 100);
  });
  slider.addEventListener("change", () => {
    dragging = false;
    render();
  });
  // the level the player has (set here, on the radio page or in the archive)
  ipcRenderer.on("player-update", (_e, msg) => {
    const reported = msg?.type === "state" ? msg.state?.volume : undefined;
    if (typeof reported !== "number" || dragging) return;
    // a report sent before the change just made would undo it on screen
    if (performance.now() < changedUntil && Math.abs(reported - volume) > 0.01)
      return;
    volume = reported;
    render();
  });
  render();
}

module.exports = { bindRecitationVolume };
