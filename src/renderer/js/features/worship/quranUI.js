"use strict";
/**
 * quranUI.js — Native Quran Book Reader
 * Uses quran.com API v4 (api.quran.com/api/v4)
 * No iframes, no embeds. Full native reader.
 */

const { ipcRenderer } = require("electron");
const { t } = require("../../core/i18n/translations");
const analytics = require("../../utils/analytics");
const screenSizeManager = require("../../core/screenSize");

// ── Constants ────────────────────────────────────────────────
const QURAN_API = "https://api.quran.com/api/v4";
const ALT_API   = "https://alquran.cloud/api/v1"; // fallback

// ── State ────────────────────────────────────────────────────
let state = {
  surahs: [],             // all 114 chapters
  filteredSurahs: [],
  currentSurah: null,     // { number, name, ... }
  currentAyahs: [],
  fontSize: 26,           // px for arabic text
  translationId: "none",  // "none" | edition key
  settingsOpen: false,
  activeTab: "surah",     // "surah" | "juz"
  isFullscreen: false,
};

// ── Surah metadata cache (offline-first) ────────────────────
// 114 surahs with Arabic name, transliteration, ayah count, revelation type
const SURAH_META = [
  {n:1,  ar:"الفاتحة",       en:"Al-Faatiha",        count:7,   type:"Meccan"},
  {n:2,  ar:"البقرة",        en:"Al-Baqara",          count:286, type:"Medinan"},
  {n:3,  ar:"آل عمران",      en:"Aal-i-Imraan",       count:200, type:"Medinan"},
  {n:4,  ar:"النساء",        en:"An-Nisaa",           count:176, type:"Medinan"},
  {n:5,  ar:"المائدة",       en:"Al-Maaida",          count:120, type:"Medinan"},
  {n:6,  ar:"الأنعام",       en:"Al-An'aam",          count:165, type:"Meccan"},
  {n:7,  ar:"الأعراف",       en:"Al-A'raaf",          count:206, type:"Meccan"},
  {n:8,  ar:"الأنفال",       en:"Al-Anfaal",          count:75,  type:"Medinan"},
  {n:9,  ar:"التوبة",        en:"At-Tawba",           count:129, type:"Medinan"},
  {n:10, ar:"يونس",          en:"Yunus",               count:109, type:"Meccan"},
  {n:11, ar:"هود",           en:"Hud",                 count:123, type:"Meccan"},
  {n:12, ar:"يوسف",          en:"Yusuf",               count:111, type:"Meccan"},
  {n:13, ar:"الرعد",         en:"Ar-Ra'd",             count:43,  type:"Medinan"},
  {n:14, ar:"إبراهيم",       en:"Ibrahim",             count:52,  type:"Meccan"},
  {n:15, ar:"الحجر",         en:"Al-Hijr",             count:99,  type:"Meccan"},
  {n:16, ar:"النحل",         en:"An-Nahl",             count:128, type:"Meccan"},
  {n:17, ar:"الإسراء",       en:"Al-Israa",            count:111, type:"Meccan"},
  {n:18, ar:"الكهف",         en:"Al-Kahf",             count:110, type:"Meccan"},
  {n:19, ar:"مريم",          en:"Maryam",              count:98,  type:"Meccan"},
  {n:20, ar:"طه",            en:"Taa-Haa",             count:135, type:"Meccan"},
  {n:21, ar:"الأنبياء",      en:"Al-Anbiyaa",          count:112, type:"Meccan"},
  {n:22, ar:"الحج",          en:"Al-Hajj",             count:78,  type:"Medinan"},
  {n:23, ar:"المؤمنون",      en:"Al-Muminoon",         count:118, type:"Meccan"},
  {n:24, ar:"النور",         en:"An-Noor",             count:64,  type:"Medinan"},
  {n:25, ar:"الفرقان",       en:"Al-Furqaan",          count:77,  type:"Meccan"},
  {n:26, ar:"الشعراء",       en:"Ash-Shu'araa",        count:227, type:"Meccan"},
  {n:27, ar:"النمل",         en:"An-Naml",             count:93,  type:"Meccan"},
  {n:28, ar:"القصص",         en:"Al-Qasas",            count:88,  type:"Meccan"},
  {n:29, ar:"العنكبوت",      en:"Al-Ankaboot",         count:69,  type:"Meccan"},
  {n:30, ar:"الروم",         en:"Ar-Room",             count:60,  type:"Meccan"},
  {n:31, ar:"لقمان",         en:"Luqman",              count:34,  type:"Meccan"},
  {n:32, ar:"السجدة",        en:"As-Sajda",            count:30,  type:"Meccan"},
  {n:33, ar:"الأحزاب",       en:"Al-Ahzaab",           count:73,  type:"Medinan"},
  {n:34, ar:"سبأ",           en:"Saba",                count:54,  type:"Meccan"},
  {n:35, ar:"فاطر",          en:"Faatir",              count:45,  type:"Meccan"},
  {n:36, ar:"يس",            en:"Yaseen",              count:83,  type:"Meccan"},
  {n:37, ar:"الصافات",       en:"As-Saaffaat",         count:182, type:"Meccan"},
  {n:38, ar:"ص",             en:"Saad",                count:88,  type:"Meccan"},
  {n:39, ar:"الزمر",         en:"Az-Zumar",            count:75,  type:"Meccan"},
  {n:40, ar:"غافر",          en:"Ghafir",              count:85,  type:"Meccan"},
  {n:41, ar:"فصلت",          en:"Fussilat",            count:54,  type:"Meccan"},
  {n:42, ar:"الشورى",        en:"Ash-Shura",           count:53,  type:"Meccan"},
  {n:43, ar:"الزخرف",        en:"Az-Zukhruf",          count:89,  type:"Meccan"},
  {n:44, ar:"الدخان",        en:"Ad-Dukhaan",          count:59,  type:"Meccan"},
  {n:45, ar:"الجاثية",       en:"Al-Jaathiya",         count:37,  type:"Meccan"},
  {n:46, ar:"الأحقاف",       en:"Al-Ahqaf",            count:35,  type:"Meccan"},
  {n:47, ar:"محمد",          en:"Muhammad",            count:38,  type:"Medinan"},
  {n:48, ar:"الفتح",         en:"Al-Fath",             count:29,  type:"Medinan"},
  {n:49, ar:"الحجرات",       en:"Al-Hujuraat",         count:18,  type:"Medinan"},
  {n:50, ar:"ق",             en:"Qaaf",                count:45,  type:"Meccan"},
  {n:51, ar:"الذاريات",      en:"Adh-Dhaariyat",       count:60,  type:"Meccan"},
  {n:52, ar:"الطور",         en:"At-Tur",              count:49,  type:"Meccan"},
  {n:53, ar:"النجم",         en:"An-Najm",             count:62,  type:"Meccan"},
  {n:54, ar:"القمر",         en:"Al-Qamar",            count:55,  type:"Meccan"},
  {n:55, ar:"الرحمن",        en:"Ar-Rahmaan",          count:78,  type:"Medinan"},
  {n:56, ar:"الواقعة",       en:"Al-Waaqia",           count:96,  type:"Meccan"},
  {n:57, ar:"الحديد",        en:"Al-Hadid",            count:29,  type:"Medinan"},
  {n:58, ar:"المجادلة",      en:"Al-Mujaadila",        count:22,  type:"Medinan"},
  {n:59, ar:"الحشر",         en:"Al-Hashr",            count:24,  type:"Medinan"},
  {n:60, ar:"الممتحنة",      en:"Al-Mumtahana",        count:13,  type:"Medinan"},
  {n:61, ar:"الصف",          en:"As-Saff",             count:14,  type:"Medinan"},
  {n:62, ar:"الجمعة",        en:"Al-Jumu'a",           count:11,  type:"Medinan"},
  {n:63, ar:"المنافقون",     en:"Al-Munaafiqoon",      count:11,  type:"Medinan"},
  {n:64, ar:"التغابن",       en:"At-Taghaabun",        count:18,  type:"Medinan"},
  {n:65, ar:"الطلاق",        en:"At-Talaaq",           count:12,  type:"Medinan"},
  {n:66, ar:"التحريم",       en:"At-Tahrim",           count:12,  type:"Medinan"},
  {n:67, ar:"الملك",         en:"Al-Mulk",             count:30,  type:"Meccan"},
  {n:68, ar:"القلم",         en:"Al-Qalam",            count:52,  type:"Meccan"},
  {n:69, ar:"الحاقة",        en:"Al-Haaqqa",           count:52,  type:"Meccan"},
  {n:70, ar:"المعارج",       en:"Al-Ma'aarij",         count:44,  type:"Meccan"},
  {n:71, ar:"نوح",           en:"Nooh",                count:28,  type:"Meccan"},
  {n:72, ar:"الجن",          en:"Al-Jinn",             count:28,  type:"Meccan"},
  {n:73, ar:"المزمل",        en:"Al-Muzzammil",        count:20,  type:"Meccan"},
  {n:74, ar:"المدثر",        en:"Al-Muddaththir",      count:56,  type:"Meccan"},
  {n:75, ar:"القيامة",       en:"Al-Qiyaama",          count:40,  type:"Meccan"},
  {n:76, ar:"الإنسان",       en:"Al-Insaan",           count:31,  type:"Medinan"},
  {n:77, ar:"المرسلات",      en:"Al-Mursalaat",        count:50,  type:"Meccan"},
  {n:78, ar:"النبأ",         en:"An-Naba",             count:40,  type:"Meccan"},
  {n:79, ar:"النازعات",      en:"An-Naazi'aat",        count:46,  type:"Meccan"},
  {n:80, ar:"عبس",           en:"Abasa",               count:42,  type:"Meccan"},
  {n:81, ar:"التكوير",       en:"At-Takwir",           count:29,  type:"Meccan"},
  {n:82, ar:"الانفطار",      en:"Al-Infitaar",         count:19,  type:"Meccan"},
  {n:83, ar:"المطففين",      en:"Al-Mutaffifin",       count:36,  type:"Meccan"},
  {n:84, ar:"الانشقاق",      en:"Al-Inshiqaaq",        count:25,  type:"Meccan"},
  {n:85, ar:"البروج",        en:"Al-Burooj",           count:22,  type:"Meccan"},
  {n:86, ar:"الطارق",        en:"At-Taariq",           count:17,  type:"Meccan"},
  {n:87, ar:"الأعلى",        en:"Al-Ala",              count:19,  type:"Meccan"},
  {n:88, ar:"الغاشية",       en:"Al-Ghaashiya",        count:26,  type:"Meccan"},
  {n:89, ar:"الفجر",         en:"Al-Fajr",             count:30,  type:"Meccan"},
  {n:90, ar:"البلد",         en:"Al-Balad",            count:20,  type:"Meccan"},
  {n:91, ar:"الشمس",         en:"Ash-Shams",           count:15,  type:"Meccan"},
  {n:92, ar:"الليل",         en:"Al-Lail",             count:21,  type:"Meccan"},
  {n:93, ar:"الضحى",         en:"Ad-Duhaa",            count:11,  type:"Meccan"},
  {n:94, ar:"الشرح",         en:"Ash-Sharh",           count:8,   type:"Meccan"},
  {n:95, ar:"التين",         en:"At-Tin",              count:8,   type:"Meccan"},
  {n:96, ar:"العلق",         en:"Al-Alaq",             count:19,  type:"Meccan"},
  {n:97, ar:"القدر",         en:"Al-Qadr",             count:5,   type:"Meccan"},
  {n:98, ar:"البينة",        en:"Al-Bayyina",          count:8,   type:"Medinan"},
  {n:99, ar:"الزلزلة",       en:"Az-Zalzala",          count:8,   type:"Medinan"},
  {n:100,ar:"العاديات",      en:"Al-Aadiyaat",         count:11,  type:"Meccan"},
  {n:101,ar:"القارعة",       en:"Al-Qaari'a",          count:11,  type:"Meccan"},
  {n:102,ar:"التكاثر",       en:"At-Takaathur",        count:8,   type:"Meccan"},
  {n:103,ar:"العصر",         en:"Al-Asr",              count:3,   type:"Meccan"},
  {n:104,ar:"الهمزة",        en:"Al-Humaza",           count:9,   type:"Meccan"},
  {n:105,ar:"الفيل",         en:"Al-Fil",              count:5,   type:"Meccan"},
  {n:106,ar:"قريش",          en:"Quraish",             count:4,   type:"Meccan"},
  {n:107,ar:"الماعون",       en:"Al-Maun",             count:7,   type:"Meccan"},
  {n:108,ar:"الكوثر",        en:"Al-Kawthar",          count:3,   type:"Meccan"},
  {n:109,ar:"الكافرون",      en:"Al-Kaafiroon",        count:6,   type:"Meccan"},
  {n:110,ar:"النصر",         en:"An-Nasr",             count:3,   type:"Medinan"},
  {n:111,ar:"المسد",         en:"Al-Masad",            count:5,   type:"Meccan"},
  {n:112,ar:"الإخلاص",       en:"Al-Ikhlaas",          count:4,   type:"Meccan"},
  {n:113,ar:"الفلق",         en:"Al-Falaq",            count:5,   type:"Meccan"},
  {n:114,ar:"الناس",         en:"An-Naas",             count:6,   type:"Meccan"},
];

