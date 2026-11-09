"use strict";

// Where each adhan voice's audio is, and the user's own file (Settings → Adhan voice → Your
// own file). The chosen file is copied to <userData>/adhan/custom.<ext>, so it keeps working
// when the original is moved or deleted; the page plays it from app://salaty/user/adhan-custom
// (app/app-protocol.js serves that one file, nothing else of userData).
const fs = require("fs");
const path = require("path");
const { app, dialog } = require("electron");
const { ASSETS_DIR, APP_ORIGIN, appUrl } = require("../config/paths");
const {
  ADHAN_VOICES,
  DEFAULT_ADHAN_VOICE,
  CUSTOM_ADHAN_VOICE,
  CUSTOM_ADHAN_EXTENSIONS,
  CUSTOM_ADHAN_MAX_BYTES,
  voiceForPrayer,
} = require("../../shared/adhan-voices");
const log = require("./logger").logger("Adhan");

const CUSTOM_URL_PATH = "/user/adhan-custom";

const customDir = () => path.join(app.getPath("userData"), "adhan");

/**
 * A file of the folder by its name before the extension: "custom" (the one played) or
 * "previous" (kept while a new file is checked), or null.
 * @param {"custom" | "previous"} base
 */
function fileNamed(base) {
  try {
    const pattern = new RegExp(`^${base}\\.[a-z0-9]+$`);
    const name = fs.readdirSync(customDir()).find((f) => pattern.test(f));
    return name ? path.join(customDir(), name) : null;
  } catch {
    return null; // no folder yet
  }
}

/** The copied file of "Your own file", or null when there is none. */
const customAdhanFile = () => fileNamed("custom");

/**
 * The app:// URL of a voice. The user's file gets its change time in the URL, so a new file
 * is not served from the cache of the old one.
 * @param {string} id
 */
function voiceUrl(id) {
  if (id === CUSTOM_ADHAN_VOICE) {
    const file = customAdhanFile();
    if (file) {
      const changed = Math.round(fs.statSync(file).mtimeMs);
      return `${APP_ORIGIN}${CUSTOM_URL_PATH}?v=${changed}`;
    }
    id = DEFAULT_ADHAN_VOICE; // the file is gone: the default voice instead of silence
  }
  const voice =
    ADHAN_VOICES.find((v) => v.id === id) ??
    ADHAN_VOICES.find((v) => v.id === DEFAULT_ADHAN_VOICE);
  return appUrl(path.join(ASSETS_DIR, "adhan", voice?.file ?? "algiers.mp3"));
}

/**
 * The adhan to play for a prayer (Fajr may have its own voice).
 * @param {string | undefined} prayerKey
 * @param {object} settings
 */
const adhanUrlFor = (prayerKey, settings) =>
  voiceUrl(voiceForPrayer(prayerKey, settings));

/**
 * Asks for an audio file and copies it in. Returns its name, or why it was not taken.
 * @param {import("electron").BrowserWindow | null} win
 * @returns {Promise<{ name: string } | { cancelled: true } | { error: "too-big" | "type" | "copy" }>}
 */
async function chooseCustomAdhan(win) {
  /** @type {import("electron").OpenDialogOptions} */
  const options = {
    properties: ["openFile"],
    filters: [{ name: "Audio", extensions: [...CUSTOM_ADHAN_EXTENSIONS] }],
  };
  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options);
  const source = result.filePaths?.[0];
  if (result.canceled || !source) return { cancelled: true };

  const ext = path.extname(source).slice(1).toLowerCase();
  if (!CUSTOM_ADHAN_EXTENSIONS.includes(ext)) return { error: "type" };
  try {
    const { size } = await fs.promises.stat(source);
    if (size > CUSTOM_ADHAN_MAX_BYTES) return { error: "too-big" };
    await fs.promises.mkdir(customDir(), { recursive: true });
    // the file played now waits as "previous" until the page says the new one plays
    await dropFile("previous");
    const old = customAdhanFile();
    if (old)
      await fs.promises.rename(
        old,
        old.replace(/custom(\.\w+)$/, "previous$1"),
      );
    await fs.promises.copyFile(source, path.join(customDir(), `custom.${ext}`));
    return { name: path.basename(source) };
  } catch (err) {
    log.warn("could not copy the adhan file:", err);
    return { error: "copy" };
  }
}

/** @param {"custom" | "previous"} base */
async function dropFile(base) {
  const file = fileNamed(base);
  if (file) await fs.promises.rm(file, { force: true });
}

/**
 * The page tried the new file: keep it (and forget the one before), or put the one before
 * back (the new file does not play).
 * @param {boolean} playable
 */
async function confirmCustomAdhan(playable) {
  try {
    if (playable) return void (await dropFile("previous"));
    await dropFile("custom");
    const previous = fileNamed("previous");
    if (previous)
      await fs.promises.rename(
        previous,
        previous.replace(/previous(\.\w+)$/, "custom$1"),
      );
  } catch (err) {
    log.warn("could not keep the adhan file:", err);
  }
}

/** Settings → Your own file → 🗑: the copied file is deleted. */
async function removeCustomAdhan() {
  try {
    await dropFile("custom");
    await dropFile("previous");
  } catch (err) {
    log.warn("could not delete the adhan file:", err);
  }
}

module.exports = {
  CUSTOM_URL_PATH,
  customAdhanFile,
  voiceUrl,
  adhanUrlFor,
  chooseCustomAdhan,
  confirmCustomAdhan,
  removeCustomAdhan,
};
