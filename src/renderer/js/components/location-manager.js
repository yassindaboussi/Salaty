"use strict";

const TomSelect = require("tom-select").default;
const { t } = require("../core/i18n");
const { showToast } = require("../core/toast");
const { showConfirmDialog } = require("./confirm-dialog");
const locationManager = require("../services/locations");
const { fetchCountries, fetchCities } = require("../services/api/countries");
const analytics = require("../services/analytics");
const { html, setHtml } = require("../utils/html");
const { byId, queryAll } = require("../core/dom");

let currentEditingLocationId = null;
/** @type {InstanceType<typeof TomSelect> | null} */
let locationCountrySelect = null;
/** @type {InstanceType<typeof TomSelect> | null} */
let locationCitySelect = null;

function initLocationManagementUI() {
  const manageLocationsBtn = document.getElementById("manageLocationsBtn");
  const closeModalBtn = document.getElementById("closeLocationModal");
  const addLocationBtn = document.getElementById("addLocationBtn");
  const closeAddEditBtn = document.getElementById("closeAddEditModal");
  const cancelAddEditBtn = document.getElementById("cancelAddEditBtn");
  const saveLocationBtn = document.getElementById("saveLocationBtn");
  const modal = document.getElementById("locationManagerModal");
  const addEditModal = document.getElementById("addEditLocationModal");

  updateLocationModalTitles();

  if (!modal || !addEditModal) {
    return;
  }

  modal.classList.remove("active");
  addEditModal.classList.remove("active");

  if (manageLocationsBtn) {
    manageLocationsBtn.addEventListener("click", async () => {
      addEditModal.classList.remove("active");
      resetAddEditForm();
      updateLocationModalTitles(); // the language may have changed since the page opened

      modal.classList.add("active");
      await loadLocationsList();
    });
  }

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

  if (addLocationBtn) {
    addLocationBtn.addEventListener("click", async () => {
      currentEditingLocationId = null;
      updateLocationModalTitles();
      addEditModal.classList.add("active");
      await initLocationSelects();
    });
  }

  if (saveLocationBtn) {
    saveLocationBtn.addEventListener("click", async () => {
      await saveLocation();
    });
  }
}

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

async function loadLocationsList() {
  const locationsList = document.getElementById("locationsList");
  if (!locationsList) return;

  const locations = await locationManager.getLocations();

  if (locations.length === 0) {
    setHtml(
      locationsList,
      html`
      <div class="empty-state">
        <i class="fas fa-map-marker-alt" aria-hidden="true"></i>
        <p>${t("noLocations")}</p>
      </div>
    `,
    );
    return;
  }

  setHtml(
    locationsList,
    html`${locations.map(
      (location) => html`
    <div class="location-item ${location.isActive ? "active" : ""}" data-location-id="${location.id}">
      <div>
        <div class="location-item-title">
          <span class="location-item-name">${location.name}</span>
          ${location.isActive ? html`<span class="location-item-badge">${t("active")}</span>` : ""}
          ${location.isFavorite ? html`<i class="fas fa-star location-item-star" aria-hidden="true"></i>` : ""}
        </div>
        <div class="location-item-place">
          <i class="fas fa-map-marker-alt" aria-hidden="true"></i> ${location.city}, ${location.country}
        </div>
      </div>
      <div class="location-actions">
        ${
          !location.isActive
            ? html`
          <button type="button" class="action-btn activate-btn" data-action="activate" data-id="${location.id}" title="${t("activate")}">
            <i class="fas fa-check-circle" aria-hidden="true"></i>
          </button>
        `
            : ""
        }
        <button type="button" class="action-btn edit-btn" data-action="edit" data-id="${location.id}" title="${t("edit")}">
          <i class="fas fa-edit" aria-hidden="true"></i>
        </button>
        ${
          locations.length > 1
            ? html`
          <button type="button" class="action-btn delete-btn" data-action="delete" data-id="${location.id}" title="${t("delete")}">
            <i class="fas fa-trash" aria-hidden="true"></i>
          </button>
        `
            : ""
        }
      </div>
    </div>
  `,
    )}`,
  );

  queryAll(".action-btn", HTMLElement, locationsList).forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const locationId = btn.dataset.id;

      if (action === "activate") {
        await locationManager.setActiveLocation(locationId);
        analytics.locationAction("activated");
        await loadLocationsList();
      } else if (action === "edit") {
        await editLocation(locationId);
      } else if (action === "delete") {
        const confirmed = await showConfirmDialog(t("confirmDeleteLocation"));
        if (confirmed) {
          await locationManager.deleteLocation(locationId);
          analytics.locationAction("deleted");
          await loadLocationsList();
        }
      }
    });
  });
}