// JUZ start info
const JUZ_META = [
  {n:1,  start:"Al-Faatiha 1:1"},  {n:2,  start:"Al-Baqara 2:142"},
  {n:3,  start:"Al-Baqara 2:253"},{n:4,  start:"Aal-i-Imraan 3:92"},
  {n:5,  start:"An-Nisaa 4:24"},  {n:6,  start:"An-Nisaa 4:148"},
  {n:7,  start:"Al-Maaida 5:82"}, {n:8,  start:"Al-An'aam 6:111"},
  {n:9,  start:"Al-A'raaf 7:87"}, {n:10, start:"Al-Anfaal 8:41"},
  {n:11, start:"At-Tawba 9:93"},  {n:12, start:"Hud 11:6"},
  {n:13, start:"Yusuf 12:53"},    {n:14, start:"Al-Hijr 15:1"},
  {n:15, start:"Al-Israa 17:1"},  {n:16, start:"Al-Kahf 18:75"},
  {n:17, start:"Al-Anbiyaa 21:1"},{n:18, start:"Al-Muminoon 23:1"},
  {n:19, start:"Al-Furqaan 25:21"},{n:20,start:"An-Naml 27:56"},
  {n:21, start:"Al-Ankaboot 29:46"},{n:22,start:"Al-Ahzaab 33:31"},
  {n:23, start:"Yaseen 36:28"},   {n:24, start:"Az-Zumar 39:32"},
  {n:25, start:"Fussilat 41:47"}, {n:26, start:"Al-Ahqaf 46:1"},
  {n:27, start:"Adh-Dhaariyat 51:31"},{n:28,start:"Al-Mujaadila 58:1"},
  {n:29, start:"Al-Mulk 67:1"},   {n:30, start:"An-Naba 78:1"},
];

