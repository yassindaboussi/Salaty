"use strict";

// Selecting Quran text in the reader shows a small bar just above the selection (below it when
// there is no room): "Copy" and "Copy with reference" (adds "(Al-Maida 5:1–3)"). Ctrl+C and a
// right-click on the selection do the same. The copied text is clean: an ayah's number becomes
// ﴿١﴾ (as in printed Quran quotes) and the card labels and icons are left out. The bar keeps the
// selection while used, and closes on scroll, Escape, a click elsewhere or after copying.
const { t } = require("../../core/i18n");
const { byId } = require("../../core/dom");
const { html, setHtml } = require("../../utils/html");
const { formatNumerals } = require("../../utils/numerals");
const {
  state,
  fmt,
  surahMeta,
  surahName,
  sep,
  riwayaName,
} = require("./state");

/** @type {HTMLElement | null} */
let bar = null;

/** The selection when it is inside the reader's text, else null. @param {HTMLElement} content */
function readerSelection(content) {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  if (!content.contains(range.commonAncestorContainer)) return null;
  return range;
}

/** The ayah a point of the selection is in. @param {Node} node */
function ayahOf(node) {
  const el = node instanceof Element ? node : node.parentElement;
  const ayah = el?.closest("[data-ayah]");
  return ayah instanceof HTMLElement ? Number(ayah.dataset.ayah) : 0;
}

/** The selected text, clean. @param {Range} range */
function cleanText(range) {
  const box = document.createElement("div");
  box.append(range.cloneContents());
  for (const el of box.querySelectorAll(".ayah-card-head")) el.remove();
  // the page's own line breaks are not the text's: one space, then the lines added below
  const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    n.textContent = (n.textContent ?? "").replace(/\s+/g, " ");
  }
  // one line per Arabic text and translation, a blank line between the ayah cards
  for (const el of box.querySelectorAll(".ayah-card-ar, .ayah-card-tr")) {
    el.append("\n");
  }
  for (const el of box.querySelectorAll(".ayah-end")) {
    const n = Number(/** @type {HTMLElement} */ (el).dataset.ayah);
    el.replaceWith(`﴿${formatNumerals(n, state.numerals)}﴾`);
  }
  for (const el of box.querySelectorAll(".ayah-card")) el.append("\n");
  return (box.textContent ?? "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** "(Al-Maida 5:1–3)" for the selected ayahs. @param {Range} range */
function reference(range) {
  const meta = state.currentSurah && surahMeta(state.currentSurah.n);
  if (!meta) return "";
  const a = ayahOf(range.startContainer) || 1;
  const b = ayahOf(range.endContainer) || a;
  const [from, to] = a <= b ? [a, b] : [b, a];
  const ayahs = from === to ? fmt(from) : `${fmt(from)}–${fmt(to)}`;
  const riwaya =
    state.riwaya === "hafs" ? "" : `${sep()}${riwayaName(state.riwaya)}`;
  return `(${surahName(meta)} ${fmt(meta.n)}:${ayahs}${riwaya})`;
}

function closeBar() {
  bar?.remove();
  bar = null;
}

/**
 * @param {Range} range
 * @param {(text: string) => void} copy
 * @param {{ x: number, y: number }} [at]  a right-click point, else above the selection
 */
function openBar(range, copy, at) {
  closeBar();
  const el = document.createElement("div");
  el.className = "q-selection-bar";
  el.setAttribute("role", "toolbar");
  el.setAttribute("aria-label", t("copy"));
  setHtml(
    el,
    html`<button type="button" data-copy="plain"><i class="far fa-copy" aria-hidden="true"></i><span>${t("copy")}</span></button>
      <span class="q-selection-sep" aria-hidden="true"></span>
      <button type="button" data-copy="ref"><i class="fas fa-quote-right" aria-hidden="true"></i><span>${t("quranCopyWithRef")}</span></button>`,
  );
  el.addEventListener("mousedown", (e) => e.preventDefault()); // keeps the selection
  el.addEventListener("click", (e) => {
    const button = /** @type {Element} */ (e.target).closest("[data-copy]");
    if (!(button instanceof HTMLButtonElement)) return;
    const text = cleanText(range);
    copy(button.dataset.copy === "ref" ? `${text}\n${reference(range)}` : text);
    window.getSelection()?.removeAllRanges();
    closeBar();
  });
  document.body.append(el);

  // above the selection (or the click), centred; below when there is no room; inside the window
  const rect = at
    ? new DOMRect(at.x, at.y, 0, 0)
    : range.getBoundingClientRect();
  const { offsetWidth: w, offsetHeight: h } = el;
  const above = rect.top - h - 10 >= 4;
  el.classList.toggle("is-below", !above);
  const left = rect.left + rect.width / 2 - w / 2;
  el.style.left = `${Math.max(6, Math.min(left, window.innerWidth - w - 6))}px`;
  el.style.top = `${above ? rect.top - h - 10 : Math.min(rect.bottom + 10, window.innerHeight - h - 6)}px`;
  bar = el;
}

/** @param {(text: string) => void} copy  writes to the clipboard and tells the user */
function bindSelectionBar(copy) {
  const content = byId("readerContent", HTMLElement);

  const showSoon = () =>
    setTimeout(() => {
      const range = readerSelection(content);
      if (range) openBar(range, copy);
      else closeBar();
    });
  content.addEventListener("mouseup", showSoon);
  content.addEventListener("keyup", (e) => {
    if (e.shiftKey) showSoon(); // selected with the keyboard
  });
  content.addEventListener("contextmenu", (e) => {
    const range = readerSelection(content);
    if (!range) return;
    e.preventDefault();
    openBar(range, copy, { x: e.clientX, y: e.clientY });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeBar();
    const isCopy =
      (e.ctrlKey || e.metaKey) &&
      !e.shiftKey &&
      !e.altKey &&
      e.key.toLowerCase() === "c";
    if (!isCopy) return;
    const range = readerSelection(content);
    if (!range) return;
    e.preventDefault();
    copy(cleanText(range));
    closeBar();
  });
  document.addEventListener("mousedown", (e) => {
    if (bar && !(e.target instanceof Node && bar.contains(e.target)))
      closeBar();
  });
  document.addEventListener("selectionchange", () => {
    if (bar && !readerSelection(content)) closeBar();
  });
  content.addEventListener("scroll", closeBar, { passive: true });
  window.addEventListener("blur", closeBar);
  window.addEventListener("resize", closeBar);
}

module.exports = { bindSelectionBar, cleanText };
