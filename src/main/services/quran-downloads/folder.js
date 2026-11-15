"use strict";

// Where the downloaded audio lives, and what is there. The disk is the only record: one folder
// per "album" with its files (named as on mp3quran's server) and an album.json with the names to
// show. A file still downloading is "<name>.part" (downloader.js).
//
//   <dir>/<reciterId>-<moshafId>/001.mp3 … 114.mp3     a recitation
//   <dir>/tafsir-<bookId>/002-1-25.mp3                  a tafsir book's parts (surah-from-to)
//
// <dir> is <userData>/quran-audio unless the user picked another folder in Settings (the
// "downloadsDir" setting). An album key and a file name are checked against the patterns below
// before any path is built, so a page can never reach another file.
const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const settings = require("../settings-store");

const ALBUM_FILE = "album.json";
const KEY_RE = /^(?:\d{1,6}-\d{1,6}|tafsir-\d{1,6})$/;
const RECITATION_KEY_RE = /^(\d{1,6})-(\d{1,6})$/;
const FILE_RE = /^\d{3}(?:-\d{1,3}-\d{1,3})?\.mp3$/;

const defaultDir = () => path.join(app.getPath("userData"), "quran-audio");

/** The folder in use (the user's choice, or the default). */
function downloadsDir() {
  const chosen = settings.get().downloadsDir;
  return typeof chosen === "string" && path.isAbsolute(chosen)
    ? chosen
    : defaultDir();
}

/** True when the folder can be used (the default one is created when needed). */
async function dirAvailable() {
  const dir = downloadsDir();
  if (dir === defaultDir()) return true;
  // macOS may refuse a folder on Desktop / Documents / Downloads or a USB drive (privacy
  // settings) even when it exists: readable and writable is what counts
  try {
    await fs.promises.access(dir, fs.constants.R_OK | fs.constants.W_OK);
    return (await fs.promises.stat(dir)).isDirectory();
  } catch {
    return false;
  }
}

/** @param {string} key → its folder, or null when not a key */
function albumDir(key) {
  return KEY_RE.test(key) ? path.join(downloadsDir(), key) : null;
}

/** @param {string} key @param {string} name  "001.mp3" → the finished file's path, or null */
function filePath(key, name) {
  const dir = albumDir(key);
  return dir && FILE_RE.test(name) ? path.join(dir, name) : null;
}

/**
 * What album.json holds: a recitation (reciterId, moshafId, names, server, surahList) or a
 * tafsir book (kind "tafsir", bookId, bookName).
 * @typedef {Record<string, any>} AlbumInfo
 * @typedef {AlbumInfo & { key: string, kind: "recitation" | "tafsir", files: string[],
 *   fileBytes: Record<string, number>, surahs: number[], bytes: number }} Album
 */

/** @param {string} key @param {AlbumInfo} info */
async function writeAlbumInfo(key, info) {
  const dir = albumDir(key);
  if (!dir) return;
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(
    path.join(dir, ALBUM_FILE),
    JSON.stringify(info, null, 1),
  );
}

/** @param {string} dir @returns {Promise<AlbumInfo | null>} */
async function readAlbumInfo(dir) {
  try {
    const info = JSON.parse(
      await fs.promises.readFile(path.join(dir, ALBUM_FILE), "utf8"),
    );
    return info && typeof info === "object" ? info : null;
  } catch {
    return null;
  }
}

/** Every downloaded recitation with its finished surahs and their size on disk.
 * @returns {Promise<Album[]>} */
async function listAlbums() {
  const root = downloadsDir();
  const entries = await fs.promises
    .readdir(root, { withFileTypes: true })
    .catch(() => []);
  /** @type {Album[]} */
  const albums = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !KEY_RE.test(entry.name)) continue;
    const dir = path.join(root, entry.name);
    const names = await fs.promises.readdir(dir).catch(() => []);
    const files = [];
    /** @type {Record<string, number>} */
    const fileBytes = {};
    let bytes = 0;
    for (const name of names) {
      if (!FILE_RE.test(name)) continue;
      const stat = await fs.promises
        .stat(path.join(dir, name))
        .catch(() => null);
      if (!stat?.isFile()) continue;
      files.push(name);
      fileBytes[name] = stat.size;
      bytes += stat.size;
    }
    if (!files.length) continue;
    files.sort();
    const info = (await readAlbumInfo(dir)) ?? {};
    const recitation = RECITATION_KEY_RE.exec(entry.name);
    albums.push({
      ...(recitation
        ? {
            reciterId: Number(recitation[1]),
            moshafId: Number(recitation[2]),
            reciterName: "",
            moshafName: "",
            server: "",
            surahList: "",
          }
        : { bookId: Number(entry.name.slice(7)), bookName: "" }),
      ...info,
      kind: recitation ? "recitation" : "tafsir",
      key: entry.name,
      files,
      fileBytes,
      // the surahs it has (a tafsir part "002-1-25.mp3" counts for surah 2)
      surahs: [...new Set(files.map((f) => Number(f.slice(0, 3))))],
      bytes,
    });
  }
  return albums.sort((a, b) => b.bytes - a.bytes); // biggest first: frees space fastest
}

/** Free and total bytes of the drive holding the folder (null when it can't be read). */
async function diskSpace() {
  let dir = downloadsDir();
  // statfs needs an existing path: the closest existing parent
  while (!(await fs.promises.stat(dir).catch(() => null))) {
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  try {
    const s = await fs.promises.statfs(dir);
    return { free: s.bavail * s.bsize, total: s.blocks * s.bsize };
  } catch {
    return null;
  }
}

/** Deletes files (names), or the whole album when `names` is omitted.
 * @param {string} key @param {string[]} [names] */
async function remove(key, names) {
  const dir = albumDir(key);
  if (!dir) return;
  if (names === undefined) {
    await fs.promises.rm(dir, { recursive: true, force: true });
    return;
  }
  for (const name of names) {
    const file = filePath(key, name);
    if (!file) continue;
    await fs.promises.rm(file, { force: true });
    await fs.promises.rm(`${file}.part`, { force: true });
  }
  // the last file gone: the folder too
  const left = await fs.promises.readdir(dir).catch(() => []);
  if (!left.some((name) => name.endsWith(".mp3") || name.endsWith(".part")))
    await fs.promises.rm(dir, { recursive: true, force: true });
}

/** Deletes every downloaded recitation (only our album folders, nothing else in the folder). */
async function removeAll() {
  const root = downloadsDir();
  const entries = await fs.promises
    .readdir(root, { withFileTypes: true })
    .catch(() => []);
  for (const entry of entries) {
    if (entry.isDirectory() && KEY_RE.test(entry.name))
      await fs.promises.rm(path.join(root, entry.name), {
        recursive: true,
        force: true,
      });
  }
}

module.exports = {
  KEY_RE,
  defaultDir,
  downloadsDir,
  dirAvailable,
  FILE_RE,
  albumDir,
  filePath,
  writeAlbumInfo,
  listAlbums,
  diskSpace,
  remove,
  removeAll,
};
