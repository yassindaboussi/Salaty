"use strict";

// Typed element lookups, for elements a page cannot work without:
//   byId("prevBtn", HTMLButtonElement)  query(".track-title", HTMLElement, card)
//   queryAll(".surah-card", HTMLElement, grid)
// When the element is missing, or is another kind than the one named, they throw an error that
// says which, instead of a vague "Cannot read properties of null" further on; and the type
// checker knows the exact element type (an <input> has .value, a <button> has .disabled...).
// For an element that may legitimately be absent, use document.getElementById() / the
// querySelector() methods and check the result for null.

/**
 * @template {Element} T
 * @param {Element | null} el
 * @param {new (...args: any[]) => T} type
 * @param {string} what for the error message
 * @returns {T}
 */
function checked(el, type, what) {
  if (!el) throw new Error(`${what} not found`);
  if (!(el instanceof type)) {
    throw new Error(`${what} is a <${el.localName}>, not a ${type.name}`);
  }
  return el;
}

/**
 * The element with this id.
 * @template {Element} T
 * @param {string} id
 * @param {new (...args: any[]) => T} type the kind of element expected, e.g. HTMLInputElement
 * @returns {T}
 */
function byId(id, type) {
  return checked(document.getElementById(id), type, `#${id}`);
}

/**
 * The first element matching a CSS selector, in `root` (the whole page if left out).
 * @template {Element} T
 * @param {string} selector
 * @param {new (...args: any[]) => T} type the kind of element expected, e.g. HTMLElement
 * @param {ParentNode} [root]
 * @returns {T}
 */
function query(selector, type, root = document) {
  return checked(root.querySelector(selector), type, `"${selector}"`);
}

/**
 * Every element matching a CSS selector, in `root` (the whole page if left out), as an array.
 * @template {Element} T
 * @param {string} selector
 * @param {new (...args: any[]) => T} type the kind of element expected, e.g. HTMLElement
 * @param {ParentNode} [root]
 * @returns {T[]}
 */
function queryAll(selector, type, root = document) {
  return Array.from(root.querySelectorAll(selector), (el) =>
    checked(el, type, `"${selector}"`),
  );
}

module.exports = { byId, query, queryAll };
