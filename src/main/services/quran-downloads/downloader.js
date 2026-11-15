"use strict";

// Downloads audio files (surahs, tafsir parts) from mp3quran.net to the disk (folder.js), in the main process so they go on
// whatever page is open. Two files at a time, gentle on the free servers.
//
// Each file is written to "<name>.part" and renamed only once complete, so a file on disk is
// always whole. A stopped download (paused, offline, app closed) keeps its .part: the
// next try asks for the rest with an HTTP Range request and appends it when the server answers
// 206 with the matching start; any other answer starts the file again.
// https://developer.mozilla.org/docs/Web/HTTP/Guides/Range_requests
const fs = require("fs");
const { net } = require("electron");
const folder = require("./folder");
const log = require("../logger").logger("Downloads");

const PARALLEL = 2;
const RETRIES = 2; // after the first try: 3 tries in all
const STALL_MS = 30_000; // no byte for this long: the try fails
const NOTIFY_MS = 250;

/** mp3quran's audio servers ("https://server8.mp3quran.net/afs/"): nothing else is fetched. */
function isAudioServer(url) {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      (u.hostname === "mp3quran.net" || u.hostname.endsWith(".mp3quran.net"))
    );
  } catch {
    return false;
  }
}

/** The file name a URL is saved as (".../tabri/002-1-25.mp3" -> "002-1-25.mp3"), or null when
 * the URL is not an mp3quran audio file we know how to name. @param {string} url */
function fileNameOf(url) {
  if (!isAudioServer(url)) return null;
  const name = new URL(url).pathname.split("/").pop() ?? "";
  return folder.FILE_RE.test(name) ? name : null;
}

/**
 * @typedef {{ key: string, name: string, url: string }} Job
 * @typedef {{ received: number, total: number }} Progress
 */

/** @type {Job[]} */
let queue = [];
/** @type {Map<string, { job: Job, controller: AbortController, progress: Progress }>} */
const active = new Map();
/** @type {Map<string, Set<string>>} files whose last try failed, by album */
const failed = new Map();
/** @type {Set<() => void>} */
const listeners = new Set();
/** @type {ReturnType<typeof setTimeout> | null} */
let notifyTimer = null;

const jobId = (key, name) => `${key}/${name}`;

function notify() {
  if (notifyTimer) return;
  notifyTimer = setTimeout(() => {
    notifyTimer = null;
    listeners.forEach((listener) => listener());
  }, NOTIFY_MS);
}

/** @param {() => void} listener  called (at most every 250 ms) when anything changes */
function onChange(listener) {
  listeners.add(listener);
}

/** What is queued, downloading and failed, by album key. */
function status() {
  /** @type {Record<string, { queued: string[], active: Record<string, Progress>, failed: string[] }>} */
  const out = {};
  const of = (key) => (out[key] ??= { queued: [], active: {}, failed: [] });
  for (const job of queue) of(job.key).queued.push(job.name);
  for (const { job, progress } of active.values())
    of(job.key).active[job.name] = progress;
  for (const [key, names] of failed) of(key).failed.push(...names);
  return out;
}

/**
 * Queues files of an album (those already on disk or on the way are skipped; URLs that are not
 * mp3quran audio files are ignored).
 * @param {string} key @param {import("./folder").AlbumInfo} info @param {string[]} urls
 * @returns {Promise<boolean>}
 */
async function enqueue(key, info, urls) {
  if (!folder.KEY_RE.test(key)) return false;
  await folder.writeAlbumInfo(key, info);
  for (const url of urls) {
    const name = fileNameOf(url);
    const file = name && folder.filePath(key, name);
    if (!name || !file || fs.existsSync(file)) continue;
    const id = jobId(key, name);
    if (active.has(id) || queue.some((j) => jobId(j.key, j.name) === id))
      continue;
    failed.get(key)?.delete(name);
    queue.push({ key, name, url });
  }
  notify();
  pump();
  return true;
}

/**
 * Stops an album's downloads (or some files'). The .part files stay so a new try resumes,
 * unless `discard`.
 * @param {string} key @param {{ names?: string[], discard?: boolean }} [options]
 */
async function stop(key, { names, discard = false } = {}) {
  const match = (j) =>
    j.key === key && (names === undefined || names.includes(j.name));
  queue = queue.filter((j) => !match(j));
  const stopped = [...active.values()].filter(({ job }) => match(job));
  stopped.forEach(({ controller }) => controller.abort());
  if (names === undefined) failed.delete(key);
  else names.forEach((name) => failed.get(key)?.delete(name));
  if (discard) {
    for (const { job } of stopped) {
      active.delete(jobId(job.key, job.name));
      const file = folder.filePath(job.key, job.name);
      if (file) await fs.promises.rm(`${file}.part`, { force: true });
    }
  }
  notify();
}

