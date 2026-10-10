"use strict";

const { ipcRenderer } = require("electron");
const { setupConnectionRecovery } = require("../services/connection-recovery");
const analytics = require("../services/analytics");

const STREAM_SOURCES = {
  makkah: "https://makkahlive.netlify.app/makkah",
  madina: "https://makkahlive.netlify.app/madina",
};

function initLiveStreamsPage() {
  setupConnectionRecovery(() => {
    reloadActiveStream();
  }, "Livestreams");

  const backBtn = document.getElementById("backBtn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      stopAllStreams();
      ipcRenderer.invoke("navigate-to", "features");
    });
  }

  const closeBtn = document.getElementById("closeBtn");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      stopAllStreams();
    });
  }

  initTabs();

  loadStream("makkah");
}

function loadStream(streamKey) {
  const iframe = document.getElementById(`iframe-${streamKey}`);
  if (iframe && !iframe.src.includes(STREAM_SOURCES[streamKey])) {
    iframe.src = STREAM_SOURCES[streamKey];
  }
}

function stopStream(streamKey) {
  const iframe = document.getElementById(`iframe-${streamKey}`);
  if (iframe) {
    iframe.src = "about:blank";
  }
}

function stopAllStreams() {
  Object.keys(STREAM_SOURCES).forEach((key) => stopStream(key));
}

function reloadActiveStream() {
  const streamKeys = ["makkah", "madina"];
  const tabs = document.querySelectorAll(".channel-tab");
  const activeIndex = Array.from(tabs).findIndex((tab) =>
    tab.classList.contains("active"),
  );
  const activeKey = streamKeys[activeIndex] ?? "makkah";
  stopStream(activeKey);
  loadStream(activeKey);
}

function initTabs() {
  const tabs = document.querySelectorAll(".channel-tab");
  const panels = document.querySelectorAll(".stream-panel");
  const streamKeys = ["makkah", "madina"];

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      const currentIndex = Array.from(tabs).findIndex((tabEl) =>
        tabEl.classList.contains("active"),
      );
      if (currentIndex === index) return;

      stopStream(streamKeys[currentIndex]);

      panels[currentIndex].classList.remove("active");
      panels[currentIndex].classList.add("prev");
      setTimeout(() => panels[currentIndex].classList.remove("prev"), 380);

      tabs.forEach((tabEl) => {
        tabEl.classList.remove("active");
        tabEl.setAttribute("aria-selected", "false");
      });
      tab.classList.add("active");
      tab.setAttribute("aria-selected", "true");
      panels[index].classList.add("active");

      loadStream(streamKeys[index]);

      analytics.livestreamSwitch(streamKeys[index]);
    });
  });
}

module.exports = { initLiveStreamsPage };
