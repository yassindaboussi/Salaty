"use strict";

const { t, getLanguage } = require("../core/i18n");
const { getAdkar } = require("../services/content");
const analytics = require("../services/analytics");
const { renderToast } = require("../core/toast");
const { initSelectionCopy } = require("../components/selection-copy");
const { refreshTooltips } = require("../core/tooltips");
const { escapeHtml, asButton } = require("../utils/html");

let athkarData = null;
let currentCategory = null;
let athkarState = {};
let searchQuery = "";
const collapsedGroups = new Set();

// Groups categories into meaningful sections for the sidebar, so 50+
// categories stay browsable instead of one long flat list. Each entry maps
// a group label (translation key) to the exact category names it contains
// (these must match the keys in adkar.json). A category not listed here
// automatically falls into "أخرى" (Other) as a safety net.
const CATEGORY_GROUPS = [
  {
    key: "groupMorningEvening",
    icon: "fa-sun",
    categories: ["أذكار الصباح", "أذكار المساء"],
  },
  {
    key: "groupPrayer",
    icon: "fa-mosque",
    categories: [
      "أذكار بعد السلام من الصلاة المفروضة",
      "أذكار الآذان",
      "دعاء صلاة الاستخارة",
      "دعاء الذهاب إلى المسجد",
      "دعاء دخول المسجد",
      "دعاء الخروج من المسجد",
    ],
  },
  {
    key: "groupHomePurity",
    icon: "fa-house",
    categories: [
      "الذكر قبل الوضوء",
      "الذكر بعد الفراغ من الوضوء",
      "الذكر عند الخروج من المنزل",
      "الذكر عند دخول المنزل",
      "دعاء دخول الخلاء",
      "دعاء الخروج من الخلاء",
      "دعاء لبس الثوب",
    ],
  },
  {
    key: "groupSleepWake",
    icon: "fa-moon",
    categories: ["أذكار النوم", "أذكار الاستيقاظ"],
  },
  {
    key: "groupTasbihIstighfar",
    icon: "fa-hand-holding-heart",
    categories: [
      "تسابيح",
      "فضل الاستغفار",
      "ما يقال في المجلس",
      "كفارة المجلس",
    ],
  },
  {
    key: "groupFoodFasting",
    icon: "fa-utensils",
    categories: [
      "الدعاء قبل الطعام",
      "الدعاء عند الفراغ من الطعام",
      "دعاء الضيف لصاحب الطعام",
      "الدعاء عند إفطار الصائم",
    ],
  },
  {
    key: "groupTravel",
    icon: "fa-plane",
    categories: [
      "دعاء الركوب",
      "دعاء السفر",
      "دعاء دخول القرية أو البلدة",
      "دعاء دخول السوق",
      "دعاء المسافر للمقيم والمقيم للمسافر",
      "ذكر الرجوع من السفر",
    ],
  },
  {
    key: "groupNature",
    icon: "fa-cloud-showers-heavy",
    categories: [
      "دعاء الريح",
      "دعاء الرعد",
      "الدعاء إذا نزل المطر",
      "الذكر بعد نزول المطر",
      "دعاء رؤية الهلال",
    ],
  },
  {
    key: "groupSocial",
    icon: "fa-people-arrows",
    categories: [
      "إفشاء السلام",
      "الدعاء لمن قال بارك الله فيك",
      "تهنئة المولود له وجوابه",
      "الدعاء للمتزوج",
      "دعاء العطاس",
      "دعاء التعجب والأمر السار",
      "من آداب الذكر الجامعة",
    ],
  },
  {
    key: "groupDistress",
    icon: "fa-shield-heart",
    categories: [
      "دعاء الهم والحزن",
      "دعاء الكرب",
      "دعاء لقاء العدو وذي السلطان",
      "ما يقول من خاف قوماً",
      "دعاء قضاء الدين",
      "دعاء الغضب",
      "دعاء من رأى مبتلى",
      "ما يقال عند الفزع",
      "ما يقول من أحسّ وجعاً في جسده",
    ],
  },
  {
    key: "groupSicknessDeath",
    icon: "fa-hand-holding-medical",
    categories: [
      "الدعاء للمريض في عيادته",
      "دعاء من أصيب بمصيبة",
      "دعاء زيارة القبور",
    ],
  },
  {
    key: "groupQuranProphets",
    icon: "fa-book-quran",
    categories: ["أدعية قرآنية", "أدعية الأنبياء"],
  },
];

