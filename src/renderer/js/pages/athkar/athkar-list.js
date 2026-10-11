"use strict";

// The chosen category's adhkar, one card each: the text, its note, the counter and the reference.
const { t, getLanguage } = require("../../core/i18n");
const { escapeHtml } = require("../../utils/html");
const { state } = require("./state");
const { categoryLabel } = require("./categories");
const { incrementCount, decrementCount, resetCount } = require("./counter");
const { copyAthkar } = require("./feedback");

// The dua text and its reference stay Arabic; the explanatory note follows the app language.
function descriptionFor(item) {
  const lang = getLanguage();
  return (lang !== "ar" && item[`description_${lang}`]) || item.description;
}

// Reference line (book name, hadith number, short note) follows the app language too.
function referenceFor(item) {
  const lang = getLanguage();
  return (lang !== "ar" && item[`reference_${lang}`]) || item.reference;
}

function renderAthkarList() {
  const athkarList = document.getElementById("athkarList");
  if (!athkarList || !state.athkarData || !state.currentCategory) {
    console.error("Cannot render: missing data or category");
    return;
  }
  athkarList.innerHTML = "";

  const athkarItems = state.athkarData[state.currentCategory] || [];
  if (athkarItems.length === 0) {
    athkarList.innerHTML = `
      <div class="athkar-empty">
        <i class="fas fa-book-open" aria-hidden="true"></i>
        <span>${t("noAthkarInCategory")}</span>
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

  const athkarId = `${state.currentCategory}-${index}`;
  card.id = `athkar-${athkarId}`;

  const currentCount = state.athkarState[athkarId] || 0;
  const isUnlimited = item.count === null || item.count === undefined;
  const targetCount = isUnlimited ? null : parseInt(item.count) || 1;
  const progress =
    targetCount === null
      ? 0
      : Math.min((currentCount / targetCount) * 100, 100);
  const isCompleted = targetCount !== null && currentCount >= targetCount;

  if (isCompleted) {
    card.classList.add("completed");
  }

  card.innerHTML = `
    <div class="athkar-card-header">
      <div class="athkar-category">
        <i class="fas fa-hashtag" aria-hidden="true"></i>
        ${categoryLabel(item.category)}
      </div>
      <div class="athkar-actions">
        <button type="button" class="athkar-action-btn copy-btn" data-id="${athkarId}" title="${t("copy")}">
          <i class="fas fa-copy" aria-hidden="true"></i>
        </button>
      </div>
    </div>
    
    <div class="athkar-content-text">${item.content}</div>
    
    ${
      item.description
        ? `
      <div class="athkar-description">
        ${descriptionFor(item)}
      </div>
    `
        : ""
    }
    
    <div class="athkar-count-controls">
      <div class="count-info">
        <div class="count-label">${t("recitations")}</div>
        <div class="count-display">
          <div class="count-value">${escapeHtml(currentCount)}</div>
          <div class="count-target">/${isUnlimited ? "∞" : targetCount}</div>
        </div>
      </div>
      
      <div class="count-progress ${isUnlimited ? "athkar-count-hidden" : ""}">
        <div class="progress-bar" style="width: ${progress}%"></div>
      </div>
      
      <div class="count-buttons">
        <button type="button" class="count-btn increment-btn" data-id="${athkarId}" ${isCompleted ? "disabled" : ""}>
          +
        </button>
        <button type="button" class="count-btn decrement-btn" data-id="${athkarId}" ${currentCount <= 0 ? "disabled" : ""}>
          −
        </button>
        <button type="button" class="count-btn reset-btn" data-id="${athkarId}">
          <i class="fas fa-redo" aria-hidden="true"></i>
        </button>
      </div>
    </div>
    
    ${
      item.reference
        ? `
      <div class="athkar-reference">
        ${item.grade ? `<span class="athkar-grade athkar-grade-${item.grade}">${t(`grade_${item.grade}`)}</span>` : ""}
        <bdi>${referenceFor(item)}</bdi>
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

module.exports = { renderAthkarList };
