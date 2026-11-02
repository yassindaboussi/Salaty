"use strict";

// Live from the Two Holy Mosques: the official live broadcasts (Quran TV from al-Masjid
// al-Haram, Sunnah TV from al-Masjid an-Nabawi), the time and date in Makkah. Its parts:
//   channels.js    the two channels
//   player.js      the live video (found by the main process, played by YouTube's player)
//   panel.js       the two mosques, the clock
//   panel-fold.js  folding the panel to a strip
const { ipcRenderer } = require("electron");
const { byId } = require("../../core/dom");
const {
  setupConnectionRecovery,
} = require("../../services/connection-recovery");
const analytics = require("../../services/analytics");
const { channelOf } = require("./channels");
const { playChannel, stop } = require("./player");
const { renderChannels, renderClock } = require("./panel");
const { bindPanelFold } = require("./panel-fold");

const CHANNEL_KEY = "livestreamsChannel";
let current = "makkah";

/** @param {string} key @param {boolean} [byUser] */
function openChannel(key, byUser = false) {
  current = channelOf(key).key;
  try {
    localStorage.setItem(CHANNEL_KEY, current);
  } catch {
    // storage unavailable: Makkah next time
  }
  renderChannels(current);
  playChannel(current);
  if (byUser) analytics.livestreamSwitch(current);
}

/** A click on a mosque (in the panel or the folded strip). @param {Event} e */
function onChannelClick(e) {
  const button = /** @type {Element} */ (e.target).closest("[data-channel]");
  if (!(button instanceof HTMLButtonElement)) return;
  const key = String(button.dataset.channel);
  if (key !== current) openChannel(key, true);
  // the list was redrawn: keep the focus on the same mosque
  const again = button.parentElement?.querySelector(`[data-channel="${key}"]`);
  if (again instanceof HTMLElement) again.focus();
}

function initLiveStreamsPage() {
  byId("lvChannels", HTMLElement).addEventListener("click", onChannelClick);
  byId("lvRail", HTMLElement).addEventListener("click", onChannelClick);
  byId("lvRetry", HTMLButtonElement).addEventListener("click", () =>
    playChannel(current),
  );
  byId("lvYoutube", HTMLButtonElement).addEventListener("click", () =>
    ipcRenderer.invoke("open-external", channelOf(current).youtube),
  );
  bindPanelFold();

  renderClock();
  setInterval(renderClock, 15_000);
  // back online: the video again
  setupConnectionRecovery(() => playChannel(current), "Livestreams");
  // the sound stops with the page
  window.addEventListener("pagehide", stop);

  let saved = "makkah";
  try {
    saved = localStorage.getItem(CHANNEL_KEY) ?? "makkah";
  } catch {
    // storage unavailable: Makkah
  }
  openChannel(saved);
}

module.exports = { initLiveStreamsPage };
