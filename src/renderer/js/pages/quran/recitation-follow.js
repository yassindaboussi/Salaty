"use strict";

// The ayah being recited, marked in the reader's text, and the text kept on it: when the ayah
// leaves the middle of the view the text scrolls to bring it back. Scrolling by hand (wheel,
// touch, the scroll keys, the scrollbar) stops that, so the reader can look elsewhere; "Back to
// the ayah" (shown in the player bar) turns it on again.
const { byId } = require("../../core/dom");
const { state } = require("./state");
const {
  rec,
  currentTime,
  ayahAt,
  onRecitationChange,
} = require("./recitation");

const SCROLL_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  " ",
]);

const follow = {
  on: true,
  ayah: 0,
  /** @type {HTMLElement | null} */
  el: null,
};

/** @type {Set<() => void>} */
const listeners = new Set();
/** @param {() => void} fn  called when following turns on or off, and when the marked ayah changes */
const onFollowChange = (fn) => listeners.add(fn);

/** Whether the reader shows the surah being recited, in the same riwaya. */
const showsTrack = () =>
  Boolean(rec.track) &&
  state.currentSurah?.n === rec.track?.surah &&
  state.riwaya === rec.track?.riwaya;

/** The ayah being recited in a surah of the riwaya read, else 0 (not playing, or not known yet).
 * @param {number} surah */
const recitedAyah = (surah) =>
  rec.track?.surah === surah &&
  rec.track.riwaya === state.riwaya &&
  rec.timings.length
    ? ayahAt(currentTime())
    : 0;

const reduceMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Brings the ayah to a third of the view, when it is outside its middle. @param {HTMLElement} el */
function keepInView(el, force = false) {
  const content = byId("readerContent", HTMLElement);
  const box = content.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const inMiddle =
    r.top >= box.top + box.height * 0.12 &&
    r.bottom <= box.top + box.height * 0.75;
  if (inMiddle && !force) return;
  content.scrollTo({
    top: content.scrollTop + r.top - box.top - box.height * 0.3,
    behavior: reduceMotion() ? "auto" : "smooth",
  });
}

/** Moves the mark to the ayah recited now (and the view with it). */
function mark() {
  const ayah = showsTrack() && rec.timings.length ? ayahAt(currentTime()) : 0;
  const el = ayah ? document.getElementById(`ayah-${ayah}`) : null;
  if (el === follow.el) return;
  follow.el?.classList.remove("is-reciting");
  follow.el = el;
  follow.ayah = ayah;
  listeners.forEach((fn) => fn()); // "Back to the ayah" needs an ayah marked
  if (!el) return;
  el.classList.add("is-reciting");
  if (follow.on) keepInView(el);
}

let frame = 0;
function loop() {
  mark();
  frame = rec.playing ? requestAnimationFrame(loop) : 0;
}

/** @param {boolean} on */
function setFollow(on) {
  if (follow.on === on) return;
  follow.on = on;
  listeners.forEach((fn) => fn());
}

/** "Back to the ayah": follows again, the ayah brought into view now. */
function backToAyah() {
  setFollow(true);
  if (follow.el) keepInView(follow.el, true);
}

function bindFollow() {
  const content = byId("readerContent", HTMLElement);
  const byHand = () => {
    if (rec.track) setFollow(false);
  };
  content.addEventListener("wheel", byHand, { passive: true });
  content.addEventListener("touchmove", byHand, { passive: true });
  content.addEventListener("keydown", (e) => {
    if (SCROLL_KEYS.has(e.key)) byHand();
  });
  // the scrollbar: a press on the strip outside the box's content width (on the right, or on
  // the left in a right-to-left page). A press on its empty space (under a short surah) is
  // not a scroll.
  content.addEventListener("pointerdown", (e) => {
    if (e.target !== content) return;
    const box = content.getBoundingClientRect();
    const from = box.left + content.clientLeft;
    const onScrollbar =
      e.clientX < from || e.clientX > from + content.clientWidth;
    if (onScrollbar) byHand();
  });
  // the text is drawn again (translation, size, digits): the mark goes on the new one
  new MutationObserver(() => {
    follow.el = null;
    mark();
  }).observe(byId("ayahList", HTMLElement), { childList: true });

  onRecitationChange(() => {
    if (!rec.track) setFollow(true);
    if (rec.playing && !frame) frame = requestAnimationFrame(loop);
    mark();
  });
}

module.exports = {
  follow,
  showsTrack,
  recitedAyah,
  setFollow,
  backToAyah,
  onFollowChange,
  bindFollow,
  markRecited: mark,
};
