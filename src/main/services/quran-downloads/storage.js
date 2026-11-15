"use strict";

// Settings → Downloads & storage: open the folder in Explorer, move it to another drive, back to
// the default place. A move copies album by album and switches the setting only when all of it
// arrived; if anything fails, the old folder stays in use and nothing is lost.
const fs = require("fs");
const path = require("path");
const { dialog, shell } = require("electron");
const settings = require("../settings-store");
const folder = require("./folder");
const downloader = require("./downloader");
const log = require("../logger").logger("Downloads");

// Inside the folder the user picks, so it never fills e.g. D:\ with album folders
const SUBFOLDER = "Salaty Quran Audio";

/** Opens the folder in File Explorer (created first, so there is always something to open). */
async function openFolder() {
  const dir = folder.downloadsDir();
  if (!(await folder.dirAvailable())) return "missing";
  await fs.promises.mkdir(dir, { recursive: true });
  const error = await shell.openPath(dir);
  if (!error) return "ok";
  // Linux: openPath goes through xdg-open, which fails on some desktops / AppImages
  // (https://github.com/electron/electron/issues/42171). Show it in the file manager instead.
  shell.showItemInFolder(dir);
  return "ok";
}

/** @param {string} from @param {string} to  one album folder, across drives too */
async function moveDir(from, to) {
  try {
    await fs.promises.rename(from, to); // same drive: instant
    return;
  } catch {
    // another drive (EXDEV) or a USB / exFAT drive: copy, then delete the original
  }
  try {
    await fs.promises.cp(from, to, { recursive: true, errorOnExist: false });
  } catch (err) {
    await fs.promises.rm(to, { recursive: true, force: true }); // no half copy left
    throw err;
  }
  await fs.promises.rm(from, { recursive: true, force: true });
}

/**
 * Moves every album to `target` and makes it the folder in use.
 * @param {string} target
 * @returns {Promise<"ok" | "same" | "failed">}
 */
async function moveTo(target) {
  const from = folder.downloadsDir();
  // Windows paths ignore case; macOS and Linux may not ("Music" ≠ "music")
  const norm = (/** @type {string} */ p) =>
    process.platform === "win32"
      ? path.resolve(p).toLowerCase()
      : path.resolve(p);
  if (norm(target) === norm(from)) return "same";
  await downloader.stopAll();
  /** @type {string[]} albums already moved, put back if a later one fails */
  const moved = [];
  try {
    await fs.promises.mkdir(target, { recursive: true });
    const entries = await fs.promises
      .readdir(from, { withFileTypes: true })
      .catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory() || !folder.KEY_RE.test(entry.name)) continue;
      await moveDir(path.join(from, entry.name), path.join(target, entry.name));
      moved.push(entry.name);
    }
  } catch (err) {
    log.error("moving the downloads failed:", err);
    // all or nothing: what already moved goes back, so the folder in use stays whole
    for (const name of moved) {
      await moveDir(path.join(target, name), path.join(from, name)).catch((e) =>
        log.error("moving back failed:", name, e),
      );
    }
    return "failed";
  }
  settings.update({
    downloadsDir: target === folder.defaultDir() ? "" : target,
  });
  // the old folder, if now empty (never something the user put there)
  await fs.promises.rmdir(from).catch(() => {});
  return "ok";
}

/** @param {import("electron").BrowserWindow | null} win  asks where, then moves */
async function chooseFolder(win, title) {
  /** @type {import("electron").OpenDialogOptions} */
  const options = { title, properties: ["openDirectory", "createDirectory"] };
  const res = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options);
  if (res.canceled || !res.filePaths[0]) return "canceled";
  const picked = res.filePaths[0];
  const target =
    path.basename(picked) === SUBFOLDER ? picked : path.join(picked, SUBFOLDER);
  return moveTo(target);
}

/** Back to <userData>/quran-audio. When the chosen folder is gone, just forget it. */
async function resetFolder() {
  if (!(await folder.dirAvailable())) {
    settings.update({ downloadsDir: "" });
    return "ok";
  }
  return moveTo(folder.defaultDir());
}

module.exports = { openFolder, chooseFolder, resetFolder };
