"use strict";

// The dhikr cards (pick the dhikr to count) and the panel about the dhikr being counted.
const { t, getLanguage } = require("../../core/i18n");
const { queryAll } = require("../../core/dom");
const { pageState, DEFAULT_DHIKR_LIST, isUnlimited } = require("./state");
const { saveTasbihState } = require("./storage");
const { updateCounterDisplay } = require("./ring");
const { showSuccessToast } = require("./feedback");

function populateDhikrGrid() {
  const grid = document.getElementById("dhikrGrid");
  if (!grid) return;
  const lang = getLanguage();
  grid.innerHTML = "";

  DEFAULT_DHIKR_LIST.forEach((dhikr) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "dhikr-card";
    if (dhikr.id === pageState.currentDhikr.id) card.classList.add("active");
    card.dataset.id = dhikr.id;
    if (dhikr.sourceKey) card.title = t(dhikr.sourceKey);

    const nameSpan = document.createElement("span");
    nameSpan.className = "dhikr-name";
    nameSpan.textContent = dhikr.name;
    card.appendChild(nameSpan);

    if (lang !== "ar") {
      const meaningSpan = document.createElement("span");
      meaningSpan.className = "dhikr-meaning";
      meaningSpan.textContent = t(dhikr.meaningKey);
      card.appendChild(meaningSpan);
    }

    const countSpan = document.createElement("span");
    countSpan.className = "dhikr-count";
    countSpan.textContent = isUnlimited(dhikr.id) ? "∞" : String(dhikr.count);
    card.appendChild(countSpan);

    card.addEventListener("click", () => switchDhikr(dhikr));
    grid.appendChild(card);
  });
}

function switchDhikr(dhikr) {
  if (pageState.currentDhikr.id === dhikr.id) return;
  pageState.tasbihHistory[pageState.currentDhikr.id] =
    pageState.currentDhikr.current;
  pageState.currentDhikr = {
    id: dhikr.id,
    name: dhikr.name,
    count: dhikr.count,
    current: pageState.tasbihHistory[dhikr.id] || 0,
  };

  queryAll(".dhikr-card", HTMLElement).forEach((card) => {
    card.classList.toggle("active", card.dataset.id === dhikr.id);
  });

  updateActiveDhikrPanel();
  updateCounterDisplay();
  saveTasbihState();

  showSuccessToast(t("dhikrSwitched").replace("{name}", dhikr.name));
}

function updateActiveDhikrPanel() {
  const nameEl = document.getElementById("activeDhikrName");
  const meaningEl = document.getElementById("activeDhikrMeaning");
  const sourceEl = document.getElementById("activeDhikrSource");
  const lang = getLanguage();
  const dhikr = DEFAULT_DHIKR_LIST.find(
    (d) => d.id === pageState.currentDhikr.id,
  );
  if (nameEl) nameEl.textContent = pageState.currentDhikr.name;
  if (meaningEl) {
    meaningEl.textContent =
      lang === "ar" ? "" : (dhikr && t(dhikr.meaningKey)) || "";
    meaningEl.classList.toggle("hidden", lang === "ar");
  }
  if (sourceEl) {
    sourceEl.textContent =
      (dhikr && dhikr.sourceKey && t(dhikr.sourceKey)) || "";
  }
}

module.exports = { populateDhikrGrid, updateActiveDhikrPanel };
