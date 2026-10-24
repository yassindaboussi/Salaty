"use strict";

// Theme, language and window size cards, and the page text that follows a language switch.
const {
  setLanguage,
  t,
  applyTranslations,
  applyLanguageDirection,
} = require("../../core/i18n");
const { state } = require("../../core/store");
const { applyTheme } = require("../../core/theme");
const { refreshTooltips } = require("../../core/tooltips");
const screenSizeManager = require("../../core/screen-size");
const { queryAll } = require("../../core/dom");
const { pageState } = require("./state");
const { persistSettings } = require("./persist");
const { updateHijriText } = require("./hijri");

function updateAllText() {
  applyTranslations(); // every [data-i18n] text on the page (they follow the language switch)
  updateHijriText(); // weekday names and today's Hijri date

  const aboutStatusEl = document.getElementById("aboutStatusText");
  const aboutIconEl = document.getElementById("aboutStatusIcon");
  if (aboutStatusEl && aboutIconEl) {
    const isIdle =
      aboutIconEl.classList.contains("fa-circle-check") &&
      !aboutIconEl.classList.contains("checking") &&
      !aboutIconEl.classList.contains("available") &&
      !aboutIconEl.classList.contains("error");
    if (isIdle) aboutStatusEl.textContent = t("upToDate");
  }

  refreshTooltips();
}

function initThemeSelection() {
  const themeContainer = document.getElementById("themeOptions");
  if (!themeContainer) return;

  const themeCards = queryAll(".theme-card", HTMLElement, themeContainer);

  themeCards.forEach((card) => {
    const theme = /** @type {string} */ (card.dataset.theme); // every .theme-card has one

    if (theme === pageState.pendingTheme) {
      card.classList.add("selected");
    } else {
      card.classList.remove("selected");
    }

    card.addEventListener("click", () => {
      pageState.pendingTheme = theme;
      state.settings.theme = theme;
      state.settings.themeChosen = true; // the seasonal Ramadan theme then leaves it alone

      themeCards.forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");

      applyTheme(pageState.pendingTheme);

      persistSettings();
    });
  });
}

function initLanguageSelection() {
  const languageContainer = document.getElementById("languageOptions");
  if (!languageContainer) return;

  const languageCards = queryAll(
    ".language-card",
    HTMLElement,
    languageContainer,
  );

  languageCards.forEach((card) => {
    if (card.dataset.lang === state.settings.language) {
      card.classList.add("selected");
    } else {
      card.classList.remove("selected");
    }

    card.addEventListener("click", () => {
      const newLang = /** @type {string} */ (card.dataset.lang); // every .language-card has one
      state.settings.language = newLang;
      setLanguage(newLang);

      languageCards.forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");

      applyLanguageDirection();
      updateAllText();

      persistSettings();
    });
  });
}

function initScreenSizeSetting() {
  const sizeContainer = document.getElementById("screenSizeOptions");
  if (!sizeContainer) return;

  const sizeCards = queryAll(".size-card", HTMLElement, sizeContainer);

  const showSelected = () => {
    const current = state.settings.bigScreen ? "big" : "fullscreen";
    sizeCards.forEach((c) =>
      c.classList.toggle("selected", c.dataset.size === current),
    );
  };
  showSelected();
  // also when the window is maximized/restored another way (title-bar double-click, Snap…)
  screenSizeManager.onChange(showSelected);

  sizeCards.forEach((card) => {
    card.addEventListener("click", async () => {
      const newSize = card.dataset.size;
      state.settings.bigScreen = newSize === "big";

      sizeCards.forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");

      await persistSettings();
      await screenSizeManager.applyScreenSize();
    });
  });
}

module.exports = {
  updateAllText,
  initThemeSelection,
  initLanguageSelection,
  initScreenSizeSetting,
};
