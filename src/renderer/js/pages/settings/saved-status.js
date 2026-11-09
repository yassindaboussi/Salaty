"use strict";

// A quiet "Saved ✓" in the corner after each change: the settings save themselves, this only
// confirms it. It is a status message (role="status"), so screen readers announce it too.
const { t } = require("../../core/i18n");

const SHOW_MS = 1600;
/** @type {ReturnType<typeof setTimeout> | null} */
let timer = null;

function showSaved() {
  const el = document.getElementById("stSaved");
  if (!el) return;
  el.textContent = `✓ ${t("stSaved")}`;
  el.classList.add("is-visible");
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => el.classList.remove("is-visible"), SHOW_MS);
}

module.exports = { showSaved };
