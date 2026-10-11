"use strict";

// HTTP for the main process, through Electron's net module (Chromium's network stack): the
// Windows proxy settings and certificate store apply, as in the pages, which Node's own fetch
// ignores (company networks, antivirus HTTPS scanning). Every request has a timeout.
// https://www.electronjs.org/docs/latest/api/net
const { net } = require("electron");

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * GET a JSON API. The answer comes from outside the app: callers check its shape.
 * @param {string} url
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<any>}
 */
async function fetchJson(url, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const res = await net.fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store", // these are API answers: always ask the server
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * True when the server answers at all (any status below 500).
 * @param {string} url
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<boolean>}
 */
async function isReachable(url, { timeoutMs = 5_000 } = {}) {
  try {
    const res = await net.fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    return res.status < 500;
  } catch {
    return false;
  }
}

/**
 * POST a JSON body to an API. Network failures (offline, timeout) throw; any HTTP answer,
 * error or not, is returned for the caller to read.
 * @param {string} url
 * @param {unknown} body
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<{ status: number, json: any }>}
 */
async function postJson(url, body, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const res = await net.fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  /** @type {any} */
  let json = null;
  try {
    json = await res.json();
  } catch {
    // not JSON (a proxy's error page...): the status says enough
  }
  return { status: res.status, json };
}

module.exports = { fetchJson, isReachable, postJson };
