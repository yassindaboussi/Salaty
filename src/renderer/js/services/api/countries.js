"use strict";

// Country and city lists for the location pickers (countriesnow.space, no key needed).
const API = "https://countriesnow.space/api/v0.1/countries";

async function fetchCountries() {
  const res = await fetch(`${API}/positions`);
  const json = await res.json();
  return Array.isArray(json?.data) ? json.data : [];
}

async function fetchCities(country) {
  const res = await fetch(`${API}/cities`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ country }),
  });
  const json = await res.json();
  return Array.isArray(json?.data) ? json.data : [];
}

module.exports = { fetchCountries, fetchCities };
