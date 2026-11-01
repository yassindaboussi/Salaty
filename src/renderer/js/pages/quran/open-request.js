"use strict";

// Another page can open the Quran at one ayah (the 99 Names page: the verses where a name
// appears). It leaves { surah, ayah, back } in sessionStorage and opens this page; the request is
// used once. The ayah is scrolled to and marked, and both back buttons return to that page.
const { ipcRenderer } = require("electron");
const { byId } = require("../../core/dom");
const { SURAH_META } = require("./state");

const KEY = "quranOpenAyah";

/** @returns {{ surah: number, ayah: number, back: string } | null} */
function takeOpenRequest() {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const { surah, ayah, back } = JSON.parse(raw);
    const meta = SURAH_META.find((s) => s.n === surah);
    if (!meta || !(ayah >= 1 && ayah <= meta.count)) return null;
    return { surah, ayah, back: back === "asma" ? back : "features" };
  } catch {
    return null;
  }
}

/** @param {number} ayah */
function revealAyah(ayah) {
  const el = document.getElementById(`ayah-${ayah}`);
  if (!el) return;
  el.classList.add("is-target");
  el.scrollIntoView({ block: "center" });
}

/**
 * @param {(surah: number) => Promise<void>} openSurah
 * @param {() => void} showSurahList  the reader's own back (to the surah list)
 */
function handleOpenRequest(openSurah, showSurahList) {
  const request = takeOpenRequest();
  const readerBack = byId("readerBackBtn", HTMLButtonElement);
  if (!request) {
    readerBack.addEventListener("click", showSurahList);
    return;
  }
  byId("backBtn", HTMLButtonElement).dataset.back = request.back;
  readerBack.addEventListener("click", () =>
    ipcRenderer.invoke("navigate-to", request.back),
  );
  openSurah(request.surah).then(() => revealAyah(request.ayah));
}

module.exports = { handleOpenRequest };
