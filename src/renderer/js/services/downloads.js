"use strict";

// The downloaded recitations and tafsir parts, for the pages (the files and transfers are in the
// main process: main/services/quran-downloads/). An album is "<reciterId>-<moshafId>" or
// "tafsir-<bookId>"; a file is named as on the server ("001.mp3", "002-1-25.mp3") and plays from
// app://salaty/offline-audio/<album>/<file>, so without internet.
const { ipcRenderer } = require("electron");
const { getLanguage } = require("../core/i18n");

/**
 * @typedef {{ received: number, total: number }} Progress
 * @typedef {{ queued: string[], active: Record<string, Progress>, failed: string[] }} AlbumStatus
 * @typedef {{ key: string, kind: "recitation" | "tafsir", files: string[], surahs: number[],
 *   bytes: number, [info: string]: any }} Album
 * @typedef {{ albums: Album[], status: Record<string, AlbumStatus>, dir: string,
 *   isDefault: boolean, available: boolean, disk: { free: number, total: number } | null }} Overview
 */

/** @param {number} reciterId @param {number} moshafId */
const albumKey = (reciterId, moshafId) => `${reciterId}-${moshafId}`;

/** "…/tabri/002-1-25.mp3" → "002-1-25.mp3" @param {string} url */
const fileNameOf = (url) => String(url).split("/").pop() ?? "";

/** @param {string} key @param {string} name */
const offlineUrl = (key, name) =>
  `${location.origin}/offline-audio/${key}/${name}`;

/** @returns {Promise<Overview>} */
const overview = () => ipcRenderer.invoke("downloads-list");

/** @param {(status: Record<string, AlbumStatus>) => void} listener */
function onDownloadsChanged(listener) {
  ipcRenderer.on("downloads-changed", (_e, status) => listener(status));
}

/**
 * @param {Record<string, any>} info  a recitation ({ reciterId, moshafId, reciterName,
 *   moshafName, server, surahList }) or a tafsir book ({ kind: "tafsir", bookId, bookName })
 * @param {string[]} urls  the mp3quran files to download
 */
const startDownload = (info, urls) =>
  ipcRenderer.invoke("downloads-start", info, urls);

/** Pauses (the part downloaded stays, a new start resumes) or cancels with `discard`.
 * @param {string} key @param {string[]} [names] all when omitted @param {boolean} [discard] */
const stopDownload = (key, names, discard = false) =>
  ipcRenderer.invoke("downloads-stop", key, names ?? null, discard);

/** @param {string} key @param {string[]} [names]  the whole album when omitted */
const deleteDownload = (key, names) =>
  ipcRenderer.invoke("downloads-delete", key, names ?? null);

/** @param {string[]} urls @returns {Promise<Record<string, number>>} sizes by file name */
const remoteSizes = (urls) => ipcRenderer.invoke("downloads-sizes", urls);

/**
 * Online or not: the browser's own flag, and the app's connection check (main process,
 * services/connection-manager.js), which also sees a network without internet.
 * @param {(online: boolean) => void} listener  called on every change
 */
function watchOnline(listener) {
  let mainOnline = true;
  const emit = () => listener(navigator.onLine && mainOnline);
  ipcRenderer
    .invoke("get-connection-status")
    .then((online) => {
      mainOnline = online !== false;
      emit();
    })
    .catch(() => {});
  ipcRenderer.on("connection-lost", () => {
    mainOnline = false;
    emit();
  });
  ipcRenderer.on("connection-restored", () => {
    mainOnline = true;
    emit();
  });
  window.addEventListener("online", emit);
  window.addEventListener("offline", emit);
}

/** "12 MB", "1.4 GB" in the app language. @param {number} bytes */
function formatBytes(bytes) {
  const units = ["byte", "kilobyte", "megabyte", "gigabyte", "terabyte"];
  let value = Math.max(0, bytes);
  let i = 0;
  while (value >= 1000 && i < units.length - 1) {
    value /= 1000;
    i++;
  }
  return new Intl.NumberFormat(getLanguage(), {
    style: "unit",
    unit: units[i],
    unitDisplay: "short",
    maximumFractionDigits: value < 10 && i >= 3 ? 1 : 0,
  })
    .format(value)
    .replace(/\s/g, "\u00a0"); // "399 kB" never splits across two lines
}

module.exports = {
  albumKey,
  fileNameOf,
  offlineUrl,
  overview,
  onDownloadsChanged,
  startDownload,
  stopDownload,
  deleteDownload,
  remoteSizes,
  formatBytes,
  watchOnline,
};