/** Stops everything (before the folder moves, or all downloads are deleted). */
async function stopAll() {
  const keys = new Set(
    [...queue, ...[...active.values()].map((a) => a.job)].map((j) => j.key),
  );
  for (const key of keys) await stop(key);
  // wait for the aborted transfers to let go of their files
  while (active.size) await new Promise((r) => setTimeout(r, 50));
}

function pump() {
  while (active.size < PARALLEL && queue.length) {
    const job = /** @type {Job} */ (queue.shift());
    const controller = new AbortController();
    const entry = { job, controller, progress: { received: 0, total: 0 } };
    active.set(jobId(job.key, job.name), entry);
    run(entry).finally(() => {
      active.delete(jobId(job.key, job.name));
      notify();
      pump();
    });
  }
}

/** @param {{ job: Job, controller: AbortController, progress: Progress }} entry */
async function run(entry) {
  const { job, controller } = entry;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    if (controller.signal.aborted) return;
    try {
      await transfer(entry);
      return;
    } catch (err) {
      if (controller.signal.aborted) return;
      log.warn(
        `${job.key}/${job.name} try ${attempt + 1} failed:`,
        err.message,
      );
      if (attempt < RETRIES)
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1) ** 2));
    }
  }
  if (!failed.has(job.key)) failed.set(job.key, new Set());
  failed.get(job.key)?.add(job.name);
}

/** One try: resumes the .part when the server allows it, renames it when complete. */
async function transfer({ job, controller, progress }) {
  const file = /** @type {string} */ (folder.filePath(job.key, job.name));
  const part = `${file}.part`;
  const have = (await fs.promises.stat(part).catch(() => null))?.size ?? 0;

  // this try's own signal: a stall ends the try (and is retried), a stop ends the job
  const attempt = new AbortController();
  const onStop = () => attempt.abort();
  controller.signal.addEventListener("abort", onStop);
  let stall = setTimeout(() => attempt.abort(), STALL_MS);
  const resetStall = () => {
    clearTimeout(stall);
    stall = setTimeout(() => attempt.abort(), STALL_MS);
  };
  try {
    const res = await net.fetch(job.url, {
      headers: have ? { Range: `bytes=${have}-` } : {},
      signal: attempt.signal,
      cache: "no-store",
    });
    if (res.status === 416 && have) {
      // the .part is already whole (stopped just before the rename)
      await res.body?.cancel();
      await fs.promises.rename(part, file);
      return;
    }
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const resumed =
      res.status === 206 &&
      /^bytes (\d+)-/.exec(res.headers.get("content-range") ?? "")?.[1] ===
        String(have);
    const length = Number(res.headers.get("content-length")) || 0;
    progress.received = resumed ? have : 0;
    progress.total = length ? progress.received + length : 0;

    const out = fs.createWriteStream(part, { flags: resumed ? "a" : "w" });
    const finished = new Promise((resolve, reject) => {
      out.on("finish", resolve);
      out.on("error", reject);
    });
    const reader = res.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        resetStall();
        progress.received += value.byteLength;
        if (!out.write(value)) await new Promise((r) => out.once("drain", r));
        notify();
      }
    } finally {
      out.end();
      await finished;
    }
    if (progress.total && progress.received < progress.total)
      throw new Error("connection closed early");
    await fs.promises.rename(part, file);
  } finally {
    clearTimeout(stall);
    controller.signal.removeEventListener("abort", onStop);
  }
}

/**
 * The size of each file (HEAD requests, 6 at a time), by file name, for "Download all · 1.4 GB".
 * Unknown sizes are left out.
 * @param {string[]} urls
 * @returns {Promise<Record<string, number>>}
 */
async function remoteSizes(urls) {
  /** @type {Record<string, number>} */
  const sizes = {};
  const todo = urls.filter((url) => fileNameOf(url));
  const worker = async () => {
    while (todo.length) {
      const url = /** @type {string} */ (todo.shift());
      const name = /** @type {string} */ (fileNameOf(url));
      try {
        const res = await net.fetch(url, {
          method: "HEAD",
          signal: AbortSignal.timeout(10_000),
        });
        const size = Number(res.headers.get("content-length"));
        if (res.ok && size > 0) sizes[name] = size;
      } catch {
        // offline or slow: that size stays unknown
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  return sizes;
}

const isBusy = () => active.size > 0 || queue.length > 0;

module.exports = {
  isAudioServer,
  fileNameOf,
  onChange,
  status,
  enqueue,
  stop,
  stopAll,
  remoteSizes,
  isBusy,
};
