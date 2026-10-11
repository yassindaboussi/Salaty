"use strict";

const ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

// Makes text safe to put inside an HTML template (element content or a quoted attribute).
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

// A clickable element that is not a <button>: reachable with Tab and activated with Enter or
// Space like a button (app/app-shell.js handles the keys).
function asButton(el) {
  el.setAttribute("role", "button");
  el.tabIndex = 0;
  return el;
}

module.exports = { escapeHtml, asButton };
