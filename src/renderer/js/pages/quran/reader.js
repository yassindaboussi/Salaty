"use strict";

// The reader view: one surah, its title and footer, opening it at an ayah, the text size, the
// ← / → keys. The text itself is drawn by reader-text.js (running text or ayah cards).
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
  surahCount,
} = require("./state");
const { saveFontSize, clampFont } = require("./storage");
const { isBookmarked } = require("./bookmarks");
const { trackReading, rememberAyah } = require("./reading-position");
const { flowHtml, cardsHtml, ayahEndLabel } = require("./reader-text");
const { refreshFind, resetFind } = require("./reader-find");
const { rec } = require("./recitation");
const { recitedAyah, setFollow } = require("./recitation-follow");

function updateReaderMeta() {
  const meta = state.currentSurah;
  if (!meta) return;
  const parts = [
    surahName(meta) === meta.ar ? "" : meta.ar,
    `${t("surah")} ${fmt(meta.n)}`,
    ayahCount(surahCount(meta)),
    revelationPlace(meta),
  ];
  byId("readerSurahName", HTMLElement).textContent = surahName(meta);
  byId("readerSurahMeta", HTMLElement).textContent = parts
    .filter(Boolean)
    .join(sep());

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
  if (state.currentSurah !== meta) resetFind();
  state.currentSurah = meta;

  byId("viewSurahList", HTMLElement).hidden = true;
  const reader = byId("viewSurahReader", HTMLElement);
  reader.hidden = false;
  // the keys scroll the text (focus was left on the hidden list); the prev/next buttons keep it
  if (!reader.contains(document.activeElement))
    byId("readerContent", HTMLElement).focus({ preventScroll: true });
  // Hafs counts the Bismillah of Al-Fatiha as its first ayah; Qalun and Warsh do not, so there
  // it is written above the surah like for the others. At-Tawba has none.
  byId("bismillahHeader", HTMLElement).hidden =
    surahNum === 9 || (surahNum === 1 && state.riwaya === "hafs");
  updateReaderMeta();

  await loadAyahs(surahNum);
  if (state.currentSurah !== meta) return; // another surah was opened meanwhile

  const content = byId("readerContent", HTMLElement);
  // the surah being recited, opened without an ayah: at the ayah recited, followed from there
  // (its timings not loaded yet: the follow brings the text to it when they are)
  const playing =
    rec.track?.surah === surahNum && rec.track.riwaya === state.riwaya;
  const recited = ayah ? 0 : recitedAyah(surahNum);
  if (playing && !ayah) setFollow(true);
  if (ayah && ayah > 1) revealAyah(ayah);
  else if (recited) {
    document
      .getElementById(`ayah-${recited}`)
      ?.scrollIntoView({ block: "center" });
  } else content.scrollTop = 0;
  rememberAyah(surahNum, ayah || recited || 1);
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
    const { ayahs, translationMissing, bismillah } = await fetchQuranSurah(
      surahNum,
      state.translationId,
      state.riwaya,
    );
    if (id !== loadId) return;
    state.currentAyahs = ayahs;
    // the Bismillah as the riwaya's text writes it (the page's own line is the Hafs one)
    const header = byId("bismillahHeader", HTMLElement);
    header.dataset.hafs ??= header.textContent?.trim() ?? "";
    header.textContent = bismillah ?? header.dataset.hafs;
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

function renderAyahs() {
  const list = byId("ayahList", HTMLElement);
  const cards =
    state.translationId !== "none" &&
    state.currentAyahs.some((a) => a.translation);
  list.classList.toggle("is-cards", cards);
  applyFontSize();
  setHtml(list, cards ? cardsHtml() : flowHtml());
  refreshTooltips();
  refreshFind(); // the words found, marked again in the new text
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
  return [
    a.arabic,
    a.translation,
    `(${ayahPlace(state.currentSurah.n, n, state.riwaya)})`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Brings the bookmark icons up to date in place (no redraw, so the scroll and focus stay). */
function updateBookmarkIcons() {
  const surah = state.currentSurah?.n ?? 0;
  for (const el of byId("ayahList", HTMLElement).querySelectorAll(
    "[data-action='bookmark'], .ayah-end",
  )) {
    if (!(el instanceof HTMLButtonElement)) continue;
    const n = Number(el.dataset.ayah);
    const on = isBookmarked(surah, n);
    el.classList.toggle("is-on", on);
    const label = el.classList.contains("ayah-end")
      ? ayahEndLabel(n, on)
      : t(on ? "quranRemoveBookmark" : "quranAddBookmark");
    if (!el.classList.contains("ayah-end"))
      el.setAttribute("aria-pressed", String(on));
    el.setAttribute("aria-label", label);
    el.setAttribute("data-tip", label);
    const icon = el.querySelector("i");
    if (icon) icon.className = `${on ? "fas" : "far"} fa-bookmark`;
  }
}

function showSurahList() {
  const n = state.currentSurah?.n;
  byId("viewSurahReader", HTMLElement).hidden = true;
  const list = byId("viewSurahList", HTMLElement);
  list.hidden = false;
  state.currentSurah = null;
  // focus back on the row that was opened (an ayah found by the search, a surah; else the
  // tabs), not lost on the hidden reader
  const row = [
    ...list.querySelectorAll(`.q-verse[data-opened]`),
    ...list.querySelectorAll(`.surah-row[data-surah="${n}"]`),
  ].find((el) => el instanceof HTMLElement && el.offsetParent);
  const target = row ?? list.querySelector(".q-tab[aria-selected='true']");
  if (!(target instanceof HTMLElement)) return;
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: "nearest" });
}

// ← / → are left alone where they already mean something: typing, a list, the tabs
const OWNS_ARROWS =
  "input, textarea, select, [contenteditable], [role='listbox'], [role='tablist'], [role='slider']";

/** Next is on the left in a right-to-left page (the buttons follow the reading direction). */
const nextKey = () => (document.dir === "rtl" ? "ArrowLeft" : "ArrowRight");
const prevKey = () => (document.dir === "rtl" ? "ArrowRight" : "ArrowLeft");

/** ← / → press the previous or next surah button. @param {KeyboardEvent} e */
function onArrowKey(e) {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.defaultPrevented)
    return;
  if (!state.currentSurah) return;
  if (e.target instanceof Element && e.target.closest(OWNS_ARROWS)) return;
  const side = e.key === nextKey() ? "next" : "prev";
  const button = byId(`${side}SurahBtn`, HTMLButtonElement);
  if (button.disabled) return;
  e.preventDefault();
  button.click();
}

function bindReader() {
  trackReading(byId("readerContent", HTMLElement));
  const prev = byId("prevSurahBtn", HTMLButtonElement);
  const next = byId("nextSurahBtn", HTMLButtonElement);
  prev.addEventListener("click", () => {
    if (state.currentSurah) openSurah(state.currentSurah.n - 1);
  });
  next.addEventListener("click", () => {
    if (state.currentSurah) openSurah(state.currentSurah.n + 1);
  });
  // tells screen readers about the keys
  prev.setAttribute("aria-keyshortcuts", prevKey());
  next.setAttribute("aria-keyshortcuts", nextKey());
  document.addEventListener("keydown", onArrowKey);
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
