"use strict";

// The side panel's groups (after prayer, from the Sunnah, my dhikr): each header folds its list,
// like the Athkar page's categories. The header is a button with aria-expanded; which groups
// are folded is remembered (localStorage).
const { queryAll } = require("../../core/dom");

const KEY = "tasbihCollapsed";

/** @returns {Set<string>} */
function readFolded() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return new Set(Array.isArray(list) ? list : []);
  } catch {
    return new Set();
  }
}

/** @param {Set<string>} folded */
function saveFolded(folded) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...folded]));
  } catch {
    // storage unavailable: the choice lasts until the page closes
  }
}

const folded = readFolded();

/** @param {HTMLElement} group @param {boolean} open */
function show(group, open) {
  group.classList.toggle("is-collapsed", !open);
  group
    .querySelector(".tb-group-header")
    ?.setAttribute("aria-expanded", String(open));
}

/** @param {HTMLElement} group @param {boolean} open */
function setOpen(group, open) {
  show(group, open);
  const key = group.dataset.group ?? "";
  if (open) folded.delete(key);
  else folded.add(key);
  saveFolded(folded);
}

function bindGroups() {
  for (const group of queryAll(".tb-group", HTMLElement)) {
    show(group, !folded.has(group.dataset.group ?? ""));
    group
      .querySelector(".tb-group-header")
      ?.addEventListener("click", () =>
        setOpen(group, group.classList.contains("is-collapsed")),
      );
  }
  // the folding animates only after the first drawing (no movement while the page opens)
  requestAnimationFrame(() =>
    document.querySelector(".tb-panel")?.classList.add("is-ready"),
  );
}

/**
 * Opens a group (e.g. "mine" when a dhikr was just added to it).
 * @param {string} key
 */
function openGroup(key) {
  const group = document.querySelector(`.tb-group[data-group="${key}"]`);
  if (
    group instanceof HTMLElement &&
    group.classList.contains("is-collapsed")
  ) {
    setOpen(group, true);
  }
}

module.exports = { bindGroups, openGroup };
