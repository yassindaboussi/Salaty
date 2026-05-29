// tooltip-init.js — standalone tooltip bootstrap for pages that don't load renderer.js
// Reads data-tooltip="key" → looks up translation → sets data-tip → shows floating div on hover
"use strict";

(function () {
  const {
    t,
    setLanguage,
    getLanguage,
  } = require("../../js/core/i18n/translations");
  const { state } = require("../../js/core/globalStore");
  const { ipcRenderer } = require("electron");

  // Apply language from saved settings so t() resolves correctly
  ipcRenderer
    .invoke("get-settings")
    .then((settings) => {
      if (settings?.language) setLanguage(settings.language);
      initTooltips();
    })
    .catch(() => initTooltips());

  function initTooltips() {
    // Resolve keys → data-tip
    document.querySelectorAll("[data-tooltip]").forEach((el) => {
      const key = el.getAttribute("data-tooltip");
      el.setAttribute("data-tip", t(key) || key);
    });

    // Create shared floating tooltip div
    const tip = document.createElement("div");
    tip.id = "appTooltip";
    tip.style.cssText = [
      "position:fixed",
      "z-index:99999",
      "pointer-events:none",
      "opacity:0",
      "transition:opacity 0.15s ease,transform 0.15s ease",
      "transform:translateX(-50%) scale(0.85)",
      "background:rgba(10,15,35,0.92)",
      "backdrop-filter:blur(8px)",
      "-webkit-backdrop-filter:blur(8px)",
      "color:#fff",
      "font-size:11px",
      "font-weight:600",
      "letter-spacing:0.03em",
      "white-space:nowrap",
      "padding:5px 10px",
      "border-radius:7px",
      "border:1px solid rgba(255,255,255,0.1)",
      "box-shadow:0 4px 16px rgba(0,0,0,0.4)",
    ].join(";");
    document.body.appendChild(tip);

    function show(el) {
      const text = el.getAttribute("data-tip");
      if (!text) return;
      tip.textContent = text;
      const r = el.getBoundingClientRect();
      tip.style.left = r.left + r.width / 2 + "px";
      tip.style.top = r.bottom + 8 + "px";
      tip.style.opacity = "1";
      tip.style.transform = "translateX(-50%) scale(1)";
    }
    function hide() {
      tip.style.opacity = "0";
      tip.style.transform = "translateX(-50%) scale(0.85)";
    }

    document.querySelectorAll("[data-tip]").forEach((el) => {
      el.addEventListener("mouseenter", () => show(el));
      el.addEventListener("mouseleave", hide);
      el.addEventListener("click", hide);
    });
  }
})();