// Translation editions for alquran.cloud fallback API
const TRANSLATION_EDITIONS = {
  "en.sahih":      "en.sahih",
  "en.asad":       "en.asad",
  "fr.hamidullah": "fr.hamidullah",
};

// ── API helpers ──────────────────────────────────────────────

async function fetchQuranSurah(surahNum, translationEdition) {
  // Try quran.com API v4 first
  try {
    const params = new URLSearchParams({
      words: "false",
      translations: translationEdition !== "none" ? getQuranComTranslationId(translationEdition) : "",
      audio: "",
      tafsirs: "",
      word_fields: "",
      translation_fields: "",
      fields: "text_uthmani,verse_number",
      per_page: "300",
    });
    // Remove empty params
    for (const [k, v] of [...params.entries()]) {
      if (!v) params.delete(k);
    }

    const url = `${QURAN_API}/verses/by_chapter/${surahNum}?${params.toString()}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`quran.com ${res.status}`);
    const data = await res.json();
    return normalizeQuranComResponse(data, translationEdition);
  } catch (e) {
    console.warn("quran.com failed, trying alquran.cloud:", e.message);
  }

  // Fallback: alquran.cloud
  try {
    const editions = ["quran-uthmani"];
    if (translationEdition !== "none" && TRANSLATION_EDITIONS[translationEdition]) {
      editions.push(TRANSLATION_EDITIONS[translationEdition]);
    }
    const url = `${ALT_API}/surah/${surahNum}/editions/${editions.join(",")}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`alquran.cloud ${res.status}`);
    const data = await res.json();
    return normalizeAlquranCloudResponse(data, translationEdition);
  } catch (e2) {
    throw new Error("Both APIs failed: " + e2.message);
  }
}

