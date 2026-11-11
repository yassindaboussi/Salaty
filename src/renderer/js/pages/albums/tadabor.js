"use strict";

// The Tadabor tab: short reflection videos (mp3quran.net, filmed upright like phone clips), as
// one grid of cards in surah order: picture, title, surah and speaker. The search looks in the
// surah, the title and the speaker. A card plays its video in a dialog (tadabor-video.js); its
// headphones button plays the sound only, in the app's player (the cards shown as the playlist,
// so it goes on in the background with the mini player), and is marked while it plays. On top,
// "Continue watching / listening": the last clip, from the second it stopped.
const mp3quranApi = require("../../services/api/mp3quran");
const { t } = require("../../core/i18n");
const { byId } = require("../../core/dom");
const { html, setHtml } = require("../../utils/html");
const { normalizeForSearch } = require("../../utils/search-text");
const { state, surahName } = require("./state");
const { messageHtml } = require("./messages");
const { playVideo } = require("./tadabor-video");
const { getResume } = require("../../services/listening-resume");
const { playingNow, playFrom, pause, continueHtml } = require("./continue");

const box = () => byId("acTadabor", HTMLElement);

/** @type {{ id: string, e: any, i: number }[]} the cards shown, in order: previous / next */
let shownClips = [];

async function loadTadabor() {
  if (state.tadaborBySura) {
    renderTadabor();
    return;
  }
  setHtml(box(), messageHtml("loading", t("loadingTadabor")));
  try {
    const lang = mp3quranApi.apiLanguage();
    const [bySura, surahs] = await Promise.all([
      mp3quranApi.getTadabor(lang),
      state.surahNames ?? mp3quranApi.getSurahNames(lang),
    ]);
    state.tadaborBySura = bySura;
    state.surahNames = surahs;
    renderTadabor();
  } catch (error) {
    console.error("Failed to load tadabor:", error);
    setHtml(box(), messageHtml("error", t("errorLoadingTadabor"), "tadabor"));
  }
}

/** The clips that can play. @param {string} id */
const clipsOf = (id) =>
  (state.tadaborBySura?.[id] ?? []).filter((e) => e.video_url || e.audio_url);

/** @param {any} e */
const titleOf = (e) =>
  (e.title || e.share_title || e.text || "").replace(/\s+/g, " ").trim() ||
  t("tadabor");

/** "Al-Baqarah · Speaker" @param {string} id @param {any} e */
const metaOf = (id, e) =>
  [surahName(id), (e.reciter_name || "").trim()]
    .filter(Boolean)
    .join(t("acSep"));

/** @param {any} e */
const urlOf = (e) => e.video_url || e.audio_url;

/** @param {string} id @param {any} e @param {number} i */
function cardHtml(id, e, i) {
  const title = titleOf(e);
  const meta = metaOf(id, e);
  const on = urlOf(e) === playingNow();
  const listenLabel = t(on ? "acListening" : "acListen");
  return html`<li class="ac-td-item"><button type="button" class="ac-td-card" data-sura="${id}" data-index="${i}" aria-label="${t("acWatch")}${t("acSep")}${title}${t("acSep")}${meta}"><span class="ac-td-thumb">${e.image_url ? html`<img src="${e.image_url}" alt="" loading="lazy" decoding="async" />` : ""}${e.video_url ? html`<i class="fas fa-play ac-td-play" aria-hidden="true"></i>` : ""}</span><span class="ac-td-title" dir="auto">${title}</span><span class="ac-td-speaker">${meta}</span></button><button type="button" class="ac-td-listen" data-listen="${id}" data-index="${i}" aria-pressed="${String(on)}" aria-label="${listenLabel}${t("acSep")}${title}" data-tip="${listenLabel}"><i class="fas ${on ? "fa-volume-high" : "fa-headphones"}" aria-hidden="true"></i></button></li>`;
}

