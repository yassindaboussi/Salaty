"use strict";

const { t, getLanguage } = require("../core/i18n");
const { formatNumerals, toWestern } = require("../utils/numerals");
const analytics = require("../services/analytics");
const screenSizeManager = require("../core/screen-size");
const { showToast } = require("../core/toast");
const { initSelectionCopy } = require("../components/selection-copy");
const { refreshTooltips } = require("../core/tooltips");
const { setupConnectionRecovery } = require("../services/connection-recovery");
const { escapeHtml } = require("../utils/html");

const ALQURAN_CLOUD_API = "https://api.alquran.cloud/v1";

const state = {
  surahs: [],
  filteredSurahs: [],
  currentSurah: null,
  currentAyahs: [],
  fontSize: 26,
  translationId: "none",
  settingsOpen: true,
  activeTab: "surah",
  numerals: "latin", // "arabic" (٠١٢٣) or "latin" (0123); resolved in initQuranPage
};

const SURAH_META = [
  { n: 1, ar: "الفاتحة", en: "Al-Faatiha", count: 7, type: "Meccan" },
  { n: 2, ar: "البقرة", en: "Al-Baqara", count: 286, type: "Medinan" },
  { n: 3, ar: "آل عمران", en: "Aal-i-Imraan", count: 200, type: "Medinan" },
  { n: 4, ar: "النساء", en: "An-Nisaa", count: 176, type: "Medinan" },
  { n: 5, ar: "المائدة", en: "Al-Maaida", count: 120, type: "Medinan" },
  { n: 6, ar: "الأنعام", en: "Al-An'aam", count: 165, type: "Meccan" },
  { n: 7, ar: "الأعراف", en: "Al-A'raaf", count: 206, type: "Meccan" },
  { n: 8, ar: "الأنفال", en: "Al-Anfaal", count: 75, type: "Medinan" },
  { n: 9, ar: "التوبة", en: "At-Tawba", count: 129, type: "Medinan" },
  { n: 10, ar: "يونس", en: "Yunus", count: 109, type: "Meccan" },
  { n: 11, ar: "هود", en: "Hud", count: 123, type: "Meccan" },
  { n: 12, ar: "يوسف", en: "Yusuf", count: 111, type: "Meccan" },
  { n: 13, ar: "الرعد", en: "Ar-Ra'd", count: 43, type: "Medinan" },
  { n: 14, ar: "إبراهيم", en: "Ibrahim", count: 52, type: "Meccan" },
  { n: 15, ar: "الحجر", en: "Al-Hijr", count: 99, type: "Meccan" },
  { n: 16, ar: "النحل", en: "An-Nahl", count: 128, type: "Meccan" },
  { n: 17, ar: "الإسراء", en: "Al-Israa", count: 111, type: "Meccan" },
  { n: 18, ar: "الكهف", en: "Al-Kahf", count: 110, type: "Meccan" },
  { n: 19, ar: "مريم", en: "Maryam", count: 98, type: "Meccan" },
  { n: 20, ar: "طه", en: "Taa-Haa", count: 135, type: "Meccan" },
  { n: 21, ar: "الأنبياء", en: "Al-Anbiyaa", count: 112, type: "Meccan" },
  { n: 22, ar: "الحج", en: "Al-Hajj", count: 78, type: "Medinan" },
  { n: 23, ar: "المؤمنون", en: "Al-Muminoon", count: 118, type: "Meccan" },
  { n: 24, ar: "النور", en: "An-Noor", count: 64, type: "Medinan" },
  { n: 25, ar: "الفرقان", en: "Al-Furqaan", count: 77, type: "Meccan" },
  { n: 26, ar: "الشعراء", en: "Ash-Shu'araa", count: 227, type: "Meccan" },
  { n: 27, ar: "النمل", en: "An-Naml", count: 93, type: "Meccan" },
  { n: 28, ar: "القصص", en: "Al-Qasas", count: 88, type: "Meccan" },
  { n: 29, ar: "العنكبوت", en: "Al-Ankaboot", count: 69, type: "Meccan" },
  { n: 30, ar: "الروم", en: "Ar-Room", count: 60, type: "Meccan" },
  { n: 31, ar: "لقمان", en: "Luqman", count: 34, type: "Meccan" },
  { n: 32, ar: "السجدة", en: "As-Sajda", count: 30, type: "Meccan" },
  { n: 33, ar: "الأحزاب", en: "Al-Ahzaab", count: 73, type: "Medinan" },
  { n: 34, ar: "سبأ", en: "Saba", count: 54, type: "Meccan" },
  { n: 35, ar: "فاطر", en: "Faatir", count: 45, type: "Meccan" },
  { n: 36, ar: "يس", en: "Yaseen", count: 83, type: "Meccan" },
  { n: 37, ar: "الصافات", en: "As-Saaffaat", count: 182, type: "Meccan" },
  { n: 38, ar: "ص", en: "Saad", count: 88, type: "Meccan" },
  { n: 39, ar: "الزمر", en: "Az-Zumar", count: 75, type: "Meccan" },
  { n: 40, ar: "غافر", en: "Ghafir", count: 85, type: "Meccan" },
  { n: 41, ar: "فصلت", en: "Fussilat", count: 54, type: "Meccan" },
  { n: 42, ar: "الشورى", en: "Ash-Shura", count: 53, type: "Meccan" },
  { n: 43, ar: "الزخرف", en: "Az-Zukhruf", count: 89, type: "Meccan" },
  { n: 44, ar: "الدخان", en: "Ad-Dukhaan", count: 59, type: "Meccan" },
  { n: 45, ar: "الجاثية", en: "Al-Jaathiya", count: 37, type: "Meccan" },
  { n: 46, ar: "الأحقاف", en: "Al-Ahqaf", count: 35, type: "Meccan" },
  { n: 47, ar: "محمد", en: "Muhammad", count: 38, type: "Medinan" },
  { n: 48, ar: "الفتح", en: "Al-Fath", count: 29, type: "Medinan" },
  { n: 49, ar: "الحجرات", en: "Al-Hujuraat", count: 18, type: "Medinan" },
  { n: 50, ar: "ق", en: "Qaaf", count: 45, type: "Meccan" },
  { n: 51, ar: "الذاريات", en: "Adh-Dhaariyat", count: 60, type: "Meccan" },
  { n: 52, ar: "الطور", en: "At-Tur", count: 49, type: "Meccan" },
  { n: 53, ar: "النجم", en: "An-Najm", count: 62, type: "Meccan" },
  { n: 54, ar: "القمر", en: "Al-Qamar", count: 55, type: "Meccan" },
  { n: 55, ar: "الرحمن", en: "Ar-Rahmaan", count: 78, type: "Medinan" },
  { n: 56, ar: "الواقعة", en: "Al-Waaqia", count: 96, type: "Meccan" },
  { n: 57, ar: "الحديد", en: "Al-Hadid", count: 29, type: "Medinan" },
  { n: 58, ar: "المجادلة", en: "Al-Mujaadila", count: 22, type: "Medinan" },
  { n: 59, ar: "الحشر", en: "Al-Hashr", count: 24, type: "Medinan" },
  { n: 60, ar: "الممتحنة", en: "Al-Mumtahana", count: 13, type: "Medinan" },
  { n: 61, ar: "الصف", en: "As-Saff", count: 14, type: "Medinan" },
  { n: 62, ar: "الجمعة", en: "Al-Jumu'a", count: 11, type: "Medinan" },
  { n: 63, ar: "المنافقون", en: "Al-Munaafiqoon", count: 11, type: "Medinan" },
  { n: 64, ar: "التغابن", en: "At-Taghaabun", count: 18, type: "Medinan" },
  { n: 65, ar: "الطلاق", en: "At-Talaaq", count: 12, type: "Medinan" },
  { n: 66, ar: "التحريم", en: "At-Tahrim", count: 12, type: "Medinan" },
  { n: 67, ar: "الملك", en: "Al-Mulk", count: 30, type: "Meccan" },
  { n: 68, ar: "القلم", en: "Al-Qalam", count: 52, type: "Meccan" },
  { n: 69, ar: "الحاقة", en: "Al-Haaqqa", count: 52, type: "Meccan" },
  { n: 70, ar: "المعارج", en: "Al-Ma'aarij", count: 44, type: "Meccan" },
  { n: 71, ar: "نوح", en: "Nooh", count: 28, type: "Meccan" },
  { n: 72, ar: "الجن", en: "Al-Jinn", count: 28, type: "Meccan" },
  { n: 73, ar: "المزمل", en: "Al-Muzzammil", count: 20, type: "Meccan" },
  { n: 74, ar: "المدثر", en: "Al-Muddaththir", count: 56, type: "Meccan" },
  { n: 75, ar: "القيامة", en: "Al-Qiyaama", count: 40, type: "Meccan" },
  { n: 76, ar: "الإنسان", en: "Al-Insaan", count: 31, type: "Medinan" },
  { n: 77, ar: "المرسلات", en: "Al-Mursalaat", count: 50, type: "Meccan" },
  { n: 78, ar: "النبأ", en: "An-Naba", count: 40, type: "Meccan" },
  { n: 79, ar: "النازعات", en: "An-Naazi'aat", count: 46, type: "Meccan" },
  { n: 80, ar: "عبس", en: "Abasa", count: 42, type: "Meccan" },
  { n: 81, ar: "التكوير", en: "At-Takwir", count: 29, type: "Meccan" },
  { n: 82, ar: "الانفطار", en: "Al-Infitaar", count: 19, type: "Meccan" },
  { n: 83, ar: "المطففين", en: "Al-Mutaffifin", count: 36, type: "Meccan" },
  { n: 84, ar: "الانشقاق", en: "Al-Inshiqaaq", count: 25, type: "Meccan" },
  { n: 85, ar: "البروج", en: "Al-Burooj", count: 22, type: "Meccan" },
  { n: 86, ar: "الطارق", en: "At-Taariq", count: 17, type: "Meccan" },
  { n: 87, ar: "الأعلى", en: "Al-Ala", count: 19, type: "Meccan" },
  { n: 88, ar: "الغاشية", en: "Al-Ghaashiya", count: 26, type: "Meccan" },
  { n: 89, ar: "الفجر", en: "Al-Fajr", count: 30, type: "Meccan" },
  { n: 90, ar: "البلد", en: "Al-Balad", count: 20, type: "Meccan" },
  { n: 91, ar: "الشمس", en: "Ash-Shams", count: 15, type: "Meccan" },
  { n: 92, ar: "الليل", en: "Al-Lail", count: 21, type: "Meccan" },
  { n: 93, ar: "الضحى", en: "Ad-Duhaa", count: 11, type: "Meccan" },
  { n: 94, ar: "الشرح", en: "Ash-Sharh", count: 8, type: "Meccan" },
  { n: 95, ar: "التين", en: "At-Tin", count: 8, type: "Meccan" },
  { n: 96, ar: "العلق", en: "Al-Alaq", count: 19, type: "Meccan" },
  { n: 97, ar: "القدر", en: "Al-Qadr", count: 5, type: "Meccan" },
  { n: 98, ar: "البينة", en: "Al-Bayyina", count: 8, type: "Medinan" },
  { n: 99, ar: "الزلزلة", en: "Az-Zalzala", count: 8, type: "Medinan" },
  { n: 100, ar: "العاديات", en: "Al-Aadiyaat", count: 11, type: "Meccan" },
  { n: 101, ar: "القارعة", en: "Al-Qaari'a", count: 11, type: "Meccan" },
  { n: 102, ar: "التكاثر", en: "At-Takaathur", count: 8, type: "Meccan" },
  { n: 103, ar: "العصر", en: "Al-Asr", count: 3, type: "Meccan" },
  { n: 104, ar: "الهمزة", en: "Al-Humaza", count: 9, type: "Meccan" },
  { n: 105, ar: "الفيل", en: "Al-Fil", count: 5, type: "Meccan" },
  { n: 106, ar: "قريش", en: "Quraish", count: 4, type: "Meccan" },
  { n: 107, ar: "الماعون", en: "Al-Maun", count: 7, type: "Meccan" },
  { n: 108, ar: "الكوثر", en: "Al-Kawthar", count: 3, type: "Meccan" },
  { n: 109, ar: "الكافرون", en: "Al-Kaafiroon", count: 6, type: "Meccan" },
  { n: 110, ar: "النصر", en: "An-Nasr", count: 3, type: "Medinan" },
  { n: 111, ar: "المسد", en: "Al-Masad", count: 5, type: "Meccan" },
  { n: 112, ar: "الإخلاص", en: "Al-Ikhlaas", count: 4, type: "Meccan" },
  { n: 113, ar: "الفلق", en: "Al-Falaq", count: 5, type: "Meccan" },
  { n: 114, ar: "الناس", en: "An-Naas", count: 6, type: "Meccan" },
];

