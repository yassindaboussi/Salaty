"use strict";

// Settings → Downloads & storage: how much the downloaded recitations take and what is left on
// the drive, where they are (Open folder in Explorer, Change… to move them to another drive,
// back to the default folder), Manage downloads (the archive's Downloads tab) and Delete all.
// A folder that disappeared (USB drive unplugged) is said plainly, with Change / Default.
const { ipcRenderer } = require("electron");
const { t } = require("../../core/i18n");
const { byId } = require("../../core/dom");
const { showConfirmDialog } = require("../../components/confirm-dialog");
const dl = require("../../services/downloads");

/** @type {import("../../services/downloads").Overview | null} */
let view = null;
let moving = false;

const used = () => (view?.albums ?? []).reduce((a, b) => a + b.bytes, 0);

/** @param {string} message  "" hides it */
function showError(message) {
  const box = byId("stStorageError", HTMLElement);
  box.textContent = message;
  box.hidden = !message;
}

function render() {
  if (!view) return;
  const bytes = used();
  const count = view.albums.length;
  byId("stStorageUsed", HTMLElement).textContent = [
    t("dlUsedBy")
      .replace("{used}", dl.formatBytes(bytes))
      .replace("{count}", String(count)),
    view.disk
      ? t("dlFree").replace("{free}", dl.formatBytes(view.disk.free))
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
  // the bar: Salaty's share of what is taken on the drive plus Salaty
  const share = view.disk ? bytes / Math.max(1, bytes + view.disk.free) : 0;
  const percent = Math.min(100, Math.round(share * 100));
  byId("stStorageFill", HTMLElement).style.width =
    `${bytes ? Math.max(percent, 1) : 0}%`;
  byId("stStorageMeter", HTMLElement).setAttribute(
    "aria-valuenow",
    String(percent),
  );
  byId("stStoragePath", HTMLElement).textContent = view.dir;
  byId("stStorageReset", HTMLButtonElement).hidden = view.isDefault;
  if (!view.available) showError(t("dlFolderMissing"));
  for (const id of ["stStorageOpen", "stStorageChange", "stStorageReset"])
    byId(id, HTMLButtonElement).disabled = moving;
  byId("stStorageOpen", HTMLButtonElement).disabled = moving || !view.available;
  byId("stStorageDeleteAll", HTMLButtonElement).disabled = moving || !count;
}

async function refresh() {
  view = await dl.overview();
  render();
}

/** @param {"ok" | "same" | "failed" | "canceled"} result */
function afterMove(result) {
  moving = false;
  showError(result === "failed" ? t("dlMoveFailed") : "");
  return refresh();
}

async function move(/** @type {"change" | "reset"} */ how) {
  moving = true;
  showError("");
  render();
  byId("stStoragePath", HTMLElement).textContent = t("dlMoving");
  const result =
    how === "change"
      ? await ipcRenderer.invoke("downloads-change-folder", t("dlChangeFolder"))
      : await ipcRenderer.invoke("downloads-reset-folder");
  await afterMove(result);
}

function initStorage() {
  byId("stStorageOpen", HTMLButtonElement).addEventListener(
    "click",
    async () => {
      const result = await ipcRenderer.invoke("downloads-open-folder");
      showError(result === "ok" ? "" : t("dlFolderMissing"));
    },
  );
  byId("stStorageChange", HTMLButtonElement).addEventListener("click", () =>
    move("change"),
  );
  byId("stStorageReset", HTMLButtonElement).addEventListener("click", () =>
    move("reset"),
  );
  byId("stStorageManage", HTMLButtonElement).addEventListener("click", () => {
    try {
      const prefs = JSON.parse(localStorage.getItem("archivePrefs") ?? "{}");
      localStorage.setItem(
        "archivePrefs",
        JSON.stringify({ ...prefs, tab: "downloads" }),
      );
    } catch {
      // storage unavailable: the archive opens on its last tab
    }
    ipcRenderer.invoke("navigate-to", "albums");
  });
  byId("stStorageDeleteAll", HTMLButtonElement).addEventListener(
    "click",
    async () => {
      const ok = await showConfirmDialog(
        t("dlDeleteAllConfirm").replace("{size}", dl.formatBytes(used())),
        { confirmText: t("dlDelete"), confirmClass: "btn-danger" },
      );
      if (!ok) return;
      await ipcRenderer.invoke("downloads-delete-all");
      await refresh();
    },
  );
  // files deleted in Explorer meanwhile: the numbers follow when the window comes back
  window.addEventListener("focus", () => {
    if (!moving) refresh();
  });
  let lastBusy = -1;
  dl.onDownloadsChanged((status) => {
    const busy = Object.values(status).reduce(
      (a, s) => a + s.queued.length + Object.keys(s.active).length,
      0,
    );
    if (busy !== lastBusy && !moving) refresh();
    lastBusy = busy;
  });
  refresh();
}

module.exports = { initStorage };
