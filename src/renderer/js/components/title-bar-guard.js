"use strict";

// Keeps every page's title bar draggable when the page is scrolled.
//
// The window is dragged by the title bar (.page-header: -webkit-app-region: drag). Chromium
// builds the window's drag / no-drag areas from every painted element's whole box, not cut to
// the scroll box it sits in, and the area that comes later in the page wins. Scrolled content
// (no-drag, so it stays clickable) slides up under the title bar out of sight, and its boxes
// still cover it: scrolled down, the window can't be moved (measured: Settings, 0 of 11 points
// of the title bar dragged once scrolled).
//
// So after the page's content comes a second, invisible drag area over the title bar, with
// holes where the title bar's own buttons are (found by their no-drag style). Coming later, it
// wins over the scrolled content; dialogs and banners, added later still, win over it. It is
// hidden from screen readers and lets clicks through (pointer-events: none): the real title
// bar under it does the rest. Kept on the title bar's box as the window resizes.

/** @param {Element} el */
const isNoDrag = (el) =>
  getComputedStyle(el).getPropertyValue("-webkit-app-region") === "no-drag";

/**
 * The title bar's no-drag parts (buttons, a search box…): the outermost ones only.
 * @param {HTMLElement} header
 */
function holesOf(header) {
  /** @type {Element[]} */
  const found = [];
  /** @param {Element} parent */
  const walk = (parent) => {
    for (const child of parent.children) {
      if (isNoDrag(child)) found.push(child);
      else walk(child);
    }
  };
  walk(header);
  return found;
}

/** @param {HTMLElement} header */
function guard(header) {
  const layer = document.createElement("div");
  layer.className = "title-bar-guard";
  layer.setAttribute("aria-hidden", "true");
  header.parentElement?.append(layer); // after the page's content

  const place = () => {
    const box = header.getBoundingClientRect();
    const hidden = box.width === 0 || box.height === 0;
    layer.hidden = hidden;
    if (hidden) return;
    Object.assign(layer.style, {
      left: `${box.left}px`,
      top: `${box.top}px`,
      width: `${box.width}px`,
      height: `${box.height}px`,
    });
    layer.replaceChildren(
      ...holesOf(header).map((el) => {
        const r = el.getBoundingClientRect();
        const hole = document.createElement("div");
        hole.className = "title-bar-guard__hole";
        Object.assign(hole.style, {
          left: `${r.left - box.left}px`,
          top: `${r.top - box.top}px`,
          width: `${r.width}px`,
          height: `${r.height}px`,
        });
        return hole;
      }),
    );
  };

  let queued = false;
  const update = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      place();
    });
  };
  new ResizeObserver(update).observe(header);
  // buttons shown / hidden, the language (RTL) or a class changed
  new MutationObserver(update).observe(header, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["class", "hidden", "style", "dir"],
  });
  new MutationObserver(update).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["dir", "class"],
  });
  window.addEventListener("resize", update);
  update();
}

/** Every title bar of the page (after renderPageHeaders: its buttons exist). */
function guardTitleBars() {
  document.querySelectorAll(".page-header").forEach((header) => {
    if (header instanceof HTMLElement) guard(header);
  });
}

module.exports = { guardTitleBars };