// Category names in adkar.json are Arabic and double as lookup keys, so they stay
// untouched; only what the user sees is translated through these locale keys.
const CATEGORY_KEYS = {
  "أذكار الصباح": "cat_morning",
  "أذكار المساء": "cat_evening",
  "أذكار بعد السلام من الصلاة المفروضة": "cat_afterPrayer",
  تسابيح: "cat_tasbih",
  "أذكار النوم": "cat_sleep",
  "أذكار الاستيقاظ": "cat_wake",
  "أدعية قرآنية": "cat_quranDuas",
  "أدعية الأنبياء": "cat_prophetsDuas",
  "دعاء الغضب": "cat_anger",
};

// Falls back to the raw Arabic name for a category without a translation key.
function categoryLabel(name) {
  const key = CATEGORY_KEYS[name];
  const label = key ? t(key) : null;
  return label && label !== key ? label : name;
}

function categoryMatches(name, query) {
  const q = query.toLowerCase();
  return name.includes(query) || categoryLabel(name).toLowerCase().includes(q);
}

// The dua text and its reference stay Arabic; the explanatory note follows the app language.
function descriptionFor(item) {
  const lang = getLanguage();
  return (lang !== "ar" && item[`description_${lang}`]) || item.description;
}

// ---- Collapsible category sidebar (icon rail) ----
const SIDEBAR_KEY = "athkarSidebarCollapsed";
const wideScreen = window.matchMedia("(min-width: 769px)");
let sidebarCollapsed = false;

function loadSidebarPref() {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === "1";
  } catch {
    return false;
  }
}

function saveSidebarPref(collapsed) {
  try {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
  } catch {
    /* storage unavailable: the choice just won't be remembered */
  }
}

// In the rail the names are hidden, so give every chip/icon a hover tooltip with its name.
// In the expanded view the names are visible, so the tooltip is removed to avoid noise.
function syncRailTooltips() {
  const rail = sidebarCollapsed && wideScreen.matches;
  document.querySelectorAll("#categoryNav [data-tip-name]").forEach((el) => {
    if (rail) el.setAttribute("data-tooltip", el.dataset.tipName);
    else {
      el.removeAttribute("data-tooltip");
      el.removeAttribute("data-tip");
    }
  });
  if (rail) refreshTooltips();
}

function applySidebarState() {
  const body = document.querySelector(".athkar-body");
  const btn = document.getElementById("sidebarToggleBtn");
  if (!body) return;
  // The narrow-window layout already turns the sidebar into a horizontal strip.
  body.classList.toggle(
    "sidebar-collapsed",
    sidebarCollapsed && wideScreen.matches,
  );
  if (btn) {
    const key = sidebarCollapsed
      ? "tooltipExpandSidebar"
      : "tooltipCollapseSidebar";
    btn.classList.toggle("is-collapsed", sidebarCollapsed);
    btn.setAttribute("data-tooltip", key);
    btn.setAttribute("aria-label", t(key));
    btn.setAttribute("aria-pressed", String(sidebarCollapsed));
    btn.style.display = wideScreen.matches ? "" : "none";
    refreshTooltips();
  }
  syncRailTooltips();
}

function setSidebarCollapsed(collapsed) {
  sidebarCollapsed = collapsed;
  saveSidebarPref(collapsed);
  applySidebarState();
}

// Reference line (book name, hadith number, short note) follows the app language too.
function referenceFor(item) {
  const lang = getLanguage();
  return (lang !== "ar" && item[`reference_${lang}`]) || item.reference;
}

// The adhkar are bundled (data/adkar.json), so nothing needs reloading when the connection returns.
function initAthkarPage() {
  const resetAllBtn = document.getElementById("resetAllBtn");
  if (resetAllBtn) {
    resetAllBtn.addEventListener("click", showResetConfirm);
  }

  const searchInput = document.getElementById("athkarSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value || "";
      populateCategoryNav();
      // Keep the active card highlighted in the sidebar if it's still visible
      document.querySelectorAll(".category-card").forEach((card) => {
        card.classList.toggle(
          "active",
          card.dataset.category === currentCategory,
        );
      });
    });
  }

  sidebarCollapsed = loadSidebarPref();
  const sidebarToggleBtn = document.getElementById("sidebarToggleBtn");
  // initAthkarPage can run again after a connection recovery; bind only once so
  // a second listener doesn't toggle the sidebar twice per click.
  if (sidebarToggleBtn && !sidebarToggleBtn.dataset.bound) {
    sidebarToggleBtn.dataset.bound = "1";
    sidebarToggleBtn.addEventListener("click", () =>
      setSidebarCollapsed(!sidebarCollapsed),
    );
    wideScreen.addEventListener("change", applySidebarState);
  }

  initSelectionCopy(document.getElementById("athkarList"), copyAthkar);

  updateAthkarUI();
  applySidebarState();

  loadAthkarData();

  loadAthkarState();
}

