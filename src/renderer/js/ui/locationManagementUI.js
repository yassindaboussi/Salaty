// src/renderer/js/locationManagementUI.js
const TomSelect = require("tom-select").default;
const { t } = require("../core/i18n/translations");
const { showToast } = require("../core/toast");
const locationManager = require("../services/locationManager");
const analytics = require("../utils/analytics");

let currentEditingLocationId = null;
let locationCountrySelect = null;
let locationCitySelect = null;

// Holds the original values of the location being edited so we can
// pass them as `prev` to analytics.locationAction('edited', ...).
let _originalLocation = null;

/**
 * Initialize location management UI
 */
function initLocationManagementUI() {
  const manageLocationsBtn = document.getElementById("manageLocationsBtn");
  const closeModalBtn = document.getElementById("closeLocationModal");
  const addLocationBtn = document.getElementById("addLocationBtn");
  const closeAddEditBtn = document.getElementById("closeAddEditModal");
  const cancelAddEditBtn = document.getElementById("cancelAddEditBtn");
  const saveLocationBtn = document.getElementById("saveLocationBtn");
  const modal = document.getElementById("locationManagerModal");
  const addEditModal = document.getElementById("addEditLocationModal");

  // Update titles based on language
  updateLocationModalTitles();

  if (!modal || !addEditModal) {
    return;
  }

  // IMPORTANT: Ensure modals are closed on initialization
  modal.classList.remove("active");
  addEditModal.classList.remove("active");

  // Open location manager modal
  if (manageLocationsBtn) {
    manageLocationsBtn.addEventListener("click", async () => {
      // Ensure add/edit modal is closed before opening manager
      addEditModal.classList.remove("active");
      resetAddEditForm();

      modal.classList.add("active");
      await loadLocationsList();
    });
  }

  // Close modals
  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", () => {
      modal.classList.remove("active");
    });
  }

  if (closeAddEditBtn) {
    closeAddEditBtn.addEventListener("click", () => {
      addEditModal.classList.remove("active");
      resetAddEditForm();
    });
  }

  if (cancelAddEditBtn) {
    cancelAddEditBtn.addEventListener("click", () => {
      addEditModal.classList.remove("active");
      resetAddEditForm();
    });
  }

  // Close modals when clicking outside (on the overlay itself)
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.classList.remove("active");
    }
  });

  addEditModal.addEventListener("click", (e) => {
    if (e.target === addEditModal) {
      addEditModal.classList.remove("active");
      resetAddEditForm();
    }
  });

  // Add new location
  if (addLocationBtn) {
    addLocationBtn.addEventListener("click", async () => {
      currentEditingLocationId = null;
      updateLocationModalTitles();
      addEditModal.classList.add("active");
      await initLocationSelects(); // preload countries so the dropdown is ready to type/search
    });
  }

  // Save location
  if (saveLocationBtn) {
    saveLocationBtn.addEventListener("click", async () => {
      await saveLocation();
    });
  }
}

/**
 * Update location modal titles based on current language
 */
function updateLocationModalTitles() {
  const myLocationsTitle = document.getElementById("myLocationsTitle");
  const addLocationTitle = document.getElementById("addLocationTitle");

  if (myLocationsTitle) {
    myLocationsTitle.textContent = t("myLocations");
  }

  if (addLocationTitle) {
    if (currentEditingLocationId) {
      addLocationTitle.textContent = t("editLocation");
    } else {
      addLocationTitle.textContent = t("addLocation");
    }
  }
}

/**
 * Load and display locations list
 */
