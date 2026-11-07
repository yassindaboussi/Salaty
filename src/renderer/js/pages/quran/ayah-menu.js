"use strict";

// The menu of an ayah in the running text: its number ﴿n﴾ is a button that opens it under the
// number, with "Play from this ayah", "Bookmark" (or "Remove bookmark") and "Copy". A menu
// button pattern: the first item is focused, ↑ ↓ Home End move, Enter picks, Escape or a click
// elsewhere closes and focus goes back to the number.
const { t } = require("../../core/i18n");
const { html, setHtml } = require("../../utils/html");
const { state, fmt } = require("./state");
const { isBookmarked } = require("./bookmarks");

/** @typedef {{ play: (ayah: number) => void, bookmark: (ayah: number) => void, copy: (ayah: number) => void }} AyahActions */

/** @type {HTMLElement | null} */
let menu = null;
/** @type {HTMLButtonElement | null} */
let opener = null;

/** @param {boolean} [refocus]  focus back on the number (not when the click went elsewhere) */
function closeAyahMenu(refocus = false) {
  if (!menu) return;
  menu.remove();
  menu = null;
  opener?.setAttribute("aria-expanded", "false");
  if (refocus) opener?.focus();
  opener = null;
}

const items = () =>
  menu
    ? [
        ...menu.querySelectorAll(
          "[role='menuitem']:not([aria-disabled='true'])",
        ),
      ]
    : [];

/** @param {number} step */
function moveFocus(step) {
  const list = items();
  const at = list.indexOf(/** @type {Element} */ (document.activeElement));
  const next = list[(at + step + list.length) % list.length];
  if (next instanceof HTMLElement) next.focus();
}

/** @param {HTMLButtonElement} button  the ayah's number @param {AyahActions} actions */
function openAyahMenu(button, actions) {
  // its number again: closes it (a toggle, like other menu buttons)
  if (menu && opener === button) {
    closeAyahMenu(true);
    return;
  }
  closeAyahMenu();
  const ayah = Number(button.dataset.ayah);
  const marked = isBookmarked(state.currentSurah?.n ?? 0, ayah);
  const offline = !navigator.onLine;
  const el = document.createElement("div");
  el.className = "q-ayah-menu";
  el.setAttribute("role", "menu");
  el.setAttribute(
    "aria-label",
    t("quranAyahActions").replace("{n}", fmt(ayah)),
  );
  setHtml(
    el,
    html`<button type="button" role="menuitem" data-do="play" aria-disabled="${String(offline)}" data-tip="${offline ? t("quranListenOffline") : ""}"><i class="fas fa-play" aria-hidden="true"></i><span>${t("quranPlayFromHere")}</span></button>
      <button type="button" role="menuitem" data-do="bookmark"><i class="${marked ? "fas" : "far"} fa-bookmark" aria-hidden="true"></i><span>${t(marked ? "quranRemoveBookmark" : "quranAddBookmark")}</span></button>
      <button type="button" role="menuitem" data-do="copy"><i class="far fa-copy" aria-hidden="true"></i><span>${t("quranCopyAyah")}</span></button>`,
  );
  el.addEventListener("click", (e) => {
    const item = /** @type {Element} */ (e.target).closest("[data-do]");
    if (
      !(item instanceof HTMLElement) ||
      item.getAttribute("aria-disabled") === "true"
    )
      return;
    closeAyahMenu(true);
    const what = /** @type {keyof AyahActions} */ (item.dataset.do);
    actions[what](ayah);
  });
  el.addEventListener("keydown", (e) => {
    const step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (step) moveFocus(step);
    else if (e.key === "Home" || e.key === "End") {
      const list = items();
      const target = e.key === "Home" ? list[0] : list.at(-1);
      if (target instanceof HTMLElement) target.focus();
    } else if (e.key === "Escape" || e.key === "Tab")
      closeAyahMenu(e.key === "Escape");
    else return;
    e.preventDefault();
    e.stopPropagation();
  });
  document.body.append(el);
  menu = el;
  opener = button;
  button.setAttribute("aria-expanded", "true");

  // under the number (above it when there is no room), inside the window
  const r = button.getBoundingClientRect();
  const { offsetWidth: w, offsetHeight: h } = el;
  const below = r.bottom + 6 + h <= window.innerHeight - 6;
  const left = r.left + r.width / 2 - w / 2;
  el.style.left = `${Math.max(6, Math.min(left, window.innerWidth - w - 6))}px`;
  el.style.top = `${below ? r.bottom + 6 : Math.max(6, r.top - h - 6)}px`;
  const first = items()[0];
  if (first instanceof HTMLElement) first.focus();
}

function bindAyahMenu() {
  document.addEventListener("mousedown", (e) => {
    if (!menu || !(e.target instanceof Node)) return;
    // the number itself toggles it on click
    if (!menu.contains(e.target) && !opener?.contains(e.target))
      closeAyahMenu();
  });
  document
    .getElementById("readerContent")
    // scrolling by hand (the text also scrolls by itself while following the recitation)
    ?.addEventListener("wheel", () => closeAyahMenu(), { passive: true });
  window.addEventListener("blur", () => closeAyahMenu());
  window.addEventListener("resize", () => closeAyahMenu());
}

module.exports = { openAyahMenu, closeAyahMenu, bindAyahMenu };
