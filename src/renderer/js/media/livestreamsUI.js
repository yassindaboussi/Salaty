const { ipcRenderer } = require("electron");
const { setupConnectionRecovery } = require("../services/connection-recovery");
const { t } = require("../core/i18n/translations");
const analytics = require("../utils/analytics");

const STREAM_SOURCES = {
  makkah: "https://makkahlive.netlify.app/makkah",
  madina: "https://makkahlive.netlify.app/madina",
};

function initLiveStreamsPage() {
  setupConnectionRecovery(() => {
    reloadActiveStream();
  }, "Livestreams");
  updateStreamsUI();

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
      const currentIndex = Array.from(tabs).findIndex((t) =>
        t.classList.contains("active"),
      );
      if (currentIndex === index) return;

      stopStream(streamKeys[currentIndex]);

      panels[currentIndex].classList.remove("active");
      panels[currentIndex].classList.add("prev");
      setTimeout(() => panels[currentIndex].classList.remove("prev"), 380);

      tabs.forEach((t) => {
        t.classList.remove("active");
        t.setAttribute("aria-selected", "false");
      });
      tab.classList.add("active");
      tab.setAttribute("aria-selected", "true");
      panels[index].classList.add("active");

      loadStream(streamKeys[index]);

      analytics.livestreamSwitch(streamKeys[index]);
    });
  });
}

function updateStreamsUI() {
  const elements = {
    livestreamsTitle: "livestreamsTitle",
    makkahTitle: "makkahLive",
    madinaTitle: "madinaLive",
    tabMakkahLabel: "makkahTab",
    tabMadinaLabel: "madinaTab",
  };

  for (const [id, key] of Object.entries(elements)) {
    const el = document.getElementById(id);
    if (el) {
      const translated = t(key);
      if (translated && translated !== key) el.textContent = translated;
    }
  }

  const makkahLocationSub = document.querySelector(
    "#panelMakkah .stream-location-sub",
  );
  if (makkahLocationSub) {
    makkahLocationSub.textContent = t("makkahLocation");
  }

  const madinaLocationSub = document.querySelector(
    "#panelMadina .stream-location-sub",
  );
  if (madinaLocationSub) {
    madinaLocationSub.textContent = t("madinaLocation");
  }

  const liveBadges = document.querySelectorAll(".live-text");
  liveBadges.forEach((badge) => {
    badge.textContent = t("live");
  });
}

window.addEventListener("languageChanged", () => {
  updateStreamsUI();
});

module.exports = { initLiveStreamsPage };
