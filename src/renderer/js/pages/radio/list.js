"use strict";

// The list of the open tab: favourites first, then the others; the search keeps the matching
// radios (no tashkeel, alif forms, accents: utils/search-text.js). A row plays its radio; its
// star adds it to the favourites. The radio the player has is marked (white) with its state.
const { t } = require("../../core/i18n");
const { byId } = require("../../core/dom");
const { html, setHtml } = require("../../utils/html");
const { normalizeForSearch } = require("../../utils/search-text");
const { reciterPhotoHtml } = require("../../components/reciter-photo");
const { view } = require("./state");

/** The logo, the reciter's photo, or its first letter. @param {import("./state").RadioItem} item @param {string} [size] */
function artHtml(item, size = "") {
  if (item.image) {
    return html`<span class="rd-logo ${size}" aria-hidden="true"><img src="${item.image}" alt="" loading="lazy" decoding="async"></span>`;
  }
  return reciterPhotoHtml(item.reciterId, item.name, `rd-photo ${size}`);
}

/** @param {import("./state").RadioItem} item */
function stateLabel(item) {
  if (view.current?.key !== item.key) return "";
  if (view.connecting) return t("rdConnecting");
  return view.playing ? t("rdLive") : t("rdPaused");
}

/** @param {import("./state").RadioItem} item */
function rowHtml(item) {
  const current = view.current?.key === item.key;
  const fav = view.favourites.has(item.key);
  const label = stateLabel(item);
  return html`<div class="rd-row${current ? " is-current" : ""}" data-key="${item.key}">
    <button type="button" class="rd-row-main" data-action="play" aria-current="${String(current)}">
      ${artHtml(item)}
      <span class="rd-row-text">
        <span class="rd-row-name" dir="auto">${item.name}</span>
        <span class="rd-row-sub" dir="auto">${item.sub}</span>
      </span>
      ${label ? html`<span class="rd-row-state">${view.playing && !view.connecting ? html`<i class="fas fa-circle" aria-hidden="true"></i> ` : ""}${label}</span>` : ""}
    </button>
    <button type="button" class="rd-star" data-action="favourite" aria-pressed="${String(fav)}" data-tip="${fav ? t("rdRemoveFavourite") : t("rdAddFavourite")}" aria-label="${fav ? t("rdRemoveFavourite") : t("rdAddFavourite")}: ${item.name}">
      <i class="${fav ? "fas" : "far"} fa-star" aria-hidden="true"></i>
    </button>
  </div>`;
}

/** @param {string} text @param {boolean} [retry] */
const messageHtml = (text, retry = false) =>
  html`<p class="rd-message">${text}${retry ? html` <button type="button" class="rd-retry" data-action="retry">${t("rdRetry")}</button>` : ""}</p>`;

function renderList() {
  const list = byId("rdList", HTMLElement);
  const items = view.tab === "stations" ? view.stations : view.reciters;
  if (!items) {
    setHtml(
      list,
      view.recitersFailed
        ? messageHtml(t("rdRecitersOffline"), true)
        : messageHtml(t("rdLoading")),
    );
    return;
  }
  const query = normalizeForSearch(view.query);
  const found = query
    ? items.filter((r) =>
        normalizeForSearch(`${r.name} ${r.sub}`).includes(query),
      )
    : items;
  if (!found.length) {
    setHtml(list, messageHtml(t("rdNoMatch")));
    return;
  }
  const favs = found.filter((r) => view.favourites.has(r.key));
  const others = found.filter((r) => !view.favourites.has(r.key));
  setHtml(
    list,
    html`${favs.length ? html`<h3 class="rd-group">${t("rdFavourites")}</h3>${favs.map(rowHtml)}` : ""}
    ${favs.length && others.length ? html`<h3 class="rd-group">${t("rdAll")}</h3>` : ""}
    ${others.map(rowHtml)}`,
  );
}

/** Redraws, keeping the focus on the same row's same button. */
function refreshList() {
  const active = document.activeElement;
  const row = active?.closest?.(".rd-row");
  const key = row instanceof HTMLElement ? row.dataset.key : null;
  const action = active instanceof HTMLElement ? active.dataset.action : null;
  renderList();
  if (!key || !action) return;
  const again = document.querySelector(
    `.rd-row[data-key="${CSS.escape(key)}"] [data-action="${action}"]`,
  );
  if (again instanceof HTMLElement) again.focus();
}

module.exports = { renderList, refreshList, artHtml };
