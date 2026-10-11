"use strict";

const { t } = require("../core/i18n");
const { getNamesOfAllah } = require("../services/content");
const analytics = require("../services/analytics");
const { renderToast } = require("../core/toast");
const { initSelectionCopy } = require("../components/selection-copy");
const { byId, query } = require("../core/dom");

/** @type {any[] | null} */
let asmaData = null;
let currentLanguage = "en";

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

// The names are bundled (data/99_Names_Of_Allah.json): nothing to reload when the connection returns.
function initAsmaPage() {
  currentLanguage = document.documentElement.lang || "en";

  initSelectionCopy(document.getElementById("asmaList"), copySelectedText);

  loadAsmaData();
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

  if (!asmaData) return;
  asmaData.forEach((item) => {
    const card = document.createElement("div");
    card.className = "asma-card";

    if (isArabic) {
      const langData = item.ar;
      const meaning = langData ? decodeUnicode(langData.meaning) : "";
      const desc = langData ? decodeUnicode(langData.desc) : "";

      card.innerHTML = `
        <div class="asma-header-row">
          <div class="asma-name-group">
            <div class="asma-number">${item.number}</div>
            <div class="asma-name">${item.name}</div>
          </div>
          <button type="button" class="asma-copy-btn" aria-label="${t("copy")}">
            <i class="fas fa-copy" aria-hidden="true"></i>
          </button>
        </div>
        <div class="asma-meaning">${meaning}</div>
        <div class="asma-desc">${desc}</div>
      `;

      const copyBtn = query(".asma-copy-btn", HTMLButtonElement, card);
      copyBtn.addEventListener("click", () =>
        copyAsmaArabic(item.name, meaning, desc),
      );
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
        <button type="button" class="asma-copy-btn" aria-label="${t("copy")}">
          <i class="fas fa-copy" aria-hidden="true"></i>
        </button>
      `;

      const copyBtn = query(".asma-copy-btn", HTMLButtonElement, card);
      copyBtn.addEventListener("click", () => copyAsma(item, meaning, desc));
    }

    list.appendChild(card);
  });
}

// Copies the part of a card the user highlighted (Ctrl/Cmd+C or right-click > Copy).
function copySelectedText(text) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      analytics.asmaCopied();
      showSuccessToast(t("copiedToClipboard"));
    })
    .catch(() => showSuccessToast(t("failedToCopy"), true));
}

function copyAsma(item, meaning, desc) {
  const text = `${item.name} - ${item.transliteration} - ${meaning}\n${desc}`;
  navigator.clipboard
    .writeText(text)
    .then(() => {
      analytics.asmaCopied();
      showSuccessToast(t("copiedToClipboard"));
    })
    .catch(() => showSuccessToast(t("failedToCopy"), true));
}

function copyAsmaArabic(name, meaning, desc) {
  const text = meaning ? `${name} — ${meaning}\n${desc}` : name;
  navigator.clipboard
    .writeText(text)
    .then(() => {
      analytics.asmaCopied();
      showSuccessToast(t("copiedToClipboard"));
    })
    .catch(() => showSuccessToast(t("failedToCopy"), true));
}

function showSuccessToast(message, isError = false) {
  renderToast(
    `asma-toast ${isError ? "error" : ""}`,
    `<i class="fas fa-${isError ? "exclamation-circle" : "check-circle"}" aria-hidden="true"></i><span>${message}</span>`,
    { duration: 3000, removeDelay: 500 },
  );
}

function showError() {
  const content = document.getElementById("asmaContent");
  if (content) {
    content.innerHTML = `
      <div class="error-message">
        <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
        <div>${t("errorLoading")}</div>
        <button type="button" class="retry-button" id="retryAsma">
          <i class="fas fa-redo" aria-hidden="true"></i> ${t("retry")}
        </button>
      </div>
    `;
    byId("retryAsma", HTMLButtonElement).addEventListener(
      "click",
      loadAsmaData,
    );
  }
}

module.exports = { initAsmaPage };
