const TomSelect = require("tom-select").default;
const { ipcRenderer } = require("electron");

async function initSelectLocation() {
  let detectedLocationTarget = null;
  let savedSettings = {};
  try {
    savedSettings = (await ipcRenderer.invoke("get-settings")) || {};
  } catch (error) {}

  const commonConfig = {
    valueField: "name",
    labelField: "name",
    searchField: "name",
    maxOptions: 500,
  };

  // ── Country Select ──────────────────────────────────────────────────────────
  // We pre-fetch countries BEFORE creating TomSelect so the load callback
  // never fires again while the user is typing (which was causing the reset).
  let countriesData = [];
  try {
    const res = await fetch(
      "https://countriesnow.space/api/v0.1/countries/positions",
    );
    const json = await res.json();
    countriesData = json.data || [];
  } catch (e) {}

  const countrySelect = new TomSelect("#countryInput", {
    ...commonConfig,
    placeholder: "Select a country",
    // No `load` callback — options are supplied directly via `options`
    options: countriesData,
  });

  // Set initial country value ONCE after creation, not inside a load callback
  const initialCountry = savedSettings.country || "Tunisia";
  countrySelect.setValue(initialCountry, true); // true = silent (no change event)

  // ── City Select ─────────────────────────────────────────────────────────────
  const citySelect = new TomSelect("#cityInput", {
    ...commonConfig,
    placeholder: "Select a city",
  });
  citySelect.disable();

  // Load cities for a given country, then optionally select a default city
  async function loadCities(countryName, defaultCity = null) {
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

      if (json.data && json.data.length) {
        citySelect.addOptions(json.data.map((city) => ({ name: city })));
        citySelect.enable();
        if (defaultCity) {
          citySelect.setValue(defaultCity, true); // silent — don't fire city change
        }
      }
    } catch (e) {
      console.error("City load error:", e);
    }
  }

  // ── Country change handler ──────────────────────────────────────────────────
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
    loadCities(value, defaultCity);
  });

  // Load cities for the initial country (triggered manually since setValue was silent)
  const initialCity =
    savedSettings.city || (initialCountry === "Tunisia" ? "Tunis" : null);
  loadCities(initialCountry, initialCity);

  // ── Auto Detect Button ──────────────────────────────────────────────────────
  const detectBtn = document.getElementById("detectLocationBtn");
  if (detectBtn) {
    detectBtn.addEventListener("click", async () => {
      detectBtn.classList.add("loading");
      try {
        const res = await fetch("http://ip-api.com/json");
        const data = await res.json();

        if (data && data.status === "success") {
          detectedLocationTarget = {
            country: data.country,
            city: data.city,
          };
          countrySelect.setValue(data.country); // this WILL fire change → loadCities
        }
      } catch (error) {
        console.error("Location detection error:", error);
      } finally {
        detectBtn.classList.remove("loading");
      }
    });
  }
}

module.exports = { initSelectLocation };
