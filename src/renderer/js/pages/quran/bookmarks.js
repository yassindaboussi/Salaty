"use strict";

// Bookmarked ayahs: toggled from the reader (the bookmark icon of an ayah), listed in the
// Bookmarks tab (newest first) with the start of the ayah's Arabic; a row opens the reader at the
// ayah, the bin removes it after a confirm.
const { t } = require("../../core/i18n");
const { byId } = require("../../core/dom");
const { html, setHtml } = require("../../utils/html");
const { showConfirmDialog } = require("../../components/confirm-dialog");
const { ayahArabic } = require("../../services/api/alquran-cloud");
const { loadBookmarks, saveBookmarks } = require("./storage");
const { fmt, ayahPlace } = require("./state");

/** @typedef {import("./storage").AyahRef} AyahRef */

/** @type {AyahRef[]} */
let bookmarks = loadBookmarks();

/** @type {Set<() => void>} */
const listeners = new Set();

/** @param {() => void} fn  called after every change */
const onBookmarksChange = (fn) => listeners.add(fn);

/** @param {number} surah @param {number} ayah */
const isBookmarked = (surah, ayah) =>
  bookmarks.some((b) => b.surah === surah && b.ayah === ayah);

/** @param {AyahRef[]} next */
function commit(next) {
  bookmarks = next;
  saveBookmarks(bookmarks);
  listeners.forEach((fn) => fn());
}

/** Adds or removes the ayah; returns whether it is bookmarked now. @param {number} surah @param {number} ayah */
function toggleBookmark(surah, ayah) {
  const on = isBookmarked(surah, ayah);
  commit(
    on
      ? bookmarks.filter((b) => !(b.surah === surah && b.ayah === ayah))
      : [{ surah, ayah }, ...bookmarks],
  );
  return !on;
}

/** The number shown on the Bookmarks tab. */
function renderBookmarkCount() {
  const count = byId("bookmarkCount", HTMLElement);
  count.textContent = bookmarks.length ? fmt(bookmarks.length) : "";
  count.hidden = !bookmarks.length;
}

let renderId = 0;

async function renderBookmarkList() {
  const id = ++renderId;
  const list = byId("bookmarkList", HTMLElement);
  if (!bookmarks.length) {
    setHtml(
      list,
      html`<div class="q-empty">
        <i class="far fa-bookmark" aria-hidden="true"></i>
        <p>${t("quranNoBookmarks")}</p>
      </div>`,
    );
    return;
  }
  const texts = await Promise.all(
    bookmarks.map((b) => ayahArabic(b.surah, b.ayah)),
  );
  if (id !== renderId) return;
  setHtml(
    list,
    html`${bookmarks.map(
      (b, i) => html`<div class="q-bookmark">
        <button type="button" class="q-bookmark-open" data-surah="${b.surah}" data-ayah="${b.ayah}">
          <span class="q-bookmark-place">${ayahPlace(b.surah, b.ayah)}</span>
          <span class="q-bookmark-text" lang="ar" dir="rtl">${texts[i]}</span>
        </button>
        <button type="button" class="q-icon-btn q-bookmark-remove" data-surah="${b.surah}" data-ayah="${b.ayah}" aria-label="${t("quranRemoveBookmark")}" data-tip="${t("quranRemoveBookmark")}">
          <i class="fas fa-trash-can" aria-hidden="true"></i>
        </button>
      </div>`,
    )}`,
  );
}

/** @param {(surah: number, ayah: number) => void} openAt */
function bindBookmarkList(openAt) {
  const list = byId("bookmarkList", HTMLElement);
  list.addEventListener("click", async (e) => {
    const button = /** @type {Element} */ (e.target).closest("button");
    if (!(button instanceof HTMLButtonElement)) return;
    const surah = Number(button.dataset.surah);
    const ayah = Number(button.dataset.ayah);
    if (!surah || !ayah) return;
    if (button.classList.contains("q-bookmark-open")) {
      openAt(surah, ayah);
      return;
    }
    const ok = await showConfirmDialog(
      t("quranRemoveBookmarkConfirm").replace(
        "{place}",
        ayahPlace(surah, ayah),
      ),
      { confirmClass: "btn-danger" },
    );
    if (ok && isBookmarked(surah, ayah)) toggleBookmark(surah, ayah);
  });
}

module.exports = {
  isBookmarked,
  toggleBookmark,
  onBookmarksChange,
  renderBookmarkCount,
  renderBookmarkList,
  bindBookmarkList,
};
