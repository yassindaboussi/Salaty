"use strict";

// The "new version" dialog on the home page, driven by the auto-updater in main
// (main/windows/updater.js). One dialog, four states, each with only the actions that make sense
// then:
//   available    what's new, Download (or "Open download page" where the app can't update itself)
//   downloading  a real progress bar (MB done of total), Hide: the download goes on
//   ready        Restart now, or Later: it installs when the app quits (autoInstallOnAppQuit)
//   failed       Try again, Close
// Hidden while downloading, it comes back by itself when the update is ready (or failed).
const { ipcRenderer } = require("electron");
const { t, getLocaleTag } = require("../core/i18n");
const { byId } = require("../core/dom");

const MB = 1024 * 1024;

/** @typedef {"available" | "downloading" | "ready" | "failed"} UpdateState */

/** @type {UpdateState} */
let current = "available";
let version = "";
let installed = "";
let updateMode = "auto"; // "auto" installs here; otherwise the download page (main)

const dialog = () => byId("updateDialog", HTMLDialogElement);
const primary = () => byId("updatePrimary", HTMLButtonElement);
const secondary = () => byId("updateSecondary", HTMLButtonElement);

/** @param {string} id @param {string} text */
const setText = (id, text) => {
  byId(id, HTMLElement).textContent = text;
};

const megabytes = (/** @type {number} */ bytes) =>
  new Intl.NumberFormat(`${getLocaleTag()}-u-nu-latn`, {
    style: "unit",
    unit: "megabyte",
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(bytes / MB);

/** @param {UpdateState} state */
function render(state) {
  current = state;
  const box = dialog();
  box.dataset.state = state;
  const icon = {
    available: "fa-circle-arrow-down",
    downloading: "fa-circle-arrow-down",
    ready: "fa-circle-check",
    failed: "fa-triangle-exclamation",
  }[state];
  byId("updateIcon", HTMLElement).className = `fas ${icon}`;

  const auto = updateMode === "auto";
  const texts = {
    available: {
      title: "updTitleAvailable",
      text: t(installed ? "updTextAvailable" : "updTextAvailableShort")
        .replace("{version}", version)
        .replace("{installed}", installed),
      primary: auto ? "updDownload" : "openDownloadPage",
      secondary: "later",
    },
    downloading: {
      title: "updTitleDownloading",
      text: t("updTextDownloading"),
      primary: "",
      secondary: "updHide",
    },
    ready: {
      title: "updTitleReady",
      text: t("updTextReady").replace("{version}", version),
      primary: "updRestart",
      secondary: "later",
    },
    failed: {
      title: "updTitleFailed",
      text: t("updTextFailed"),
      primary: "updRetry",
      secondary: "updClose",
    },
  }[state];
  setText("updateTitle", t(texts.title));
  setText("updateText", texts.text);
  primary().hidden = !texts.primary;
  if (texts.primary) primary().textContent = t(texts.primary);
  secondary().textContent = t(texts.secondary);
  byId("updateWhatsNew", HTMLElement).hidden = state !== "available";
  byId("updateLaterNote", HTMLElement).hidden = state !== "ready";
  byId("updateProgress", HTMLElement).hidden = state !== "downloading";
}

/** @param {number} percent @param {number} [transferred] @param {number} [total] */
function showProgress(percent, transferred, total) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  const bar = byId("updateBar", HTMLElement);
  bar.setAttribute("aria-valuenow", String(pct));
  byId("updateBarFill", HTMLElement).style.width = `${pct}%`;
  setText(
    "updateProgressText",
    total
      ? t("updProgress")
          .replace("{done}", megabytes(transferred ?? 0))
          .replace("{total}", megabytes(total))
          .replace("{percent}", String(pct))
      : `${pct}%`,
  );
}

function open() {
  if (!dialog().open) dialog().showModal();
  // the main action has the focus (Enter), not the ✕ that comes first
  (primary().hidden ? secondary() : primary()).focus();
}

function onPrimary() {
  if (current === "available" || current === "failed") {
    ipcRenderer.send("start-download");
    if (updateMode !== "auto") {
      dialog().close(); // main opens the download page in the browser
      return;
    }
    showProgress(0);
    render("downloading");
    secondary().focus();
  } else if (current === "ready") {
    ipcRenderer.send("install-update");
  }
}

function initUpdateDialog() {
  ipcRenderer
    .invoke("get-update-mode")
    .then((mode) => (updateMode = mode))
    .catch(() => {});
  ipcRenderer
    .invoke("get-app-version")
    .then((v) => (installed = String(v ?? "")))
    .catch(() => {});

  primary().addEventListener("click", onPrimary);
  secondary().addEventListener("click", () => dialog().close());
  byId("updateClose", HTMLButtonElement).addEventListener("click", () =>
    dialog().close(),
  );
  // a click on the dimmed backdrop closes it, as Esc does
  dialog().addEventListener("click", (e) => {
    if (e.target === dialog()) dialog().close();
  });

  ipcRenderer.on("update-available", (_e, info) => {
    if (current === "downloading" || current === "ready") return;
    version = String(info?.version ?? "");
    render("available");
    open();
  });
  ipcRenderer.on("download-progress", (_e, p) => {
    if (current !== "downloading") render("downloading");
    showProgress(p?.percent ?? 0, p?.transferred, p?.total);
  });
  ipcRenderer.on("update-downloaded", (_e, info) => {
    if (info?.version) version = String(info.version);
    render("ready");
    open();
  });
  // only a failed download is shown here; a failed check is silent (Settings shows it)
  ipcRenderer.on("update-error", () => {
    if (current !== "downloading") return;
    render("failed");
    open();
  });
}

module.exports = { initUpdateDialog };
