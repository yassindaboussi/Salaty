"use strict";

// Counting: a click on a card's counter adds one (up to its number), undo takes one back, reset
// sets the open category to 0 (after asking). When a dhikr is done, the focus moves to the next
// one not done yet, so the whole category can be said with Space alone. Screen readers hear the
// progress at each dhikr done, not at every count.
const { t } = require("../../core/i18n");
const analytics = require("../../services/analytics");
const { showConfirmDialog } = require("../../components/confirm-dialog");
const {
  state,
  dhikrId,
  targetOf,
  countOf,
  saveCounts,
  progressOf,
  startNewDayIfNeeded,
} = require("./state");
const { renderList, renderHead, updateCard } = require("./list");
const { renderPanel } = require("./panel");
const { announce } = require("./feedback");
const { categoryLabel } = require("./categories");

/** @param {string} id */
const parse = (id) => {
  const cut = id.lastIndexOf("::");
  return { category: id.slice(0, cut), index: Number(id.slice(cut + 2)) };
};

function refresh() {
  renderHead();
  renderPanel();
}

// A new day while the page was open: everything starts again from 0 first.
function checkNewDay() {
  if (!startNewDayIfNeeded()) return false;
  renderPanel();
  renderList();
  return true;
}

/** @param {string} id */
function count(id) {
  if (checkNewDay()) return;
  const { category, index } = parse(id);
  const target = targetOf(state.data[category][index]);
  const now = countOf(id);
  if (target !== null && now >= target) return;
  state.counts[id] = now + 1;
  saveCounts();
  updateCard(id);
  refresh();
  if (target === null || now + 1 < target) return;

  const { done, total } = progressOf(category);
  if (done === total) {
    announce(`${categoryLabel(category)}: ${t("akAllDone")}`);
    analytics.athkarCategoryCompleted(category);
    return;
  }
  announce(
    t("akDoneOf")
      .replace("{done}", String(done))
      .replace("{total}", String(total)),
  );
  if (state.query.trim()) return; // in the search results, stay where the user is
  focusNextOpen(index);
}

/** @param {number} from  the card just done */
function focusNextOpen(from) {
  const items = state.data[state.category];
  const order = [...items.keys()]
    .filter((i) => i > from)
    .concat([...items.keys()].filter((i) => i < from));
  const next = order.find((i) => {
    const target = targetOf(items[i]);
    return target !== null && countOf(dhikrId(state.category, i)) < target;
  });
  if (next === undefined) return;
  const button = document.querySelector(
    `.ak-card[data-id="${CSS.escape(dhikrId(state.category, next))}"] .ak-count`,
  );
  if (!(button instanceof HTMLElement)) return;
  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  button.closest(".ak-card")?.scrollIntoView({
    block: "nearest",
    behavior: smooth ? "smooth" : "auto",
  });
  button.focus({ preventScroll: true });
}

/** @param {string} id */
function undo(id) {
  if (checkNewDay()) return;
  const now = countOf(id);
  if (now === 0) return;
  state.counts[id] = now - 1;
  saveCounts();
  updateCard(id);
  refresh();
}

async function resetCategory() {
  const sure = await showConfirmDialog(
    t("akResetConfirm").replace("{category}", categoryLabel(state.category)),
    { confirmText: t("akReset") },
  );
  if (!sure) return;
  (state.data[state.category] ?? []).forEach((_, i) => {
    delete state.counts[dhikrId(state.category, i)];
  });
  saveCounts();
  renderPanel();
  renderList();
}

module.exports = { count, undo, resetCategory, checkNewDay };
