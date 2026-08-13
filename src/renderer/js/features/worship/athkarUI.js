const { ipcRenderer } = require("electron");
const {
  setupConnectionRecovery,
} = require("../../services/connection-recovery");
const { t } = require("../../core/i18n/translations");
const { getAdkar } = require("../../services/api/api");
const analytics = require("../../utils/analytics");
const { renderToast } = require("../../core/toast");

let athkarData = null;
let currentCategory = null;
let athkarState = {};

function initAthkarPage() {
  setupConnectionRecovery(() => {
    const athkarContainer = document.getElementById("athkar-container");
    if (athkarContainer) {
      initAthkarPage();
    }
  }, "Athkar");

  const backBtn = document.getElementById("backBtn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      ipcRenderer.invoke("navigate-to", "features");
    });
  }

  const resetAllBtn = document.getElementById("resetAllBtn");
  if (resetAllBtn) {
    resetAllBtn.addEventListener("click", showResetConfirm);
  }

  updateAthkarUI();

  loadAthkarData();

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

  if (athkarLoading) {
    athkarLoading.style.display = "flex";
  }

  try {
    athkarData = await getAdkar();

    populateCategoryNav();

    const categories = Object.keys(athkarData);
    if (categories.length > 0 && !currentCategory) {
      currentCategory = categories[0];
      setActiveCategory(currentCategory);
    }

    if (athkarLoading) {
      athkarLoading.style.display = "none";
    }
  } catch (error) {
    console.error("Error loading athkar data:", error);
    analytics.error("athkar_load", error.message || String(error));
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

  const categories = Object.keys(athkarData);
  categories.forEach((category) => {
    const count = athkarData[category].length;
    const categoryCard = createCategoryCard(category, category, count);
    categoryNav.appendChild(categoryCard);

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

  document.querySelectorAll(".category-card").forEach((card) => {
    if (card.dataset.category === category) {
      card.classList.add("active");
    } else {
      card.classList.remove("active");
    }
  });

  analytics.athkarCategoryView(category);

  renderAthkarList();
}

function renderAthkarList() {
  const athkarList = document.getElementById("athkarList");
  if (!athkarList || !athkarData || !currentCategory) {
    console.error("Cannot render: missing data or category");
    return;
  }
  athkarList.innerHTML = "";

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

  athkarItems.forEach((item, index) => {
    const athkarCard = createAthkarCard(item, index);
    athkarList.appendChild(athkarCard);
  });
}

function createAthkarCard(item, index) {
  const card = document.createElement("div");
  card.className = "athkar-card";
  card.dataset.index = index;

  const athkarId = `${currentCategory}-${index}`;
  card.id = `athkar-${athkarId}`;

  const currentCount = athkarState[athkarId] || 0;
  const isUnlimited = item.count === null || item.count === undefined;
  const targetCount = isUnlimited ? null : parseInt(item.count) || 1;
  const progress = isUnlimited
    ? 0
    : Math.min((currentCount / targetCount) * 100, 100);
  const isCompleted = !isUnlimited && currentCount >= targetCount;

  if (isCompleted) {
    card.classList.add("completed");
  }

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
          <div class="count-target">/${isUnlimited ? "∞" : targetCount}</div>
        </div>
      </div>
      
      <div class="count-progress ${isUnlimited ? "athkar-count-hidden" : ""}">
        <div class="progress-bar" style="width: ${progress}%"></div>
      </div>
      
      <div class="count-buttons">
        <button class="count-btn increment-btn" data-id="${athkarId}" ${isCompleted ? "disabled" : ""}>
          +
        </button>
        <button class="count-btn decrement-btn" data-id="${athkarId}" ${currentCount <= 0 ? "disabled" : ""}>
          −
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

  const decrementBtn = card.querySelector(".decrement-btn");
  const incrementBtn = card.querySelector(".increment-btn");
  const resetBtn = card.querySelector(".reset-btn");
  const copyBtn = card.querySelector(".copy-btn");

  if (decrementBtn) {
    decrementBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      decrementCount(athkarId, targetCount);
    });
  }

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

  const isUnlimited = targetCount === null || targetCount === undefined;

  if (isUnlimited || athkarState[athkarId] < targetCount) {
    athkarState[athkarId]++;
    saveAthkarState();
    updateAthkarCard(athkarId, targetCount);
    showSuccessToast(t("countIncreased"));

    if (!isUnlimited && athkarState[athkarId] >= targetCount) {
      const items = athkarData[currentCategory] || [];
      const allDone = items.every((item, idx) => {
        const id = `${currentCategory}-${idx}`;
        if (item.count === null || item.count === undefined) return true;
        return (athkarState[id] || 0) >= (parseInt(item.count) || 1);
      });
      if (allDone) analytics.athkarCategoryCompleted(currentCategory);
    }
  } else {
    showSuccessToast(t("maxCountReached"), true);
  }
}

function decrementCount(athkarId, targetCount) {
  if (!athkarState[athkarId]) athkarState[athkarId] = 0;

  if (athkarState[athkarId] > 0) {
    athkarState[athkarId]--;
    saveAthkarState();
    updateAthkarCard(athkarId, targetCount);
  }
}

function resetCount(athkarId) {
  athkarState[athkarId] = 0;
  saveAthkarState();
  updateAthkarCard(athkarId);
  showSuccessToast(t("countReset"));
}

function showResetConfirm() {
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

  const isUnlimited = athkarItem.count === null || athkarItem.count === undefined;
  const currentCount = athkarState[athkarId] || 0;
  const itemTargetCount = isUnlimited
    ? null
    : targetCount || parseInt(athkarItem.count) || 1;
  const progress = isUnlimited
    ? 0
    : Math.min((currentCount / itemTargetCount) * 100, 100);
  const isCompleted = !isUnlimited && currentCount >= itemTargetCount;

  const countValue = card.querySelector(".count-value");
  const countTarget = card.querySelector(".count-target");
  const decrementBtn = card.querySelector(".decrement-btn");
  const incrementBtn = card.querySelector(".increment-btn");

  if (countValue) countValue.textContent = currentCount;
  if (countTarget)
    countTarget.textContent = `/${isUnlimited ? "∞" : itemTargetCount}`;
  if (decrementBtn) decrementBtn.disabled = currentCount <= 0;

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
  renderToast(
    `success-toast ${isError ? "error" : ""}`,
    `<i class="fas fa-${isError ? "exclamation-circle" : "check-circle"}"></i><span>${message}</span>`,
    { duration: 2000, removeDelay: 200 },
  );
}

module.exports = { initAthkarPage };
