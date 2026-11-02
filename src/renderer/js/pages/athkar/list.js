"use strict";

// The main column: the chosen category (its name, how many are done, a progress bar, reset) and
// its athkar, one card each: the Arabic text, its note in the app language, the reference, copy,
// undo and the counter ("count / target"; a tick once done). While searching, the
// matches from every category instead, each with its category's name.
const { t, getLanguage } = require("../../core/i18n");
const { byId } = require("../../core/dom");
const { html, setHtml } = require("../../utils/html");
const { normalizeForSearch } = require("../../utils/search-text");
const { state, dhikrId, targetOf, countOf, progressOf } = require("./state");
const { categoryLabel, categoryIcon } = require("./categories");
const { referenceHtml } = require("./references");

/** @param {import("./state").Dhikr} item  the note and reference in the app language */
function localized(item, field) {
  const lang = getLanguage();
  return (lang !== "ar" && item[`${field}_${lang}`]) || item[field] || "";
}

/** What a counter shows. @param {string} id @param {number | null} target */
function counterView(id, target) {
  const count = countOf(id);
  const done = target !== null && count >= target;
  return {
    done,
    label: (target === null ? t("akCountFree") : t("akCountLabel"))
      .replace("{count}", String(count))
      .replace("{target}", String(target)),
    inner: done
      ? html`<i class="fas fa-check"></i>`
      : target === null
        ? html`${count}`
        : html`${count}/${target}`,
  };
}

/** @param {string} id @param {number | null} target */
function counterHtml(id, target) {
  const v = counterView(id, target);
  return html`<button type="button" class="ak-count" data-action="count" data-id="${id}" aria-label="${v.label}" ${v.done ? "aria-disabled=true" : ""}><span class="ak-count-text" aria-hidden="true">${v.inner}</span></button>`;
}

/** @param {string} category @param {number} index @param {boolean} withCategory */
function cardHtml(category, index, withCategory) {
  const item = state.data[category][index];
  const id = dhikrId(category, index);
  const target = targetOf(item);
  const count = countOf(id);
  const done = target !== null && count >= target;
  const note = localized(item, "description");
  const reference = referenceHtml(item);
  return html`<article class="ak-card${done ? " is-done" : ""}" data-id="${id}">
    ${withCategory ? html`<p class="ak-card-category"><i class="fas ${categoryIcon(category)}" aria-hidden="true"></i> ${categoryLabel(category)}</p>` : ""}
    <p class="ak-text" lang="ar" dir="rtl">${item.content}</p>
    ${note ? html`<p class="ak-note" dir="auto">${note}</p>` : ""}
    <div class="ak-card-foot">
      <p class="ak-ref">${item.grade ? html`<span class="ak-grade">${t(`grade_${item.grade}`)}</span>` : ""}${reference ? html`<bdi>${reference}</bdi>` : ""}</p>
      <button type="button" class="ak-icon-btn" data-action="copy" data-id="${id}" data-tip="${t("copy")}" aria-label="${t("copy")}"><i class="fas fa-copy" aria-hidden="true"></i></button>
      <button type="button" class="ak-icon-btn" data-action="undo" data-id="${id}" data-tip="${t("akUndo")}" aria-label="${t("akUndo")}" ${count ? "" : "hidden"}><i class="fas fa-rotate-left" aria-hidden="true"></i></button>
      ${counterHtml(id, target)}
    </div>
  </article>`;
}

/** @returns {{ category: string, index: number }[]} the athkar matching the search */
function matches() {
  const query = normalizeForSearch(state.query);
  const found = [];
  for (const [category, items] of Object.entries(state.data)) {
    const label = normalizeForSearch(categoryLabel(category));
    items.forEach((item, index) => {
      const text = normalizeForSearch(
        `${item.content} ${localized(item, "description")}`,
      );
      if (text.includes(query) || label.includes(query)) {
        found.push({ category, index });
      }
    });
  }
  return found;
}

function renderHead() {
  const searching = state.query.trim() !== "";
  const title = byId("akTitle", HTMLElement);
  const icon = byId("akTitleIcon", HTMLElement);
  const progress = byId("akProgress", HTMLElement);
  byId("akReset", HTMLButtonElement).hidden = searching;
  byId("akBar", HTMLElement).hidden = searching;
  if (searching) {
    icon.className = "fas fa-magnifying-glass ak-title-icon";
    title.textContent = t("akResults").replace("{query}", state.query.trim());
    progress.textContent = "";
    return;
  }
  icon.className = `fas ${categoryIcon(state.category)} ak-title-icon`;
  title.textContent = categoryLabel(state.category);
  const { done, total } = progressOf(state.category);
  const complete = total > 0 && done === total;
  progress.textContent = complete
    ? t("akAllDone")
    : t("akDoneOf")
        .replace("{done}", String(done))
        .replace("{total}", String(total));
  progress.classList.toggle("is-complete", complete);
  byId("akBarFill", HTMLElement).style.width =
    `${total ? (done / total) * 100 : 0}%`;
}

function renderList() {
  const list = byId("akList", HTMLElement);
  const searching = state.query.trim() !== "";
  const items = searching
    ? matches()
    : (state.data[state.category] ?? []).map((_, index) => ({
        category: state.category,
        index,
      }));
  setHtml(
    list,
    items.length
      ? html`${items.map((x) => cardHtml(x.category, x.index, searching))}`
      : html`<p class="ak-empty">${searching ? t("akNoMatch").replace("{query}", state.query.trim()) : t("noAthkarInCategory")}</p>`,
  );
  list.scrollTop = 0;
  renderHead();
}

/** Updates one card's counter, undo and done state in place (the focus stays). @param {string} id */
function updateCard(id) {
  const card = document.querySelector(`.ak-card[data-id="${CSS.escape(id)}"]`);
  if (!(card instanceof HTMLElement)) return;
  const cut = id.lastIndexOf("::");
  const item = state.data[id.slice(0, cut)][Number(id.slice(cut + 2))];
  const v = counterView(id, targetOf(item));
  card.classList.toggle("is-done", v.done);
  const undo = card.querySelector('[data-action="undo"]');
  if (undo instanceof HTMLElement) undo.hidden = countOf(id) === 0;
  const button = card.querySelector(".ak-count");
  const inner = card.querySelector(".ak-count-text");
  if (!button || !(inner instanceof HTMLElement)) return;
  button.setAttribute("aria-label", v.label);
  if (v.done) button.setAttribute("aria-disabled", "true");
  else button.removeAttribute("aria-disabled");
  setHtml(inner, v.inner);
}

module.exports = { renderList, renderHead, updateCard };