async function _loadCitiesForCountry(country) {
  // Only called once initLocationSelects() has created the pickers.
  if (!locationCitySelect) return;
  locationCitySelect.clear();
  locationCitySelect.clearOptions();
  locationCitySelect.disable();

  if (!country) return;

  try {
    const cities = await fetchCities(country);
    if (cities.length) {
      locationCitySelect.addOptions(cities.map((city) => ({ name: city })));
      locationCitySelect.enable();
    }
  } catch (e) {
    console.error("[LocationUI] Error loading cities:", e);
  }
}

function initLocationSelects() {
  const commonConfig = {
    valueField: "name",
    labelField: "name",
    searchField: ["name"],
    maxOptions: 500,
  };

  if (locationCountrySelect) locationCountrySelect.destroy();
  if (locationCitySelect) locationCitySelect.destroy();

  locationCitySelect = new TomSelect("#locationCityInput", {
    ...commonConfig,
    placeholder: t("selectCity"),
  });
  locationCitySelect.disable();

  locationCountrySelect = new TomSelect("#locationCountryInput", {
    ...commonConfig,
    placeholder: t("selectCountry"),
  });

  locationCountrySelect.on("change", async (value) => {
    await _loadCitiesForCountry(value);
  });

  return fetchCountries()
    .then((countries) => {
      locationCountrySelect?.addOptions(countries);
      return countries;
    })
    .catch((e) => {
      console.error("[LocationUI] Error loading countries:", e);
      return [];
    });
}

async function editLocation(locationId) {
  const locations = await locationManager.getLocations();
  const location = locations.find((loc) => loc.id === locationId);

  if (!location) return;

  currentEditingLocationId = locationId;

  const nameInput = byId("locationNameInput", HTMLInputElement);
  const favoriteToggle = byId("locationFavoriteToggle", HTMLInputElement);
  const addEditModal = byId("addEditLocationModal", HTMLElement);

  nameInput.value = location.name;
  favoriteToggle.checked = location.isFavorite;

  updateLocationModalTitles();

  addEditModal.classList.add("active");

  try {
    await initLocationSelects();
    locationCountrySelect?.setValue(location.country);
    await _loadCitiesForCountry(location.country);
    locationCitySelect?.setValue(location.city);
  } catch (e) {
    console.error("[LocationUI] editLocation: failed to pre-fill selects:", e);
  }
}

async function saveLocation() {
  const nameInput = byId("locationNameInput", HTMLInputElement);
  const favoriteToggle = byId("locationFavoriteToggle", HTMLInputElement);

  const name = nameInput.value.trim();
  const country = locationCountrySelect ? locationCountrySelect.getValue() : "";
  const city = locationCitySelect ? locationCitySelect.getValue() : "";
  const isFavorite = favoriteToggle.checked;

  if (!name) {
    showToast(t("enterLocationName"), "error");
    return;
  }

  if (!country || !city) {
    showToast(t("selectCountryAndCity"), "error");
    return;
  }

  const locationData = { name, country, city, isFavorite };
  let success;

  if (currentEditingLocationId) {
    const updated = await locationManager.updateLocation(
      currentEditingLocationId,
      locationData,
    );
    success = updated !== null;
    if (success) analytics.locationAction("edited");
  } else {
    const added = await locationManager.addLocation(locationData);
    success = added !== null;
    if (success) analytics.locationAction("added");
  }

  if (success) {
    byId("addEditLocationModal", HTMLElement).classList.remove("active");
    resetAddEditForm();
    await loadLocationsList();
  }
}

function resetAddEditForm() {
  currentEditingLocationId = null;
  byId("locationNameInput", HTMLInputElement).value = "";
  byId("locationFavoriteToggle", HTMLInputElement).checked = true;

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
