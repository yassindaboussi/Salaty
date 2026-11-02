"use strict";

// Playing: the audio is in the background player window (windows/background-player.js), as for
// the Audio Archive, so the radio goes on after this page closes and the mini player controls
// it. This page sends it commands ("player-command") and shows what it reports
// ("player-update"): the panel (logo or photo, name, live / paused / connecting, controls,
// volume) and the marked row.
const { ipcRenderer } = require("electron");
const { t } = require("../../core/i18n");
const { byId } = require("../../core/dom");
const { html, setHtml } = require("../../utils/html");
const { updateTooltip } = require("../../core/tooltips");
const { showToast } = require("../../core/toast");
const analytics = require("../../services/analytics");
const { view, toggleFavourite, findItem } = require("./state");
const { refreshList, artHtml } = require("./list");

const MUTED_KEY = "radioVolumeBeforeMute";
let toldFailure = false; // the error is said once, not at every later report

/** @param {string} type @param {object} [extra] */
const send = (type, extra = {}) =>
  ipcRenderer.send("player-command", { type, ...extra });

/** @param {HTMLElement} button @param {string} icon @param {string} tooltip */
function setIconButton(button, icon, tooltip) {
  setHtml(button, html`<i class="${icon}" aria-hidden="true"></i>`);
  button.dataset.tooltip = tooltip;
  updateTooltip(button);
}

function renderPanel() {
  const item = view.current;
  setHtml(
    byId("rdArt", HTMLElement),
    item
      ? artHtml(item, "is-large")
      : html`<span class="rd-art-icon" aria-hidden="true"><i class="fas fa-tower-broadcast"></i></span>`,
  );
  byId("rdNowName", HTMLElement).textContent = item?.name ?? t("selectStation");
  const sub = byId("rdNowSub", HTMLElement);
  sub.classList.toggle(
    "is-live",
    Boolean(item && view.playing && !view.connecting),
  );
  sub.textContent = !item
    ? t("rdChoose")
    : view.connecting
      ? t("rdConnecting")
      : view.playing
        ? `${t("rdLive")} · ${item.sub}`
        : `${t("rdPaused")} · ${item.sub}`;

  const playIcon = view.playing ? "fas fa-pause" : "fas fa-play";
  const playTip = view.playing ? "tooltipPause" : "tooltipPlay";
  setIconButton(byId("rdPlay", HTMLButtonElement), playIcon, playTip);
  setIconButton(byId("rdRailPlay", HTMLButtonElement), playIcon, playTip);
  for (const id of ["rdPlay", "rdStop", "rdFav"]) {
    byId(id, HTMLButtonElement).disabled = !item;
  }
  const fav = Boolean(item && view.favourites.has(item.key));
  const star = byId("rdFav", HTMLButtonElement);
  star.setAttribute("aria-pressed", String(fav));
  setIconButton(
    star,
    `${fav ? "fas" : "far"} fa-star`,
    fav ? "rdRemoveFavourite" : "rdAddFavourite",
  );
  renderVolume();
}

function renderVolume() {
  const slider = byId("rdVolume", HTMLInputElement);
  slider.value = String(Math.round(view.volume * 100));
  slider.style.setProperty("--fill", `${view.volume * 100}%`);
  const icon =
    view.volume === 0
      ? "fas fa-volume-xmark"
      : view.volume < 0.5
        ? "fas fa-volume-low"
        : "fas fa-volume-high";
  setIconButton(
    byId("rdMute", HTMLButtonElement),
    icon,
    view.volume === 0 ? "tooltipUnmute" : "tooltipMute",
  );
}

function render() {
  renderPanel();
  refreshList();
}

/** A click on a row: plays it, or pauses / resumes it if it is the one playing. @param {string} key */
function playItem(key) {
  const item = findItem(key);
  if (!item) return;
  if (view.current?.key === key && !view.connecting) {
    togglePlay();
    return;
  }
  view.current = item;
  view.connecting = true;
  view.playing = false;
  send("set-playlist", {
    tracks: [
      {
        title: item.name,
        artist: item.sub,
        url: item.url,
        live: true,
        page: "radio",
        key: item.key,
        image: item.image,
        reciterId: item.reciterId,
      },
    ],
    startIndex: 0,
  });
  analytics.radioStationPlay();
  render();
}

function togglePlay() {
  if (!view.current) return;
  if (view.playing) send("pause");
  else {
    view.connecting = true; // a live stream connects again
    send("resume");
  }
  render();
}

function stop() {
  if (!view.current) return;
  send("stop");
  analytics.radioStop();
}

function toggleCurrentFavourite() {
  if (!view.current) return;
  toggleFavourite(view.current.key);
  render();
}

function toggleMute() {
  if (view.volume > 0) {
    try {
      localStorage.setItem(MUTED_KEY, String(view.volume));
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

/** @param {number} value 0..1 */
function setVolume(value) {
  view.volume = Math.min(1, Math.max(0, value));
  send("volume", { value: view.volume });
  renderVolume();
}

/** What the background player reports. */
function bindPlayerUpdates() {
  ipcRenderer.on("player-update", (_e, { type, state }) => {
    if (type !== "state" || !state) return;
    if (typeof state.volume === "number") view.volume = state.volume;
    const track = state.currentTrack;
    // the player window just opened says "nothing" once before it plays what was asked
    if (!track && view.connecting) return;
    if (!track || track.page !== "radio") {
      // nothing, or the Audio Archive is playing: the radio is not
      view.current = null;
      view.playing = view.connecting = false;
      render();
      return;
    }
    view.current = findItem(track.key) ?? {
      key: track.key,
      kind: track.reciterId ? "reciter" : "station",
      name: track.title,
      sub: track.artist,
      url: track.url,
      image: track.image,
      reciterId: track.reciterId,
    };
    if (state.failed) {
      view.playing = view.connecting = false;
      if (!toldFailure) showToast(t("playbackError"), "error");
      toldFailure = true;
    } else {
      toldFailure = false;
      view.connecting = Boolean(state.loading);
      view.playing = Boolean(state.isPlaying) && !view.connecting;
    }
    render();
  });
  send("get-state");
}

function bindControls() {
  byId("rdPlay", HTMLButtonElement).addEventListener("click", togglePlay);
  byId("rdStop", HTMLButtonElement).addEventListener("click", stop);
  byId("rdFav", HTMLButtonElement).addEventListener(
    "click",
    toggleCurrentFavourite,
  );
  byId("rdMute", HTMLButtonElement).addEventListener("click", toggleMute);
  const volume = byId("rdVolume", HTMLInputElement);
  volume.addEventListener("input", () => setVolume(Number(volume.value) / 100));
}

module.exports = {
  playItem,
  togglePlay,
  stop,
  render,
  renderPanel,
  bindPlayerUpdates,
  bindControls,
};
