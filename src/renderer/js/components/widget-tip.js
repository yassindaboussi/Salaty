"use strict";

// Tooltips for the widget's buttons. The bar is only 48px high, so a tip above or below
// would be cut off by the window edge: it goes beside the button, inside the bar.

const { t } = require("../core/i18n");
const { byId } = require("../core/dom");

const GAP = 8;
const PAD = 4;

/** Gives every [data-tooltip] button its text, aria-label and a hover/focus tip. */
function initWidgetTips() {
  const tip = byId("widgetTip", HTMLElement);

  const show = (/** @type {HTMLElement} */ el) => {
    const text = el.getAttribute("aria-label");
    if (!text) return;
    tip.textContent = text;
    const r = el.getBoundingClientRect();
    const w = tip.offsetWidth;
    const rtl = document.documentElement.dir === "rtl";
    const before = r.left - w - GAP;
    const after = r.right + GAP;
    let x = rtl ? after : before;
    if (x < PAD) x = after;
    if (x + w > window.innerWidth - PAD) x = Math.max(PAD, before);
    tip.style.left = `${x}px`;
    tip.classList.add("is-visible");
  };
  const hide = () => tip.classList.remove("is-visible");

  document.querySelectorAll("[data-tooltip]").forEach((node) => {
    const el = /** @type {HTMLElement} */ (node);
    el.setAttribute("aria-label", t(el.dataset.tooltip ?? ""));
    el.addEventListener("mouseenter", () => show(el));
    el.addEventListener("focus", () => show(el));
    el.addEventListener("mouseleave", hide);
    el.addEventListener("blur", hide);
    el.addEventListener("click", hide);
  });
}

module.exports = { initWidgetTips };
