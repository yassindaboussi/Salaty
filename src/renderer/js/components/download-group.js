"use strict";

// A list of audio files that can be downloaded together: the surahs of a recitation (playlist
// page) or the parts of a surah's tafsir (archive, Tafasir tab). It draws
//   - a button on each row: ⬇ + size → progress ring → ✓ (click: download / cancel / remove)
//   - a bar: "Download all · 1.4 GB" → progress with Pause / Cancel → "Downloaded" with Delete
//   - an offline note, and tells the page which rows can play without internet.
// Material "offline states": icon + word + size before, determinate progress during, an offline
// mark after, deleting says what it frees. https://m2.material.io/design/communication/offline-states.html
// The files and transfers are in the main process (services/downloads.js).
const { t } = require("../core/i18n");
const { html, setHtml } = require("../utils/html");
const { showConfirmDialog } = require("./confirm-dialog");
const dl = require("../services/downloads");

const LOW_SPACE_LEFT = 1e9; // ask first when a download would leave less than 1 GB free
const EMPTY = () => ({ queued: [], active: {}, failed: [] });

/**
 * @typedef {{ name: string, url: string, title: string }} Item
 * @typedef {{
 *   key: string,
 *   info: Record<string, any>,
 *   items: () => Item[],
 *   bar: HTMLElement,
 *   list: HTMLElement,
 *   note?: HTMLElement,
 *   title: () => string,
 *   onPaint?: () => void,
 *   allLabel?: string,
 * }} Options
 */

