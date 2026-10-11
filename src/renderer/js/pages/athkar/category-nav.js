"use strict";

// The category list in the sidebar: grouped (groups fold), filtered by the search box; clicking a
// category shows its adhkar.
const { t } = require("../../core/i18n");
const analytics = require("../../services/analytics");
const { asButton, html, setHtml } = require("../../utils/html");
const { queryAll } = require("../../core/dom");
const { state } = require("./state");
const {
  CATEGORY_GROUPS,
  categoryLabel,
  categoryMatches,
} = require("./categories");
const {
  wideScreen,
  syncRailTooltips,
  setSidebarCollapsed,
} = require("./sidebar");
const { renderAthkarList } = require("./athkar-list");

const collapsedGroups = new Set();

function populateCategoryNav() {
  const categoryNav = document.getElementById("categoryNav");
  if (!categoryNav || !state.athkarData) return;
  categoryNav.innerHTML = "";

  const allCategories = Object.keys(state.athkarData);
  const grouped = new Set();
  const query = state.searchQuery.trim();

  CATEGORY_GROUPS.forEach((group) => {
    const catsInGroup = group.categories.filter((c) => state.athkarData[c]);
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
    setHtml(
      empty,
      html`<i class="fas fa-magnifying-glass" aria-hidden="true"></i><span>${t("noAthkarFound")}</span>`,
    );
    categoryNav.appendChild(empty);
  }

  syncRailTooltips();
}

function buildGroupSection(labelKey, icon, categories, totalInGroup) {
  const section = document.createElement("div");
  section.className = "category-group";
  const isCollapsed =
    collapsedGroups.has(labelKey) && !state.searchQuery.trim();
  section.classList.toggle("collapsed", isCollapsed);

  const header = document.createElement("button");
  header.className = "category-group-header";
  header.dataset.tipName = t(labelKey);
  setHtml(
    header,
    html`
    <i class="fas ${icon} category-group-icon" aria-hidden="true"></i>
    <span class="category-group-label">${t(labelKey)}</span>
    <span class="category-group-total">${totalInGroup}</span>
    <i class="fas fa-chevron-down category-group-chevron" aria-hidden="true"></i>
  `,
  );
  header.addEventListener("click", (e) => {
    e.stopPropagation();
    // In the icon rail the group label is hidden, so clicking its icon opens the sidebar.
    if (state.sidebarCollapsed && wideScreen.matches) {
      setSidebarCollapsed(false);
      return;
    }
    if (state.searchQuery.trim()) return; // don't allow collapsing an active filter view
    if (collapsedGroups.has(labelKey)) collapsedGroups.delete(labelKey);
    else collapsedGroups.add(labelKey);
    section.classList.toggle("collapsed");
  });

  const list = document.createElement("div");
  list.className = "category-group-list";

  categories.forEach((category) => {
    const count = state.athkarData[category].length;
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
  if (!category || !state.athkarData || !state.athkarData[category]) {
    console.error("Invalid category:", category);
    return;
  }

  state.currentCategory = category;

  queryAll(".category-card", HTMLElement).forEach((card) => {
    if (card.dataset.category === category) {
      card.classList.add("active");
    } else {
      card.classList.remove("active");
    }
  });

  analytics.athkarCategoryView(category);

  renderAthkarList();
}

module.exports = { populateCategoryNav, setActiveCategory };
