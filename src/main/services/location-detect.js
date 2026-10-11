"use strict";

// City/country guessed from the IP address. Used by "Auto Detect Location" (settings page and
// the location switcher, through the "detect-location" IPC).
// freeipapi.com: HTTPS, no API key, no sign-up (https://freeipapi.com).
const { fetchJson } = require("./http");

const ENDPOINT = "https://free.freeipapi.com/api/json";
const TIMEOUT_MS = 8000;

async function detectLocation() {
  const d = await fetchJson(ENDPOINT, { timeoutMs: TIMEOUT_MS });
  const city = typeof d?.cityName === "string" ? d.cityName.trim() : "";
  const country =
    typeof d?.countryName === "string" ? d.countryName.trim() : "";
  if (!city || !country) throw new Error("Detection failed");
  return { city, country };
}

module.exports = { detectLocation };