/** @param {Options} o */
function createDownloadGroup(o) {
  const g = {
    /** @type {Set<string>} files on disk (the whole album, not only these items) */
    done: new Set(),
    /** @type {Record<string, number>} bytes on disk of each file */
    onDisk: {},
    /** @type {import("../services/downloads").AlbumStatus} */
    status: EMPTY(),
    /** @type {Record<string, number>} */
    sizes: {},
    /** @type {{ free: number, total: number } | null} */
    disk: null,
    online: navigator.onLine,
  };

  const names = () => o.items().map((i) => i.name);
  const missing = () => names().filter((n) => !g.done.has(n));
  const sum = (/** @type {string[]} */ list) =>
    list.reduce((a, n) => a + (g.sizes[n] ?? 0), 0);
  const busyOf = (/** @type {string[]} */ list) =>
    list.filter(
      (n) => g.status.queued.includes(n) || g.status.active[n] !== undefined,
    );

  /** @param {string} name */
  function stateOf(name) {
    if (g.done.has(name)) return "done";
    if (g.status.active[name]) return "active";
    if (g.status.queued.includes(name)) return "queued";
    if (g.status.failed.includes(name)) return "failed";
    return "idle";
  }

  /** The URL to play: the file on disk when downloaded. @param {Item} item */
  const urlFor = (item) =>
    g.done.has(item.name) ? dl.offlineUrl(o.key, item.name) : item.url;

  /** False when offline and not downloaded. @param {string} name */
  const canPlay = (name) => g.online || g.done.has(name);

  /** @param {string} name */
  const rowButtonHtml = (name) =>
    html`<button type="button" class="pl-dl" data-file="${name}"></button>`;

  /** @param {HTMLButtonElement} button */
  function paintRowButton(button) {
    const name = button.dataset.file ?? "";
    const title = o.items().find((i) => i.name === name)?.title ?? name;
    const s = stateOf(name);
    button.dataset.state = s;
    button.disabled = !g.online && (s === "idle" || s === "failed");
    const p = g.status.active[name];
    const percent = p?.total ? Math.floor((p.received / p.total) * 100) : 0;
    const size = g.sizes[name] ? dl.formatBytes(g.sizes[name]) : "";
    const label = {
      idle: t("dlSurahDownload"),
      queued: t("dlSurahQueued"),
      active: t("dlSurahActive").replace("{percent}", String(percent)),
      done: t("dlSurahDone"),
      failed: t("dlSurahFailed"),
    }[s].replace("{title}", title);
    button.setAttribute("aria-label", label);
    button.title = label;
    button.style.setProperty("--p", `${percent}%`);
    setHtml(
      button,
      {
        idle: html`<i class="fas fa-download" aria-hidden="true"></i><span class="pl-dl-size">${size}</span>`,
        queued: html`<i class="fas fa-clock" aria-hidden="true"></i>`,
        active: html`<span class="pl-dl-ring" aria-hidden="true"></span>`,
        done: html`<i class="fas fa-circle-check" aria-hidden="true"></i>`,
        failed: html`<i class="fas fa-rotate-right" aria-hidden="true"></i>`,
      }[s],
    );
  }

  function paintBar() {
    if (o.note) o.note.hidden = g.online;
    const all = names();
    o.bar.hidden = !all.length;
    if (!all.length) return;
    const left = missing();
    const busy = busyOf(all);
    const doneBytes = all.reduce((a, n) => a + (g.onDisk[n] ?? 0), 0);
    if (busy.length) {
      const doneCount = all.length - left.length;
      const activeBytes = busy.reduce(
        (a, n) => a + (g.status.active[n]?.received ?? 0),
        0,
      );
      const percent = Math.round((doneCount / all.length) * 100);
      setHtml(
        o.bar,
        html`<div class="pl-dl-progress"><span class="pl-dl-text">${t("dlProgress").replace("{done}", String(doneCount)).replace("{total}", String(all.length))}${activeBytes ? html` · ${dl.formatBytes(doneBytes + activeBytes)}` : ""}</span><span class="pl-dl-track" role="progressbar" aria-valuemin="0" aria-valuemax="${all.length}" aria-valuenow="${doneCount}" aria-label="${t("dlDownloading")}"><span class="pl-dl-fill" style="width: ${percent}%"></span></span></div>
          <button type="button" class="pl-dl-btn" data-dl="pause"><i class="fas fa-pause" aria-hidden="true"></i><span>${t("dlPause")}</span></button>
          <button type="button" class="pl-dl-btn" data-dl="cancel"><i class="fas fa-xmark" aria-hidden="true"></i><span>${t("cancel")}</span></button>`,
      );
    } else if (!left.length) {
      setHtml(
        o.bar,
        html`<span class="pl-dl-text pl-dl-done"><i class="fas fa-circle-check" aria-hidden="true"></i> ${t("dlDownloaded")} · ${dl.formatBytes(doneBytes)}</span>
          <button type="button" class="pl-dl-btn" data-dl="delete"><i class="fas fa-trash-can" aria-hidden="true"></i><span>${t("dlDelete")}</span></button>`,
      );
    } else {
      const label =
        left.length === all.length
          ? t(o.allLabel ?? "dlDownloadAll")
          : t("dlDownloadRest").replace("{count}", String(left.length));
      const size = left.every((n) => g.sizes[n])
        ? ` · ${dl.formatBytes(sum(left))}`
        : "";
      const some = all.some((n) => g.done.has(n));
      setHtml(
        o.bar,
        html`<button type="button" class="pl-dl-btn pl-dl-main" data-dl="all" ${g.online ? "" : "disabled"}><i class="fas fa-download" aria-hidden="true"></i><span>${label}${size}</span></button>
          ${some ? html`<button type="button" class="pl-dl-btn" data-dl="delete"><i class="fas fa-trash-can" aria-hidden="true"></i><span>${t("dlDelete")}</span></button>` : ""}`,
      );
    }
  }

  function paint() {
    paintBar();
    for (const button of o.list.querySelectorAll(".pl-dl"))
      if (button instanceof HTMLButtonElement) paintRowButton(button);
    o.onPaint?.();
  }

  async function refresh() {
    const view = await dl.overview();
    const album = view.albums.find((a) => a.key === o.key);
    g.done = new Set(album?.files ?? []);
    g.onDisk = album?.fileBytes ?? {};
    g.status = view.status[o.key] ?? EMPTY();
    g.disk = view.disk;
    paint();
  }

  /** The sizes (HEAD requests): shown when they arrive; unknown offline. */
  function loadSizes() {
    if (!g.online) return;
    const wanted = o.items().filter((i) => g.sizes[i.name] === undefined);
    if (!wanted.length) return;
    dl.remoteSizes(wanted.map((i) => i.url)).then((sizes) => {
      Object.assign(g.sizes, sizes ?? {});
      paint();
    });
  }

  /** @param {string[]} list */
  const start = (list) =>
    dl.startDownload(
      o.info,
      o
        .items()
        .filter((i) => list.includes(i.name))
        .map((i) => i.url),
    );

  async function downloadAll() {
    const left = missing();
    const need = sum(left);
    if (g.disk && need && g.disk.free - need < LOW_SPACE_LEFT) {
      const ok = await showConfirmDialog(
        t("dlLowSpace")
          .replace("{free}", dl.formatBytes(g.disk.free))
          .replace("{size}", dl.formatBytes(need)),
      );
      if (!ok) return;
    }
    await start(left);
  }

  /** Deletes these items' files (only these: a tafsir surah, not the whole book). */
  async function deleteAll() {
    const mine = names().filter((n) => g.done.has(n));
    const bytes = mine.reduce((a, n) => a + (g.onDisk[n] ?? 0), 0);
    const ok = await showConfirmDialog(
      t("dlDeleteConfirm")
        .replace("{name}", o.title())
        .replace("{size}", dl.formatBytes(bytes)),
      { confirmText: t("dlDelete"), confirmClass: "btn-danger" },
    );
    if (ok) await dl.deleteDownload(o.key, names());
  }

  /** @param {HTMLButtonElement} button  a row's download button */
  async function onRowButton(button) {
    const name = button.dataset.file ?? "";
    const s = stateOf(name);
    if (s === "idle" || s === "failed") await start([name]);
    else if (s === "queued" || s === "active")
      await dl.stopDownload(o.key, [name], true);
    else if (s === "done") {
      const title = o.items().find((i) => i.name === name)?.title ?? name;
      const ok = await showConfirmDialog(
        t("dlRemoveSurah")
          .replace("{title}", title)
          .replace("{size}", dl.formatBytes(g.onDisk[name] ?? 0)),
        { confirmText: t("dlDelete"), confirmClass: "btn-danger" },
      );
      if (ok) await dl.deleteDownload(o.key, [name]);
    }
    await refresh();
  }

  /** @param {HTMLButtonElement} button  a button of the bar */
  async function onBarButton(button) {
    const action = button.dataset.dl;
    if (action === "all") await downloadAll();
    else if (action === "pause") await dl.stopDownload(o.key, names());
    else if (action === "cancel") await dl.stopDownload(o.key, names(), true);
    else if (action === "delete") await deleteAll();
    await refresh();
  }

  o.bar.addEventListener("click", (e) => {
    const button = /** @type {Element} */ (e.target).closest("button");
    if (button instanceof HTMLButtonElement) onBarButton(button);
  });
  // capture: a row's download button never also plays the row
  o.list.addEventListener(
    "click",
    (e) => {
      const button = /** @type {Element} */ (e.target).closest(".pl-dl");
      if (!(button instanceof HTMLButtonElement)) return;
      e.stopPropagation();
      onRowButton(button);
    },
    true,
  );
  let lastBusy = 0;
  dl.onDownloadsChanged((status) => {
    g.status = status[o.key] ?? EMPTY();
    const busy = busyOf(names()).length;
    // a file finished (or stopped): what is on disk changed
    if (busy < lastBusy || busy === 0) refresh();
    else paint();
    lastBusy = busy;
  });
  dl.watchOnline((online) => {
    g.online = online;
    paint();
  });

  return {
    rowButtonHtml,
    urlFor,
    canPlay,
    paint,
    refresh,
    loadSizes,
    isDone: (/** @type {string} */ name) => g.done.has(name),
    isOnline: () => g.online,
  };
}

module.exports = { createDownloadGroup };
