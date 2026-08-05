"use strict";
const { ipcRenderer } = require("electron");
const {
  setupConnectionRecovery,
} = require("../../services/connection-recovery");
const { t, getLanguage } = require("../../core/i18n/translations");
const analytics = require("../../utils/analytics");
const { renderToast } = require("../../core/toast");

const DEFAULT_DHIKR_LIST = [
  { id: "subhanallah", name: "سُبْحَانَ اللَّهِ", count: 33, meaningKey: "dhikrSubhanallahMeaning" },
  { id: "alhamdulillah", name: "الْحَمْدُ لِلَّهِ", count: 33, meaningKey: "dhikrAlhamdulillahMeaning" },
  { id: "allahuakbar", name: "اللَّهُ أَكْبَرُ", count: 34, meaningKey: "dhikrAllahuAkbarMeaning" },
  { id: "laIlahaIllallah", name: "لا إله إلا الله", count: 100, meaningKey: "dhikrLaIlahaMeaning" },
  { id: "astaghfirullah", name: "أستغفر الله", count: 100, meaningKey: "dhikrAstaghfirullahMeaning" },
  { id: "subhanallahiWaBihamdihi", name: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ", count: 100, meaningKey: "dhikrSubhanallahiWaBihamdihiMeaning" },
  { id: "salawat", name: "اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ", count: 100, meaningKey: "dhikrSalawatMeaning" },
  { id: "hawqala", name: "لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ", count: 100, meaningKey: "dhikrHawqalaMeaning" },
];

const LEGACY_NAME_TO_ID = {
  "سُبْحَانَ اللَّهِ": "subhanallah",
  "الْحَمْدُ لِلَّهِ": "alhamdulillah",
  "اللَّهُ أَكْبَرُ": "allahuakbar",
  "لا إله إلا الله": "laIlahaIllallah",
  "أستغفر الله": "astaghfirullah",
  "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ": "subhanallahiWaBihamdihi",
};

const FOOTER_TEXTS = {
  en: [
    '"So remember Me; I will remember you" [Quran 2:152]',
    '"And the remembering of Allah is greater" [Quran 29:45]',
    '"Glory and praise be to Allah, by whose grace good deeds are accomplished"',
    '"Whoever remembers his Lord and glorifies Him, his sins fall away"',
    '"The best of deeds is to remember Allah"',
  ],
  fr: [
    '"Souvenez-vous de Moi, donc, Je Me souviendrai de vous" [Coran 2:152]',
    '"Et le rappel d\'Allah est plus grand" [Coran 29:45]',
    '"Gloire et louange à Allah, par la grâce duquel les bonnes actions sont accomplies"',
    '"Celui qui se souvient de son Seigneur et Le glorifie, ses péchés tombent"',
    '"La meilleure des actions est le rappel d\'Allah"',
  ],
  ar: [
    '"فَاذْكُرُونِي أَذْكُرْكُمْ" [البقرة 152]',
    '"وَلَذِكْرُ اللَّهِ أَكْبَرُ" [العنكبوت 45]',
    '"سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ"',
    '"مَنْ ذَكَرَ رَبَّهُ وَسَبَّحَهُ تَسَاقَطَتْ خَطَايَاهُ"',
    '"أَفْضَلُ الْأَعْمَالِ ذِكْرُ اللَّهِ"',
  ],
};

const RING_RADIUS = 96;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

let currentDhikr = {
  id: DEFAULT_DHIKR_LIST[0].id,
  name: DEFAULT_DHIKR_LIST[0].name,
  count: DEFAULT_DHIKR_LIST[0].count,
  current: 0,
};
let tasbihHistory = {};
let unlimitedMap = {};

function initTasbihPage() {
  setupConnectionRecovery(initTasbihPage, "Tasbih");

  document.getElementById("backBtn")?.addEventListener("click", () => {
    ipcRenderer.invoke("navigate-to", "features");
  });
  document
    .getElementById("incrementBtn")
    ?.addEventListener("click", incrementCount);
  document.getElementById("tbRingTap")?.addEventListener("click", incrementCount);
  document.getElementById("undoBtn")?.addEventListener("click", undoLastCount);
  document
    .getElementById("resetBtn")
    ?.addEventListener("click", resetCurrentDhikr);
  document
    .getElementById("tbLimitChip")
    ?.addEventListener("click", toggleUnlimited);

  loadTasbihState();
  updateStaticText();
  populateDhikrGrid();
  updateActiveDhikrPanel();
  updateCounterDisplay();
  setupKeyboardListener();
}


function setupKeyboardListener() {
  document.addEventListener("keydown", (event) => {
    if (
      event.code === "Space" &&
      !event.target.matches("input, textarea, button")
    ) {
      event.preventDefault();
      pulseRing();
      incrementCount();
    }
  });
}

function pulseRing() {
  const ring = document.getElementById("tbRingTap");
  if (!ring) return;
  ring.classList.remove("tb-ring-tap--pulse");
  void ring.offsetWidth;
  ring.classList.add("tb-ring-tap--pulse");
}


function updateStaticText() {
  const lang = getLanguage();
  const map = {
    tasbihTitle: "tasbih",
    dhikrLabel: "selectDhikr",
    incrementLabel: "countBtn",
    resetLabel: "resetBtn",
    spacebarText: "spacebarHint",
  };
  for (const [id, key] of Object.entries(map)) {
    const el = document.getElementById(id);
    const text = t(key);
    if (el && text) el.textContent = text;
  }

  const undoBtn = document.getElementById("undoBtn");
  if (undoBtn) undoBtn.setAttribute("aria-label", t("undoBtn"));

  const tasbihFooter = document.getElementById("tasbihFooterText");
  if (tasbihFooter) {
    const texts = FOOTER_TEXTS[lang] || FOOTER_TEXTS.en;
    tasbihFooter.textContent = texts[Math.floor(Math.random() * texts.length)];
  }
}


function loadTasbihState() {
  try {
    const saved = localStorage.getItem("tasbihState");
    if (saved) {
      const parsed = JSON.parse(saved);
      tasbihHistory = _migrateLegacyKeys(parsed);
    }
    const savedUnlimited = localStorage.getItem("tasbihUnlimitedMap");
    if (savedUnlimited) unlimitedMap = JSON.parse(savedUnlimited) || {};

    const lastDhikrId = localStorage.getItem("lastDhikrId");
    const found = DEFAULT_DHIKR_LIST.find((d) => d.id === lastDhikrId);
    const dhikr = found || DEFAULT_DHIKR_LIST[0];
    currentDhikr = {
      id: dhikr.id,
      name: dhikr.name,
      count: dhikr.count,
      current: tasbihHistory[dhikr.id] || 0,
    };
  } catch (err) {
    console.error("Error loading tasbih state:", err);
    tasbihHistory = {};
    unlimitedMap = {};
  }
}

function _migrateLegacyKeys(parsed) {
  const migrated = {};
  for (const [key, value] of Object.entries(parsed || {})) {
    const mappedId = LEGACY_NAME_TO_ID[key];
    migrated[mappedId || key] = value;
  }
  return migrated;
}

function saveTasbihState() {
  try {
    tasbihHistory[currentDhikr.id] = currentDhikr.current;
    localStorage.setItem("tasbihState", JSON.stringify(tasbihHistory));
    localStorage.setItem("lastDhikrId", currentDhikr.id);
  } catch (err) {
    console.error("Error saving tasbih state:", err);
  }
}

function saveUnlimitedMap() {
  try {
    localStorage.setItem("tasbihUnlimitedMap", JSON.stringify(unlimitedMap));
  } catch (err) {
    console.error("Error saving unlimited map:", err);
  }
}

function isUnlimited(dhikrId) {
  return !!unlimitedMap[dhikrId];
}


function populateDhikrGrid() {
  const grid = document.getElementById("dhikrGrid");
  if (!grid) return;
  const lang = getLanguage();
  grid.innerHTML = "";

  DEFAULT_DHIKR_LIST.forEach((dhikr) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "dhikr-card";
    if (dhikr.id === currentDhikr.id) card.classList.add("active");
    card.dataset.id = dhikr.id;

    const nameSpan = document.createElement("span");
    nameSpan.className = "dhikr-name";
    nameSpan.textContent = dhikr.name;
    card.appendChild(nameSpan);

    if (lang !== "ar") {
      const meaningSpan = document.createElement("span");
      meaningSpan.className = "dhikr-meaning";
      meaningSpan.textContent = t(dhikr.meaningKey) || "";
      card.appendChild(meaningSpan);
    }

    const countSpan = document.createElement("span");
    countSpan.className = "dhikr-count";
    countSpan.textContent = dhikr.count;
    card.appendChild(countSpan);

    card.addEventListener("click", () => switchDhikr(dhikr));
    grid.appendChild(card);
  });
}

