// athkarUI.js
const { ipcRenderer } = require("electron");
const {
  setupConnectionRecovery,
} = require("../../services/connection-recovery");
const { t } = require("../../core/i18n/translations");
const screenSizeManager = require("../../core/screenSize");
const { getAdkar } = require("../../services/api/api"); // Added import
const analytics = require("../../utils/analytics");

let athkarData = null;
let currentCategory = null;
let athkarState = {};

// ==================== ATHKAR PAGE FUNCTIONS ====================
function initAthkarPage() {
  // Setup auto-reload on connection restored
  setupConnectionRecovery(() => {
    const athkarContainer = document.getElementById("athkar-container");
    if (athkarContainer) {
      initAthkarPage(); // Reload page
    }
  }, "Athkar");
  // SCREEN SIZE IS NOW HANDLED IN renderer.js

  // Setup back button
  const backBtn = document.getElementById("backBtn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      ipcRenderer.invoke("navigate-to", "features");
    });
  }

  // Setup reset all button
  const resetAllBtn = document.getElementById("resetAllBtn");
  if (resetAllBtn) {
    resetAllBtn.addEventListener("click", showResetConfirm);
  }

  // Update UI text
  updateAthkarUI();

  // Load athkar data
  loadAthkarData();

  // Load saved state
  loadAthkarState();
}

function updateAthkarUI() {
  const athkarTitle = document.getElementById("athkarTitle");
  const athkarFooterText = document.getElementById("athkarFooterText");
  const loadingText = document.getElementById("loadingText");
  const resetAllBtn = document.getElementById("resetAllBtn");

  if (athkarTitle) athkarTitle.textContent = t("athkar");
  if (athkarFooterText)
    athkarFooterText.textContent = t("remembrancesFromSunnah");
  if (loadingText) loadingText.textContent = t("loadingAthkar");

  if (resetAllBtn) {
    resetAllBtn.setAttribute("aria-label", t("resetAll"));
  }
}

async function loadAthkarData() {
  const athkarLoading = document.getElementById("athkarLoading");
  const athkarList = document.getElementById("athkarList");

  if (athkarLoading) {
    athkarLoading.style.display = "flex";
  }

  try {
    // Load the JSON data
    athkarData = await getAdkar(); // Using new API

    // Populate category navigation
    populateCategoryNav();

    // Auto-select first category
    const categories = Object.keys(athkarData);
    if (categories.length > 0 && !currentCategory) {
      currentCategory = categories[0];
      setActiveCategory(currentCategory);
    }

    // Hide loading
    if (athkarLoading) {
      athkarLoading.style.display = "none";
    }
  } catch (error) {
    console.error("Error loading athkar data:", error);
    analytics.error("athkar_load", err.message || String(err)); // ← ANALYTICS
    if (athkarLoading) {
      athkarLoading.innerHTML = `
        <div class="athkar-loading-content">
          <i class="fas fa-exclamation-triangle"></i>
          <span>${t("athkarError")}</span>
          <button class="retry-button" id="retryAthkarBtn">
            <i class="fas fa-sync-alt"></i> ${t("retry")}
          </button>
        </div>
      `;

      const retryBtn = document.getElementById("retryAthkarBtn");
      if (retryBtn) {
        retryBtn.addEventListener("click", loadAthkarData);
      }
    }
  }
}

function loadAthkarState() {
  try {
    const savedState = localStorage.getItem("athkarState");
    if (savedState) {
      athkarState = JSON.parse(savedState);
    }
  } catch (error) {
    console.error("Error loading athkar state:", error);
    athkarState = {};
  }
}

function saveAthkarState() {
  try {
    localStorage.setItem("athkarState", JSON.stringify(athkarState));
  } catch (error) {
    console.error("Error saving athkar state:", error);
  }
}

function populateCategoryNav() {
  const categoryNav = document.getElementById("categoryNav");
  if (!categoryNav || !athkarData) return;
  categoryNav.innerHTML = "";

  // Create category cards for each category
  const categories = Object.keys(athkarData);
  categories.forEach((category, index) => {
    const count = athkarData[category].length;
    const categoryCard = createCategoryCard(category, category, count);
    categoryNav.appendChild(categoryCard);

    // Add click listener immediately
    categoryCard.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      setActiveCategory(category);
    });
  });
}