function getQuranComTranslationId(edition) {
  const map = {
    "en.sahih":      "131", // Saheeh International
    "en.asad":       "95",  // Muhammad Asad
    "fr.hamidullah": "136", // Hamidullah
  };
  return map[edition] || "";
}

function normalizeQuranComResponse(data, translationEdition) {
  const verses = data.verses || [];
  return verses.map((v) => ({
    number: v.verse_number,
    arabic: v.text_uthmani || v.text_imlaei || "",
    translation: (v.translations && v.translations[0] && translationEdition !== "none")
      ? stripHtmlTags(v.translations[0].text)
      : null,
  }));
}

function normalizeAlquranCloudResponse(data, translationEdition) {
  const editions = data.data || [];
  // editions[0] = arabic, editions[1] = translation (if requested)
  const arabicEdition = Array.isArray(editions) ? editions[0] : editions;
  const transEdition  = Array.isArray(editions) && editions.length > 1 ? editions[1] : null;
  const ayahs = arabicEdition.ayahs || [];
  return ayahs.map((a, i) => ({
    number: a.numberInSurah,
    arabic: a.text,
    translation: (transEdition && translationEdition !== "none")
      ? stripHtmlTags(transEdition.ayahs[i]?.text || "")
      : null,
  }));
}

function stripHtmlTags(str) {
  return str ? str.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : "";
}

