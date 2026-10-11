"use strict";

// What the Athkar page shows right now (shared by its modules) and the saved recitation counts.
const state = {
  // adkar.json ({ category name: adhkar[] }), null until loaded
  /** @type {any} */
  athkarData: null,
  /** @type {string | null} */
  currentCategory: null,
  athkarState: {},
  searchQuery: "",
  sidebarCollapsed: false,
};

function loadAthkarState() {
  try {
    const savedState = localStorage.getItem("athkarState");
    if (savedState) {
      state.athkarState = JSON.parse(savedState);
    }
  } catch (error) {
    console.error("Error loading athkar state:", error);
    state.athkarState = {};
  }
}

function saveAthkarState() {
  try {
    localStorage.setItem("athkarState", JSON.stringify(state.athkarState));
  } catch (error) {
    console.error("Error saving athkar state:", error);
  }
}

module.exports = { state, loadAthkarState, saveAthkarState };
