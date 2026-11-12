"use strict";

// The ▶ / ■ buttons of Settings → Notifications → Voice reminders. One plays at a time; the
// adhan voice preview stops when one starts, and leaving the page stops it.
const { t } = require("../../core/i18n");
const {
  playBeforeAdhan,
  playAfterAdhan,
  stopVoice,
} = require("../../components/adhan-voice");
const { stopPreview } = require("./adhan-preview");

/** @type {string | null} "near", "before" or "after" while it plays */
let playing = null;

function _buttons() {
  return /** @type {HTMLElement[]} */ ([
    ...document.querySelectorAll("[data-voice-play]"),
  ]);
}

function _sync() {
  for (const btn of _buttons()) {
    const on = btn.dataset.voicePlay === playing;
    btn.setAttribute("aria-pressed", String(on));
    btn.classList.toggle("is-playing", on);
    const icon = btn.querySelector("i");
    if (icon) icon.className = `fas fa-${on ? "stop" : "play"}`;
    const label = t(on ? "voiceStop" : "voiceListen");
    btn.setAttribute("aria-label", label);
    btn.setAttribute("data-tip", label);
  }
}

/** @param {string} which */
async function _toggle(which) {
  if (playing === which) {
    stopVoice();
    playing = null;
    _sync();
    return;
  }
  stopPreview();
  playing = which;
  _sync();
  // the sample says Dhuhr; the real one names the coming prayer
  const done =
    which === "after"
      ? playAfterAdhan()
      : playBeforeAdhan("Dhuhr", {
          near: which === "near",
          hadith: which === "before",
        });
  await done;
  if (playing === which) {
    playing = null;
    _sync();
  }
}

function initVoicePreview() {
  for (const btn of _buttons()) {
    btn.addEventListener("click", () => _toggle(btn.dataset.voicePlay ?? ""));
  }
  _sync();
  window.addEventListener("pagehide", stopVoice);
}

/** After a language change. */
const updateVoicePreviewText = _sync;

module.exports = { initVoicePreview, updateVoicePreviewText };