// ── Init ─────────────────────────────────────────────────────

function initQuranPage() {
  // Back button (surah list view)
  document.getElementById("backBtn")?.addEventListener("click", () => {
    ipcRenderer.invoke("navigate-to", "features");
  });

  // Window controls
  document.getElementById("minimizeBtn")?.addEventListener("click", () => {
    ipcRenderer.invoke("minimize-window");
  });
  document.getElementById("closeBtn")?.addEventListener("click", () => {
    ipcRenderer.invoke("close-window");
  });
  document.getElementById("readerCloseBtn")?.addEventListener("click", () => {
    ipcRenderer.invoke("close-window");
  });

  // Fullscreen buttons
  document.getElementById("quranFullscreenBtn")?.addEventListener("click", toggleFullscreen);
  document.getElementById("readerFullscreenBtn")?.addEventListener("click", toggleFullscreen);

  // Reader back button → go back to surah list
  document.getElementById("readerBackBtn")?.addEventListener("click", showSurahList);

  // Tab toggle
  document.getElementById("tabSurah")?.addEventListener("click", () => switchTab("surah"));
  document.getElementById("tabJuz")?.addEventListener("click",   () => switchTab("juz"));

  // Search
  document.getElementById("surahSearchInput")?.addEventListener("input", onSearch);

  // Settings panel toggle
  document.getElementById("readerSettingsBtn")?.addEventListener("click", toggleSettings);

  // Font size controls
  document.getElementById("fontIncBtn")?.addEventListener("click", () => changeFontSize(2));
  document.getElementById("fontDecBtn")?.addEventListener("click", () => changeFontSize(-2));

  // Translation selector
  document.getElementById("translationSelect")?.addEventListener("change", onTranslationChange);

  // Prev/Next surah
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

  // Apply translations
  updateQuranText();

  // Load surah grid
  state.surahs = SURAH_META;
  state.filteredSurahs = [...SURAH_META];
  renderSurahGrid(state.filteredSurahs);
  renderJuzList();

  analytics.featureOpen("quran");
}

// ── UI text ──────────────────────────────────────────────────

function updateQuranText() {
  const el = (id) => document.getElementById(id);
  if (el("quranTitle"))      el("quranTitle").textContent = t("holyQuran") || "القرآن الكريم";
  if (el("quranFooterText")) el("quranFooterText").textContent = t("listenReadQuran") || "Read the Holy Quran";
  if (el("loadingText"))     el("loadingText").textContent = t("loadingQuran") || "Loading...";
  if (el("tabSurah"))        el("tabSurah").textContent = t("surah") || "Surah";
  if (el("tabJuz"))          el("tabJuz").textContent = t("juz") || "Juz";
  if (el("surahSearchInput")) el("surahSearchInput").placeholder = t("searchSurah") || "Search surah...";
  if (el("labelFontSize"))   el("labelFontSize").textContent = t("fontSize") || "Font Size";
  if (el("labelTranslation")) el("labelTranslation").textContent = t("translation") || "Translation";
  if (el("fontSizeDisplay")) el("fontSizeDisplay").textContent = state.fontSize;
}

