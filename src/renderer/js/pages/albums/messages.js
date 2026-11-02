"use strict";

// The messages in place of a list: loading, nothing found, or an error with a retry button
// (index.js handles data-retry).
const { t } = require("../../core/i18n");
const { html } = require("../../utils/html");

const ICONS = {
  loading: "fa-spinner fa-spin",
  empty: "fa-magnifying-glass",
  error: "fa-circle-exclamation",
};

/**
 * @param {"loading" | "empty" | "error"} kind
 * @param {string} text
 * @param {string} [retry]  what to load again ("reciters", "tafsir", "tadabor")
 */
function messageHtml(kind, text, retry) {
  return html`<div class="ac-message" ${kind === "error" ? html`role="alert"` : ""}><i class="fas ${ICONS[kind]}" aria-hidden="true"></i><p>${text}</p>${retry ? html`<button type="button" class="ac-retry" data-retry="${retry}">${t("retry")}</button>` : ""}</div>`;
}

module.exports = { messageHtml };
