"use strict";

// The downloaded recitations and tafsir parts (services/quran-downloads/): the Audio Archive's
// download buttons, its Downloads tab and Settings → Downloads & storage. The album key is built
// here from checked numbers; files are mp3quran URLs (downloader.js keeps only those) or, to stop
// or delete, file names (folder.js checks them).
const { BrowserWindow } = require("electron");
const secureIpc = require("../secure-ipc");
const check = require("../validate");
const folder = require("../../services/quran-downloads/folder");
const downloader = require("../../services/quran-downloads/downloader");
const storage = require("../../services/quran-downloads/storage");

const MAX_ID = 999_999;

/** @param {unknown} v → "<reciterId>-<moshafId>" or undefined */
const albumKey = (v) =>
  typeof v === "string" && folder.KEY_RE.test(v) ? v : undefined;

const MAX_FILES = 400; // a recitation has 114, a tafsir book about 300 parts

/** @param {unknown} v → mp3quran audio URLs (strings), without repeats */
function urls(v) {
  if (!Array.isArray(v)) return [];
  const out = new Set();
  for (const u of v.slice(0, MAX_FILES)) {
    const url = check.text(u, 300);
    if (url && downloader.fileNameOf(url)) out.add(url);
  }
  return [...out];
}

/** @param {unknown} v → file names ("001.mp3", "002-1-25.mp3"), or undefined for "all" */
function names(v) {
  if (v == null) return undefined;
  const list = Array.isArray(v) ? v : [v];
  return list
    .slice(0, MAX_FILES)
    .filter((x) => typeof x === "string" && folder.FILE_RE.test(x));
}

/** What to download into: a recitation or a tafsir book → [key, album.json], or null.
 * @param {any} info @returns {[string, Record<string, any>] | null} */
function albumOf(info) {
  if (!check.isPlainObject(info)) return null;
  if (info.kind === "tafsir") {
    const bookId = check.int(info.bookId, 0, MAX_ID);
    if (bookId === undefined) return null;
    return [
      `tafsir-${bookId}`,
      { kind: "tafsir", bookId, bookName: check.text(info.bookName) ?? "" },
    ];
  }
  const reciterId = check.int(info.reciterId, 1, MAX_ID);
  const moshafId = check.int(info.moshafId, 0, MAX_ID);
  if (reciterId === undefined || moshafId === undefined) return null;
  return [
    `${reciterId}-${moshafId}`,
    {
      kind: "recitation",
      reciterId,
      moshafId,
      reciterName: check.text(info.reciterName) ?? "",
      moshafName: check.text(info.moshafName) ?? "",
      server: check.text(info.server, 300) ?? "",
      surahList: check.text(info.surahList, 1000) ?? "",
    },
  ];
}

/** Everything the pages show: albums on disk, transfers, the folder and the drive. */
async function overview() {
  const [albums, disk, available] = await Promise.all([
    folder.listAlbums(),
    folder.diskSpace(),
    folder.dirAvailable(),
  ]);
  return {
    albums,
    status: downloader.status(),
    dir: folder.downloadsDir(),
    isDefault: folder.downloadsDir() === folder.defaultDir(),
    available,
    disk,
  };
}

let registered = false;

/** @param {() => BrowserWindow | null} getMainWindow */
function registerDownloadsHandlers(getMainWindow) {
  if (registered) return;
  registered = true;

  // progress and new files: the open page draws them again
  downloader.onChange(() => {
    const win = getMainWindow();
    if (win && !win.isDestroyed())
      win.webContents.send("downloads-changed", downloader.status());
  });

  secureIpc.handle("downloads-list", () => overview());

  secureIpc.handle("downloads-start", (_e, info, list) => {
    const album = albumOf(info);
    return album ? downloader.enqueue(album[0], album[1], urls(list)) : false;
  });

  secureIpc.handle("downloads-stop", (_e, key, files, discard) => {
    const k = albumKey(key);
    if (!k) return false;
    return downloader
      .stop(k, { names: names(files), discard: discard === true })
      .then(() => true);
  });

  secureIpc.handle("downloads-delete", async (_e, key, files) => {
    const k = albumKey(key);
    if (!k) return false;
    const which = names(files);
    await downloader.stop(k, { names: which, discard: true });
    await folder.remove(k, which);
    return true;
  });

  secureIpc.handle("downloads-delete-all", async () => {
    await downloader.stopAll();
    await folder.removeAll();
    return true;
  });

  secureIpc.handle("downloads-sizes", (_e, list) =>
    downloader.remoteSizes(urls(list)),
  );

  secureIpc.handle("downloads-open-folder", () => storage.openFolder());

  secureIpc.handle("downloads-change-folder", (event, title) =>
    storage.chooseFolder(
      BrowserWindow.fromWebContents(event.sender),
      check.text(title, 100) ?? "",
    ),
  );

  secureIpc.handle("downloads-reset-folder", () => storage.resetFolder());
}

module.exports = { registerDownloadsHandlers };
