"use strict";

// The tasbih (dhikr counter) page. Its parts:
//   counter.js   counting, undo, reset, "no limit", the after-prayer tasbih, the keys
//   ring.js      the counter: count, target, round, progress ring, limit chip
//   active.js    the words being counted, their meaning and source, the after-prayer steps
//   list.js      the after-prayer tasbih, the dhikr of the Sunnah, the user's own
//   groups.js    the side panel's groups, folded or open
//   panel-fold.js  the whole side panel folded to a strip of icons
//   editor.js    adding / editing / deleting the user's own dhikr
//   texts.js     meanings, sources, hadith links
//   feedback.js  toasts and screen-reader announcements
//   storage.js   everything saved (localStorage)
//   state.js     the dhikr of the Sunnah (data/tasbih.json) and what is counted now
// Everything is on this computer, so there is nothing to reload when the connection returns.
const { ipcRenderer } = require("electron");
const { t } = require("../../core/i18n");
const { byId } = require("../../core/dom");
const { pageState } = require("./state");
const storage = require("./storage");
const counter = require("./counter");
const { updateCounterDisplay } = require("./ring");
const { renderActive } = require("./active");
const { renderLists, updateListCounts } = require("./list");
const { openEditor, bindEditor, removeDhikr } = require("./editor");
const { bindGroups, openGroup } = require("./groups");
const { bindPanelFold } = require("./panel-fold");

function initTasbihPage() {
  storage.loadState();
  counter.setOnChange(() => {
    updateListCounts();
  });
  // a saved dhikr is in "My dhikr": open it so the user sees it
  bindEditor(() => {
    openGroup("mine");
    drawAll();
  });
  bindGroups();
  bindPanelFold();
  bindControls();
  counter.bindKeys();
  showQuote();
  drawAll();
}

function drawAll() {
  renderActive();
  updateCounterDisplay();
  renderLists();
}

function bindControls() {
  byId("tbRingTap", HTMLButtonElement).addEventListener(
    "click",
    counter.increment,
  );
  byId("undoBtn", HTMLButtonElement).addEventListener("click", counter.undo);
  byId("resetBtn", HTMLButtonElement).addEventListener("click", counter.reset);
  byId("tbLimitChip", HTMLButtonElement).addEventListener(
    "click",
    counter.toggleUnlimited,
  );
  byId("tbAddBtn", HTMLButtonElement).addEventListener("click", () =>
    openEditor(null),
  );

  byId("tbLayout", HTMLElement).addEventListener("click", (e) => {
    const target = /** @type {Element} */ (e.target);
    const source = target.closest("[data-source]");
    if (source instanceof HTMLElement && source.dataset.source) {
      ipcRenderer.invoke("open-external", source.dataset.source);
      return;
    }
    const button = target.closest("[data-action]");
    if (!(button instanceof HTMLButtonElement)) return;
    const { action, id } = button.dataset;
    if (action === "choose" && id) {
      counter.choose(id);
      renderLists();
      byId("tbRingTap", HTMLButtonElement).focus(); // ready to count with Space
    } else if (action === "edit" && id) {
      openEditor(id);
    } else if (action === "delete" && id) {
      // once deleted, its row is gone: the focus goes to "Add your own dhikr"
      removeDhikr(id).then(() => {
        if (!document.querySelector(`[data-id="${id}"]`)) {
          byId("tbAddBtn", HTMLButtonElement).focus();
        }
      });
    } else if (action === "sequence-start") {
      if (!pageState.sequence) counter.startSequence();
      renderLists();
      byId("tbRingTap", HTMLButtonElement).focus();
    } else if (action === "sequence-again") {
      counter.startSequence();
      renderLists();
    } else if (action === "sequence-stop") {
      counter.stopSequence();
      renderLists();
    }
  });
}

// one of the remembrance quotes (locales/<lang>/worship/tasbih.json), picked at random
function showQuote() {
  const quotes = t("footerQuotes");
  const el = document.getElementById("tasbihFooterText");
  if (el && Array.isArray(quotes)) {
    el.textContent = quotes[Math.floor(Math.random() * quotes.length)];
  }
}

module.exports = { initTasbihPage };