function switchDhikr(dhikr) {
  if (currentDhikr.id === dhikr.id) return;
  tasbihHistory[currentDhikr.id] = currentDhikr.current;
  currentDhikr = {
    id: dhikr.id,
    name: dhikr.name,
    count: dhikr.count,
    current: tasbihHistory[dhikr.id] || 0,
  };

  document.querySelectorAll(".dhikr-card").forEach((card) => {
    card.classList.toggle("active", card.dataset.id === dhikr.id);
  });

  updateActiveDhikrPanel();
  updateCounterDisplay();
  saveTasbihState();

  showSuccessToast((t("dhikrSwitched") || "{name}").replace("{name}", dhikr.name));
}

function updateActiveDhikrPanel() {
  const nameEl = document.getElementById("activeDhikrName");
  const meaningEl = document.getElementById("activeDhikrMeaning");
  const lang = getLanguage();
  if (nameEl) nameEl.textContent = currentDhikr.name;
  if (meaningEl) {
    const dhikr = DEFAULT_DHIKR_LIST.find((d) => d.id === currentDhikr.id);
    meaningEl.textContent =
      lang === "ar" ? "" : (dhikr && t(dhikr.meaningKey)) || "";
    meaningEl.classList.toggle("tb-hidden", lang === "ar");
  }
}


