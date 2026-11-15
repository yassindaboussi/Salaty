"use strict";

// Downloads on the Tafasir tab, one surah at a time (a whole book is ~5 GB; people study a surah):
//   - the side panel: "Download this surah · 120 MB" (progress, Pause / Cancel, Downloaded +
//     Delete) and a button on each part (components/download-group.js)
//   - the surah cards: ✓ when all its parts are saved, "3 / 12" when some are
// Saved parts play from the disk; offline, the others are greyed out. The files are kept per book
// (main: <folder>/tafsir-<bookId>/002-1-25.mp3).
const { t } = require("../../core/i18n");
const { byId } = require("../../core/dom");
const { html } = require("../../utils/html");
const dl = require("../../services/downloads");
const { createDownloadGroup } = require("../../components/download-group");

/**
 * @typedef {{
 *   book: { id: any, name: string },
 *   selected: () => string,
 *   partsOf: (id: string) => { url: string }[],
 *   surahIds: () => string[],
 *   title: (id: string, url: string) => string,
 *   onCardsChange: () => void,
 * }} Context
 */

/** @type {ReturnType<typeof createDownloadGroup> | null} */
let group = null;
/** @type {Context | null} */
let ctx = null;
let bookId = /** @type {any} */ (null);
let cardsSignature = "";

/** @param {string} url */
const nameOf = (url) => dl.fileNameOf(url);

/** How many parts of each surah are saved: the cards change only when this does. */
function signature() {
  if (!ctx || !group) return "";
  const c = ctx;
  return c
    .surahIds()
    .map(
      (id) => c.partsOf(id).filter((e) => group?.isDone(nameOf(e.url))).length,
    )
    .join(",");
}

function onPaint() {
  if (!ctx || !group) return;
  for (const row of byId("tfParts", HTMLElement).querySelectorAll(".tf-part")) {
    if (!(row instanceof HTMLButtonElement)) continue;
    const part = ctx.partsOf(ctx.selected())[Number(row.dataset.part)];
    row.disabled = Boolean(part) && !group.canPlay(nameOf(part.url));
  }
  const now = signature();
  if (now !== cardsSignature) {
    cardsSignature = now;
    ctx.onCardsChange();
  }
}

/** Once per book, after the panel is drawn. @param {Context} context */
function setupTafsirDownloads(context) {
  ctx = context;
  if (group && String(bookId) === String(context.book.id)) return;
  bookId = context.book.id;
  group = createDownloadGroup({
    key: `tafsir-${bookId}`,
    info: {
      kind: "tafsir",
      bookId: Number(bookId),
      bookName: context.book.name,
    },
    items: () => {
      const c = /** @type {Context} */ (ctx);
      const id = c.selected();
      return c.partsOf(id).map((e) => ({
        name: nameOf(e.url),
        url: e.url,
        title: c.title(id, e.url),
      }));
    },
    allLabel: "dlDownloadSurah",
    bar: byId("tfDl", HTMLElement),
    list: byId("tfParts", HTMLElement),
    title: () => {
      const c = /** @type {Context} */ (ctx);
      return c.title(c.selected(), "");
    },
    onPaint,
  });
  group.refresh().then(() => group?.loadSizes());
}

/** The panel shows another surah: its buttons, its sizes. */
function onSurahShown() {
  group?.paint();
  group?.loadSizes();
}

/** @param {string} url  the part's download button ("" before the book is set up) */
const partButtonHtml = (url) => (group ? group.rowButtonHtml(nameOf(url)) : "");

/** The URL to play: the saved file when there is one. @param {string} url */
const playUrl = (url) =>
  group ? group.urlFor({ name: nameOf(url), url, title: "" }) : url;

/** @param {string} url  false when offline and not saved */
const canPlayUrl = (url) => !group || group.canPlay(nameOf(url));

/** A surah card's mark: ✓ all parts saved, "⬇ 3 / 12" some. @param {string} id */
function cardBadgeHtml(id) {
  if (!ctx || !group) return "";
  const parts = ctx.partsOf(id);
  const saved = parts.filter((e) => group?.isDone(nameOf(e.url))).length;
  if (!saved) return "";
  return saved === parts.length
    ? html`<span class="tf-dl-badge" role="img" aria-label="${t("dlDownloaded")}" title="${t("dlDownloaded")}"><i class="fas fa-circle-down" aria-hidden="true"></i></span>`
    : html`<span class="tf-dl-badge is-partial" title="${t("dlPartsSaved").replace("{done}", String(saved)).replace("{total}", String(parts.length))}"><i class="fas fa-download" aria-hidden="true"></i> ${saved}/${parts.length}</span>`;
}

module.exports = {
  setupTafsirDownloads,
  onSurahShown,
  partButtonHtml,
  playUrl,
  canPlayUrl,
  cardBadgeHtml,
};
