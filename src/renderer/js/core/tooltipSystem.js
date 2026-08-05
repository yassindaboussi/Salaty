"use strict";

const { ipcRenderer } = require("electron");
const { t } = require("./i18n/translations");

function resolveTooltipText(el) {
  const key = el.getAttribute("data-tooltip");
  if (!key) return null;
  return t(key) || key;
}

function applyTooltipText(el) {
  const text = resolveTooltipText(el);
  if (text == null) return;
  el.setAttribute("data-tip", text);
  if (!el.hasAttribute("aria-label") && !el.hasAttribute("aria-labelledby")) {
    el.setAttribute("aria-label", text);
  }
}

function refreshAllTooltipText() {
  document.querySelectorAll("[data-tooltip]").forEach(applyTooltipText);
}

let _initialized = false;

let _hideTooltipNow = () => {};

function initTooltipSystem() {
  refreshAllTooltipText();
  window.updateTooltips = refreshAllTooltipText;

  if (_initialized) return;
  _initialized = true;

  const tip = document.createElement("div");
  tip.id = "appTooltip";
  tip.setAttribute("role", "tooltip");
  Object.assign(tip.style, {
    position: "fixed",
    zIndex: "99999",
    pointerEvents: "none",
    opacity: "0",
    transition: "opacity 0.12s ease, transform 0.12s ease",
    transform: "translateX(-50%) scale(0.88)",
    background: "rgba(10,15,35,0.92)",
    backdropFilter: "blur(8px)",
    color: "#fff",
    fontSize: "11px",
    fontWeight: "600",
    letterSpacing: "0.03em",
    whiteSpace: "nowrap",
    padding: "5px 10px",
    borderRadius: "7px",
    border: "1px solid rgba(255,255,255,0.1)",
    boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
  });
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
  attach();
  new MutationObserver(attach).observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function hideTooltip() {
  _hideTooltipNow();
}

module.exports = { initTooltipSystem, refreshAllTooltipText, hideTooltip };
