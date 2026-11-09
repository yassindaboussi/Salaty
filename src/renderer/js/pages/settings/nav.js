"use strict";

// The side menu: one category of settings is shown at a time, like the Windows Settings app.
// The last one opened is remembered (localStorage). The menu and the folded strip of icons
// open the same categories; ↑ / ↓ / Home / End move between the menu items.
const { queryAll } = require("../../core/dom");

const KEY = "settingsPane";
const DEFAULT_PANE = "prayer";

const panes = () => queryAll(".st-pane", HTMLElement);
const navButtons = () =>
  queryAll(".st-nav-item, .st-rail-btn[data-pane]", HTMLButtonElement);

/** @param {string} key */
const isPane = (key) => panes().some((pane) => pane.dataset.pane === key);

function savedPane() {
  try {
    const key = localStorage.getItem(KEY);
    if (key && isPane(key)) return key;
  } catch {
    // storage unavailable: the first category
  }
  return DEFAULT_PANE;
}

let current = DEFAULT_PANE;

/** Marks the open category in the menu ("" while a search shows all of them).
 * @param {string} key */
function markCurrent(key) {
  navButtons().forEach((button) => {
    if (button.dataset.pane === key)
      button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
}

/** @param {string} key */
function showPane(key) {
  if (!isPane(key)) return;
  current = key;
  panes().forEach((pane) => {
    pane.hidden = pane.dataset.pane !== key;
  });
  markCurrent(key);
  const main = document.getElementById("stMain");
  if (main) main.scrollTop = 0;
  try {
    localStorage.setItem(KEY, key);
  } catch {
    // storage unavailable: the choice lasts until the page closes
  }
}

const currentPane = () => current;

/** @param {KeyboardEvent} e */
function moveFocus(e) {
  const items = queryAll(".st-nav-item", HTMLButtonElement);
  const at = items.indexOf(/** @type {HTMLButtonElement} */ (e.target));
  if (at < 0) return;
  /** @type {Record<string, number>} */
  const next = {
    ArrowDown: (at + 1) % items.length,
    ArrowUp: (at - 1 + items.length) % items.length,
    Home: 0,
    End: items.length - 1,
  };
  if (!(e.key in next)) return;
  e.preventDefault();
  items[next[e.key]].focus();
}

/** @param {() => void} beforeOpen  called before a category is opened from the menu */
function initPaneNav(beforeOpen) {
  // the tray's "Check for updates" opens this page on the About category
  showPane(window.location.hash === "#check-updates" ? "about" : savedPane());

  queryAll(".st-nav-item", HTMLButtonElement).forEach((button) => {
    button.addEventListener("click", () => {
      beforeOpen();
      showPane(/** @type {string} */ (button.dataset.pane));
    });
  });
  document.getElementById("stNav")?.addEventListener("keydown", moveFocus);
}

module.exports = { initPaneNav, showPane, currentPane, markCurrent };
