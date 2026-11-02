"use strict";

// The video: asks the main process for the channel's live video, then plays it in YouTube's
// embedded player. Until then, or when it cannot be found (offline), a message says so, with
// "Try again". The last video that worked is kept (localStorage) for when the lookup fails.
const { ipcRenderer } = require("electron");
const { t, getLanguage } = require("../../core/i18n");
const { byId } = require("../../core/dom");
const { embedUrl } = require("./channels");

const LAST_KEY = "haramainLiveVideos"; // { makkah: "<video id>", madina: "<video id>" }
let loadId = 0; // a quicker later channel wins over a slower earlier one

/** @returns {Record<string, string>} */
function lastVideos() {
  try {
    const saved = JSON.parse(localStorage.getItem(LAST_KEY) ?? "{}");
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

/** @param {string} key @param {string} id */
function remember(key, id) {
  try {
    localStorage.setItem(
      LAST_KEY,
      JSON.stringify({ ...lastVideos(), [key]: id }),
    );
  } catch {
    // storage unavailable: found again next time
  }
}

/** @param {"loading" | "offline" | ""} state  "" shows the video */
function showMessage(state) {
  const message = byId("lvMessage", HTMLElement);
  message.hidden = !state;
  byId("lvFrame", HTMLIFrameElement).hidden = Boolean(state);
  byId("lvMessageText", HTMLElement).textContent =
    state === "offline" ? t("lvOffline") : t("lvLoading");
  message.classList.toggle("is-offline", state === "offline");
  // no "Live" tag on the mosque while its video cannot be shown
  byId("lvLayout", HTMLElement).classList.toggle(
    "is-offline",
    state === "offline",
  );
  byId("lvRetry", HTMLButtonElement).hidden = state !== "offline";
}

/** @param {string} key "makkah" | "madina" */
async function playChannel(key) {
  const id = ++loadId;
  const frame = byId("lvFrame", HTMLIFrameElement);
  frame.src = "about:blank"; // the other mosque's sound stops at once
  showMessage("loading");
  /** @type {string | null} */
  let video = null;
  try {
    video = await ipcRenderer.invoke("get-haramain-live", key);
  } catch (err) {
    console.warn("[Livestreams] the live video could not be found:", err);
  }
  if (id !== loadId) return;
  video = video || lastVideos()[key];
  if (!video || !navigator.onLine) {
    showMessage("offline");
    return;
  }
  remember(key, video);
  frame.src = embedUrl(video, getLanguage());
  showMessage("");
}

function stop() {
  loadId++;
  byId("lvFrame", HTMLIFrameElement).src = "about:blank";
}

module.exports = { playChannel, stop };