function createCategoryCard(categoryId, categoryName, count) {
  const card = document.createElement("div");
  card.className = "category-card";
  card.dataset.category = categoryId;
  card.setAttribute("data-test", "category-card");

  const nameSpan = document.createElement("span");
  nameSpan.className = "category-name";
  nameSpan.textContent = categoryName;

  const countSpan = document.createElement("span");
  countSpan.className = "category-count";
  countSpan.textContent = `${count}`;

  card.appendChild(nameSpan);
  card.appendChild(countSpan);

  return card;
}

function setActiveCategory(category) {
  if (!category || !athkarData || !athkarData[category]) {
    console.error("Invalid category:", category);
    return;
  }

  currentCategory = category;

  // Update active state in navigation
  document.querySelectorAll(".category-card").forEach((card) => {
    if (card.dataset.category === category) {
      card.classList.add("active");
    } else {
      card.classList.remove("active");
    }
  });

  // ── Track category view ──────────────────────────────────────────────────
  analytics.athkarCategoryView(category); // ← ANALYTICS

  // Render athkar list for the selected category
  renderAthkarList();
}

function renderAthkarList() {
  const athkarList = document.getElementById("athkarList");
  if (!athkarList || !athkarData || !currentCategory) {
    console.error("Cannot render: missing data or category");
    return;
  }
  athkarList.innerHTML = "";

  // Get athkar items for selected category
  const athkarItems = athkarData[currentCategory] || [];
  if (athkarItems.length === 0) {
    athkarList.innerHTML = `
      <div class="athkar-empty">
        <i class="fas fa-book-open"></i>
        <span>No athkar found for this category</span>
      </div>
    `;
    return;
  }

  // Render each athkar item as a card
  athkarItems.forEach((item, index) => {
    const athkarCard = createAthkarCard(item, index);
    athkarList.appendChild(athkarCard);
  });
}

function createAthkarCard(item, index) {
  const card = document.createElement("div");
  card.className = "athkar-card";
  card.dataset.index = index;

  // Generate unique ID for this athkar
  const athkarId = `${currentCategory}-${index}`;
  card.id = `athkar-${athkarId}`;

  // Get current count from state
  const currentCount = athkarState[athkarId] || 0;
  const targetCount = parseInt(item.count) || 1;
  const progress = Math.min((currentCount / targetCount) * 100, 100);
  const isCompleted = currentCount >= targetCount;

  if (isCompleted) {
    card.classList.add("completed");
  }

  // Create card HTML with language-based positioning
  card.innerHTML = `
    <div class="athkar-card-header">
      <div class="athkar-category">
        <i class="fas fa-hashtag"></i>
        ${item.category}
      </div>
      <div class="athkar-actions">
        <button class="athkar-action-btn copy-btn" data-id="${athkarId}" title="${t("copy")}">
          <i class="fas fa-copy"></i>
        </button>
      </div>
    </div>
    
    <div class="athkar-content-text">${item.content}</div>
    
    ${
      item.description
        ? `
      <div class="athkar-description">
        ${item.description}
      </div>
    `
        : ""
    }
    
    <div class="athkar-count-controls">
      <div class="count-info">
        <div class="count-label">${t("recitations")}</div>
        <div class="count-display">
          <div class="count-value">${currentCount}</div>
          <div class="count-target">/${targetCount}</div>
        </div>
      </div>
      
      <div class="count-progress">
        <div class="progress-bar" style="width: ${progress}%"></div>
      </div>
      
      <div class="count-buttons">
        <button class="count-btn increment-btn" data-id="${athkarId}" ${isCompleted ? "disabled" : ""}>
          +
        </button>
        <button class="count-btn reset-btn" data-id="${athkarId}">
          <i class="fas fa-redo"></i>
        </button>
      </div>
    </div>
    
    ${
      item.reference
        ? `
      <div class="athkar-reference">
        ${item.reference}
      </div>
    `
        : ""
    }
  `;

  // Add event listeners
  const incrementBtn = card.querySelector(".increment-btn");
  const resetBtn = card.querySelector(".reset-btn");
  const copyBtn = card.querySelector(".copy-btn");

  if (incrementBtn) {
    incrementBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      incrementCount(athkarId, targetCount);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      resetCount(athkarId);
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      copyAthkar(item.content);
    });
  }

  return card;
}

