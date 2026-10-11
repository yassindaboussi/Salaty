"use strict";

// The collapsible category sidebar: on wide windows it folds into an icon rail (the choice is
// remembered); in the rail every chip/icon gets a tooltip with its name.
const { t } = require("../../core/i18n");
const { refreshTooltips } = require("../../core/tooltips");
const { queryAll } = require("../../core/dom");
const { state } = require("./state");

const SIDEBAR_KEY = "athkarSidebarCollapsed";
const wideScreen = window.matchMedia("(min-width: 769px)");

function loadSidebarPref() {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === "1";
  } catch {
    return false;
  }
}

function saveSidebarPref(collapsed) {
  try {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
  } catch {
    /* storage unavailable: the choice just won't be remembered */
  }
}

// In the rail the names are hidden, so give every chip/icon a hover tooltip with its name.
// In the expanded view the names are visible, so the tooltip is removed to avoid noise.
function syncRailTooltips() {
  const rail = state.sidebarCollapsed && wideScreen.matches;
  queryAll("#categoryNav [data-tip-name]", HTMLElement).forEach((el) => {
    if (rail) el.setAttribute("data-tooltip", String(el.dataset.tipName));
    else {
      el.removeAttribute("data-tooltip");
      el.removeAttribute("data-tip");
    }
  });
  if (rail) refreshTooltips();
}

function applySidebarState() {
  const body = document.querySelector(".athkar-body");
  const btn = document.getElementById("sidebarToggleBtn");
  if (!body) return;
  // The narrow-window layout already turns the sidebar into a horizontal strip.
  body.classList.toggle(
    "sidebar-collapsed",
    state.sidebarCollapsed && wideScreen.matches,
  );
  if (btn) {
    const key = state.sidebarCollapsed
      ? "tooltipExpandSidebar"
      : "tooltipCollapseSidebar";
    btn.classList.toggle("is-collapsed", state.sidebarCollapsed);
    btn.setAttribute("data-tooltip", key);
    btn.setAttribute("aria-label", t(key));
    btn.setAttribute("aria-pressed", String(state.sidebarCollapsed));
    btn.style.display = wideScreen.matches ? "" : "none";
    refreshTooltips();
  }
  syncRailTooltips();
}

function setSidebarCollapsed(collapsed) {
  state.sidebarCollapsed = collapsed;
  saveSidebarPref(collapsed);
  applySidebarState();
}

module.exports = {
  wideScreen,
  loadSidebarPref,
  syncRailTooltips,
  applySidebarState,
  setSidebarCollapsed,
};
