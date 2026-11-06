"use strict";

// The side panel: the chosen name in full (meaning, explanation, the verses where it appears),
// copy, previous / next. A verse opens the app's Quran page at that ayah: the request is left in
// sessionStorage (same window, so it is still there when the Quran page starts).
const { ipcRenderer } = require("electron");
const { t } = require("../../core/i18n");
const { byId } = require("../../core/dom");
const { showToast } = require("../../core/toast");
const { copyText } = require("../../core/clipboard");
const analytics = require("../../services/analytics");
const { html, setHtml } = require("../../utils/html");
const { pageState, nameByNumber, surahName } = require("./state");

const QURAN_REQUEST = "quranOpenAyah";
const lang = () => document.documentElement.lang;

/** @param {import("./state").VerseRef} v */
const verseRef = (v) =>
  v.last > v.ayah ? `${v.surah}:${v.ayah}-${v.last}` : `${v.surah}:${v.ayah}`;

function renderVerses(verses) {
  const list = byId("anVerses", HTMLElement);
  byId("anVersesTitle", HTMLElement).hidden = verses.length === 0;
  setHtml(
    list,
    html`${verses.map((v) => {
      const surah = surahName(v.surah, lang());
      const ref = verseRef(v);
      const label = t("anVerseLabel")
        .replace("{surah}", surah)
        .replace("{ref}", ref);
      return html`<li><button type="button" class="an-verse" data-surah="${v.surah}" data-ayah="${v.ayah}" aria-label="${label}" title="${label}"><span class="an-verse-surah">${surah}</span><span class="an-verse-ref" dir="ltr">${ref}</span></button></li>`;
    })}`,
  );
}

function renderDetail() {
  const n = nameByNumber(pageState.selected);
  const arabic = lang() === "ar";
  byId("anName", HTMLElement).textContent = n.name;
  const translit = byId("anTranslit", HTMLElement);
  translit.textContent = n.translit;
  translit.hidden = arabic; // an Arabic reader does not need the Latin spelling
  byId("anMeaning", HTMLElement).textContent = n.meaning;
  const desc = byId("anDesc", HTMLElement);
  desc.textContent = n.desc;
  desc.hidden = !n.desc || n.desc === n.meaning;
  byId("anNumber", HTMLElement).textContent = t("anOf").replace(
    "{number}",
    String(n.number),
  );
  byId("anPrev", HTMLButtonElement).disabled = n.number <= 1;
  byId("anNext", HTMLButtonElement).disabled = n.number >= 99;
  renderVerses(n.verses);
  byId("anDetail", HTMLElement)
    .querySelector(".an-detail-body")
    ?.scrollTo(0, 0);
}

/** @param {string} text */
async function copy(text) {
  if (await copyText(text)) {
    analytics.asmaCopied();
    showToast(t("copiedToClipboard"), "success"); // the app's toast, as in the Quran reader
  } else {
    showToast(t("failedToCopy"), "error");
  }
}

function copySelected() {
  const n = nameByNumber(pageState.selected);
  const title =
    lang() === "ar"
      ? `${n.name} — ${n.meaning}`
      : `${n.name} — ${n.translit} — ${n.meaning}`;
  copy(n.desc && n.desc !== n.meaning ? `${title}\n${n.desc}` : title);
}

/** @param {(number: number) => void} choose */
function bindDetail(choose) {
  byId("anCopy", HTMLButtonElement).addEventListener("click", copySelected);
  byId("anPrev", HTMLButtonElement).addEventListener("click", () =>
    choose(pageState.selected - 1),
  );
  byId("anNext", HTMLButtonElement).addEventListener("click", () =>
    choose(pageState.selected + 1),
  );
  byId("anVerses", HTMLElement).addEventListener("click", (e) => {
    const verse = /** @type {Element} */ (e.target).closest(".an-verse");
    if (!(verse instanceof HTMLButtonElement)) return;
    try {
      sessionStorage.setItem(
        QURAN_REQUEST,
        JSON.stringify({
          surah: Number(verse.dataset.surah),
          ayah: Number(verse.dataset.ayah),
          back: "asma",
        }),
      );
    } catch {
      // storage unavailable: the Quran page opens on its list
    }
    ipcRenderer.invoke("navigate-to", "quran");
  });
}

module.exports = { renderDetail, bindDetail, copy };
