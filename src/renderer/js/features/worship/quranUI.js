"use strict";

const { ipcRenderer } = require("electron");
const { t } = require("../../core/i18n/translations");
const analytics = require("../../utils/analytics");
const screenSizeManager = require("../../core/screenSize");

const ALQURAN_CLOUD_API = "https://api.alquran.cloud/v1";

let state = {
  surahs: [],
  filteredSurahs: [],
  currentSurah: null,
  currentAyahs: [],
  fontSize: 26,
  translationId: "none",
  settingsOpen: true,
  activeTab: "surah",
};

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

const TRANSLATION_EDITIONS = {
  "en.sahih":      "en.sahih",
  "en.asad":       "en.asad",
  "fr.hamidullah": "fr.hamidullah",
};


async function fetchQuranSurah(surahNum, translationEdition) {
  if (!navigator.onLine) {
    return getLocalQuranSurah(surahNum, translationEdition);
  }

  try {
    const editions = ["quran-uthmani"];
    if (translationEdition !== "none" && TRANSLATION_EDITIONS[translationEdition]) {
      editions.push(TRANSLATION_EDITIONS[translationEdition]);
    }
    const url = `${ALQURAN_CLOUD_API}/surah/${surahNum}/editions/${editions.join(",")}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`alquran.cloud ${res.status}`);
    const data = await res.json();
    return normalizeAlquranCloudResponse(data, translationEdition);
  } catch (e) {
    console.warn("AlQuran Cloud request failed, using offline data:", e.message);
    return getLocalQuranSurah(surahNum, translationEdition);
  }
}

function normalizeAlquranCloudResponse(data, translationEdition) {
  const editions = data.data || [];
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

let _localQuranDataPromise = null;
function getLocalQuranData() {
  if (!_localQuranDataPromise) {
    _localQuranDataPromise = fetch("../../data/Quran.json").then((res) => {
      if (!res.ok) throw new Error(`Failed to load offline Quran data (${res.status})`);
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
  return str ? str.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : "";
}


function initQuranPage() {
  screenSizeManager.initPageScreenSize();
  updateFullscreenButtons();

  document.getElementById("backBtn")?.addEventListener("click", () => {
    ipcRenderer.invoke("navigate-to", "features");
  });

  document.getElementById("minimizeBtn")?.addEventListener("click", () => {
    ipcRenderer.invoke("minimize-window");
  });
  document.getElementById("closeBtn")?.addEventListener("click", () => {
    ipcRenderer.invoke("close-window");
  });
  document.getElementById("readerMinimizeBtn")?.addEventListener("click", () => {
    ipcRenderer.invoke("minimize-window");
  });
  document.getElementById("readerCloseBtn")?.addEventListener("click", () => {
    ipcRenderer.invoke("close-window");
  });

  document.getElementById("quranFullscreenBtn")?.addEventListener("click", toggleFullscreen);
  document.getElementById("readerFullscreenBtn")?.addEventListener("click", toggleFullscreen);

  document.getElementById("readerBackBtn")?.addEventListener("click", showSurahList);

  document.getElementById("tabSurah")?.addEventListener("click", () => switchTab("surah"));
  document.getElementById("tabJuz")?.addEventListener("click",   () => switchTab("juz"));

  document.getElementById("surahSearchInput")?.addEventListener("input", onSearch);

  document.getElementById("readerSettingsBtn")?.addEventListener("click", toggleSettings);
  document.getElementById("settingsPanelCloseBtn")?.addEventListener("click", closeSettings);

  document.getElementById("fontIncBtn")?.addEventListener("click", () => changeFontSize(2));
  document.getElementById("fontDecBtn")?.addEventListener("click", () => changeFontSize(-2));

  document.getElementById("translationSelect")?.addEventListener("change", onTranslationChange);

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

  state.surahs = SURAH_META;
  state.filteredSurahs = [...SURAH_META];
  renderSurahGrid(state.filteredSurahs);
  renderJuzList();

  analytics.featureOpen("quran");
}


function updateQuranText() {
  const el = (id) => document.getElementById(id);
  if (el("quranTitle"))      el("quranTitle").textContent = t("holyQuran") || "القرآن الكريم";
  if (el("quranFooterText")) el("quranFooterText").textContent = t("listenReadQuran") || "Read the Holy Quran";
  if (el("loadingText"))     el("loadingText").textContent = t("loadingQuran") || "Loading...";
  if (el("tabSurah"))        el("tabSurah").textContent = t("surah") || "Surah";
  if (el("tabJuz"))          el("tabJuz").textContent = t("juz") || "Juz";
  if (el("surahSearchInput")) el("surahSearchInput").placeholder = t("searchSurah") || "Search surah...";
  if (el("fontSizeDisplay")) el("fontSizeDisplay").textContent = state.fontSize;
}


function switchTab(tab) {
  state.activeTab = tab;
  document.getElementById("tabSurah").classList.toggle("active", tab === "surah");
  document.getElementById("tabJuz").classList.toggle("active", tab === "juz");
  document.getElementById("surahGrid").style.display = tab === "surah" ? "" : "none";
  document.getElementById("juzList").style.display  = tab === "juz" ? "" : "none";
  document.getElementById("surahSearchInput").style.display = tab === "surah" ? "" : "none";
}


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

  const JUZ_TO_SURAH = [1,2,2,3,4,4,5,6,7,8,9,11,12,15,17,18,21,23,25,27,29,33,36,39,41,46,51,58,67,78];
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

  document.getElementById("readerSurahName").textContent = `${meta.ar}  —  ${meta.en}`;
  document.getElementById("readerSurahMeta").textContent =
    `${t("surah") || "Surah"} ${meta.n} · ${meta.count} ${t("verses") || "verses"} · ${meta.type}`;

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

  const bismillah = document.getElementById("bismillahHeader");
  bismillah.style.display = (surahNum !== 1 && surahNum !== 9) ? "" : "none";

  await loadAyahs(surahNum);

  document.getElementById("readerContent").scrollTop = 0;

  analytics.featureOpen("quran-surah");
}


let loadAyahsRequestId = 0;

async function loadAyahs(surahNum) {
  const myRequestId = ++loadAyahsRequestId;
  const loading  = document.getElementById("readerLoading");
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


function renderAyahs(ayahs) {
  const list = document.getElementById("ayahList");
  const withTranslation = ayahs.filter((a) => a.translation);
  const showingTranslation = state.translationId !== "none" && withTranslation.length > 0;

  let html = "";

  if (!showingTranslation) {
    const flowHtml = ayahs
      .map(
        (a) =>
          `${a.arabic} <span class="ayah-number-inline" data-ayah="${a.number}">(${a.number})</span>`,
      )
      .join(" ");
    html += `<div class="surah-flow-text" id="surahFlowText" style="font-size:${state.fontSize}px">${flowHtml}</div>`;
  }

  if (showingTranslation) {
    html += `<div class="ayah-translation-list" id="ayahTranslationList" style="font-size:${state.fontSize}px">${withTranslation
      .map(
        (a) =>
          `<div class="ayah-translation-row"><span class="ayah-translation-num">${a.number}.</span>${a.translation}</div>`,
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
  document.getElementById("fontSizeDisplay").textContent = state.fontSize;
  const flowText = document.getElementById("surahFlowText");
  if (flowText) flowText.style.fontSize = `${state.fontSize}px`;
  const translationList = document.getElementById("ayahTranslationList");
  if (translationList) translationList.style.fontSize = `${state.fontSize}px`;
}

async function onTranslationChange(e) {
  state.translationId = e.target.value;
  if (state.currentSurah) {
    await loadAyahs(state.currentSurah.n);
  }
}


function updateFullscreenButtons() {
  const isBig = screenSizeManager.isBigScreen();
  const tipKey = isBig ? "tooltipExpand" : "tooltipCompress";
  const tipText = t(tipKey) || (isBig ? "Expand" : "Compress");
  const iconCls = isBig ? "fas fa-expand" : "fas fa-compress";

  ["quranFullscreenBtn", "readerFullscreenBtn"].forEach((id) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.setAttribute("aria-label", tipText);
    btn.setAttribute("data-tooltip", tipKey);
    btn.setAttribute("data-tip", tipText);
    const icon = btn.querySelector("i");
    if (icon) icon.className = iconCls;
  });
}

async function toggleFullscreen() {
  await screenSizeManager.toggleScreenSize();
  updateFullscreenButtons();
}


window.addEventListener("connection-restored", () => {
  if (state.currentSurah) loadAyahs(state.currentSurah.n);
});

module.exports = { initQuranPage };
