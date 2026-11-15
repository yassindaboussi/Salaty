"use strict";

// The Tafasir tab: "Continue listening" (the last part, from the second it stopped), the surahs as
// cards, and a side panel with the chosen surah's parts (the one playing marked). The panel folds
// to a thin strip (remembered); a narrow window has one column. Today the API has one book; book
// chips show only when it has more. The search filters the surah cards (name or number).
// Downloading a surah's parts: tafsir-downloads.js.
const mp3quranApi = require("../../services/api/mp3quran");
const { t } = require("../../core/i18n");
const { byId } = require("../../core/dom");
const { html, setHtml } = require("../../utils/html");
const { normalizeForSearch } = require("../../utils/search-text");
const { state, surahName, savePrefs } = require("./state");
const { messageHtml } = require("./messages");
const { getResume } = require("../../services/listening-resume");
const { playingNow, playFrom, pause, continueHtml } = require("./continue");
const td = require("./tafsir-downloads");
const { isFolded, setFolded } = require("./tafsir-fold");

const lang = () => mp3quranApi.apiLanguage();
const box = () => byId("acTafsir", HTMLElement);

/** @type {string} the surah shown in the panel */
let selected = "";

async function loadTafsirBooks() {
  if (state.tafsirBook) {
    renderTafsir();
    return;
  }
  setHtml(box(), messageHtml("loading", t("loadingTafasir")));
  try {
    const books =
      state.tafsirBooks ?? (await mp3quranApi.getTafasirBooks(lang()));
    state.tafsirBooks = books;
    const book =
      books.find((b) => String(b.id) === String(state.tafsirBookId)) ??
      books[0];
    if (book) await openTafsirBook(book);
    else setHtml(box(), messageHtml("empty", t("noTracksFound")));
  } catch (error) {
    console.error("Failed to load tafsir books:", error);
    setHtml(box(), messageHtml("error", t("errorLoadingTafasir"), "tafsir"));
  }
}

async function openTafsirBook(book) {
  setHtml(box(), messageHtml("loading", t("loadingTafasir")));
  try {
    const { bookName, bySura } = await mp3quranApi.getTafsirSurahs(
      book.id,
      lang(),
    );
    if (!state.surahNames)
      state.surahNames = await mp3quranApi.getSurahNames(lang());
    state.tafsirBook = {
      id: book.id,
      name: book.displayName || bookName || book.name,
      bySura,
    };
    selected = whereOf(last()?.url ?? "")?.id ?? surahIds()[0] ?? "";
    savePrefs();
    renderTafsir();
  } catch (error) {
    console.error("Failed to load tafsir surahs:", error);
    setHtml(box(), messageHtml("error", t("errorLoadingTafasir"), "tafsir"));
  }
}

/** @param {string} id  the surah's parts that can play */
const partsOf = (id) =>
  (state.tafsirBook?.bySura[id] ?? []).filter((e) => e && e.url);

/** The surahs with parts, in order. */
const surahIds = () =>
  Object.keys(state.tafsirBook?.bySura ?? {})
    .filter((id) => partsOf(id).length)
    .sort((a, b) => Number(a) - Number(b));

/** Which surah and part a url is. @param {string} url */
function whereOf(url) {
  if (!url) return null;
  for (const id of surahIds()) {
    const index = partsOf(id).findIndex((e) => e.url === url);
    if (index !== -1) return { id, index };
  }
  return null;
}

/** Where this book's listening stopped (null: not started). */
function last() {
  const entry = getResume("tafsir");
  return entry &&
    String(entry.bookId) === String(state.tafsirBook?.id) &&
    whereOf(entry.url)
    ? entry
    : null;
}

/** "Ayahs 1–25", or "Whole surah". @param {string} url */
function partLabel(url) {
  const range = mp3quranApi.parseAyahRangeFromUrl(url);
  return range
    ? t("tafsirAyahs")
        .replace("{start}", String(range.start))
        .replace("{end}", String(range.end))
    : t("tafsirWholeSurah");
}

/** The frame, drawn once per book, so the lists keep their scroll when re-drawn. */
function frame() {
  if (box().querySelector("#tfLayout")) return;
  setHtml(
    box(),
    html`<div class="tf-layout" id="tfLayout"><div class="tf-main"><div class="tf-top" id="tfContinue"></div><div class="tf-surahs" id="tfSurahs"></div></div><aside class="tf-panel"><div class="tf-panel-head"><button type="button" class="tf-icon-btn tf-panel-toggle" id="tfPanelToggle" data-action="fold"><i class="fas fa-angles-right" aria-hidden="true"></i></button><h2 class="tf-panel-title" id="tfPanelTitle"></h2><span class="tf-panel-count" id="tfPanelCount"></span></div><div class="pl-dl-bar tf-dl" id="tfDl" hidden></div><ul class="tf-parts" id="tfParts"></ul></aside></div>`,
  );
  setFolded(isFolded());
}

/** The panel's title for a part, or for the surah ("Al-Baqarah · Ayahs 1–25"). */
const titleOf = (/** @type {string} */ id, /** @type {string} */ url) =>
  url ? `${surahName(id)}${t("acSep")}${partLabel(url)}` : surahName(id);

