"use strict";

// The player bar under the reader's text, while a surah is recited: the position (a slider),
// the reciter (opens the reciter list), the time, the previous / play / next ayah and stop.
// It shows in the reader whatever surah is playing; "Listen" in the reader's footer plays the
// open surah. Listening needs the internet: offline, "Listen" says so instead of playing.
const { t } = require("../../core/i18n");
const { byId } = require("../../core/dom");
const { updateTooltip, refreshTooltips } = require("../../core/tooltips");
const { showToast } = require("../../core/toast");
const { setHtml } = require("../../utils/html");
const { reciterPhotoHtml } = require("../../components/reciter-photo");
const {
  state,
  fmt,
  sep,
  riwayaName,
  surahMeta,
  surahName,
} = require("./state");
const {
  rec,
  currentTime,
  listen,
  seek,
  stepAyah,
  togglePlay,
  stop,
  onRecitationChange,
} = require("./recitation");
const {
  follow,
  showsTrack,
  backToAyah,
  onFollowChange,
} = require("./recitation-follow");
const { openReciterDialog } = require("./reciter-dialog");

/** "4:05" / "1:02:03" in the page's digits. @param {number} seconds */
function clock(seconds) {
  const total =
    Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return fmt(h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`);
}

let dragging = false;

/** The slider and the time (every few frames while playing). */
function renderTime() {
  const slider = byId("qPlayerSeek", HTMLInputElement);
  const now = currentTime();
  const duration = rec.duration || 0;
  slider.max = String(Math.max(1, Math.round(duration)));
  if (!dragging) slider.value = String(Math.round(now));
  const shown = dragging ? Number(slider.value) : now;
  const text = `${clock(shown)} / ${clock(duration)}`;
  byId("qPlayerTime", HTMLElement).textContent = text;
  slider.setAttribute("aria-valuetext", text);
  slider.style.setProperty(
    "--q-seek",
    `${duration ? (shown / duration) * 100 : 0}%`,
  );
}

/** @param {string} id @param {string} key */
function setTip(id, key) {
  const el = byId(id, HTMLElement);
  if (el.dataset.tooltip === key) return;
  el.dataset.tooltip = key;
  updateTooltip(el);
}

function render() {
  const bar = byId("qPlayer", HTMLElement);
  const track = rec.track;
  bar.hidden = !track || !state.currentSurah;
  // the mini player hides while this bar shows (the surah list shows the mini player)
  document.body.classList.toggle("has-own-player", !bar.hidden);
  byId("readerListenBtn", HTMLButtonElement).hidden = showsTrack();
  if (!track) return;

  setHtml(
    byId("qPlayerPhoto", HTMLElement),
    reciterPhotoHtml(track.reciterId, track.artist, "is-small"),
  );
  // in the page's language (the track keeps the names of when it started)
  const meta = surahMeta(track.surah);
  const artist =
    rec.reciters.find((r) => r.read === track.read)?.name ?? track.artist;
  byId("qPlayerTitle", HTMLElement).textContent = meta
    ? surahName(meta)
    : track.title;
  byId("qPlayerSub", HTMLElement).textContent =
    track.riwaya === "hafs"
      ? artist
      : `${artist}${sep()}${riwayaName(track.riwaya)}`;

  const play = byId("qPlayerPlay", HTMLButtonElement);
  const icon = play.querySelector("i");
  if (icon)
    icon.className = rec.loading
      ? "fas fa-spinner fa-spin"
      : `fas fa-${rec.playing ? "pause" : "play"}`;
  play.setAttribute("aria-busy", String(rec.loading));
  setTip("qPlayerPlay", rec.playing ? "quranPause" : "quranPlay");

  const timed = rec.timings.length > 0;
  byId("qPlayerPrev", HTMLButtonElement).disabled = !timed;
  byId("qPlayerNext", HTMLButtonElement).disabled = !timed;
  // only when there is an ayah to go back to (not during the opening Isti'adha / Bismillah)
  byId("qPlayerBack", HTMLButtonElement).hidden =
    follow.on || !showsTrack() || !follow.el;
  byId("qPlayerStatus", HTMLElement).textContent = rec.timingsFailed
    ? t("quranNoFollow")
    : "";
  renderTime();
}

/** "Listen" is unavailable offline (aria-disabled, so its tooltip still shows). */
function renderListenAvailability() {
  const button = byId("readerListenBtn", HTMLButtonElement);
  const offline = !navigator.onLine;
  button.setAttribute("aria-disabled", String(offline));
  // only the hover text: the button keeps its name ("Listen"); a click says why it can't play
  if (offline) button.dataset.tip = t("quranListenOffline");
  else delete button.dataset.tip;
  refreshTooltips();
}

/** Plays the open surah from an ayah; tells the user when it can't. @param {number} [ayah] */
async function listenFrom(ayah = 1) {
  if (!navigator.onLine) {
    showToast(t("quranListenOffline"), "error");
    return;
  }
  // the first time, the reciter list loads first: "Listen" shows it is working
  const button = byId("readerListenBtn", HTMLButtonElement);
  const icon = button.querySelector("i");
  if (button.getAttribute("aria-busy") === "true") return;
  button.setAttribute("aria-busy", "true");
  if (icon) icon.className = "fas fa-spinner fa-spin";
  try {
    await listen({ ayah });
    backToAyah();
  } catch (err) {
    console.error("Listening failed:", err);
    showToast(t("quranAudioError"), "error");
  } finally {
    button.setAttribute("aria-busy", "false");
    if (icon) icon.className = "fas fa-play";
  }
}

function bindRecitationBar() {
  byId("readerListenBtn", HTMLButtonElement).addEventListener("click", () =>
    listenFrom(1),
  );
  byId("qPlayerPlay", HTMLButtonElement).addEventListener("click", togglePlay);
  byId("qPlayerStop", HTMLButtonElement).addEventListener("click", stop);
  byId("qPlayerPrev", HTMLButtonElement).addEventListener("click", () =>
    stepAyah(-1),
  );
  byId("qPlayerNext", HTMLButtonElement).addEventListener("click", () =>
    stepAyah(1),
  );
  byId("qPlayerBack", HTMLButtonElement).addEventListener("click", () => {
    backToAyah();
    render();
  });
  byId("qPlayerReciter", HTMLButtonElement).addEventListener("click", () =>
    // the reciters of the riwaya being read (the audio follows it)
    openReciterDialog(state.riwaya),
  );

  const slider = byId("qPlayerSeek", HTMLInputElement);
  slider.addEventListener("input", () => {
    dragging = true;
    renderTime();
  });
  slider.addEventListener("change", () => {
    dragging = false;
    seek(Number(slider.value));
    renderTime();
  });

  let shownFailure = false;
  onRecitationChange(() => {
    if (rec.failed && !shownFailure) showToast(t("quranAudioError"), "error");
    shownFailure = rec.failed;
    render();
  });
  onFollowChange(render);
  // another surah (or riwaya) opened in the reader: "Listen" is for it, the bar stays
  new MutationObserver(render).observe(byId("ayahList", HTMLElement), {
    childList: true,
  });
  // back to the surah list (the bar hides, the mini player shows) and into the reader again
  new MutationObserver(render).observe(byId("viewSurahReader", HTMLElement), {
    attributes: true,
    attributeFilter: ["hidden"],
  });
  window.addEventListener("online", renderListenAvailability);
  window.addEventListener("offline", renderListenAvailability);
  renderListenAvailability();
  // the time moves on between the player's reports
  setInterval(() => {
    if (rec.playing && !byId("qPlayer", HTMLElement).hidden) renderTime();
  }, 250);
}

module.exports = { bindRecitationBar, renderRecitationBar: render, listenFrom };
