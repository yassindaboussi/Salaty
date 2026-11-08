"use strict";

// The volume of the floating mini player: the speaker mutes / unmutes (back to the level it
// had), hovering or focusing it shows a slider. It is the app's one volume, kept by Howler in
// the background player's window (where this runs), shared with the reader and the radio.
const { ipcRenderer } = require("electron");
const { byId } = require("../core/dom");
const { html, setHtml } = require("../utils/html");
const { updateTooltip } = require("../core/tooltips");

/** The level before muting, to go back to. */
const MUTED_KEY = "floatingVolumeBeforeMute";

/** Howler (vendor/howler, a global in this window): the volume it plays at, 0..1. */
const howlerVolume = () => /** @type {any} */ (window).Howler?.volume?.() ?? 1;

/** @returns {() => void}  draws the level Howler has now */
function bindFloatingVolume() {
  const button = byId("volumeBtn", HTMLButtonElement);
  const range = byId("volumeRange", HTMLInputElement);

  function render(volume = howlerVolume()) {
    const percent = Math.round(volume * 100);
    range.value = String(percent);
    range.style.setProperty("--fill", `${percent}%`);
    range.setAttribute("aria-valuetext", `${percent}%`);
    const icon =
      volume === 0
        ? "volume-xmark"
        : volume < 0.5
          ? "volume-low"
          : "volume-high";
    setHtml(button, html`<i class="fas fa-${icon}" aria-hidden="true"></i>`);
    button.setAttribute("aria-pressed", String(volume === 0));
    const tip = volume === 0 ? "tooltipUnmute" : "tooltipMute";
    if (button.dataset.tooltip !== tip) {
      button.dataset.tooltip = tip;
      updateTooltip(button);
    }
  }

  /** @param {number} value  0..1 */
  function setVolume(value) {
    const volume = Math.min(1, Math.max(0, value));
    ipcRenderer.send("player-command", { type: "volume", value: volume });
    render(volume);
  }

  range.addEventListener("input", () => setVolume(Number(range.value) / 100));
  button.addEventListener("click", () => {
    const volume = howlerVolume();
    try {
      if (volume > 0) localStorage.setItem(MUTED_KEY, String(volume));
      setVolume(volume > 0 ? 0 : Number(localStorage.getItem(MUTED_KEY)) || 1);
    } catch {
      setVolume(volume > 0 ? 0 : 1); // storage unavailable: back to full volume
    }
  });
  // a level set in the main window (the reader, the radio) shows when the pointer comes
  byId("volumeBox", HTMLElement).addEventListener("pointerenter", () =>
    render(),
  );
  return render;
}

module.exports = { bindFloatingVolume };