async function loadLocationsList() {
  const locationsList = document.getElementById("locationsList");
  if (!locationsList) return;

  const locations = await locationManager.getLocations();

  if (locations.length === 0) {
    locationsList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-map-marker-alt"></i>
        <p>${t("noLocations")}</p>
      </div>
    `;
    return;
  }

  locationsList.innerHTML = locations
    .map(
      (location) => `
    <div class="location-item ${location.isActive ? "active" : ""}" data-location-id="${location.id}" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 12px 14px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; color: var(--text-primary);">
          <span style="font-weight: 600;">${location.name}</span>
          ${location.isActive ? `<span style="background: #FFD700; color: #000; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">ACTIVE</span>` : ""}
          ${location.isFavorite ? '<i class="fas fa-star" style="color: #FFD700;"></i>' : ""}
        </div>
        <div style="font-size: 13px; opacity: 0.7; color: var(--text-secondary);">
          <i class="fas fa-map-marker-alt"></i> ${location.city}, ${location.country}
        </div>
      </div>
      <div style="display: flex; gap: 6px;">
        ${
          !location.isActive
            ? `
          <button class="action-btn activate-btn" data-action="activate" data-id="${location.id}" title="Activate" style="background: transparent; border: none; cursor: pointer; font-size: 16px; opacity: 0.6; transition: opacity 0.2s; color: var(--accent-color);">
            <i class="fas fa-check-circle"></i>
          </button>
        `
            : ""
        }
        <button class="action-btn edit-btn" data-action="edit" data-id="${location.id}" title="Edit" style="background: transparent; border: none; cursor: pointer; font-size: 16px; opacity: 0.6; transition: opacity 0.2s; color: var(--accent-color);">
          <i class="fas fa-edit"></i>
        </button>
        ${
          locations.length > 1
            ? `
          <button class="action-btn delete-btn" data-action="delete" data-id="${location.id}" title="Delete" style="background: transparent; border: none; cursor: pointer; font-size: 16px; opacity: 0.6; transition: opacity 0.2s; color: #ff6b6b;">
            <i class="fas fa-trash"></i>
          </button>
        `
            : ""
        }
      </div>
    </div>
  `,
    )
    .join("");

  // Add event listeners
  locationsList.querySelectorAll(".action-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const locationId = btn.dataset.id;

      if (action === "activate") {
        const loc = locations.find((l) => l.id === locationId);
        await locationManager.setActiveLocation(locationId);
        analytics.locationAction("activated", loc);
        await loadLocationsList();
      } else if (action === "edit") {
        await editLocation(locationId);
      } else if (action === "delete") {
        if (confirm(t("confirmDeleteLocation"))) {
          const loc = locations.find((l) => l.id === locationId);
          await locationManager.deleteLocation(locationId);
          analytics.locationAction("deleted", loc);
          await loadLocationsList();
        }
      }
    });
  });
}

/**
 * Initialize location select dropdowns in add/edit modal
 */
// Fetches the cities for a given country and populates locationCitySelect.
// Returns a Promise so callers can await it before setting the city value.
async function _loadCitiesForCountry(country) {
  locationCitySelect.clear();
  locationCitySelect.clearOptions();
  locationCitySelect.disable();

  if (!country) return;

  try {
    const res = await fetch(
      "https://countriesnow.space/api/v0.1/countries/cities",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country }),
      },
    );
    const json = await res.json();
    if (json.data) {
      locationCitySelect.addOptions(json.data.map((city) => ({ name: city })));
      locationCitySelect.enable();
    }
  } catch (e) {
    console.error("[LocationUI] Error loading cities:", e);
  }
}

// Initialises the two TomSelect widgets and preloads the countries list.
// Returns a Promise that resolves with the loaded country options so callers
// can await country data before calling setValue().
function initLocationSelects() {
  const commonConfig = {
    valueField: "name",
    labelField: "name",
    searchField: "name",
    maxOptions: 500,
  };

  // Destroy existing instances
  if (locationCountrySelect) locationCountrySelect.destroy();
  if (locationCitySelect) locationCitySelect.destroy();

  // City select — starts disabled until a country is chosen
  locationCitySelect = new TomSelect("#locationCityInput", {
    ...commonConfig,
    placeholder: t("selectCity"),
  });
  locationCitySelect.disable();

  // Country select — we load options ourselves (not via TomSelect's load
  // callback) so we can return a Promise and await it in editLocation().
  locationCountrySelect = new TomSelect("#locationCountryInput", {
    ...commonConfig,
    placeholder: t("selectCountry"),
  });

  // When the user picks a country manually, load cities reactively
  locationCountrySelect.on("change", async (value) => {
    await _loadCitiesForCountry(value);
  });

  // Preload countries and return a promise so editLocation() can wait
  return fetch("https://countriesnow.space/api/v0.1/countries/positions")
    .then((r) => r.json())
    .then((json) => {
      if (json.data) {
        locationCountrySelect.addOptions(json.data);
      }
      return json.data || [];
    })
    .catch((e) => {
      console.error("[LocationUI] Error loading countries:", e);
      return [];
    });
}

/**
 * Edit existing location.
 * Snapshots the current values into _originalLocation so saveLocation()
 * can attach them as `prev` in the analytics event.
 */
async function editLocation(locationId) {
  const locations = await locationManager.getLocations();
  const location = locations.find((loc) => loc.id === locationId);

  if (!location) return;

  currentEditingLocationId = locationId;

  // Snapshot the original values for the analytics diff on save
  _originalLocation = {
    name: location.name,
    city: location.city,
    country: location.country,
    isFavorite: location.isFavorite,
  };

  const nameInput = document.getElementById("locationNameInput");
  const favoriteToggle = document.getElementById("locationFavoriteToggle");
  const addEditModal = document.getElementById("addEditLocationModal");

  nameInput.value = location.name;
  favoriteToggle.checked = location.isFavorite;

  // Update title to "Edit Location"
  updateLocationModalTitles();

  addEditModal.classList.add("active");

  // FIX: await countries loading before setting the value.
  // The old code used blind setTimeout(300) + setTimeout(500) which races
  // against the API call — if the network is even slightly slow both selects
  // end up empty.  Now we wait for each step to actually finish.
  try {
    await initLocationSelects(); // countries list is ready
    locationCountrySelect.setValue(location.country);
    await _loadCitiesForCountry(location.country); // cities list is ready
    locationCitySelect.setValue(location.city);
  } catch (e) {
    console.error("[LocationUI] editLocation: failed to pre-fill selects:", e);
  }
}

/**
 * Save location (add or update)
 */
async function saveLocation() {
  const nameInput = document.getElementById("locationNameInput");
  const favoriteToggle = document.getElementById("locationFavoriteToggle");

  const name = nameInput.value.trim();
  const country = locationCountrySelect ? locationCountrySelect.getValue() : "";
  const city = locationCitySelect ? locationCitySelect.getValue() : "";
  const isFavorite = favoriteToggle.checked;

  // Validation
  if (!name) {
    showToast(t("enterLocationName"), "error");
    return;
  }

  if (!country || !city) {
    showToast(t("selectCountryAndCity"), "error");
    return;
  }

  const locationData = { name, country, city, isFavorite };
  let success = false;

  if (currentEditingLocationId) {
    const updated = await locationManager.updateLocation(
      currentEditingLocationId,
      locationData,
    );
    success = updated !== null;
    if (success) {
      analytics.locationAction("edited", {
        ...locationData,
        prev: _originalLocation, // what it looked like before the change
      });
    }
  } else {
    const added = await locationManager.addLocation(locationData);
    success = added !== null;
    if (success) {
      analytics.locationAction("added", locationData);
    }
  }

  if (success) {
    document.getElementById("addEditLocationModal").classList.remove("active");
    resetAddEditForm();
    await loadLocationsList();
  }
}

/**
 * Reset add/edit form
 */
function resetAddEditForm() {
  currentEditingLocationId = null;
  _originalLocation = null;
  document.getElementById("locationNameInput").value = "";
  document.getElementById("locationFavoriteToggle").checked = true;

  if (locationCountrySelect) {
    locationCountrySelect.clear();
  }
  if (locationCitySelect) {
    locationCitySelect.clear();
  }
}

module.exports = {
  initLocationManagementUI,
};
