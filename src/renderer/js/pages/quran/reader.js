"use strict";

// The reader view: one surah. Without a translation the ayahs run on like a Mushaf page, each
// ending with its number ﴿n﴾ (a button: it bookmarks the ayah). With a translation each ayah is a
// card: its number, copy and bookmark icons, the Arabic, then the translation under it.
const { t } = require("../../core/i18n");
const analytics = require("../../services/analytics");
const { fetchQuranSurah } = require("../../services/api/alquran-cloud");
const { html, setHtml } = require("../../utils/html");
const { byId } = require("../../core/dom");
const { refreshTooltips } = require("../../core/tooltips");
const {
  state,
  fmt,
  surahMeta,
  surahName,
  sep,
  revelationPlace,
  ayahCount,
  ayahPlace,
} = require("./state");
const { saveFontSize, clampFont } = require("./storage");
const { isBookmarked } = require("./bookmarks");
const { trackReading, rememberAyah } = require("./reading-position");

/** The language of the chosen translation, for its `lang` attribute. */
const translationLang = () => state.translationId.split(".")[0] || "en";

function updateReaderMeta() {
  const meta = state.currentSurah;
  if (!meta) return;
  const parts = [
    surahName(meta) === meta.ar ? "" : meta.ar,
    `${t("surah")} ${fmt(meta.n)}`,
    ayahCount(meta.count),
    revelationPlace(meta),
  ];
  byId("readerSurahName", HTMLElement).textContent = surahName(meta);
  byId("readerSurahMeta", HTMLElement).textContent = parts
    .filter(Boolean)
    .join(sep());
  byId("readerPageInfo", HTMLElement).textContent =
    `${fmt(meta.n)} / ${fmt(114)}`;

  /** @param {"prev" | "next"} side @param {number} n */
  const navTo = (side, n) => {
    const other = surahMeta(n);
    byId(`${side}SurahBtn`, HTMLButtonElement).disabled = !other;
    byId(`${side}SurahLabel`, HTMLElement).textContent = other
      ? surahName(other)
      : "";
  };
  navTo("prev", meta.n - 1);
  navTo("next", meta.n + 1);
}

/** Shows the ayah in the middle of the reader and marks it for a moment. @param {number} ayah */
function revealAyah(ayah) {
  const el = document.getElementById(`ayah-${ayah}`);
  if (!el) return;
  el.classList.remove("is-target");
  void el.offsetWidth; // restart the mark's fade
  el.classList.add("is-target");
  el.scrollIntoView({ block: ayah === 1 ? "end" : "center" });
}

/**
 * Opens the reader on a surah, at its start or at one ayah.
 * @param {number} surahNum @param {number} [ayah]
 */
async function openSurah(surahNum, ayah) {
  const meta = surahMeta(surahNum);
  if (!meta) return;
  state.currentSurah = meta;

  byId("viewSurahList", HTMLElement).hidden = true;
  byId("viewSurahReader", HTMLElement).hidden = false;
  byId("bismillahHeader", HTMLElement).hidden =
    surahNum === 1 || surahNum === 9;
  updateReaderMeta();

  await loadAyahs(surahNum);
  if (state.currentSurah !== meta) return; // another surah was opened meanwhile

  const content = byId("readerContent", HTMLElement);
  if (ayah && ayah > 1) revealAyah(ayah);
  else content.scrollTop = 0;
  rememberAyah(surahNum, ayah || 1);
  analytics.featureOpen("quran-surah");
}

let loadId = 0;

/** @param {number} surahNum */
async function loadAyahs(surahNum) {
  const id = ++loadId;
  const loading = byId("readerLoading", HTMLElement);
  const list = byId("ayahList", HTMLElement);
  const notice = byId("readerNotice", HTMLElement);
  loading.hidden = false;
  notice.hidden = true;
  setHtml(list, html``);

  try {
    const { ayahs, translationMissing } = await fetchQuranSurah(
      surahNum,
      state.translationId,
    );
    if (id !== loadId) return;
    state.currentAyahs = ayahs;
    loading.hidden = true;
    notice.textContent = translationMissing ? t("quranTranslationOffline") : "";
    notice.hidden = !translationMissing;
    renderAyahs();
  } catch (err) {
    if (id !== loadId) return;
    console.error("Error loading Quran surah:", err);
    loading.hidden = true;
    setHtml(
      list,
      html`<div class="q-empty">
        <i class="fas fa-circle-exclamation" aria-hidden="true"></i>
        <p>${t("quranError")}</p>
        <button type="button" class="q-btn" id="retryBtn">${t("retry")}</button>
      </div>`,
    );
    byId("retryBtn", HTMLButtonElement).addEventListener("click", () =>
      loadAyahs(surahNum),
    );
  }
}

/** @param {number} n */
function bookmarkButton(n) {
  const on = isBookmarked(state.currentSurah?.n ?? 0, n);
  const label = t(on ? "quranRemoveBookmark" : "quranAddBookmark");
  return html`<button type="button" class="q-icon-btn ayah-bookmark${on ? " is-on" : ""}" data-action="bookmark" data-ayah="${n}" aria-pressed="${String(on)}" aria-label="${label}" data-tip="${label}"><i class="${on ? "fas" : "far"} fa-bookmark" aria-hidden="true"></i></button>`;
}

