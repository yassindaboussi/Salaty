"use strict";

// The About section: app version, GitHub and contact buttons, and the update check (download
// progress, install).
const { ipcRenderer } = require("electron");
const { t } = require("../../core/i18n");
const { showToast } = require("../../core/toast");
const analytics = require("../../services/analytics");
const { query } = require("../../core/dom");

async function initAboutSection() {
  try {
    const version = await ipcRenderer.invoke("get-app-version");
    const versionEl = document.getElementById("appVersionDisplay");
    if (versionEl) versionEl.textContent = `v${version}`;
  } catch (error) {
    console.error("Error fetching app version:", error);
  }

  const statusIcon = document.getElementById("aboutStatusIcon");
  const statusText = document.getElementById("aboutStatusText");
  const checkBtn = document.getElementById("aboutCheckUpdateBtn");
  const checkLabel = document.getElementById("aboutCheckLabel");
  const progressWrap = document.getElementById("aboutProgressWrap");
  const progressFill = document.getElementById("aboutProgressFill");
  const progressText = document.getElementById("aboutProgressText");
  const installBtn = document.getElementById("aboutInstallBtn");
  const githubBtn = document.getElementById("aboutGithubBtn");
  const contactBtn = document.getElementById("aboutContactBtn");
  const contactIcon = document.getElementById("aboutContactIcon");

  if (statusText) statusText.textContent = t("upToDate");

  githubBtn?.addEventListener("click", () => {
    ipcRenderer.invoke(
      "open-external",
      "https://github.com/yassindaboussi/Salaty",
    );
  });

  if (contactBtn) {
    const email = contactBtn.dataset.email;
    contactBtn.addEventListener("click", async () => {
      try {
        await ipcRenderer.invoke("clipboard-write-text", email);
        showToast(t("emailCopied"), "success");

        if (contactIcon) contactIcon.className = "fas fa-check";
        contactBtn.classList.add("copied");
        setTimeout(() => {
          if (contactIcon) contactIcon.className = "fas fa-envelope";
          contactBtn.classList.remove("copied");
        }, 1500);
      } catch (err) {
        console.error("Failed to copy email:", err);
      }
    });
  }

  if (!(checkBtn instanceof HTMLButtonElement)) return;

  // How this copy gets new versions (main/windows/updater.js): the Microsoft Store build has
  // nothing to check; on macOS "Download" opens the download page instead.
  const updateMode = await ipcRenderer
    .invoke("get-update-mode")
    .catch(() => "auto");
  if (updateMode === "store") {
    checkBtn.classList.add("hidden");
    if (statusText) statusText.textContent = t("updatesFromStore");
    return;
  }

  function setStatus(type, text) {
    const icons = {
      ok: "fa-circle-check",
      checking: "fa-rotate",
      available: "fa-circle-arrow-down",
      downloading: "fa-circle-arrow-down",
      ready: "fa-bolt-lightning",
      error: "fa-circle-exclamation",
    };
    const colorClass =
      {
        checking: "checking",
        available: "available",
        downloading: "available",
        error: "error",
      }[type] || "";

    if (statusIcon) {
      statusIcon.className =
        `fas ${icons[type] || "fa-circle-check"} about-status-icon ${colorClass}`.trim();
    }
    if (statusText) statusText.textContent = text;
  }

  let isManualCheckInFlight = false;

  const CHECK_TIMEOUT_MS = 20000;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let checkTimeoutId = null;

  function clearCheckTimeout() {
    if (checkTimeoutId) {
      clearTimeout(checkTimeoutId);
      checkTimeoutId = null;
    }
  }

  // An arrow function (not a hoisted declaration), so the type checker knows checkBtn is set here.
  const startFreshCheck = () => {
    isManualCheckInFlight = true;
    checkBtn.disabled = true;
    setStatus("checking", t("checkingForUpdates"));

    clearCheckTimeout();
    checkTimeoutId = setTimeout(() => {
      if (!isManualCheckInFlight) return;
      isManualCheckInFlight = false;
      setStatus("error", t("updateCheckFailed"));
      checkBtn.disabled = false;
    }, CHECK_TIMEOUT_MS);

    ipcRenderer.invoke("check-for-updates-manual").catch(() => {
      clearCheckTimeout();
      isManualCheckInFlight = false;
      setStatus("error", t("updateCheckFailed"));
      checkBtn.disabled = false;
    });
  };

  checkBtn.onclick = startFreshCheck;

  if (window.location.hash === "#check-updates") {
    document
      .getElementById("aboutSection")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    startFreshCheck();
  }

  ipcRenderer.on("update-available", (_ev, info) => {
    clearCheckTimeout();
    isManualCheckInFlight = false;
    analytics.track("update_available", { version: info.version });
    setStatus("available", `v${info.version} ${t("isAvailable")}`);
    checkBtn.disabled = false;
    const canInstall = updateMode === "auto";
    if (checkLabel)
      checkLabel.textContent = t(canInstall ? "download" : "openDownloadPage");
    query("i", HTMLElement, checkBtn).className = canInstall
      ? "fas fa-download"
      : "fas fa-arrow-up-right-from-square";
    checkBtn.onclick = () => {
      ipcRenderer.send("start-download");
      if (!canInstall) return; // the download page opened in the browser
      checkBtn.disabled = true;
      setStatus("downloading", `${t("downloading")}…`);
      progressWrap?.classList.remove("hidden");
    };
  });

  ipcRenderer.on("update-not-available", () => {
    clearCheckTimeout();
    isManualCheckInFlight = false;
    setStatus("ok", t("upToDate"));
    checkBtn.disabled = false;
  });

  ipcRenderer.on("update-error", (_ev, message) => {
    clearCheckTimeout();
    console.error("[Updater] Error:", message);
    analytics.error("update_check", message || "unknown");

    progressWrap?.classList.add("hidden");
    checkBtn.onclick = startFreshCheck;
    checkBtn.disabled = false;

    if (isManualCheckInFlight) {
      setStatus("error", t("updateCheckFailed"));
    }
    isManualCheckInFlight = false;
  });

  ipcRenderer.on("download-progress", (_ev, prog) => {
    const pct = Math.round(prog.percent);
    if (progressFill) progressFill.style.width = `${pct}%`;
    if (progressText) progressText.textContent = `${pct}%`;
    setStatus("downloading", `${t("downloading")} ${pct}%`);
  });

  ipcRenderer.on("update-downloaded", () => {
    analytics.track("update_downloaded");
    progressWrap?.classList.add("hidden");
    installBtn?.classList.remove("hidden");
    checkBtn.classList.add("hidden");
    setStatus("ready", t("readyToInstall"));
    installBtn?.addEventListener(
      "click",
      () => ipcRenderer.send("install-update"),
      { once: true },
    );
  });
}

module.exports = { initAboutSection };