const JUZ_META = [
  { n: 1, start: "Al-Faatiha 1:1" },
  { n: 2, start: "Al-Baqara 2:142" },
  { n: 3, start: "Al-Baqara 2:253" },
  { n: 4, start: "Aal-i-Imraan 3:92" },
  { n: 5, start: "An-Nisaa 4:24" },
  { n: 6, start: "An-Nisaa 4:148" },
  { n: 7, start: "Al-Maaida 5:82" },
  { n: 8, start: "Al-An'aam 6:111" },
  { n: 9, start: "Al-A'raaf 7:87" },
  { n: 10, start: "Al-Anfaal 8:41" },
  { n: 11, start: "At-Tawba 9:93" },
  { n: 12, start: "Hud 11:6" },
  { n: 13, start: "Yusuf 12:53" },
  { n: 14, start: "Al-Hijr 15:1" },
  { n: 15, start: "Al-Israa 17:1" },
  { n: 16, start: "Al-Kahf 18:75" },
  { n: 17, start: "Al-Anbiyaa 21:1" },
  { n: 18, start: "Al-Muminoon 23:1" },
  { n: 19, start: "Al-Furqaan 25:21" },
  { n: 20, start: "An-Naml 27:56" },
  { n: 21, start: "Al-Ankaboot 29:46" },
  { n: 22, start: "Al-Ahzaab 33:31" },
  { n: 23, start: "Yaseen 36:28" },
  { n: 24, start: "Az-Zumar 39:32" },
  { n: 25, start: "Fussilat 41:47" },
  { n: 26, start: "Al-Ahqaf 46:1" },
  { n: 27, start: "Adh-Dhaariyat 51:31" },
  { n: 28, start: "Al-Mujaadila 58:1" },
  { n: 29, start: "Al-Mulk 67:1" },
  { n: 30, start: "An-Naba 78:1" },
];

