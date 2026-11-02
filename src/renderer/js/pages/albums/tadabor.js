"use strict";

// The Tadabor tab: reflections grouped by surah, filtered by the search; a surah opens its
// recordings in the playlist page.
const mp3quranApi = require("../../services/api/mp3quran");
const { t } = require("../../core/i18n");
const { byId } = require("../../core/dom");
const { html, setHtml } = require("../../utils/html");
const { normalizeForSearch } = require("../../utils/search-text");
const { state, surahName } = require("./state");
const { openAlbum } = require("./open-album");
const { messageHtml } = require("./messages");

const box = () => byId("acTadabor", HTMLElement);

async function loadTadabor() {
  if (state.tadaborBySura) {
    renderTadabor();
    return;
  }
  setHtml(box(), messageHtml("loading", t("loadingTadabor")));
  try {
    const lang = mp3quranApi.apiLanguage();
    const [bySura, surahs] = await Promise.all([
      mp3quranApi.getTadabor(lang),
      state.surahNames ?? mp3quranApi.getSurahNames(lang),
    ]);
    state.tadaborBySura = bySura;
    state.surahNames = surahs;
    renderTadabor();
  } catch (error) {
    console.error("Failed to load tadabor:", error);
    setHtml(box(), messageHtml("error", t("errorLoadingTadabor"), "tadabor"));
  }
}

function renderTadabor() {
  const bySura = state.tadaborBySura;
  if (!bySura) return;
  const query = normalizeForSearch(state.query);
  const ids = Object.keys(bySura)
    .filter(
      (id) =>
        (bySura[id] ?? []).length &&
        (!query || normalizeForSearch(surahName(id)).includes(query)),
    )
    .sort((a, b) => Number(a) - Number(b));
  setHtml(
    box(),
    ids.length
      ? html`<ul class="ac-rows">${ids.map(
          (id) =>
            html`<li><button type="button" class="ac-row" data-sura="${id}"><i class="fas fa-lightbulb ac-row-icon" aria-hidden="true"></i><span class="ac-row-title">${id}. ${surahName(id)}</span><span class="ac-row-meta">${t("reflections").replace("{count}", String(bySura[id].length))}</span><i class="fas fa-chevron-right ac-row-go" aria-hidden="true"></i></button></li>`,
        )}</ul>`
      : messageHtml("empty", t("noTracksFound")),
  );
}

/** @param {HTMLButtonElement} button */
function onTadaborAction(button) {
  const id = button.dataset.sura;
  const entries = id && state.tadaborBySura?.[id];
  if (!entries) return;
  const name = surahName(id);
  openAlbum({
    source: "mp3quran-tracks",
    id: `tadabor-${id}`,
    title: name,
    artist: t("tadabor"),
    icon: "fas fa-lightbulb",
    tracks: mp3quranApi.getTadaborTracksForSura(entries, name),
  });
}

module.exports = { loadTadabor, renderTadabor, onTadaborAction };