function incrementCount(athkarId, targetCount) {
  if (!athkarState[athkarId]) athkarState[athkarId] = 0;

  if (athkarState[athkarId] < targetCount) {
    athkarState[athkarId]++;
    saveAthkarState();
    updateAthkarCard(athkarId, targetCount);
    showSuccessToast(t("countIncreased"));

    // ── Check if entire category is now completed ─────────────────────────
    if (athkarState[athkarId] >= targetCount) {
      const items = athkarData[currentCategory] || [];
      const allDone = items.every((item, idx) => {
        const id = `${currentCategory}-${idx}`;
        return (athkarState[id] || 0) >= (parseInt(item.count) || 1);
      });
      if (allDone) analytics.athkarCategoryCompleted(currentCategory); // ← ANALYTICS
    }
  } else {
    showSuccessToast(t("maxCountReached"), true);
  }
}

function resetCount(athkarId) {
  athkarState[athkarId] = 0;
  saveAthkarState();
  updateAthkarCard(athkarId);
  showSuccessToast(t("countReset"));
}

function showResetConfirm() {
  // Create custom confirm dialog with translations
  const dialog = document.createElement("div");
  dialog.className = "athkar-confirm-dialog";
  dialog.innerHTML = `
    <div class="athkar-confirm-box">
      <div class="athkar-confirm-title">${t("resetAllConfirmTitle")}</div>
      <div class="athkar-confirm-message">${t("resetAllConfirmMessage")}</div>
      <div class="athkar-confirm-buttons">
        <button class="athkar-confirm-btn athkar-confirm-cancel">${t("cancel")}</button>
        <button class="athkar-confirm-btn athkar-confirm-reset">${t("resetAllConfirm")}</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  // Add event listeners
  const cancelBtn = dialog.querySelector(".athkar-confirm-cancel");
  const resetBtn = dialog.querySelector(".athkar-confirm-reset");

  if (cancelBtn) {
    cancelBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      dialog.remove();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      athkarState = {};
      saveAthkarState();
      renderAthkarList();
      showSuccessToast(t("allCountsReset"));
      dialog.remove();
    });
  }

  // Close on backdrop click
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) {
      dialog.remove();
    }
  });
}

function updateAthkarCard(athkarId, targetCount = null) {
  const card = document.getElementById(`athkar-${athkarId}`);
  if (!card) return;

  const index = parseInt(card.dataset.index);
  const athkarItem = athkarData[currentCategory][index];

  if (!athkarItem) return;

  const currentCount = athkarState[athkarId] || 0;
  const itemTargetCount = targetCount || parseInt(athkarItem.count) || 1;
  const progress = Math.min((currentCount / itemTargetCount) * 100, 100);
  const isCompleted = currentCount >= itemTargetCount;

  const countValue = card.querySelector(".count-value");
  const countTarget = card.querySelector(".count-target");
  const incrementBtn = card.querySelector(".increment-btn");

  if (countValue) countValue.textContent = currentCount;
  if (countTarget) countTarget.textContent = `/${itemTargetCount}`;

  const progressBar = card.querySelector(".progress-bar");
  if (progressBar) {
    progressBar.style.width = `${progress}%`;
  }

  if (isCompleted) {
    card.classList.add("completed");
    if (incrementBtn) incrementBtn.disabled = true;
  } else {
    card.classList.remove("completed");
    if (incrementBtn) incrementBtn.disabled = false;
  }
}

function copyAthkar(text) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      showSuccessToast(t("copiedToClipboard"));
    })
    .catch((err) => {
      console.error("Failed to copy:", err);
      showSuccessToast(t("failedToCopy"), true);
    });
}

function showSuccessToast(message, isError = false) {
  // Remove existing toasts
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

  setTimeout(() => {
    toast.classList.add("show");
  }, 10);

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 200);
  }, 2000);
}

module.exports = { initAthkarPage };
