"use strict";

// The Downloads tab: the recitations and tafsir books saved on this computer (main/services/quran-downloads/),
// biggest first so space is freed fast. Each one opens its playlist (plays without internet) or
// is deleted, the dialog saying how much space that frees. Above: the space used and free, and
// a link to Settings → Downloads & storage (the folder: open it, move it, delete all).
const { ipcRenderer } = require("electron");
const { t } = require("../../core/i18n");
const { byId } = require("../../core/dom");
const { html, setHtml } = require("../../utils/html");
const { normalizeForSearch } = require("../../utils/search-text");
const { reciterPhotoHtml } = require("../../components/reciter-photo");
const { showConfirmDialog } = require("../../components/confirm-dialog");
const dl = require("../../services/downloads");
const { state } = require("./state");
const { openAlbum } = require("./open-album");

/** @type {import("../../services/downloads").Overview | null} */
let view = null;
let listening = false;
/** @type {() => void} opens the Tafasir tab (index.js) */
let openTafsirTab = () => {};

/** @param {() => void} fn */
const onOpenTafsir = (fn) => {
  openTafsirTab = fn;
};

/** @param {import("../../services/downloads").Album} album  the name in the app language */
function nameOf(album) {
  if (album.kind === "tafsir") {
    const book = state.tafsirBooks?.find(
      (b) => String(b.id) === String(album.bookId),
    );
    return book?.displayName || book?.name || album.bookName || t("tafasir");
  }
  return (
    state.reciters.find((r) => r.id === album.reciterId)?.name ||
    album.reciterName ||
    String(album.reciterId)
  );
}

/** @param {import("../../services/downloads").Album} album */
const totalOf = (album) =>
  String(album.surahList ?? "")
    .split(",")
    .filter((s) => s.trim()).length || album.surahs.length;

/** What a row says under the name. @param {import("../../services/downloads").Album} a */
function metaOf(a) {
  if (a.kind === "tafsir")
    return t("dlTafsirMeta")
      .replace("{surahs}", String(a.surahs.length))
      .replace("{parts}", String(a.files.length));
  const count = t("dlCount")
    .replace("{done}", String(a.surahs.length))
    .replace("{total}", String(totalOf(a)));
  return a.moshafName ? `${a.moshafName} · ${count}` : count;
}

/** @param {import("../../services/downloads").Album} a */
const iconOf = (a) =>
  a.kind === "tafsir"
    ? html`<span class="ac-dl-icon" aria-hidden="true"><i class="fas fa-book-open"></i></span>`
    : reciterPhotoHtml(a.reciterId, nameOf(a));

function renderDownloads() {
  const box = byId("acDownloads", HTMLElement);
  if (!view) return;
  const used = view.albums.reduce((a, b) => a + b.bytes, 0);
  const summary = html`<div class="ac-dl-summary"><span>${t("dlUsed").replace("{used}", dl.formatBytes(used))}${view.disk ? html` · ${t("dlFree").replace("{free}", dl.formatBytes(view.disk.free))}` : ""}</span><button type="button" class="pl-dl-btn" data-dl-action="storage"><i class="fas fa-gear" aria-hidden="true"></i><span>${t("dlStorageSettings")}</span></button></div>`;
  const query = normalizeForSearch(state.query);
  const albums = view.albums.filter(
    (a) =>
      !query || normalizeForSearch(`${nameOf(a)} ${metaOf(a)}`).includes(query),
  );
  if (!view.albums.length) {
    setHtml(
      box,
      html`${summary}<p class="ac-dl-empty"><i class="fas fa-download" aria-hidden="true"></i> ${t("dlEmpty")}</p>`,
    );
    return;
  }
  setHtml(
    box,
    html`${summary}<ul class="ac-dl-list">${albums.map((a) => {
      const st = view?.status[a.key];
      const busy = st && (st.queued.length || Object.keys(st.active).length);
      return html`<li class="ac-dl-item"><button type="button" class="ac-dl-open" data-dl-action="open" data-key="${a.key}">${iconOf(a)}<span class="ac-dl-text"><span class="ac-dl-name" dir="auto">${nameOf(a)}</span><span class="ac-dl-meta" dir="auto">${metaOf(a)} · ${dl.formatBytes(a.bytes)}${busy ? html` · ${t("dlDownloading")}` : ""}</span></span></button><button type="button" class="pl-dl-btn" data-dl-action="delete" data-key="${a.key}" aria-label="${t("dlDeleteOf").replace("{name}", nameOf(a))}" title="${t("dlDelete")}"><i class="fas fa-trash-can" aria-hidden="true"></i></button></li>`;
    })}</ul>`,
  );
}

async function loadDownloads() {
  if (!listening) {
    listening = true;
    let lastBusy = -1;
    dl.onDownloadsChanged((status) => {
      if (state.tab !== "downloads") return;
      const busy = Object.values(status).reduce(
        (a, s) => a + s.queued.length + Object.keys(s.active).length,
        0,
      );
      if (busy !== lastBusy) loadDownloads(); // a file finished: sizes changed
      lastBusy = busy;
    });
  }
  view = await dl.overview();
  renderDownloads();
}

/** @param {HTMLButtonElement} button */
async function onDownloadsAction(button) {
  const action = button.dataset.dlAction;
  const album = view?.albums.find((a) => a.key === button.dataset.key);
  if (action === "storage") {
    try {
      localStorage.setItem("settingsPane", "storage"); // settings/nav.js opens it
    } catch {
      // storage unavailable: Settings opens on its last category
    }
    await ipcRenderer.invoke("navigate-to", "settings");
  } else if (action === "open" && album?.kind === "tafsir") {
    openTafsirTab();
  } else if (action === "open" && album) {
    await openAlbum({
      source: "mp3quran",
      id: album.key,
      title: nameOf(album),
      artist: album.moshafName,
      icon: "fas fa-microphone-lines",
      reciterId: album.reciterId,
      reciterName: nameOf(album),
      server: album.server,
      surahList: album.surahList,
    });
  } else if (action === "delete" && album) {
    const ok = await showConfirmDialog(
      t("dlDeleteConfirm")
        .replace("{name}", nameOf(album))
        .replace("{size}", dl.formatBytes(album.bytes)),
      { confirmText: t("dlDelete"), confirmClass: "btn-danger" },
    );
    if (!ok) return;
    await dl.deleteDownload(album.key);
    await loadDownloads();
  }
}

module.exports = {
  loadDownloads,
  renderDownloads,
  onDownloadsAction,
  onOpenTafsir,
};