function renderTadabor() {
  const bySura = state.tadaborBySura;
  if (!bySura) return;
  const query = normalizeForSearch(state.query.trim());
  const has = (/** @type {string} */ text) =>
    normalizeForSearch(text).includes(query);
  const clips = Object.keys(bySura)
    .sort((a, b) => Number(a) - Number(b))
    .map((id) => {
      const all = clipsOf(id).map((e, i) => ({ e, i }));
      const surahHit = !query || id === query || has(surahName(id));
      const shown = surahHit
        ? all
        : all.filter(({ e }) => has(titleOf(e)) || has(e.reciter_name || ""));
      return shown.map(({ e, i }) => ({ id, e, i }));
    })
    .flat();
  shownClips = clips;
  renderTadaborContinue();
  setHtml(
    box(),
    clips.length
      ? html`<h2 class="ac-heading"><i class="fas fa-lightbulb" aria-hidden="true"></i><span>${t("reflections").replace("{count}", String(clips.length))}</span></h2><ul class="ac-td-grid">${clips.map(({ id, e, i }) => cardHtml(id, e, i))}</ul>`
      : messageHtml("empty", t("noTracksFound")),
  );
  // a picture that fails to load: the plain tile stays
  for (const img of box().querySelectorAll(".ac-td-thumb img")) {
    img.addEventListener("error", () => img.remove(), { once: true });
  }
}

/** Every clip, in surah order (Continue plays from the whole list, whatever the search). */
const allClips = () =>
  Object.keys(state.tadaborBySura ?? {})
    .sort((a, b) => Number(a) - Number(b))
    .flatMap((id) => clipsOf(id).map((e, i) => ({ id, e, i })));

/** @param {{ id: string, e: any }[]} clips  as the video dialog's list */
const asVideos = (clips) =>
  clips.map(({ id, e }) => ({
    url: urlOf(e),
    poster: e.image_url || "",
    title: titleOf(e),
    meta: metaOf(id, e),
  }));

/** Sound only: `clips` become the app's playlist, from one (startAt: seconds into it).
 * @param {{ id: string, e: any }[]} clips @param {number} at @param {number} [startAt] */
function listen(clips, at, startAt = 0) {
  const tracks = clips.map(({ id, e }) => ({
    title: titleOf(e),
    artist: metaOf(id, e),
    url: urlOf(e),
    filename: `tadabor-${e.id ?? id}.mp4`,
    resume: { kind: "tadabor", mode: "audio" },
  }));
  playFrom(tracks, at, startAt, {
    source: "mp3quran-tracks",
    id: "tadabor",
    title: t("tadabor"),
    artist: t("reflections").replace("{count}", String(tracks.length)),
    icon: "fas fa-lightbulb",
  });
}

/** The card on top: the last clip watched or listened to (nothing before the first). */
function renderTadaborContinue() {
  const target = byId("acTadaborContinue", HTMLElement);
  const entry = getResume("tadabor");
  const found = entry && allClips().find((c) => urlOf(c.e) === entry.url);
  if (!entry || !found) {
    setHtml(target, html``);
    return;
  }
  setHtml(
    target,
    continueHtml({
      title: titleOf(found.e),
      sub: metaOf(found.id, found.e),
      playing: playingNow() === entry.url,
      started: true,
      video: entry.mode === "video",
      action: "tadabor-continue",
    }),
  );
}

function continueTadabor() {
  const entry = getResume("tadabor");
  const clips = allClips();
  const at = entry ? clips.findIndex((c) => urlOf(c.e) === entry.url) : -1;
  if (!entry || at === -1) return;
  if (playingNow() === entry.url) pause();
  else if (entry.mode === "video") playVideo(asVideos(clips), at, entry.time);
  else listen(clips, at, entry.time);
}

/** @param {HTMLButtonElement} button */
function onTadaborAction(button) {
  if (button.dataset.action === "tadabor-continue") {
    continueTadabor();
    return;
  }
  const sura = button.dataset.sura ?? button.dataset.listen;
  const at = shownClips.findIndex(
    (c) => c.id === sura && String(c.i) === button.dataset.index,
  );
  if (at === -1) return;
  if (button.dataset.listen) {
    // pressed while it plays: pause
    if (urlOf(shownClips[at].e) === playingNow()) pause();
    else listen(shownClips, at);
    return;
  }
  playVideo(asVideos(shownClips), at);
}

/** What plays changed, or the video dialog closed: the marks and the Continue card. */
function onTadaborChange() {
  if (state.tab === "tadabor" && state.tadaborBySura) renderTadabor();
}

module.exports = {
  loadTadabor,
  renderTadabor,
  onTadaborAction,
  onTadaborChange,
};