function incrementCount() {
  const unlimited = isUnlimited(currentDhikr.id);
  if (!unlimited && currentDhikr.current >= currentDhikr.count) return;

  currentDhikr.current++;
  updateCounterDisplay();
  saveTasbihState();
  pulseRing();

  analytics.tasbihTap(currentDhikr.name, currentDhikr.current, currentDhikr.count);

  const isLapComplete = currentDhikr.current % currentDhikr.count === 0;
  if (isLapComplete) {
    const lap = currentDhikr.current / currentDhikr.count;
    if (lap <= 1) {
      showSuccessToast(
        (t("dhikrCompleted") || "{count}").replace("{count}", currentDhikr.count),
        false,
        3000,
      );
      analytics.tasbihCompleted(currentDhikr.name);
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    } else {
      showSuccessToast(
        (t("dhikrRoundCompleted") || "{n}").replace("{n}", lap),
        false,
        2200,
      );
      if (navigator.vibrate) navigator.vibrate([80, 40, 80, 40, 80]);
    }
  } else if (navigator.vibrate) {
    navigator.vibrate(30);
  }
}

function undoLastCount() {
  if (currentDhikr.current <= 0) return;
  currentDhikr.current--;
  updateCounterDisplay();
  saveTasbihState();
  if (navigator.vibrate) navigator.vibrate(20);
}

function toggleUnlimited() {
  unlimitedMap[currentDhikr.id] = !unlimitedMap[currentDhikr.id];
  saveUnlimitedMap();
  updateCounterDisplay();
}

function resetCurrentDhikr() {
  if (currentDhikr.current === 0) return;
  showResetConfirm(() => {
    currentDhikr.current = 0;
    updateCounterDisplay();
    saveTasbihState();
    showSuccessToast(t("counterReset"));
  });
}


function computeRingState() {
  const target = currentDhikr.count || 1;
  const current = currentDhikr.current;
  const unlimited = isUnlimited(currentDhikr.id);

  let fraction;
  let lapLocalCount;
  let lapNumber;

  if (unlimited && current > target) {
    const mod = current % target;
    lapLocalCount = mod === 0 ? target : mod;
    fraction = lapLocalCount / target;
    lapNumber = Math.ceil(current / target);
  } else {
    lapLocalCount = current;
    fraction = target > 0 ? Math.min(current / target, 1) : 0;
    lapNumber = current > 0 ? 1 : 0;
  }

  return { target, current, unlimited, fraction, lapLocalCount, lapNumber };
}