// ── Tab toggle ───────────────────────────────────────────────

function switchTab(tab) {
  state.activeTab = tab;
  document.getElementById("tabSurah").classList.toggle("active", tab === "surah");
  document.getElementById("tabJuz").classList.toggle("active", tab === "juz");
  document.getElementById("surahGrid").style.display = tab === "surah" ? "" : "none";
  document.getElementById("juzList").style.display  = tab === "juz" ? "" : "none";
  document.getElementById("surahSearchInput").style.display = tab === "surah" ? "" : "none";
}

// ── Search ───────────────────────────────────────────────────

function onSearch(e) {
  const q = e.target.value.trim().toLowerCase();
  if (!q) {
    state.filteredSurahs = [...SURAH_META];
  } else {
    state.filteredSurahs = SURAH_META.filter(
      (s) =>
        s.en.toLowerCase().includes(q) ||
        s.ar.includes(q) ||
        String(s.n).startsWith(q)
    );
  }
  renderSurahGrid(state.filteredSurahs);
}

// ── Surah Grid ───────────────────────────────────────────────

function renderSurahGrid(surahs) {
  const grid = document.getElementById("surahGrid");
  const loading = document.getElementById("surahLoading");

  if (loading) loading.style.display = "none";

  if (!surahs.length) {
    grid.innerHTML = `<div class="no-results" style="grid-column:1/-1">${t("noResults") || "No surahs found"}</div>`;
    return;
  }

  grid.innerHTML = surahs.map((s) => `
    <div class="surah-card" data-surah="${s.n}" role="button" tabindex="0">
      <div class="surah-number-badge">${s.n}</div>
      <div class="surah-card-info">
        <div class="surah-arabic-name">${s.ar}</div>
        <div class="surah-transliteration">${s.en}</div>
        <div class="surah-ayah-count">${s.count} ${t("verses") || "verses"} · ${s.type}</div>
      </div>
    </div>
  `).join("");

  grid.querySelectorAll(".surah-card").forEach((card) => {
    card.addEventListener("click", () => openSurah(Number(card.dataset.surah)));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") openSurah(Number(card.dataset.surah));
    });
  });
}

// ── Juz List ─────────────────────────────────────────────────

function renderJuzList() {
  const list = document.getElementById("juzList");
  list.innerHTML = JUZ_META.map((j) => `
    <div class="juz-card" data-juz="${j.n}" role="button" tabindex="0">
      <div class="juz-badge">${j.n}</div>
      <div class="juz-info">
        <div class="juz-title">${t("juz") || "Juz"} ${j.n}</div>
        <div class="juz-subtitle">${t("startingFrom") || "Starting from"}: ${j.start}</div>
      </div>
      <i class="fas fa-chevron-left juz-arrow"></i>
    </div>
  `).join("");

  // Map juz to first surah of that juz for simple navigation
  const JUZ_TO_SURAH = [1,2,2,3,4,4,5,6,7,8,9,11,12,15,17,18,21,23,25,27,29,33,36,39,41,46,51,58,67,78];
  list.querySelectorAll(".juz-card").forEach((card) => {
    card.addEventListener("click", () => {
      const juzN = Number(card.dataset.juz);
      const surahN = JUZ_TO_SURAH[juzN - 1] || 1;
      openSurah(surahN);
    });
  });
}

// ── Open Surah Reader ─────────────────────────────────────────

async function openSurah(surahNum) {
  const meta = SURAH_META.find((s) => s.n === surahNum);
  if (!meta) return;
  state.currentSurah = meta;

  // Switch to reader view
  document.getElementById("viewSurahList").style.display = "none";
  document.getElementById("viewSurahReader").style.display = "";

  // Set header
  document.getElementById("readerSurahName").textContent = `${meta.ar}  —  ${meta.en}`;
  document.getElementById("readerSurahMeta").textContent =
    `${t("surah") || "Surah"} ${meta.n} · ${meta.count} ${t("verses") || "verses"} · ${meta.type}`;

  // Navigation labels
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

  document.getElementById("readerPageInfo").textContent =
    `${surahNum} / 114`;

  // Bismillah (not for Surah 1 Al-Fatiha and 9 At-Tawba)
  const bismillah = document.getElementById("bismillahHeader");
  bismillah.style.display = (surahNum !== 1 && surahNum !== 9) ? "" : "none";

  // Load ayahs
  await loadAyahs(surahNum);

  // Scroll to top
  document.getElementById("readerContent").scrollTop = 0;

  analytics.featureOpen("quran-surah");
}

