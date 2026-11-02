"use strict";

// The side panel: the search, then the categories in two sections. Each row shows how many of
// its athkar are done today ("2/6"), or a tick when all are. The open category is marked with
// aria-current. Folded (panel-fold.js), the panel is a strip of icons: the search, then one per
// category, which opens it.
const { t } = require("../../core/i18n");
const { byId } = require("../../core/dom");
const { html, setHtml } = require("../../utils/html");
const { state, progressOf } = require("./state");
const { sectionsFor, categoryLabel, categoryIcon } = require("./categories");

/** @param {string} name */
function rowHtml(name) {
  const { done, total } = progressOf(name);
  const complete = total > 0 && done === total;
  const current = name === state.category && state.query.trim() === "";
  const status = complete
    ? t("akAllDone")
    : t("akDoneOf")
        .replace("{done}", String(done))
        .replace("{total}", String(total));
  const label = total
    ? `${categoryLabel(name)}, ${status}`
    : categoryLabel(name);
  return html`<li><button type="button" class="ak-cat${complete ? " is-complete" : ""}" data-category="${name}" aria-label="${label}" ${current ? html`aria-current="true"` : ""}><i class="fas ${categoryIcon(name)} ak-cat-icon" aria-hidden="true"></i><span class="ak-cat-label">${categoryLabel(name)}</span><span class="ak-cat-progress" aria-hidden="true">${complete ? html`<i class="fas fa-check"></i>` : total ? `${done}/${total}` : ""}</span></button></li>`;
}

// The folded panel's strip: the search, then each category (its name as tooltip and name).
function renderRail() {
  const searching = state.query.trim() !== "";
  setHtml(
    byId("akRail", HTMLElement),
    html`<button type="button" class="ak-rail-btn" data-rail="search" data-tip="${t("searchAthkar")}" aria-label="${t("searchAthkar")}"><i class="fas fa-magnifying-glass" aria-hidden="true"></i></button>${sectionsFor(
      state.data,
    )
      .flatMap((section) => section.names)
      .map((name) => {
        const current = name === state.category && !searching;
        return html`<button type="button" class="ak-rail-btn" data-category="${name}" data-tip="${categoryLabel(name)}" aria-label="${categoryLabel(name)}" ${current ? html`aria-current="true"` : ""}><i class="fas ${categoryIcon(name)}" aria-hidden="true"></i></button>`;
      })}`,
  );
}

function renderPanel() {
  renderRail();
  setHtml(
    byId("akNav", HTMLElement),
    html`${sectionsFor(state.data).map(
      (section) =>
        html`<h3 class="ak-section-title">${t(section.key)}</h3><ul class="ak-cats">${section.names.map(rowHtml)}</ul>`,
    )}`,
  );
}

module.exports = { renderPanel };
