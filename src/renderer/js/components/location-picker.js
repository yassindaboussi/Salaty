"use strict";

const TomSelect = require("tom-select").default;
const { ipcRenderer } = require("electron");
const { fetchCountries, fetchCities } = require("../services/api/countries");
const { t } = require("../core/i18n");

// Country + city pickers of the settings page. Returns { reloadIfEmpty } so the page can fill
// in a list that failed to load while offline once the connection comes back.
async function initSelectLocation(onChange) {
  /** @type {{ country: string, city: string } | null} */
  let detectedLocationTarget = null;
  let savedSettings = {};
  try {
    savedSettings = (await ipcRenderer.invoke("get-settings")) || {};
  } catch (error) {
    console.error("Error loading saved settings for location selector:", error);
  }

  const commonConfig = {
    valueField: "name",
    labelField: "name",
    searchField: ["name"],
    maxOptions: 500,
  };

  let countriesData = [];
  try {
    countriesData = await fetchCountries();
  } catch (e) {
    console.error("Error fetching countries list:", e);
  }

  const countrySelect = new TomSelect("#countryInput", {
    ...commonConfig,
    placeholder: t("selectCountry"),
    options: countriesData,
  });

  const initialCountry = savedSettings.country || "Tunisia";
  countrySelect.setValue(initialCountry, true);

  const citySelect = new TomSelect("#cityInput", {
    ...commonConfig,
    placeholder: t("selectCity"),
  });
  citySelect.disable();

  const defaultCityFor = (country) => {
    if (savedSettings.country && country === savedSettings.country)
      return savedSettings.city;
    return country === "Tunisia" ? "Tunis" : null;
  };

  let citiesRequestId = 0;
  /** @param {string | null} [defaultCity] */
  async function loadCities(countryName, defaultCity = null, notify = false) {
    const myRequestId = ++citiesRequestId;
    citySelect.clear();
    citySelect.clearOptions();
    citySelect.disable();

    try {
      const cities = await fetchCities(countryName);

      if (myRequestId !== citiesRequestId) return;

      if (cities.length) {
        citySelect.addOptions(cities.map((city) => ({ name: city })));
        citySelect.enable();
        if (defaultCity) {
          citySelect.setValue(defaultCity, true);
          if (notify) onChange?.({ country: countryName, city: defaultCity });
        }
      }
    } catch (e) {
      console.error("City load error:", e);
    }
  }

  countrySelect.on("change", (value) => {
    if (!value) return;

    /** @type {string | null} */
    let defaultCity;
    if (detectedLocationTarget && detectedLocationTarget.country === value) {
      defaultCity = detectedLocationTarget.city;
      detectedLocationTarget = null;
    } else {
      defaultCity = defaultCityFor(value);
    }
    loadCities(value, defaultCity, true);
  });

  const initialCity =
    savedSettings.city || (initialCountry === "Tunisia" ? "Tunis" : null);
  loadCities(initialCountry, initialCity);

  citySelect.on("change", (value) => {
    if (!value) return;
    const country = countrySelect.getValue();
    if (!country) return;
    onChange?.({ country, city: value });
  });

  const detectBtn = document.getElementById("detectLocationBtn");
  if (detectBtn instanceof HTMLButtonElement) {
    detectBtn.addEventListener("click", async () => {
      detectBtn.disabled = true;
      detectBtn.classList.add("loading");
      try {
        // main process, over HTTPS (services/location-detect.js)
        const data = await ipcRenderer.invoke("detect-location");
        if (data?.country) {
          detectedLocationTarget = { country: data.country, city: data.city };
          countrySelect.setValue(data.country);
        }
      } catch (error) {
        console.error("Location detection error:", error);
      } finally {
        detectBtn.disabled = false;
        detectBtn.classList.remove("loading");
      }
    });
  }

  async function reloadIfEmpty() {
    if (!Object.keys(countrySelect.options).length) {
      try {
        countrySelect.addOptions(await fetchCountries());
      } catch (e) {
        console.error("Error fetching countries list:", e);
        return;
      }
      countrySelect.setValue(initialCountry, true);
    }
    const country = countrySelect.getValue();
    if (country && !Object.keys(citySelect.options).length) {
      loadCities(
        country,
        country === initialCountry ? initialCity : defaultCityFor(country),
      );
    }
  }

  return { reloadIfEmpty };
}

module.exports = { initSelectLocation };
