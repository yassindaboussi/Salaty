"use strict";

// The track list: one row per surah (or recording), its number, its title and, on the one
// playing, a speaker (aria-current). Filtered by the search; a click plays it (the whole list
// becomes the background player's playlist, so next / previous follow it).
const { ipcRenderer } = require("electron");
const { t } = require("../../core/i18n");
const { byId } = require("../../core/dom");
const { html, setHtml } = require("../../utils/html");
const { normalizeForSearch } = require("../../utils/search-text");
const analytics = require("../../services/analytics");
const { state } = require("./state");

/** @param {any} track @param {number} index  "001.mp3" → 1; else its place in the list */
const numberOf = (track, index) =>
  Number.parseInt(String(track.filename ?? ""), 10) || index + 1;

function renderList() {
  const list = byId("plList", HTMLElement);
  const query = normalizeForSearch(state.query);
  const rows = state.tracks
    .map((track, index) => ({ track, index }))
    .filter(
      ({ track, index }) =>
        !query ||
        normalizeForSearch(track.title).includes(query) ||
        String(numberOf(track, index)) === query,
    );
  if (!rows.length) {
    setHtml(list, html`<p class="pl-empty">${t("noTracksFound")}</p>`);
    return;
  }
  setHtml(
    list,
    html`<ol class="pl-tracks">${rows.map(({ track, index }) => {
      const current = track.url === state.current?.url;
      return html`<li><button type="button" class="pl-track" data-index="${index}" aria-label="${t("acTrackLabel").replace("{title}", track.title)}" ${current ? html`aria-current="true"` : ""}><span class="pl-num">${numberOf(track, index)}</span><span class="pl-title">${track.title}</span><i class="fas ${current && state.playing ? "fa-volume-high" : "fa-play"} pl-state" aria-hidden="true"></i></button></li>`;
    })}</ol>`,
  );
}

// The playing row changes: only the marks, so the list keeps its scroll and focus.
function markCurrent() {
  for (const row of byId("plList", HTMLElement).querySelectorAll(".pl-track")) {
    const track = state.tracks[Number(row.getAttribute("data-index"))];
    const current = Boolean(track) && track.url === state.current?.url;
    if (current) row.setAttribute("aria-current", "true");
    else row.removeAttribute("aria-current");
    const icon = row.querySelector(".pl-state");
    if (icon) {
      icon.className = `fas ${current && state.playing ? "fa-volume-high" : "fa-play"} pl-state`;
    }
  }
}

/** @param {number} index  plays it, the whole list as the playlist */
function playTrack(index) {
  if (!state.tracks[index]) return;
  // the reciter goes with each track: the mini players show his photo
  const reciterId = state.album?.reciterId;
  ipcRenderer.send("player-command", {
    type: "set-playlist",
    tracks: reciterId
      ? state.tracks.map((track) => ({ ...track, reciterId }))
      : state.tracks,
    startIndex: index,
  });
  analytics.playlistTrackPlay();
}

function bindList() {
  byId("plList", HTMLElement).addEventListener("click", (e) => {
    const row = /** @type {Element} */ (e.target).closest(".pl-track");
    if (row instanceof HTMLButtonElement) playTrack(Number(row.dataset.index));
  });
  const search = byId("plSearch", HTMLInputElement);
  search.addEventListener("input", () => {
    state.query = search.value;
    renderList();
  });
  search.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && search.value) {
      e.preventDefault();
      search.value = "";
      state.query = "";
      renderList();
    }
  });
}

module.exports = { renderList, markCurrent, bindList };