function updateAthkarUI() {
  const resetAllBtn = document.getElementById("resetAllBtn");
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

    if (!currentCategory) {
      const firstAvailable = CATEGORY_GROUPS.flatMap((g) => g.categories).find(
        (c) => athkarData[c],
      );
      const fallback = Object.keys(athkarData)[0];
      currentCategory = firstAvailable || fallback;
      if (currentCategory) setActiveCategory(currentCategory);
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
          <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
          <span>${t("athkarError")}</span>
          <button type="button" class="retry-button" id="retryAthkarBtn">
            <i class="fas fa-sync-alt" aria-hidden="true"></i> ${t("retry")}
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

  const allCategories = Object.keys(athkarData);
  const grouped = new Set();
  const query = searchQuery.trim();

  CATEGORY_GROUPS.forEach((group) => {
    const catsInGroup = group.categories.filter((c) => athkarData[c]);
    catsInGroup.forEach((c) => grouped.add(c));
    const matching = query
      ? catsInGroup.filter((c) => categoryMatches(c, query))
      : catsInGroup;
    if (matching.length === 0) return;

    categoryNav.appendChild(
      buildGroupSection(group.key, group.icon, matching, catsInGroup.length),
    );
  });

  // Safety net: any category not placed in a group above still shows up,
  // under a generic "Other" section, so nothing from the data is ever lost.
  const leftover = allCategories.filter((c) => !grouped.has(c));
  if (leftover.length > 0) {
    const matching = query
      ? leftover.filter((c) => categoryMatches(c, query))
      : leftover;
    if (matching.length > 0) {
      categoryNav.appendChild(
        buildGroupSection(
          "groupOther",
          "fa-ellipsis",
          matching,
          leftover.length,
        ),
      );
    }
  }

  if (query && categoryNav.children.length === 0) {
    const empty = document.createElement("div");
    empty.className = "category-nav-empty";
    empty.innerHTML = `<i class="fas fa-magnifying-glass" aria-hidden="true"></i><span>${t("noAthkarFound")}</span>`;
    categoryNav.appendChild(empty);
  }

  syncRailTooltips();
}

function buildGroupSection(labelKey, icon, categories, totalInGroup) {
  const section = document.createElement("div");
  section.className = "category-group";
  const isCollapsed = collapsedGroups.has(labelKey) && !searchQuery.trim();
  section.classList.toggle("collapsed", isCollapsed);

  const header = document.createElement("button");
  header.className = "category-group-header";
  header.dataset.tipName = t(labelKey);
  header.innerHTML = `
    <i class="fas ${icon} category-group-icon" aria-hidden="true"></i>
    <span class="category-group-label">${t(labelKey)}</span>
    <span class="category-group-total">${totalInGroup}</span>
    <i class="fas fa-chevron-down category-group-chevron" aria-hidden="true"></i>
  `;
  header.addEventListener("click", (e) => {
    e.stopPropagation();
    // In the icon rail the group label is hidden, so clicking its icon opens the sidebar.
    if (sidebarCollapsed && wideScreen.matches) {
      setSidebarCollapsed(false);
      return;
    }
    if (searchQuery.trim()) return; // don't allow collapsing an active filter view
    if (collapsedGroups.has(labelKey)) collapsedGroups.delete(labelKey);
    else collapsedGroups.add(labelKey);
    section.classList.toggle("collapsed");
  });

  const list = document.createElement("div");
  list.className = "category-group-list";

  categories.forEach((category) => {
    const count = athkarData[category].length;
    const categoryCard = createCategoryCard(category, category, count);
    list.appendChild(categoryCard);
    categoryCard.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      setActiveCategory(category);
    });
  });

  section.appendChild(header);
  section.appendChild(list);
  return section;
}

function createCategoryCard(categoryId, categoryName, count) {
  const card = asButton(document.createElement("div"));
  card.className = "category-card";
  card.dataset.category = categoryId;
  card.dataset.tipName = categoryLabel(categoryName);
  card.setAttribute("data-test", "category-card");

  const nameSpan = document.createElement("span");
  nameSpan.className = "category-name";
  nameSpan.textContent = categoryLabel(categoryName);

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
        <button type="button" class="athkar-confirm-btn athkar-confirm-cancel">${t("cancel")}</button>
        <button type="button" class="athkar-confirm-btn athkar-confirm-reset">${t("resetAllConfirm")}</button>
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

  const isUnlimited =
    athkarItem.count === null || athkarItem.count === undefined;
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
    `<i class="fas fa-${isError ? "exclamation-circle" : "check-circle"}" aria-hidden="true"></i><span>${message}</span>`,
    { duration: 2000, removeDelay: 200 },
  );
}

module.exports = { initAthkarPage };
