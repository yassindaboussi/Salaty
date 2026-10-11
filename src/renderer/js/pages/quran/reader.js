"use strict";

// The reader view: one surah's text, the previous/next surah buttons and the settings panel.
const { t } = require("../../core/i18n");
const analytics = require("../../services/analytics");
const { fetchQuranSurah } = require("../../services/api/alquran-cloud");
const { html, setHtml } = require("../../utils/html");
const { byId } = require("../../core/dom");
const { state, fmt, revelationPlace, SURAH_META } = require("./state");

function updateReaderMeta() {
  const meta = state.currentSurah;
  if (!meta) return;
  byId("readerSurahMeta", HTMLElement).textContent =
    `${t("surah")} ${fmt(meta.n)} · ${fmt(meta.count)} ${t("verses")} · ${revelationPlace(meta)}`;
  byId("readerPageInfo", HTMLElement).textContent =
    `${fmt(meta.n)} / ${fmt(114)}`;
}

async function openSurah(surahNum) {
  const meta = SURAH_META.find((s) => s.n === surahNum);
  if (!meta) return;
  state.currentSurah = meta;

  byId("viewSurahList", HTMLElement).style.display = "none";
  byId("viewSurahReader", HTMLElement).style.display = "";

  state.settingsOpen = true;
  byId("readerSettingsPanel", HTMLElement).style.display = "";

  byId("readerSurahName", HTMLElement).textContent =
    `${meta.ar}  —  ${meta.en}`;
  updateReaderMeta();

  const prevMeta = SURAH_META.find((s) => s.n === surahNum - 1);
  const nextMeta = SURAH_META.find((s) => s.n === surahNum + 1);
  const prevBtn = byId("prevSurahBtn", HTMLButtonElement);
  const nextBtn = byId("nextSurahBtn", HTMLButtonElement);
  const prevLabel = byId("prevSurahLabel", HTMLElement);
  const nextLabel = byId("nextSurahLabel", HTMLElement);

  if (prevMeta) {
    prevBtn.disabled = false;
    prevLabel.textContent = prevMeta.en;
  } else {
    prevBtn.disabled = true;
    prevLabel.textContent = "";
  }
  if (nextMeta) {
    nextBtn.disabled = false;
    nextLabel.textContent = nextMeta.en;
  } else {
    nextBtn.disabled = true;
    nextLabel.textContent = "";
  }

  const bismillah = byId("bismillahHeader", HTMLElement);
  bismillah.style.display = surahNum !== 1 && surahNum !== 9 ? "" : "none";

  await loadAyahs(surahNum);

  byId("readerContent", HTMLElement).scrollTop = 0;

  analytics.featureOpen("quran-surah");
}

let loadAyahsRequestId = 0;

async function loadAyahs(surahNum) {
  const myRequestId = ++loadAyahsRequestId;
  const loading = byId("readerLoading", HTMLElement);
  const ayahList = byId("ayahList", HTMLElement);

  loading.style.display = "flex";
  ayahList.innerHTML = "";

  try {
    const ayahs = await fetchQuranSurah(surahNum, state.translationId);
    if (myRequestId !== loadAyahsRequestId) return;
    state.currentAyahs = ayahs;
    loading.style.display = "none";
    renderAyahs(ayahs);
  } catch (err) {
    if (myRequestId !== loadAyahsRequestId) return;
    console.error("Error loading Quran surah:", err);
    loading.style.display = "none";
    setHtml(
      ayahList,
      html`
      <div class="quran-error">
        <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
        <p>${t("quranError")}</p>
        <button type="button" class="retry-button" id="retryBtn">
          <i class="fas fa-sync-alt" aria-hidden="true"></i> ${t("retry")}
        </button>
      </div>
    `,
    );
    document
      .getElementById("retryBtn")
      ?.addEventListener("click", () => loadAyahs(surahNum));
  }
}

function renderAyahs(ayahs) {
  const list = byId("ayahList", HTMLElement);
  const withTranslation = ayahs.filter((a) => a.translation);
  const showingTranslation =
    state.translationId !== "none" && withTranslation.length > 0;

  let content;

  if (!showingTranslation) {
    // one space between the ayahs (running text, as in the Mushaf)
    const flowHtml = ayahs.map(
      (a, i) =>
        html`${i ? " " : ""}${a.arabic} <span class="ayah-number-inline" data-ayah="${a.number}">﴿${fmt(a.number)}﴾</span>`,
    );
    content = html`<div class="surah-flow-text" id="surahFlowText" style="font-size:${state.fontSize}px">${flowHtml}</div>`;
  } else {
    content = html`<div class="ayah-translation-list" id="ayahTranslationList" style="font-size:${state.fontSize}px">${withTranslation.map(
      (a) =>
        html`<div class="ayah-translation-row"><span class="ayah-translation-num">${fmt(a.number)}.</span> ${a.translation}</div>`,
    )}</div>`;
  }

  setHtml(list, content);
}

function showSurahList() {
  byId("viewSurahReader", HTMLElement).style.display = "none";
  byId("viewSurahList", HTMLElement).style.display = "";
  if (state.settingsOpen) {
    state.settingsOpen = false;
    byId("readerSettingsPanel", HTMLElement).style.display = "none";
  }
}

function toggleSettings() {
  state.settingsOpen = !state.settingsOpen;
  const panel = byId("readerSettingsPanel", HTMLElement);
  panel.style.display = state.settingsOpen ? "" : "none";
}

function closeSettings() {
  state.settingsOpen = false;
  byId("readerSettingsPanel", HTMLElement).style.display = "none";
}

function changeFontSize(delta) {
  state.fontSize = Math.max(18, Math.min(42, state.fontSize + delta));
  byId("fontSizeDisplay", HTMLElement).textContent = fmt(state.fontSize);
  const flowText = document.getElementById("surahFlowText");
  if (flowText) flowText.style.fontSize = `${state.fontSize}px`;
  const translationList = document.getElementById("ayahTranslationList");
  if (translationList) translationList.style.fontSize = `${state.fontSize}px`;
}

module.exports = {
  updateReaderMeta,
  openSurah,
  loadAyahs,
  renderAyahs,
  showSurahList,
  toggleSettings,
  closeSettings,
  changeFontSize,
};
