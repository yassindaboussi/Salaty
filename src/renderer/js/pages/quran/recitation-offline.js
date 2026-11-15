"use strict";

// Listening without internet in the reader. The reader plays the same mp3quran files as the
// Audio Archive, so a surah downloaded there (or with the ⬇ button of the player bar, here) is
// played from the disk: one store for both (main/services/quran-downloads/). Downloading here
// also keeps the ayah timings, so the recited ayah is still marked offline.
const { t } = require("../../core/i18n");
const { byId } = require("../../core/dom");
const { updateTooltip } = require("../../core/tooltips");
const { html, setHtml } = require("../../utils/html");
const { showConfirmDialog } = require("../../components/confirm-dialog");
const dl = require("../../services/downloads");
const { getAyahTimings, surahUrl } = require("../../services/api/ayah-timing");

/** @typedef {import("../../services/api/ayah-timing").TimedReciter} TimedReciter */

/** @type {Map<string, Set<string>>} the files on disk, by album */
let saved = new Map();
/** @type {Record<string, import("../../services/downloads").AlbumStatus>} */
let status = {};

/** @param {TimedReciter} r */
const keyOf = (r) => `${r.reciterId}-${r.moshafId}`;
/** @param {number} surah */
const fileOf = (surah) => `${String(surah).padStart(3, "0")}.mp3`;

async function refreshDownloads() {
  try {
    const view = await dl.overview();
    saved = new Map(view.albums.map((a) => [a.key, new Set(a.files)]));
    status = view.status;
  } catch {
    // the main process did not answer: stream as before
  }
}

/** @param {TimedReciter | null | undefined} r @param {number} surah */
const isSaved = (r, surah) =>
  Boolean(r && r.moshafId != null && saved.get(keyOf(r))?.has(fileOf(surah)));

/** The file on disk when downloaded, else the server's. @param {TimedReciter} r @param {number} surah */
const playUrl = (r, surah) =>
  isSaved(r, surah)
    ? dl.offlineUrl(keyOf(r), fileOf(surah))
    : surahUrl(r, surah);

/** @param {TimedReciter} r @param {number} surah */
function stateOf(r, surah) {
  if (isSaved(r, surah)) return "done";
  const s = status[keyOf(r)];
  const name = fileOf(surah);
  if (s?.active[name]) return "active";
  if (s?.queued.includes(name)) return "queued";
  if (s?.failed.includes(name)) return "failed";
  return "idle";
}

/** The ⬇ / progress / ✓ button of the player bar, for what is playing.
 * @param {TimedReciter | null | undefined} r @param {number | undefined} surah */
function renderDownloadButton(r, surah) {
  const button = byId("qPlayerDl", HTMLButtonElement);
  button.hidden = !r || r.moshafId == null || !surah;
  if (button.hidden || !r || !surah) return;
  const s = stateOf(r, surah);
  const p = status[keyOf(r)]?.active[fileOf(surah)];
  const percent = p?.total ? Math.floor((p.received / p.total) * 100) : 0;
  button.dataset.state = s;
  button.disabled = !navigator.onLine && s !== "done";
  button.style.setProperty("--p", `${percent}%`);
  const key = {
    idle: "quranDownloadSurah",
    queued: "quranDownloading",
    active: "quranDownloading",
    done: "quranDownloaded",
    failed: "quranDownloadSurah",
  }[s];
  if (button.dataset.tooltip !== key) {
    button.dataset.tooltip = key;
    updateTooltip(button);
  }
  setHtml(
    button,
    {
      idle: html`<i class="fas fa-download" aria-hidden="true"></i>`,
      queued: html`<i class="fas fa-clock" aria-hidden="true"></i>`,
      active: html`<span class="pl-dl-ring" aria-hidden="true"></span>`,
      done: html`<i class="fas fa-circle-down" aria-hidden="true"></i>`,
      failed: html`<i class="fas fa-rotate-right" aria-hidden="true"></i>`,
    }[s],
  );
}

/** Click on the button: download (with the timings), cancel, or remove.
 * @param {TimedReciter} r @param {number} surah @param {string} title */
async function onDownloadButton(r, surah, title) {
  const s = stateOf(r, surah);
  if (s === "idle" || s === "failed") {
    await dl.startDownload(
      {
        reciterId: r.reciterId,
        moshafId: r.moshafId,
        reciterName: r.name,
        moshafName: "",
        server: r.server,
        surahList: Array.from({ length: 114 }, (_, i) => i + 1).join(","),
      },
      [surahUrl(r, surah)],
    );
    getAyahTimings(r.read, surah).catch(() => {}); // kept for offline
  } else if (s === "queued" || s === "active") {
    await dl.stopDownload(keyOf(r), [fileOf(surah)], true);
  } else {
    const ok = await showConfirmDialog(
      t("quranRemoveDownload").replace("{title}", title),
      { confirmText: t("dlDelete"), confirmClass: "btn-danger" },
    );
    if (ok) await dl.deleteDownload(keyOf(r), [fileOf(surah)]);
  }
  await refreshDownloads();
}

/** @param {() => void} render  draws the bar again when downloads move */
function watchDownloads(render) {
  let lastBusy = -1;
  dl.onDownloadsChanged((next) => {
    status = next;
    const busy = Object.values(next).reduce(
      (a, s) => a + s.queued.length + Object.keys(s.active).length,
      0,
    );
    if (busy !== lastBusy) refreshDownloads().then(render);
    else render();
    lastBusy = busy;
  });
}

module.exports = {
  refreshDownloads,
  isSaved,
  playUrl,
  renderDownloadButton,
  onDownloadButton,
  watchDownloads,
};