// ── Load Ayahs ────────────────────────────────────────────────

async function loadAyahs(surahNum) {
  const loading  = document.getElementById("readerLoading");
  const ayahList = document.getElementById("ayahList");

  loading.style.display = "flex";
  ayahList.innerHTML = "";

  try {
    const ayahs = await fetchQuranSurah(surahNum, state.translationId);
    state.currentAyahs = ayahs;
    loading.style.display = "none";
    renderAyahs(ayahs);
  } catch (err) {
    loading.style.display = "none";
    ayahList.innerHTML = `
      <div class="quran-error">
        <i class="fas fa-exclamation-circle"></i>
        <p>${t("quranError") || "Failed to load. Check your connection."}</p>
        <button class="retry-button" id="retryBtn">
          <i class="fas fa-sync-alt"></i> ${t("retry") || "Retry"}
        </button>
      </div>
    `;
    document.getElementById("retryBtn")?.addEventListener("click", () => loadAyahs(surahNum));
  }
}

// ── Render Ayahs ─────────────────────────────────────────────

function renderAyahs(ayahs) {
  const list = document.getElementById("ayahList");
  list.innerHTML = ayahs.map((a) => `
    <div class="ayah-card" data-ayah="${a.number}">
      <div class="ayah-arabic" style="font-size:${state.fontSize}px">${a.arabic} <span class="ayah-end-ornament">﴿${toArabicNum(a.number)}﴾</span></div>
      ${a.translation ? `<div class="ayah-translation">${a.translation}</div>` : ""}
    </div>
  `).join("");
}

function toArabicNum(n) {
  return String(n).replace(/[0-9]/g, d => "٠١٢٣٤٥٦٧٨٩"[d]);
}

// ── Show Surah List ───────────────────────────────────────────

function showSurahList() {
  document.getElementById("viewSurahReader").style.display = "none";
  document.getElementById("viewSurahList").style.display = "";
  if (state.settingsOpen) {
    state.settingsOpen = false;
    document.getElementById("readerSettingsPanel").style.display = "none";
  }
}

// ── Settings Panel ────────────────────────────────────────────

function toggleSettings() {
  state.settingsOpen = !state.settingsOpen;
  const panel = document.getElementById("readerSettingsPanel");
  panel.style.display = state.settingsOpen ? "" : "none";
}

function changeFontSize(delta) {
  state.fontSize = Math.max(18, Math.min(42, state.fontSize + delta));
  document.getElementById("fontSizeDisplay").textContent = state.fontSize;
  // Update all displayed ayahs
  document.querySelectorAll(".ayah-arabic").forEach((el) => {
    el.style.fontSize = `${state.fontSize}px`;
  });
}

async function onTranslationChange(e) {
  state.translationId = e.target.value;
  if (state.currentSurah) {
    await loadAyahs(state.currentSurah.n);
  }
}

// ── Fullscreen ────────────────────────────────────────────────

function toggleFullscreen() {
  state.isFullscreen = !state.isFullscreen;
  if (state.isFullscreen) {
    ipcRenderer.invoke("resize-window", 1024, 768);
    document.body.classList.add("fullscreen");
  } else {
    ipcRenderer.invoke("resize-window", 850, 600);
    document.body.classList.remove("fullscreen");
  }
  const icon1 = document.querySelector("#quranFullscreenBtn i");
  const icon2 = document.querySelector("#readerFullscreenBtn i");
  const cls = state.isFullscreen ? "fas fa-compress" : "fas fa-expand";
  if (icon1) icon1.className = cls;
  if (icon2) icon2.className = cls;
}

// ── Connection recovery ───────────────────────────────────────

window.addEventListener("connection-restored", () => {
  if (state.currentSurah) loadAyahs(state.currentSurah.n);
});

module.exports = { initQuranPage };
