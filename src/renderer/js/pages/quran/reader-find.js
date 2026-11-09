"use strict";

// "Find in this surah", at the top of the reader's display panel: the words typed are marked in
// the text, "3 / 12" counts them, ↑ / ↓ (Enter / Shift+Enter) go from one to the next, the one
// at hand marked in white and scrolled to. Ctrl+F comes here (the panel unfolds); Esc clears.
// The words are matched as by the list's search (verse-search.js: Uthmani spelling, و ف ب ال
// before the word). Arabic typed: the Arabic is searched; Latin: the translation under it.
// Another surah opened: the box is cleared.
const { t } = require("../../core/i18n");
const { byId } = require("../../core/dom");
const { html, setHtml } = require("../../utils/html");
const { fmt } = require("./state");
const { markWords, queryWords } = require("./verse-search");

const TYPING_PAUSE_MS = 150;
const ARABIC = /[؀-ۿ]/;

/** @type {HTMLElement[]} the marks, in reading order */
let marks = [];
let at = -1;
/** @type {ReturnType<typeof setTimeout> | undefined} */
let timer;

const input = () => byId("qFindInput", HTMLInputElement);

/** The text elements searched: the Arabic, or the translations for a Latin query.
 * @param {string} query */
function targets(query) {
  const list = byId("ayahList", HTMLElement);
  return [
    ...list.querySelectorAll(
      ARABIC.test(query) ? ".ayah-text, .ayah-card-ar" : ".ayah-card-tr",
    ),
  ].filter((el) => el instanceof HTMLElement);
}

/** Takes the marks out of the text. */
function unmark() {
  for (const el of byId("ayahList", HTMLElement).querySelectorAll(
    "[data-found]",
  )) {
    const text = el.textContent;
    el.textContent = text;
    el.removeAttribute("data-found");
  }
  marks = [];
  at = -1;
}

function renderCount() {
  const count = byId("qFindCount", HTMLElement);
  const searching = queryWords(input().value).length > 0;
  count.textContent = !searching
    ? ""
    : marks.length
      ? // the page's direction marked around "/", or Arabic-Indic digits in an English
        // page read backwards ("١٦ / ١")
        [fmt(at + 1), fmt(marks.length)].join(
          document.dir === "rtl" ? "‏ / ‏" : "‎ / ‎",
        )
      : t("quranFindNone");
  count.classList.toggle("is-none", searching && !marks.length);
  for (const id of ["qFindPrev", "qFindNext"])
    byId(id, HTMLButtonElement).disabled = marks.length < 2;
}

/** @param {number} i */
function goTo(i) {
  if (!marks.length) return;
  marks[at]?.classList.remove("is-current");
  at = (i + marks.length) % marks.length;
  marks[at].classList.add("is-current");
  marks[at].scrollIntoView({ block: "center" });
  renderCount();
}

/** Marks the words in the text drawn now (also after it is drawn again: digits, translation). */
function refreshFind() {
  unmark();
  const query = input().value;
  const words = queryWords(query);
  if (words.length) {
    for (const el of targets(query)) {
      const parts = markWords(el.textContent ?? "", words);
      if (!parts.some((p) => p.hit)) continue;
      el.dataset.found = "1";
      setHtml(
        el,
        html`${parts.map((p) => (p.hit ? html`<mark>${p.text}</mark>` : p.text))}`,
      );
      marks.push(...el.querySelectorAll("mark"));
    }
  }
  if (marks.length) goTo(0);
  else renderCount();
}

/** Another surah: an empty box. */
function resetFind() {
  clearTimeout(timer);
  input().value = "";
  unmark();
  renderCount();
}

/** Ctrl+F: the box, its panel unfolded and its text selected. @param {() => void} unfold */
function focusFind(unfold) {
  unfold();
  input().focus();
  input().select();
}

/** @param {() => void} unfold opens the folded panel */
function bindReaderFind(unfold) {
  const box = input();
  box.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(refreshFind, TYPING_PAUSE_MS);
  });
  box.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      clearTimeout(timer);
      if (!marks.length) refreshFind();
      else goTo(at + (e.shiftKey ? -1 : 1));
    } else if (e.key === "Escape" && box.value) {
      e.preventDefault();
      e.stopPropagation();
      resetFind();
    }
  });
  byId("qFindPrev", HTMLButtonElement).addEventListener("click", () =>
    goTo(at - 1),
  );
  byId("qFindNext", HTMLButtonElement).addEventListener("click", () =>
    goTo(at + 1),
  );
  document.addEventListener("keydown", (e) => {
    const reading = !byId("viewSurahReader", HTMLElement).hidden;
    // by the key's place, so it works with an Arabic keyboard too
    if (!reading || !(e.ctrlKey || e.metaKey) || e.code !== "KeyF") return;
    e.preventDefault();
    focusFind(unfold);
  });
  renderCount();
}

module.exports = { bindReaderFind, refreshFind, resetFind, focusFind };
