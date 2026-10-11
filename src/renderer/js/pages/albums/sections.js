"use strict";

// The three collapsible sections (recitations, Tadabor, Tafsir) and the section remembered for
// the next visit (localStorage "archiveState").
/** @typedef {import("./index").AlbumsPage} AlbumsPage */

/** @param {AlbumsPage} page */
function activateGroup(page, groupEl, headerEl) {
  [page.reciteGroup, page.tafsirGroup, page.tadaborGroup].forEach((g) => {
    g?.classList.remove("expanded", "content-visible");
  });
  [
    page.reciteGroupHeader,
    page.tafsirGroupHeader,
    page.tadaborGroupHeader,
  ].forEach((h) => {
    h?.setAttribute("aria-expanded", "false");
  });

  groupEl.classList.add("expanded");
  headerEl.setAttribute("aria-expanded", "true");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      groupEl.classList.add("content-visible");
    });
  });
}

/** @param {AlbumsPage} page */
function toggleGroup(page, groupEl, headerEl, onFirstExpand) {
  const alreadyExpanded = groupEl.classList.contains("expanded");
  if (alreadyExpanded) {
    groupEl.classList.remove("expanded", "content-visible");
    headerEl.setAttribute("aria-expanded", "false");
    return;
  }
  page.activateGroup(groupEl, headerEl);
  onFirstExpand();
}

/** @param {AlbumsPage} page */
function saveArchiveState(page, state) {
  try {
    localStorage.setItem("archiveState", JSON.stringify(state));
  } catch {}
}

/** @param {AlbumsPage} page */
async function restoreArchiveState(page) {
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem("archiveState") || "null");
  } catch {
    saved = null;
  }

  if (!saved || !saved.group) {
    if (page.reciteGroup) {
      page.activateGroup(page.reciteGroup, page.reciteGroupHeader);
      await page.ensureRecitersLoaded();
    }
    return;
  }

  if (saved.group === "recite" && page.reciteGroup) {
    page.activateGroup(page.reciteGroup, page.reciteGroupHeader);
    await page.ensureRecitersLoaded();
  } else if (saved.group === "tadabor" && page.tadaborGroup) {
    page.activateGroup(page.tadaborGroup, page.tadaborGroupHeader);
    await page.ensureTadaborLoaded();
  } else if (saved.group === "tafsir" && page.tafsirGroup) {
    page.activateGroup(page.tafsirGroup, page.tafsirGroupHeader);
    await page.ensureTafsirBooksLoaded();
    if (saved.tafsirBookId != null) {
      const book = (page.tafsirBooks || []).find(
        (b) => String(b.id) === String(saved.tafsirBookId),
      );
      if (book) await page.openTafsirBook(book);
    }
  }
}

module.exports = {
  activateGroup,
  toggleGroup,
  saveArchiveState,
  restoreArchiveState,
};
