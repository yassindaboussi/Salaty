"use strict";

// The Recitations tab: the reciters (mp3quran.net) as cards with their photo, favourites first,
// filtered by the search, the riwaya and "complete Quran only". A card opens its recitation, or
// the list of its recitations when several pass the filters; its star adds it to the favourites.
const mp3quranApi = require("../../services/api/mp3quran");
const { t } = require("../../core/i18n");
const { byId } = require("../../core/dom");
const { html, setHtml } = require("../../utils/html");
const { normalizeForSearch } = require("../../utils/search-text");
const { reciterPhotoHtml } = require("../../components/reciter-photo");
const { state, toggleFavorite } = require("./state");
const { matchingMoshafs } = require("./riwaya");
const { openRecitation } = require("./open-album");
const { openMoshafDialog } = require("./moshaf-dialog");
const { messageHtml } = require("./messages");

async function loadReciters() {
  if (state.reciters.length) return;
  const box = byId("acReciters", HTMLElement);
  setHtml(box, messageHtml("loading", t("loadingReciters")));
  try {
    const reciters = await mp3quranApi.getReciters(mp3quranApi.apiLanguage());
    state.reciters = reciters
      .filter((r) => Array.isArray(r.moshaf) && r.moshaf.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
    renderReciters();
  } catch (error) {
    console.error("Failed to load reciters:", error);
    setHtml(box, messageHtml("error", t("errorLoadingReciters"), "reciters"));
  }
}

/** @param {import("./state").Reciter} reciter @param {import("./state").Moshaf[]} moshafs */
function cardHtml(reciter, moshafs) {
  const fav = state.favorites.has(reciter.id);
  const meta =
    moshafs.length === 1
      ? moshafs[0].name
      : t("recitationsAvailable").replace("{count}", String(moshafs.length));
  const favLabel = t(fav ? "acUnfavorite" : "acFavorite");
  return html`<li class="ac-card"><button type="button" class="ac-card-open" data-action="open" data-id="${reciter.id}">${reciterPhotoHtml(reciter.id, reciter.name)}<span class="ac-card-text"><span class="ac-card-name">${reciter.name}</span><span class="ac-card-meta">${meta}</span></span></button><button type="button" class="ac-fav" data-action="fav" data-id="${reciter.id}" aria-pressed="${String(fav)}" aria-label="${favLabel}: ${reciter.name}" data-tip="${favLabel}"><i class="${fav ? "fas" : "far"} fa-star" aria-hidden="true"></i></button></li>`;
}

function renderReciters() {
  const box = byId("acReciters", HTMLElement);
  if (!state.reciters.length) return;
  const query = normalizeForSearch(state.query);
  const shown = state.reciters
    .map((reciter) => ({ reciter, moshafs: matchingMoshafs(reciter) }))
    .filter(
      ({ reciter, moshafs }) =>
        moshafs.length &&
        (!query || normalizeForSearch(reciter.name).includes(query)),
    );
  if (!shown.length) {
    setHtml(box, messageHtml("empty", t("acNoReciter")));
    return;
  }
  const favorites = shown.filter((x) => state.favorites.has(x.reciter.id));
  const others = shown.filter((x) => !state.favorites.has(x.reciter.id));
  const section = (title, items) =>
    items.length
      ? html`<h3 class="ac-heading">${title} <span class="ac-heading-count">${items.length}</span></h3><ul class="ac-grid">${items.map((x) => cardHtml(x.reciter, x.moshafs))}</ul>`
      : "";
  setHtml(
    box,
    html`${section(t("acFavorites"), favorites)}${section(t("acAllReciters"), others)}`,
  );
}

/** @param {HTMLButtonElement} button  a card's open or star button */
function onCardAction(button) {
  const id = Number(button.dataset.id);
  const reciter = state.reciters.find((r) => r.id === id);
  if (!reciter) return;
  if (button.dataset.action === "fav") {
    toggleFavorite(id);
    renderReciters();
    // the card moved (into or out of the favourites): keep the focus on its star
    const again = document.querySelector(`.ac-fav[data-id="${id}"]`);
    if (again instanceof HTMLElement) again.focus();
    return;
  }
  const moshafs = matchingMoshafs(reciter);
  if (moshafs.length === 1) openRecitation(reciter, moshafs[0]);
  else openMoshafDialog(reciter, moshafs);
}

module.exports = { loadReciters, renderReciters, onCardAction };
