"use strict";

// Keeps the reader's title (surah name + its line) centred over the text, like the
// Bismillah under it, not over the whole window: the display panel beside the text (open, folded
// to a strip, or under it in a narrow window) changes where that centre is. The header centres
// the title on the full width (quran.css); this moves it by the difference, measured again
// whenever the column or the header changes size (panel folded, window resized or maximized).
const { byId } = require("../../core/dom");

function alignTitle() {
  const info = byId("readerSurahName", HTMLElement).parentElement;
  const header = info?.parentElement;
  const text = byId("readerContent", HTMLElement);
  if (!info || !header) return;
  const h = header.getBoundingClientRect();
  const c = text.getBoundingClientRect();
  if (!h.width || !c.width) return; // the reader is hidden
  // the text's own box: without the scrollbar, which takes room on one side only
  const centre = c.left + text.clientLeft + text.clientWidth / 2;
  const shift = centre - (h.left + h.width / 2);
  info.style.setProperty("--title-shift", `${Math.round(shift)}px`);
}

function bindTitleAlign() {
  const observer = new ResizeObserver(alignTitle);
  observer.observe(byId("readerContent", HTMLElement));
  observer.observe(byId("viewSurahReader", HTMLElement));
}

module.exports = { alignTitle, bindTitleAlign };
