"use strict";

// The ayahs found by the search box, under the surahs it found: "Ayahs with “صبر” 103", then one
// group per surah ("Al-Baqara 12") that opens to its ayahs, the words found marked. A click
// opens the reader at the ayah; back comes to the same results, on the ayah opened.
// The groups' rows are drawn when a group first opens (a common word is in 2,000+ ayahs).
const { t, getLanguage } = require("../../core/i18n");
const { byId } = require("../../core/dom");
const { html, setHtml } = require("../../utils/html");
const { state, fmt, surahMeta, surahName } = require("./state");
const { findVerses, markWords } = require("./verse-search");

const TYPING_PAUSE_MS = 200;
// this many ayahs or fewer: every group open; more: closed, the counts give the overview
const OPEN_ALL_UP_TO = 20;

/** @typedef {import("./verse-search").VerseHit} VerseHit */

/** @type {{ hits: VerseHit[], words: string[] }} */
let shown = { hits: [], words: [] };
let searchId = 0;
/** @type {ReturnType<typeof setTimeout> | undefined} */
let timer;

const section = () => byId("verseResults", HTMLElement);

/** @param {VerseHit} hit */
function verseRow(hit) {
  const parts = markWords(hit.text, shown.words);
  const ar = hit.lang === "ar";
  return html`<button type="button" class="q-verse" data-surah="${hit.surah}" data-ayah="${hit.ayah}">
    <span class="q-verse-num">${fmt(hit.ayah)}</span>
    <span class="q-verse-text${ar ? " is-arabic" : ""}" lang="${hit.lang}" dir="${ar ? "rtl" : "ltr"}">${parts.map(
      (p) => (p.hit ? html`<mark>${p.text}</mark>` : p.text),
    )}</span>
  </button>`;
}

/** @param {HTMLElement} head @param {boolean} open */
function setGroupOpen(head, open) {
  head.setAttribute("aria-expanded", String(open));
  const body = head.nextElementSibling;
  if (!(body instanceof HTMLElement) || !open || body.dataset.drawn) return;
  const surah = Number(head.dataset.group);
  setHtml(
    /** @type {HTMLElement} */ (body.firstElementChild),
    html`${shown.hits.filter((h) => h.surah === surah).map(verseRow)}`,
  );
  body.dataset.drawn = "1";
}

/** @param {VerseHit[]} hits */
function groupsOf(hits) {
  /** @type {Map<number, number>} */
  const counts = new Map();
  for (const h of hits) counts.set(h.surah, (counts.get(h.surah) ?? 0) + 1);
  return [...counts];
}

/** @param {string} query @param {boolean} fellBack */
function render(query, fellBack) {
  const el = section();
  const quoted = query.trim();
  if (!shown.hits.length) {
    setHtml(
      el,
      html`<p class="q-empty-line">
        ${t("quranNoVerses").replace("{query}", quoted)}
        <span class="q-verses-tip">${t("quranSearchTip")}</span>
      </p>`,
    );
    return;
  }
  const groups = groupsOf(shown.hits);
  setHtml(
    el,
    html`<h2 class="q-verses-title">
        <span>${t("quranVersesWith").replace("{query}", quoted)}</span>
        <span class="q-verses-count">${fmt(shown.hits.length)}</span>
      </h2>
      ${fellBack ? html`<p class="q-verses-note">${t("quranSearchOfflineEnglish")}</p>` : ""}
      ${groups.map(([surah, count]) => {
        const meta = surahMeta(surah);
        return html`<div class="q-vgroup">
          <button type="button" class="q-vgroup-head" data-group="${surah}" aria-expanded="false" aria-controls="vg-${surah}">
            <span class="q-num">${fmt(surah)}</span>
            <span class="q-vgroup-name">${meta ? surahName(meta) : ""}</span>
            <span class="q-vgroup-count">${fmt(count)}</span>
            <i class="fas fa-chevron-down q-vgroup-chevron" aria-hidden="true"></i>
          </button>
          <div class="q-vgroup-body" id="vg-${surah}"><div class="q-vgroup-rows"></div></div>
        </div>`;
      })}`,
  );
  if (shown.hits.length > OPEN_ALL_UP_TO && groups.length > 1) return;
  for (const head of el.querySelectorAll(".q-vgroup-head"))
    if (head instanceof HTMLElement) setGroupOpen(head, true);
}

/** Searches the ayahs once typing pauses (nothing for a surah number or one letter).
 * @param {string} query */
function searchVerses(query) {
  clearTimeout(timer);
  const id = ++searchId;
  const el = section();
  if (!query.trim() || /^[\s\d٠-٩:]+$/.test(query)) {
    el.hidden = true;
    shown = { hits: [], words: [] };
    return;
  }
  timer = setTimeout(async () => {
    try {
      const { hits, words, fellBack } = await findVerses(query, getLanguage());
      if (id !== searchId) return; // typed again meanwhile
      shown = { hits, words };
      // a surah name found and no ayah: no "No ayahs with…" under the surah
      const nothing = !hits.length && state.filteredSurahs.length > 0;
      el.hidden = !words.length || nothing || state.activeTab !== "surah";
      if (words.length) render(query, fellBack);
    } catch (err) {
      console.error("Verse search failed:", err);
    }
  }, TYPING_PAUSE_MS);
}

/** What ↑/↓ move through: group heads and the rows of open groups. */
const focusables = () =>
  [...section().querySelectorAll(".q-vgroup-head, .q-verse")].filter(
    (el) => el instanceof HTMLElement && el.offsetParent,
  );

/** @param {(surah: number, ayah?: number, riwaya?: import("./state").Riwaya) => void} openAt */
function bindVerseResults(openAt) {
  const el = section();
  el.addEventListener("click", (e) => {
    const target = /** @type {Element} */ (e.target);
    const head = target.closest(".q-vgroup-head");
    if (head instanceof HTMLElement) {
      setGroupOpen(head, head.getAttribute("aria-expanded") !== "true");
      return;
    }
    const row = target.closest(".q-verse");
    if (!(row instanceof HTMLElement)) return;
    el.querySelector("[data-opened]")?.removeAttribute("data-opened");
    row.dataset.opened = "1"; // back from the reader lands here
    // the numbers are Hafs ones: the reader opens in Hafs
    openAt(Number(row.dataset.surah), Number(row.dataset.ayah), "hafs");
  });
  el.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const list = focusables();
    const at = list.indexOf(/** @type {Element} */ (document.activeElement));
    const next = list[at + (e.key === "ArrowDown" ? 1 : -1)];
    if (!(next instanceof HTMLElement)) return;
    e.preventDefault();
    next.focus();
  });
  // ↓ in the search box goes to the first result
  byId("surahSearchInput", HTMLInputElement).addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "ArrowDown") return;
      const first =
        document.querySelector("#surahGrid .surah-row") ?? focusables()[0];
      if (!(first instanceof HTMLElement)) return;
      e.preventDefault();
      first.focus();
    },
  );
}

/** Shows the results again for what is in the box (back on the Surahs tab, digits or language
 * changed), or hides them on another tab. */
function renderVerseResults() {
  if (state.activeTab !== "surah") {
    section().hidden = true;
    return;
  }
  searchVerses(byId("surahSearchInput", HTMLInputElement).value);
}

module.exports = { searchVerses, bindVerseResults, renderVerseResults };
