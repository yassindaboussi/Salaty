const TomSelect = require("tom-select").default;
const { ipcRenderer } = require("electron");

async function initSelectLocation(onChange) {
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
    searchField: "name",
    maxOptions: 500,
  };

  let countriesData = [];
  try {
    const res = await fetch(
      "https://countriesnow.space/api/v0.1/countries/positions",
    );
    const json = await res.json();
    countriesData = json.data || [];
  } catch (e) {
    console.error("Error fetching countries list:", e);
  }

  const countrySelect = new TomSelect("#countryInput", {
    ...commonConfig,
    placeholder: "Select a country",
    options: countriesData,
  });

  const initialCountry = savedSettings.country || "Tunisia";
  countrySelect.setValue(initialCountry, true);

  const citySelect = new TomSelect("#cityInput", {
    ...commonConfig,
    placeholder: "Select a city",
  });
  citySelect.disable();

  let citiesRequestId = 0;
  async function loadCities(countryName, defaultCity = null, notify = false) {
    const myRequestId = ++citiesRequestId;
    citySelect.clear();
    citySelect.clearOptions();
    citySelect.disable();

    try {
      const res = await fetch(
        "https://countriesnow.space/api/v0.1/countries/cities",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ country: countryName }),
        },
      );
      const json = await res.json();

      if (myRequestId !== citiesRequestId) return;

      if (json.data && json.data.length) {
        citySelect.addOptions(json.data.map((city) => ({ name: city })));
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

    let defaultCity = null;
    if (detectedLocationTarget && detectedLocationTarget.country === value) {
      defaultCity = detectedLocationTarget.city;
      detectedLocationTarget = null;
    } else if (savedSettings.country && value === savedSettings.country) {
      defaultCity = savedSettings.city;
    } else if (value === "Tunisia") {
      defaultCity = "Tunis";
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
  if (detectBtn) {
    detectBtn.addEventListener("click", async () => {
      detectBtn.disabled = true;
      detectBtn.classList.add("loading");
      try {
        const res = await fetch("http://ip-api.com/json");
        const data = await res.json();

        if (data && data.status === "success") {
          detectedLocationTarget = {
            country: data.country,
            city: data.city,
          };
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
}

module.exports = { initSelectLocation };
