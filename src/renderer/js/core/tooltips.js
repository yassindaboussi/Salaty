"use strict";

const { ipcRenderer } = require("electron");
const { t } = require("./i18n");

function resolveTooltipText(el) {
  const key = el.getAttribute("data-tooltip");
  if (!key) return null;
  return t(key);
}

// Puts the translated tooltip text on the element (data-tip, shown on hover). An element with
// no accessible name of its own also gets it as aria-label; data-tip-label marks those, so
// the name follows a language change too.
function applyTooltipText(el) {
  const text = resolveTooltipText(el);
  if (text == null) return;
  el.setAttribute("data-tip", text);
  const ownName =
    el.hasAttribute("aria-label") || el.hasAttribute("aria-labelledby");
  if (el.hasAttribute("data-tip-label") || !ownName) {
    el.setAttribute("aria-label", text);
    el.setAttribute("data-tip-label", "");
  }
}

function refreshAllTooltipText() {
  document.querySelectorAll("[data-tooltip]").forEach(applyTooltipText);
}

let _initialized = false;

// Binds hover/focus handlers to every element that has a data-tip. Defined inside
// initTooltipSystem; refreshTooltips calls it so elements that get a tooltip *after*
// they were added to the page (e.g. toggled on later) are bound too.
let _attachTips = () => {};

let _hideTooltipNow = () => {};

// Re-reads every data-tooltip key (e.g. after a language change) and binds new elements.
function refreshTooltips() {
  refreshAllTooltipText();
  _attachTips();
}

function initTooltipSystem() {
  refreshAllTooltipText();

  if (_initialized) return;
  _initialized = true;

  const tip = document.createElement("div");
  tip.id = "appTooltip";
  tip.className = "app-tooltip"; // look: css/03-components/tooltip.css
  tip.setAttribute("role", "tooltip");
  document.body.appendChild(tip);

  const show = (el) => {
    const text = el.getAttribute("data-tip");
    if (!text) return;
    tip.textContent = text;
    const r = el.getBoundingClientRect();
    tip.style.left = `${r.left + r.width / 2}px`;
    tip.style.top = `${r.bottom + 8}px`;
    tip.style.opacity = "1";
    tip.style.transform = "translateX(-50%) scale(1)";
  };
  const hide = () => {
    tip.style.opacity = "0";
    tip.style.transform = "translateX(-50%) scale(0.88)";
  };
  _hideTooltipNow = hide;

  // Force-hide on any loss of window focus/visibility (minimize,
  // switching to another app, etc.) — otherwise a tooltip that was
  // showing right before the window disappeared can get stuck visible
  // when it's restored. This is a well-documented Electron/Chromium
  // quirk (electron/electron#9943, chromium#724538): the window
  // vanishing doesn't send the browser a proper "mouse left" signal, so
  // the hover state can remain stuck until something forces it to
  // re-evaluate. Electron's own team fixed the equivalent issue for
  // native window-control tooltips the same way — hide on deactivation.
  window.addEventListener("blur", hide);
  ipcRenderer.on("force-hide-tooltip", hide);

  const attach = () => {
    document
      .querySelectorAll("[data-tip]:not([data-tip-bound])")
      .forEach((el) => {
        el.setAttribute("data-tip-bound", "1");
        el.addEventListener("mouseenter", () => show(el));
        el.addEventListener("mouseleave", hide);
        el.addEventListener("click", hide);
        el.addEventListener("focus", () => show(el));
        el.addEventListener("blur", hide);
      });
  };
  _attachTips = attach;
  attach();
  new MutationObserver(attach).observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function hideTooltip() {
  _hideTooltipNow();
}

module.exports = {
  initTooltipSystem,
  refreshTooltips,
  updateTooltip: applyTooltipText,
  hideTooltip,
};
