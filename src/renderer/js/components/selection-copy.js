"use strict";

const { t } = require("../core/i18n");
const { query } = require("../core/dom");

// The application menu is removed (Menu.setApplicationMenu(null)), so there is no Edit
// menu and no default right-click menu. This module restores "copy the selected text"
// for a list of cards in a way that behaves the same on every platform:
//   - Ctrl/Cmd+C copies the current selection
//   - right-clicking a selection shows a small "Copy" popup
// Which text can be selected is decided by each page's CSS (user-select: text).

/** @type {HTMLElement | null} */
let menuEl = null;
let globalBound = false;
/** @type {((text: string) => void) | null} */
let onCopyHandler = null;

function selectedText() {
  const sel = window.getSelection();
  return sel ? sel.toString().trim() : "";
}

function closeMenu() {
  if (menuEl) {
    menuEl.remove();
    menuEl = null;
  }
}

function openMenu(x, y, text) {
  closeMenu();
  const menu = document.createElement("div");
  menu.className = "selection-copy-menu";
  menu.setAttribute("role", "menu");
  menu.innerHTML = `<button type="button" role="menuitem"><i class="fas fa-copy" aria-hidden="true"></i>${t("copy")}</button>`;
  // Keep the text selected while the menu is used.
  menu.addEventListener("mousedown", (e) => e.preventDefault());
  query("button", HTMLButtonElement, menu).addEventListener("click", () => {
    onCopyHandler?.(text);
    closeMenu();
  });
  document.body.appendChild(menu);

  // Keep the popup fully inside the window.
  const { offsetWidth: w, offsetHeight: h } = menu;
  menu.style.left = `${Math.max(4, Math.min(x, window.innerWidth - w - 4))}px`;
  menu.style.top = `${Math.max(4, Math.min(y, window.innerHeight - h - 4))}px`;
  menuEl = menu;
}

function bindGlobal() {
  if (globalBound) return;
  globalBound = true;

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
    const isCopy =
      (e.ctrlKey || e.metaKey) &&
      !e.shiftKey &&
      !e.altKey &&
      e.key.toLowerCase() === "c";
    // Inputs (e.g. a search box) keep their native copy behaviour.
    const inInput =
      e.target instanceof Element && e.target.closest("input, textarea");
    if (!isCopy || inInput) return;
    const text = selectedText();
    if (!text) return;
    e.preventDefault();
    onCopyHandler?.(text);
  });

  document.addEventListener("mousedown", (e) => {
    if (menuEl && !(e.target instanceof Node && menuEl.contains(e.target)))
      closeMenu();
  });
  window.addEventListener("blur", closeMenu);
  window.addEventListener("resize", closeMenu);
  // Scroll events don't bubble; capture them so any scrolling container closes the popup.
  document.addEventListener("scroll", closeMenu, true);
}

/**
 * @param {HTMLElement|null} listEl  scroll container holding the cards
 * @param {(text: string) => void} onCopy  writes the text to the clipboard and gives feedback
 */
function initSelectionCopy(listEl, onCopy) {
  onCopyHandler = onCopy;
  bindGlobal();

  if (!listEl || listEl.dataset.selectionCopyBound) return;
  listEl.dataset.selectionCopyBound = "1";
  listEl.addEventListener("contextmenu", (e) => {
    const text = selectedText();
    if (!text) {
      closeMenu();
      return;
    }
    e.preventDefault();
    openMenu(e.clientX, e.clientY, text);
  });
}

module.exports = { initSelectionCopy };
