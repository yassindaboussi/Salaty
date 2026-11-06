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
const { state, fmt, ayahPlace, isRiwaya } = require("./state");

/** @typedef {import("./storage").AyahRef} AyahRef */

/** @type {AyahRef[]} */
let bookmarks = loadBookmarks();

/** @type {Set<() => void>} */
const listeners = new Set();

/** @param {() => void} fn  called after every change */
const onBookmarksChange = (fn) => listeners.add(fn);

/** @typedef {import("./state").Riwaya} Riwaya */

/** @param {AyahRef} b @param {number} surah @param {number} ayah @param {Riwaya} riwaya */
const same = (b, surah, ayah, riwaya) =>
  b.surah === surah && b.ayah === ayah && b.riwaya === riwaya;

/** @param {number} surah @param {number} ayah @param {Riwaya} [riwaya]  default: the one read */
const isBookmarked = (surah, ayah, riwaya = state.riwaya) =>
  bookmarks.some((b) => same(b, surah, ayah, riwaya));

/** @param {AyahRef[]} next */
function commit(next) {
  bookmarks = next;
  saveBookmarks(bookmarks);
  listeners.forEach((fn) => fn());
}

/**
 * Adds or removes the ayah; returns whether it is bookmarked now.
 * @param {number} surah @param {number} ayah @param {Riwaya} [riwaya]  default: the one read
 */
function toggleBookmark(surah, ayah, riwaya = state.riwaya) {
  const on = isBookmarked(surah, ayah, riwaya);
  commit(
    on
      ? bookmarks.filter((b) => !same(b, surah, ayah, riwaya))
      : [{ surah, ayah, riwaya }, ...bookmarks],
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
    bookmarks.map((b) => ayahArabic(b.surah, b.ayah, b.riwaya)),
  );
  if (id !== renderId) return;
  setHtml(
    list,
    html`${bookmarks.map(
      (b, i) => html`<div class="q-bookmark">
        <button type="button" class="q-bookmark-open" data-surah="${b.surah}" data-ayah="${b.ayah}" data-riwaya="${b.riwaya}">
          <span class="q-bookmark-place">${ayahPlace(b.surah, b.ayah, b.riwaya)}</span>
          <span class="q-bookmark-text" lang="ar" dir="rtl" data-riwaya="${b.riwaya}">${texts[i]}</span>
        </button>
        <button type="button" class="q-icon-btn q-bookmark-remove" data-surah="${b.surah}" data-ayah="${b.ayah}" data-riwaya="${b.riwaya}" aria-label="${t("quranRemoveBookmark")}" data-tip="${t("quranRemoveBookmark")}">
          <i class="fas fa-trash-can" aria-hidden="true"></i>
        </button>
      </div>`,
    )}`,
  );
}

/** @param {(surah: number, ayah: number, riwaya: Riwaya) => void} openAt */
function bindBookmarkList(openAt) {
  const list = byId("bookmarkList", HTMLElement);
  list.addEventListener("click", async (e) => {
    const button = /** @type {Element} */ (e.target).closest("button");
    if (!(button instanceof HTMLButtonElement)) return;
    const surah = Number(button.dataset.surah);
    const ayah = Number(button.dataset.ayah);
    const riwaya = isRiwaya(button.dataset.riwaya)
      ? button.dataset.riwaya
      : "hafs";
    if (!surah || !ayah) return;
    if (button.classList.contains("q-bookmark-open")) {
      openAt(surah, ayah, riwaya);
      return;
    }
    const ok = await showConfirmDialog(
      t("quranRemoveBookmarkConfirm").replace(
        "{place}",
        ayahPlace(surah, ayah, riwaya),
      ),
      { confirmClass: "btn-danger" },
    );
    if (ok && isBookmarked(surah, ayah, riwaya))
      toggleBookmark(surah, ayah, riwaya);
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