function renderContinue() {
  const book = state.tafsirBook;
  if (!book) return;
  const stopped = last();
  const at = whereOf(stopped?.url ?? "") ?? {
    id: surahIds()[0] ?? "",
    index: 0,
  };
  const url = partsOf(at.id)[at.index]?.url ?? "";
  const books = state.tafsirBooks ?? [];
  setHtml(
    byId("tfContinue", HTMLElement),
    html`${
      books.length > 1
        ? html`<div class="ac-chips tf-books" role="group" aria-label="${t("tafasirBooks")}">${books.map((b) => html`<button type="button" class="ac-chip" data-book="${b.id}" aria-pressed="${String(String(b.id) === String(book.id))}">${b.displayName || b.name}</button>`)}</div>`
        : ""
    }${continueHtml({
      title: `${surahName(at.id)}${t("acSep")}${partLabel(url)}`,
      sub: book.name,
      playing: playingNow() === url,
      started: Boolean(stopped),
      action: "continue",
      url,
    })}`,
  );
}

function renderSurahs() {
  const query = normalizeForSearch(state.query.trim());
  const ids = surahIds().filter(
    (id) =>
      !query ||
      id === query ||
      normalizeForSearch(surahName(id)).includes(query),
  );
  const playingId = whereOf(playingNow())?.id;
  setHtml(
    byId("tfSurahs", HTMLElement),
    ids.length
      ? html`<ul class="tf-grid">${ids.map((id) => {
          const parts = partsOf(id);
          return html`<li><button type="button" class="tf-card" data-surah="${id}" aria-pressed="${String(id === selected)}"><span class="tf-num">${id}</span><span class="tf-card-text"><span class="tf-card-name">${surahName(id)}</span><span class="tf-card-meta">${playingId === id ? html`<i class="fas fa-volume-high" aria-hidden="true"></i> ` : ""}${t("tafsirParts").replace("{count}", String(parts.length))}${td.cardBadgeHtml(id)}</span></span></button></li>`;
        })}</ul>`
      : messageHtml("empty", t("noTracksFound")),
  );
}

function renderPanel() {
  if (!selected) return;
  const parts = partsOf(selected);
  const playing = playingNow();
  byId("tfPanelTitle", HTMLElement).textContent =
    `${selected}. ${surahName(selected)}`;
  byId("tfPanelCount", HTMLElement).textContent = t("tafsirParts").replace(
    "{count}",
    String(parts.length),
  );
  setHtml(
    byId("tfParts", HTMLElement),
    html`${parts.map((e, i) => {
      const on = e.url === playing;
      return html`<li class="pl-row"><button type="button" class="tf-part" data-part="${i}" aria-current="${String(on)}"><i class="fas ${on ? "fa-volume-high" : "fa-play"} tf-part-icon" aria-hidden="true"></i><span class="tf-part-name">${partLabel(e.url)}</span></button>${td.partButtonHtml(e.url)}</li>`;
    })}`,
  );
  td.onSurahShown();
}

function renderTafsir() {
  if (!state.tafsirBook) return;
  frame();
  td.setupTafsirDownloads({
    book: state.tafsirBook,
    selected: () => selected,
    partsOf,
    surahIds,
    title: titleOf,
    onCardsChange: renderSurahs,
  });
  renderContinue();
  renderSurahs();
  renderPanel();
}

/** Plays a surah's parts from one (resumeAt: seconds into it).
 * @param {string} id @param {number} index @param {number} [resumeAt] */
function playPart(id, index, resumeAt = 0) {
  const book = state.tafsirBook;
  if (!book) return;
  // saved parts play from the disk; offline, only those
  const tracks = mp3quranApi
    .getTafsirTracksForSura(partsOf(id), surahName(id), book.name)
    .map((track, i) => ({ ...track, i, url: td.playUrl(track.url) }))
    .filter((track) => td.canPlayUrl(partsOf(id)[track.i].url));
  const at = tracks.findIndex((track) => track.i === index);
  if (at === -1) return;
  savePrefs();
  playFrom(
    tracks.map(({ i: _i, ...track }) => ({
      ...track,
      resume: { kind: "tafsir", bookId: book.id },
    })),
    at,
    resumeAt,
    {
      source: "mp3quran-tracks",
      id: `tafsir-${book.id}-${id}`,
      title: surahName(id),
      artist: book.name,
      icon: "fas fa-book-open",
    },
  );
}

function continueListening() {
  const stopped = last();
  const at = whereOf(stopped?.url ?? "");
  if (stopped && at && playingNow() === stopped.url) pause();
  else if (stopped && at) playPart(at.id, at.index, stopped.time);
  else if (surahIds()[0]) playPart(surahIds()[0], 0);
}

/** @param {HTMLButtonElement} button */
function onTafsirAction(button) {
  const { action, surah, part, book } = button.dataset;
  if (action === "fold") {
    setFolded(
      !byId("tfLayout", HTMLElement).classList.contains("is-panel-folded"),
    );
    button.focus();
  } else if (action === "continue") {
    continueListening();
  } else if (surah) {
    selected = surah;
    setFolded(false);
    renderSurahs();
    renderPanel();
    byId("tfParts", HTMLElement).scrollTop = 0;
  } else if (part !== undefined) {
    playPart(selected, Number(part));
  } else if (book) {
    const found = state.tafsirBooks?.find((b) => String(b.id) === book);
    if (found && String(found.id) !== String(state.tafsirBook?.id))
      openTafsirBook(found);
  }
}

/** What plays changed: its marks. */
function onPlaying() {
  if (state.tab === "tafsir" && box().querySelector("#tfLayout")) {
    renderContinue();
    renderSurahs();
    renderPanel();
  }
}

module.exports = {
  loadTafsirBooks,
  renderTafsir,
  onTafsirAction,
  onPlaying,
};