function updateCounterDisplay() {
  const state = computeRingState();

  const cv = document.getElementById("counterValue");
  const targetLine = document.getElementById("targetLine");
  const roundBadge = document.getElementById("tbRoundBadge");

  if (cv) cv.textContent = state.current;

  if (targetLine) {
    targetLine.textContent =
      state.unlimited && state.lapNumber >= 2
        ? `${state.lapLocalCount} / ${state.target}`
        : `/ ${state.target}`;
  }

  if (roundBadge) {
    if (state.unlimited && state.lapNumber >= 2) {
      roundBadge.textContent = (t("roundLabel") || "{n}").replace(
        "{n}",
        state.lapNumber,
      );
      roundBadge.classList.remove("tb-hidden");
    } else {
      roundBadge.classList.add("tb-hidden");
    }
  }

  updateRing(state.fraction);
  updateLimitChip(state.unlimited);
}

function updateRing(fraction) {
  const progressEl = document.getElementById("tbRingProgress");
  const beadEl = document.getElementById("tbRingBead");
  if (!progressEl) return;

  const offset = RING_CIRCUMFERENCE * (1 - fraction);
  progressEl.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;
  progressEl.style.strokeDashoffset = `${offset}`;

  if (beadEl) {
    const angleDeg = fraction * 360 - 90;
    const angleRad = (angleDeg * Math.PI) / 180;
    const cx = 110 + RING_RADIUS * Math.cos(angleRad);
    const cy = 110 + RING_RADIUS * Math.sin(angleRad);
    beadEl.setAttribute("cx", cx.toFixed(2));
    beadEl.setAttribute("cy", cy.toFixed(2));
    beadEl.style.opacity = fraction > 0.01 ? "1" : "0";
  }
}

function updateLimitChip(unlimited) {
  const chip = document.getElementById("tbLimitChip");
  const chipText = document.getElementById("tbLimitChipText");
  if (!chip || !chipText) return;

  chip.classList.toggle("tb-limit-chip--unlimited", unlimited);
  chip.setAttribute("aria-pressed", String(unlimited));
  chipText.textContent = unlimited
    ? t("noLimit") || "No limit"
    : (t("stopAtCount") || "{count}").replace("{count}", currentDhikr.count);

  const icon = chip.querySelector("i");
  if (icon) icon.className = unlimited ? "fas fa-infinity" : "fas fa-flag-checkered";
}


function showResetConfirm(callback) {
  _showConfirmDialog({
    title: t("resetConfirmTitle"),
    message: t("resetConfirmMessage"),
    cancelLabel: t("cancel"),
    confirmLabel: t("reset"),
    onConfirm: callback,
  });
}

function _showConfirmDialog({ title, message, cancelLabel, confirmLabel, onConfirm }) {
  const dialog = document.createElement("div");
  dialog.className = "tasbih-confirm-dialog";
  dialog.innerHTML = `<div class="tasbih-confirm-box">
    <div class="tasbih-confirm-title"></div>
    <div class="tasbih-confirm-message"></div>
    <div class="tasbih-confirm-buttons">
      <button class="tasbih-confirm-btn tasbih-confirm-cancel"></button>
      <button class="tasbih-confirm-btn tasbih-confirm-reset"></button>
    </div></div>`;
  dialog.querySelector(".tasbih-confirm-title").textContent = title || "";
  dialog.querySelector(".tasbih-confirm-message").textContent = message || "";
  dialog.querySelector(".tasbih-confirm-cancel").textContent = cancelLabel || "";
  dialog.querySelector(".tasbih-confirm-reset").textContent = confirmLabel || "";

  document.body.appendChild(dialog);
  dialog
    .querySelector(".tasbih-confirm-cancel")
    .addEventListener("click", () => dialog.remove());
  dialog.querySelector(".tasbih-confirm-reset").addEventListener("click", () => {
    onConfirm?.();
    dialog.remove();
  });
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.remove();
  });
}


function showSuccessToast(message, isError = false, duration = 2000) {
  renderToast(
    `success-toast ${isError ? "error" : ""}`,
    `<i class="fas fa-${isError ? "exclamation-circle" : "check-circle"}"></i><span>${message}</span>`,
    { duration, removeDelay: 200 },
  );
}

module.exports = { initTasbihPage };