/** The running text of the surah (no translation). */
function flowHtml() {
  return html`<div class="surah-flow" lang="ar" dir="rtl">${state.currentAyahs.map(
    (a) => {
      const on = isBookmarked(state.currentSurah?.n ?? 0, a.number);
      const label = `${t(on ? "quranRemoveBookmark" : "quranAddBookmark")}${sep()}${fmt(a.number)}`;
      return html`<span class="ayah-text" id="ayah-${a.number}" data-ayah="${a.number}">${a.arabic}</span> <button type="button" class="ayah-end${on ? " is-on" : ""}" data-action="bookmark" data-ayah="${a.number}" aria-pressed="${String(on)}" aria-label="${label}" data-tip="${label}"><span class="ayah-end-ring" aria-hidden="true">۝</span><span class="ayah-end-num">${fmt(a.number)}</span></button> `;
    },
  )}</div>`;
}

/** One card per ayah: Arabic, then the translation. */
function cardsHtml() {
  const surah = state.currentSurah?.n ?? 0;
  const lang = translationLang();
  return html`${state.currentAyahs.map(
    (
      a,
    ) => html`<article class="ayah-card" id="ayah-${a.number}" data-ayah="${a.number}">
      <div class="ayah-card-head">
        <span class="ayah-card-num">${fmt(surah)}:${fmt(a.number)}</span>
        <span class="ayah-card-actions">
          <button type="button" class="q-icon-btn" data-action="copy" data-ayah="${a.number}" aria-label="${t("quranCopyAyah")}" data-tip="${t("quranCopyAyah")}"><i class="far fa-copy" aria-hidden="true"></i></button>
          ${bookmarkButton(a.number)}
        </span>
      </div>
      <p class="ayah-card-ar" lang="ar" dir="rtl">${a.arabic}</p>
      ${a.translation ? html`<p class="ayah-card-tr" lang="${lang}" dir="auto">${a.translation}</p>` : ""}
    </article>`,
  )}`;
}

function renderAyahs() {
  const list = byId("ayahList", HTMLElement);
  const cards =
    state.translationId !== "none" &&
    state.currentAyahs.some((a) => a.translation);
  list.classList.toggle("is-cards", cards);
  applyFontSize();
  setHtml(list, cards ? cardsHtml() : flowHtml());
  refreshTooltips();
}

/** The text sizes: the Arabic at the chosen size, a translation a bit over half of it. */
function applyFontSize() {
  const list = byId("ayahList", HTMLElement);
  list.style.setProperty("--q-ar-size", `${state.fontSize}px`);
  list.style.setProperty(
    "--q-tr-size",
    `${Math.max(14, Math.round(state.fontSize * 0.58))}px`,
  );
  byId("fontSizeDisplay", HTMLElement).textContent = fmt(state.fontSize);
  byId("fontDecBtn", HTMLButtonElement).disabled =
    clampFont(state.fontSize - 2) === state.fontSize;
  byId("fontIncBtn", HTMLButtonElement).disabled =
    clampFont(state.fontSize + 2) === state.fontSize;
}

/** @param {number} delta */
function changeFontSize(delta) {
  state.fontSize = clampFont(state.fontSize + delta);
  saveFontSize(state.fontSize);
  applyFontSize();
}

/** The text copied for one ayah: Arabic, translation, then where it is from. @param {number} n */
function ayahCopyText(n) {
  const a = state.currentAyahs.find((x) => x.number === n);
  if (!a || !state.currentSurah) return "";
  return [a.arabic, a.translation, `(${ayahPlace(state.currentSurah.n, n)})`]
    .filter(Boolean)
    .join("\n");
}

/** Brings the bookmark icons up to date in place (no redraw, so the scroll and focus stay). */
function updateBookmarkIcons() {
  const surah = state.currentSurah?.n ?? 0;
  for (const el of byId("ayahList", HTMLElement).querySelectorAll(
    "[data-action='bookmark']",
  )) {
    if (!(el instanceof HTMLButtonElement)) continue;
    const n = Number(el.dataset.ayah);
    const on = isBookmarked(surah, n);
    const label = t(on ? "quranRemoveBookmark" : "quranAddBookmark");
    el.classList.toggle("is-on", on);
    el.setAttribute("aria-pressed", String(on));
    const full = el.classList.contains("ayah-end")
      ? `${label}${sep()}${fmt(n)}`
      : label;
    el.setAttribute("aria-label", full);
    el.setAttribute("data-tip", full);
    const icon = el.querySelector("i");
    if (icon) icon.className = `${on ? "fas" : "far"} fa-bookmark`;
  }
}

function showSurahList() {
  byId("viewSurahReader", HTMLElement).hidden = true;
  byId("viewSurahList", HTMLElement).hidden = false;
  state.currentSurah = null;
}

function bindReader() {
  trackReading(byId("readerContent", HTMLElement));
}

module.exports = {
  updateReaderMeta,
  openSurah,
  loadAyahs,
  renderAyahs,
  revealAyah,
  showSurahList,
  changeFontSize,
  applyFontSize,
  ayahCopyText,
  updateBookmarkIcons,
  bindReader,
};
