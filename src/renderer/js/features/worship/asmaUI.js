// asmaUI.js
const { ipcRenderer } = require("electron");
const {
  setupConnectionRecovery,
} = require("../../services/connection-recovery");
const { t } = require("../../core/i18n/translations");
const screenSizeManager = require("../../core/screenSize");
const { getNamesOfAllah } = require("../../services/api/api");
const analytics = require("../../utils/analytics");

let asmaData = null;
let currentLanguage = "en";

// Function to decode Unicode escape sequences
function decodeUnicode(str) {
  if (!str) return "";
  return str
    .replace(/\\u([\dA-F]{4})/gi, (match, grp) =>
      String.fromCharCode(parseInt(grp, 16)),
    )
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

// ==================== ASMA PAGE FUNCTIONS ====================
function initAsmaPage() {
  // Setup auto-reload on connection restored
  setupConnectionRecovery(() => {
    initAsmaPage();
  }, "Asma");
  // Get current language from HTML
  currentLanguage = document.documentElement.lang || "en";
  // SCREEN SIZE IS NOW HANDLED IN renderer.js

  // Setup back button
  const backBtn = document.getElementById("backBtn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      const currentSize = screenSizeManager.getWindowSize();
      ipcRenderer.invoke(
        "navigate-to",
        "features",
        currentSize.width,
        currentSize.height,
      );
    });
  }

  // Update UI text
  updateAsmaUI();

  // Load asma data
  loadAsmaData();
}

function updateAsmaUI() {
  const asmaTitle = document.getElementById("asmaTitle");
  const asmaFooterText = document.getElementById("asmaFooterText");
  const loadingText = document.getElementById("loadingTextAsma");

  if (asmaTitle) asmaTitle.textContent = t("asmaAllah");
  if (asmaFooterText) asmaFooterText.textContent = t("beautifulNames");
  if (loadingText) loadingText.textContent = t("loadingAsma");
}

async function loadAsmaData() {
  try {
    const rawData = await getNamesOfAllah();
    asmaData = rawData.data;
    renderAsmaList();

    const loadingEl = document.getElementById("asmaLoading");
    if (loadingEl) {
      loadingEl.style.opacity = "0";
      setTimeout(() => {
        loadingEl.style.display = "none";
      }, 300);
    }
  } catch (error) {
    console.error("Error loading Asma data:", error);
    showError();
  }
}

function renderAsmaList() {
  const list = document.getElementById("asmaList");
  if (!list) return;

  list.innerHTML = "";

  const isArabic = currentLanguage === "ar";

  asmaData.forEach((item) => {
    const card = document.createElement("div");
    card.className = "asma-card";

    if (isArabic) {
      card.innerHTML = `
        <button class="asma-copy-btn" aria-label="${t("copy")}">
          <i class="fas fa-copy"></i>
        </button>
        <div class="asma-name">${item.name}</div>
        <div class="asma-number">${item.number}</div>
      `;

      const copyBtn = card.querySelector(".asma-copy-btn");
      copyBtn.addEventListener("click", () => copyAsmaArabic(item.name));
    } else {
      const langData = item[currentLanguage] || item.en;
      const meaning = decodeUnicode(langData.meaning);
      const desc = decodeUnicode(langData.desc);

      card.innerHTML = `
        <div class="asma-number">${item.number}</div>
        <div class="asma-name">${item.name}</div>
        <div class="asma-translit">${item.transliteration}</div>
        <div class="asma-meaning">${meaning}</div>
        <div class="asma-desc">${desc}</div>
        <button class="asma-copy-btn" aria-label="${t("copy")}">
          <i class="fas fa-copy"></i>
        </button>
      `;

      const copyBtn = card.querySelector(".asma-copy-btn");
      copyBtn.addEventListener("click", () => copyAsma(item, meaning, desc));
    }

    list.appendChild(card);
  });
}

function copyAsma(item, meaning, desc) {
  const text = `${item.name} - ${item.transliteration} - ${meaning}\n${desc}`;
  navigator.clipboard
    .writeText(text)
    .then(() => {
      analytics.asmaCopied(); // ← ANALYTICS
      showSuccessToast(t("copiedToClipboard"));
    })
    .catch(() => showSuccessToast(t("failedToCopy"), true));
}

function copyAsmaArabic(name) {
  navigator.clipboard
    .writeText(name)
    .then(() => {
      analytics.asmaCopied(); // ← ANALYTICS
      showSuccessToast(t("copiedToClipboard"));
    })
    .catch(() => showSuccessToast(t("failedToCopy"), true));
}

function showSuccessToast(message, isError = false) {
  document
    .querySelectorAll(".success-toast")
    .forEach((toast) => toast.remove());

  const toast = document.createElement("div");
  toast.className = `success-toast ${isError ? "error" : ""}`;
  toast.innerHTML = `
    <i class="fas fa-${isError ? "exclamation-circle" : "check-circle"}"></i>
    <span>${message}</span>
  `;

  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}

function showError() {
  const content = document.getElementById("asmaContent");
  if (content) {
    content.innerHTML = `
      <div class="error-message">
        <i class="fas fa-exclamation-circle"></i>
        <div>${t("errorLoading")}</div>
        <button class="retry-button" id="retryAsma">
          <i class="fas fa-redo"></i> ${t("retry")}
        </button>
      </div>
    `;
    document
      .getElementById("retryAsma")
      .addEventListener("click", loadAsmaData);
  }
}

// Listen for language changes only
document.addEventListener("DOMContentLoaded", () => {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === "lang") {
        currentLanguage = document.documentElement.lang;
        updateAsmaUI();
        renderAsmaList();
      }
    });
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["lang"],
  });
});

module.exports = { initAsmaPage };