const TRANSLATION_EDITIONS = {
  "en.sahih": "en.sahih",
  "en.asad": "en.asad",
  "fr.hamidullah": "fr.hamidullah",
};

async function fetchQuranSurah(surahNum, translationEdition) {
  if (!navigator.onLine) {
    return getLocalQuranSurah(surahNum, translationEdition);
  }

  try {
    const editions = ["quran-uthmani"];
    if (
      translationEdition !== "none" &&
      TRANSLATION_EDITIONS[translationEdition]
    ) {
      editions.push(TRANSLATION_EDITIONS[translationEdition]);
    }
    const url = `${ALQURAN_CLOUD_API}/surah/${surahNum}/editions/${editions.join(",")}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`alquran.cloud ${res.status}`);
    const data = await res.json();
    return normalizeAlquranCloudResponse(data, translationEdition);
  } catch (e) {
    console.warn(
      "AlQuran Cloud request failed, using offline data:",
      e.message,
    );
    return getLocalQuranSurah(surahNum, translationEdition);
  }
}

function normalizeAlquranCloudResponse(data, translationEdition) {
  const editions = data.data || [];
  const arabicEdition = Array.isArray(editions) ? editions[0] : editions;
  const transEdition =
    Array.isArray(editions) && editions.length > 1 ? editions[1] : null;
  const ayahs = arabicEdition.ayahs || [];
  return ayahs.map((a, i) => ({
    number: a.numberInSurah,
    arabic: a.text,
    translation:
      transEdition && translationEdition !== "none"
        ? stripHtmlTags(transEdition.ayahs[i]?.text || "")
        : null,
  }));
}

let _localQuranDataPromise = null;
function getLocalQuranData() {
  if (!_localQuranDataPromise) {
    _localQuranDataPromise = fetch("../../data/Quran.json").then((res) => {
      if (!res.ok)
        throw new Error(`Failed to load offline Quran data (${res.status})`);
      return res.json();
    });
  }
  return _localQuranDataPromise;
}

async function getLocalQuranSurah(surahNum, translationEdition) {
  const data = await getLocalQuranData();
  const entry = data.find((s) => s.Number === surahNum);
  if (!entry) throw new Error(`Surah ${surahNum} not found in offline data`);

  const verses = (entry.Array_Verses && entry.Array_Verses[0]) || [];
  return verses.map((v) => ({
    number: v.id,
    arabic: v.ar,
    translation: translationEdition !== "none" ? v.en || null : null,
  }));
}

function stripHtmlTags(str) {
  return str
    ? str
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim()
    : "";
}

// ---- Numerals: Arabic-Indic (٠١٢٣) or Western (0123) digits ----
// Default follows the app language (Arabic app -> Arabic digits). Once the user picks one in
// the settings panel, that choice is remembered and wins over the language default.
//
// The remembered choice is stored per app language, and only when it differs from that
// language's default. (An earlier version kept one global value written on every click, so a
// click in Arabic made Arabic digits stick in English and French too; that old key is removed.)
const NUMERALS_KEY_PREFIX = "quranNumerals.";
const LEGACY_NUMERALS_KEY = "quranNumerals";

const defaultNumerals = () => (getLanguage() === "ar" ? "arabic" : "latin");
const numeralsKey = () => NUMERALS_KEY_PREFIX + getLanguage();

function resolveNumerals() {
  try {
    localStorage.removeItem(LEGACY_NUMERALS_KEY);
    const saved = localStorage.getItem(numeralsKey());
    if (saved === "arabic" || saved === "latin") return saved;
  } catch {
    /* storage unavailable: use the language default */
  }
  return defaultNumerals();
}

const fmt = (value) => formatNumerals(value, state.numerals);

function updateNumeralsUI() {
  document.body.classList.toggle(
    "numerals-arabic",
    state.numerals === "arabic",
  );
  document.querySelectorAll(".numerals-btn").forEach((btn) => {
    const active = btn.dataset.numerals === state.numerals;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", String(active));
    btn.setAttribute(
      "aria-label",
      t(btn.dataset.numerals === "arabic" ? "numeralsArabic" : "numeralsLatin"),
    );
  });
  document
    .getElementById("numeralsGroup")
    ?.setAttribute("aria-label", t("numeralsLabel"));
}

function updateReaderMeta() {
  const meta = state.currentSurah;
  if (!meta) return;
  document.getElementById("readerSurahMeta").textContent =
    `${t("surah")} ${fmt(meta.n)} · ${fmt(meta.count)} ${t("verses")} · ${revelationPlace(meta)}`;
  document.getElementById("readerPageInfo").textContent =
    `${fmt(meta.n)} / ${fmt(114)}`;
}

// Re-draws everything that shows a number after the user switches digit style.
function refreshNumbers() {
  renderSurahGrid(state.filteredSurahs);
  renderJuzList();
  const size = document.getElementById("fontSizeDisplay");
  if (size) size.textContent = fmt(state.fontSize);
  if (state.currentSurah) {
    updateReaderMeta();
    // Skip while a surah is still loading (the list is empty then and will render with the new digits).
    if (
      state.currentAyahs.length &&
      document.getElementById("ayahList").children.length
    ) {
      renderAyahs(state.currentAyahs);
    }
  }
}

function setNumerals(mode) {
  try {
    // Only a deviation from the language default is worth remembering.
    if (mode === defaultNumerals()) localStorage.removeItem(numeralsKey());
    else localStorage.setItem(numeralsKey(), mode);
  } catch {
    /* storage unavailable: the choice just won't be remembered */
  }
  if (mode === state.numerals) return;
  state.numerals = mode;
  updateNumeralsUI();
  refreshNumbers();
}

// Copies the part of the reader the user highlighted (Ctrl/Cmd+C or right-click > Copy).
function copySelectedText(text) {
  navigator.clipboard
    .writeText(text)
    .then(() => showToast(t("copiedToClipboard"), "success"))
    .catch(() => showToast(t("failedToCopy"), "error"));
}

// "Meccan" / "Medinan" in the UI language.
function revelationPlace(surah) {
  return t(surah.type === "Meccan" ? "meccan" : "medinan");
}

function initQuranPage() {
  // The surah list is bundled; only an open surah's text comes from the network.
  setupConnectionRecovery(() => {
    if (state.currentSurah) loadAyahs(state.currentSurah.n);
  }, "Quran");
  screenSizeManager.initPageScreenSize();
  updateFullscreenButtons();
  // also when the window is maximized/restored another way (title-bar double-click, Snap…)
  screenSizeManager.onChange(updateFullscreenButtons);
  initSelectionCopy(document.getElementById("readerContent"), copySelectedText);

  // Back (list view), minimize and close are wired by the app shell from the header markup
  // (components/page-header.js); both views have their own fullscreen button.
  document
    .getElementById("fullscreenBtn")
    ?.addEventListener("click", toggleFullscreen);
  document
    .getElementById("readerFullscreenBtn")
    ?.addEventListener("click", toggleFullscreen);

  document
    .getElementById("readerBackBtn")
    ?.addEventListener("click", showSurahList);

  document
    .getElementById("tabSurah")
    ?.addEventListener("click", () => switchTab("surah"));
  document
    .getElementById("tabJuz")
    ?.addEventListener("click", () => switchTab("juz"));

  document
    .getElementById("surahSearchInput")
    ?.addEventListener("input", onSearch);

  document
    .getElementById("readerSettingsBtn")
    ?.addEventListener("click", toggleSettings);
  document
    .getElementById("settingsPanelCloseBtn")
    ?.addEventListener("click", closeSettings);

  document
    .getElementById("fontIncBtn")
    ?.addEventListener("click", () => changeFontSize(2));
  document
    .getElementById("fontDecBtn")
    ?.addEventListener("click", () => changeFontSize(-2));

  bindTranslationCombo();

  state.numerals = resolveNumerals();
  document.querySelectorAll(".numerals-btn").forEach((btn) => {
    btn.addEventListener("click", () => setNumerals(btn.dataset.numerals));
  });

  document.getElementById("prevSurahBtn")?.addEventListener("click", () => {
    if (state.currentSurah && state.currentSurah.n > 1) {
      openSurah(state.currentSurah.n - 1);
    }
  });
  document.getElementById("nextSurahBtn")?.addEventListener("click", () => {
    if (state.currentSurah && state.currentSurah.n < 114) {
      openSurah(state.currentSurah.n + 1);
    }
  });

  updateQuranText();
  updateNumeralsUI();
  updateTranslationUI();

  state.surahs = SURAH_META;
  state.filteredSurahs = [...SURAH_META];
  renderSurahGrid(state.filteredSurahs);
  renderJuzList();
}

function updateQuranText() {
  const el = (id) => document.getElementById(id);
  if (el("fontSizeDisplay"))
    el("fontSizeDisplay").textContent = fmt(state.fontSize);
}

function switchTab(tab) {
  state.activeTab = tab;
  document
    .getElementById("tabSurah")
    .classList.toggle("active", tab === "surah");
  document.getElementById("tabJuz").classList.toggle("active", tab === "juz");
  document.getElementById("surahGrid").style.display =
    tab === "surah" ? "" : "none";
  document.getElementById("juzList").style.display =
    tab === "juz" ? "" : "none";
  document.getElementById("surahSearchInput").style.display =
    tab === "surah" ? "" : "none";
}

function onSearch(e) {
  // Accept Arabic-Indic digits too, so typing ٢ finds surah 2.
  const q = toWestern(e.target.value).trim().toLowerCase();
  if (!q) {
    state.filteredSurahs = [...SURAH_META];
  } else {
    state.filteredSurahs = SURAH_META.filter(
      (s) =>
        s.en.toLowerCase().includes(q) ||
        s.ar.includes(q) ||
        String(s.n).startsWith(q),
    );
  }
  renderSurahGrid(state.filteredSurahs);
}

function renderSurahGrid(surahs) {
  const grid = document.getElementById("surahGrid");
  const loading = document.getElementById("surahLoading");

  if (loading) loading.style.display = "none";

  if (!surahs.length) {
    grid.innerHTML = `<div class="no-results" style="grid-column:1/-1">${t("noResults")}</div>`;
    return;
  }

  grid.innerHTML = surahs
    .map(
      (s) => `
    <div class="surah-card" data-surah="${s.n}" role="button" tabindex="0">
      <div class="surah-number-badge">${fmt(s.n)}</div>
      <div class="surah-card-info">
        <div class="surah-arabic-name">${s.ar}</div>
        <div class="surah-transliteration">${s.en}</div>
        <div class="surah-ayah-count">${fmt(s.count)} ${t("verses")} · ${revelationPlace(s)}</div>
      </div>
    </div>
  `,
    )
    .join("");

  grid.querySelectorAll(".surah-card").forEach((card) => {
    card.addEventListener("click", () => openSurah(Number(card.dataset.surah)));
  });
}

function renderJuzList() {
  const list = document.getElementById("juzList");
  list.innerHTML = JUZ_META.map(
    (j) => `
    <div class="juz-card" data-juz="${j.n}" role="button" tabindex="0">
      <div class="juz-badge">${fmt(j.n)}</div>
      <div class="juz-info">
        <div class="juz-title">${t("juz")} ${fmt(j.n)}</div>
        <div class="juz-subtitle">${t("startingFrom")}: ${fmt(j.start)}</div>
      </div>
      <i class="fas fa-chevron-left juz-arrow" aria-hidden="true"></i>
    </div>
  `,
  ).join("");

  const JUZ_TO_SURAH = [
    1, 2, 2, 3, 4, 4, 5, 6, 7, 8, 9, 11, 12, 15, 17, 18, 21, 23, 25, 27, 29, 33,
    36, 39, 41, 46, 51, 58, 67, 78,
  ];
  list.querySelectorAll(".juz-card").forEach((card) => {
    card.addEventListener("click", () => {
      const juzN = Number(card.dataset.juz);
      const surahN = JUZ_TO_SURAH[juzN - 1] || 1;
      openSurah(surahN);
    });
  });
}

async function openSurah(surahNum) {
  const meta = SURAH_META.find((s) => s.n === surahNum);
  if (!meta) return;
  state.currentSurah = meta;

  document.getElementById("viewSurahList").style.display = "none";
  document.getElementById("viewSurahReader").style.display = "";

  state.settingsOpen = true;
  document.getElementById("readerSettingsPanel").style.display = "";

  document.getElementById("readerSurahName").textContent =
    `${meta.ar}  —  ${meta.en}`;
  updateReaderMeta();

  const prevMeta = SURAH_META.find((s) => s.n === surahNum - 1);
  const nextMeta = SURAH_META.find((s) => s.n === surahNum + 1);
  const prevBtn = document.getElementById("prevSurahBtn");
  const nextBtn = document.getElementById("nextSurahBtn");

  if (prevMeta) {
    prevBtn.disabled = false;
    document.getElementById("prevSurahLabel").textContent = prevMeta.en;
  } else {
    prevBtn.disabled = true;
    document.getElementById("prevSurahLabel").textContent = "";
  }
  if (nextMeta) {
    nextBtn.disabled = false;
    document.getElementById("nextSurahLabel").textContent = nextMeta.en;
  } else {
    nextBtn.disabled = true;
    document.getElementById("nextSurahLabel").textContent = "";
  }

  const bismillah = document.getElementById("bismillahHeader");
  bismillah.style.display = surahNum !== 1 && surahNum !== 9 ? "" : "none";

  await loadAyahs(surahNum);

  document.getElementById("readerContent").scrollTop = 0;

  analytics.featureOpen("quran-surah");
}

let loadAyahsRequestId = 0;

async function loadAyahs(surahNum) {
  const myRequestId = ++loadAyahsRequestId;
  const loading = document.getElementById("readerLoading");
  const ayahList = document.getElementById("ayahList");

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
    ayahList.innerHTML = `
      <div class="quran-error">
        <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
        <p>${t("quranError")}</p>
        <button type="button" class="retry-button" id="retryBtn">
          <i class="fas fa-sync-alt" aria-hidden="true"></i> ${t("retry")}
        </button>
      </div>
    `;
    document
      .getElementById("retryBtn")
      ?.addEventListener("click", () => loadAyahs(surahNum));
  }
}

function renderAyahs(ayahs) {
  const list = document.getElementById("ayahList");
  const withTranslation = ayahs.filter((a) => a.translation);
  const showingTranslation =
    state.translationId !== "none" && withTranslation.length > 0;

  let html = "";

  if (!showingTranslation) {
    const flowHtml = ayahs
      .map(
        (a) =>
          `${escapeHtml(a.arabic)} <span class="ayah-number-inline" data-ayah="${escapeHtml(a.number)}">﴿${escapeHtml(fmt(a.number))}﴾</span>`,
      )
      .join(" ");
    html += `<div class="surah-flow-text" id="surahFlowText" style="font-size:${state.fontSize}px">${flowHtml}</div>`;
  }

  if (showingTranslation) {
    html += `<div class="ayah-translation-list" id="ayahTranslationList" style="font-size:${state.fontSize}px">${withTranslation
      .map(
        (a) =>
          `<div class="ayah-translation-row"><span class="ayah-translation-num">${escapeHtml(fmt(a.number))}.</span> ${escapeHtml(a.translation)}</div>`,
      )
      .join("")}</div>`;
  }

  list.innerHTML = html;
}

function showSurahList() {
  document.getElementById("viewSurahReader").style.display = "none";
  document.getElementById("viewSurahList").style.display = "";
  if (state.settingsOpen) {
    state.settingsOpen = false;
    document.getElementById("readerSettingsPanel").style.display = "none";
  }
}

function toggleSettings() {
  state.settingsOpen = !state.settingsOpen;
  const panel = document.getElementById("readerSettingsPanel");
  panel.style.display = state.settingsOpen ? "" : "none";
}

function closeSettings() {
  state.settingsOpen = false;
  document.getElementById("readerSettingsPanel").style.display = "none";
}

function changeFontSize(delta) {
  state.fontSize = Math.max(18, Math.min(42, state.fontSize + delta));
  document.getElementById("fontSizeDisplay").textContent = fmt(state.fontSize);
  const flowText = document.getElementById("surahFlowText");
  if (flowText) flowText.style.fontSize = `${state.fontSize}px`;
  const translationList = document.getElementById("ayahTranslationList");
  if (translationList) translationList.style.fontSize = `${state.fontSize}px`;
}

// ---- Translation picker (custom combobox: trigger button + listbox) ----
const translationOptions = () => [
  ...document.querySelectorAll(".translation-option"),
];
const isOptionDisabled = (opt) => opt.getAttribute("aria-disabled") === "true";
const translationList = () => document.getElementById("translationList");
const translationTrigger = () => document.getElementById("translationTrigger");
const isTranslationListOpen = () => !translationList()?.hidden;

// The bundled offline Quran data only has the English Sahih International text, so the other
// translations need the internet. They are marked unavailable (not removed) while offline.
// aria-disabled is used instead of `disabled` so the "needs internet" tooltip still shows.
function updateTranslationAvailability() {
  const offline = !navigator.onLine;
  translationOptions().forEach((opt) => {
    const blocked = offline && opt.dataset.needsInternet === "1";
    if (blocked) {
      opt.setAttribute("aria-disabled", "true");
      opt.setAttribute("data-tooltip", "translationOnlineOnly");
    } else {
      opt.removeAttribute("aria-disabled");
      opt.removeAttribute("data-tooltip");
      opt.removeAttribute("data-tip");
    }
  });
  if (offline) refreshTooltips();
}

// Shows the selected choice (name + language tag) on the trigger and marks it in the list.
function updateTranslationUI() {
  const label = t("translation");
  translationTrigger()?.setAttribute("aria-label", label);
  translationList()?.setAttribute("aria-label", label);
  const none = document.getElementById("translationNoneLabel");
  if (none) none.textContent = t("translationNone");

  let selected = null;
  translationOptions().forEach((opt) => {
    const isSelected = opt.dataset.translation === state.translationId;
    opt.setAttribute("aria-selected", String(isSelected));
    if (isSelected) selected = opt;
  });
  if (selected) {
    const name = selected.querySelector(".combo-name")?.textContent || "";
    const lang = selected.querySelector(".pill-lang")?.textContent || "";
    document.getElementById("translationCurrentName").textContent = name;
    const langEl = document.getElementById("translationCurrentLang");
    langEl.textContent = lang;
    langEl.hidden = !lang;
  }
  updateTranslationAvailability();
}

function setActiveTranslationOption(opt) {
  translationOptions().forEach((o) =>
    o.classList.toggle("highlighted", o === opt),
  );
  const trigger = translationTrigger();
  if (opt) {
    trigger?.setAttribute("aria-activedescendant", opt.id);
    opt.scrollIntoView({ block: "nearest" });
  } else {
    trigger?.removeAttribute("aria-activedescendant");
  }
}

function closeTranslationList() {
  const list = translationList();
  if (!list || list.hidden) return;
  list.hidden = true;
  setActiveTranslationOption(null);
  translationTrigger()?.setAttribute("aria-expanded", "false");
}

function openTranslationList() {
  const list = translationList();
  if (!list || !list.hidden) return;
  list.hidden = false;
  translationTrigger()?.setAttribute("aria-expanded", "true");
  setActiveTranslationOption(
    translationOptions().find(
      (o) => o.getAttribute("aria-selected") === "true",
    ) || null,
  );
}

async function setTranslation(id) {
  if (id === state.translationId) return;
  state.translationId = id;
  updateTranslationUI();
  if (state.currentSurah) {
    await loadAyahs(state.currentSurah.n);
  }
}

function chooseTranslationOption(opt) {
  if (!opt || isOptionDisabled(opt)) return;
  closeTranslationList();
  translationTrigger()?.focus();
  setTranslation(opt.dataset.translation);
}

// Moves the highlight by one enabled option (wraps around).
function moveTranslationHighlight(step) {
  const options = translationOptions().filter((o) => !isOptionDisabled(o));
  if (!options.length) return;
  const current = options.findIndex((o) => o.classList.contains("highlighted"));
  const next =
    current === -1
      ? step > 0
        ? 0
        : options.length - 1
      : (current + step + options.length) % options.length;
  setActiveTranslationOption(options[next]);
}

function onTranslationTriggerKeydown(e) {
  const open = isTranslationListOpen();
  switch (e.key) {
    case "ArrowDown":
    case "ArrowUp":
      e.preventDefault();
      if (!open) openTranslationList();
      else moveTranslationHighlight(e.key === "ArrowDown" ? 1 : -1);
      break;
    case "Home":
    case "End": {
      if (!open) return;
      e.preventDefault();
      const options = translationOptions().filter((o) => !isOptionDisabled(o));
      setActiveTranslationOption(
        e.key === "Home" ? options[0] : options[options.length - 1],
      );
      break;
    }
    case "Enter":
    case " ":
      e.preventDefault();
      if (!open) openTranslationList();
      else
        chooseTranslationOption(
          translationOptions().find((o) => o.classList.contains("highlighted")),
        );
      break;
    case "Escape":
      if (open) {
        e.preventDefault();
        closeTranslationList();
      }
      break;
    case "Tab":
      closeTranslationList();
      break;
    default:
  }
}

function bindTranslationCombo() {
  const trigger = translationTrigger();
  const list = translationList();
  if (!trigger || !list) return;

  trigger.addEventListener("click", () => {
    if (isTranslationListOpen()) closeTranslationList();
    else openTranslationList();
  });
  trigger.addEventListener("keydown", onTranslationTriggerKeydown);
  list.addEventListener("click", (e) =>
    chooseTranslationOption(e.target.closest(".translation-option")),
  );
  list.addEventListener("mouseover", (e) => {
    const opt = e.target.closest(".translation-option");
    if (opt && !isOptionDisabled(opt)) setActiveTranslationOption(opt);
  });
  // Clicking anywhere else, or losing window focus, closes the list.
  document.addEventListener("mousedown", (e) => {
    if (!document.getElementById("translationCombo")?.contains(e.target))
      closeTranslationList();
  });
  window.addEventListener("blur", closeTranslationList);
  window.addEventListener("online", updateTranslationAvailability);
  window.addEventListener("offline", updateTranslationAvailability);
}

function updateFullscreenButtons() {
  const isBig = screenSizeManager.isBigScreen();
  const tipKey = isBig ? "tooltipExpand" : "tooltipCompress";
  const tipText = t(tipKey);
  const iconCls = isBig ? "fas fa-expand" : "fas fa-compress";

  ["fullscreenBtn", "readerFullscreenBtn"].forEach((id) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.setAttribute("aria-label", tipText);
    btn.setAttribute("data-tooltip", tipKey);
    btn.setAttribute("data-tip", tipText);
    const icon = btn.querySelector("i");
    if (icon) icon.className = iconCls;
  });
}

function toggleFullscreen() {
  screenSizeManager.toggleScreenSize(); // the buttons update through onChange
}

module.exports = { initQuranPage };
