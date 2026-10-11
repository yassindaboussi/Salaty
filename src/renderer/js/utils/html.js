"use strict";

// Safe HTML. Pages build markup with the html`...` tag, which escapes every ${value}, and put it
// on the page with setHtml / insertHtml, the only code that writes HTML. Text from the network,
// the user or a translation can then never become markup by mistake. `npm run lint` enforces
// it (eslint-plugin-no-unsanitized): innerHTML, outerHTML and insertAdjacentHTML are allowed
// nowhere else.

const ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

// Makes text safe to put inside HTML (element content or a quoted attribute).
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/**
 * The type of an html`...` fragment, for other files' JSDoc:
 * @typedef {SafeHtml} HtmlFragment
 */

/** Markup made by html`...`: safe to put on the page as it is. */
class SafeHtml {
  /** @param {string} value */
  constructor(value) {
    this.value = value;
  }

  toString() {
    return this.value;
  }
}

// html`` fragments go in as they are, lists of them are joined, null/undefined/false add
// nothing (for `${cond && html`...`}`), anything else is escaped text.
/** @param {unknown} value @returns {string} */
function piece(value) {
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(piece).join("");
  if (value === null || value === undefined || value === false) return "";
  return escapeHtml(value);
}

/**
 * Tag for HTML templates: html`<p class="name">${name}</p>`.
 * @param {TemplateStringsArray} strings
 * @param {...unknown} values
 * @returns {SafeHtml}
 */
function html(strings, ...values) {
  let out = strings[0];
  values.forEach((value, i) => {
    out += piece(value) + strings[i + 1];
  });
  return new SafeHtml(out);
}

/** @param {unknown} fragment @returns {string} */
function unwrap(fragment) {
  if (!(fragment instanceof SafeHtml)) {
    throw new TypeError("HTML must be built with html`...` (utils/html.js)");
  }
  return fragment.value;
}

/**
 * Replaces the element's content with the fragment.
 * @param {Element} el
 * @param {SafeHtml} fragment
 */
function setHtml(el, fragment) {
  // eslint-disable-next-line no-unsanitized/property -- the one place HTML is written: unwrap() accepts only html`` fragments
  el.innerHTML = unwrap(fragment);
}

/**
 * Inserts the fragment next to or inside the element (like insertAdjacentHTML).
 * @param {Element} el
 * @param {InsertPosition} position
 * @param {SafeHtml} fragment
 */
function insertHtml(el, position, fragment) {
  // eslint-disable-next-line no-unsanitized/method -- the one place HTML is inserted: unwrap() accepts only html`` fragments
  el.insertAdjacentHTML(position, unwrap(fragment));
}

// A clickable element that is not a <button>: reachable with Tab and activated with Enter or
// Space like a button (app/app-shell.js handles the keys).
function asButton(el) {
  el.setAttribute("role", "button");
  el.tabIndex = 0;
  return el;
}

module.exports = { escapeHtml, html, setHtml, insertHtml, SafeHtml, asButton };
