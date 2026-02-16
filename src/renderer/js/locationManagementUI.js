// src/renderer/js/locationManagementUI.js
const TomSelect = require('tom-select').default;
const { t } = require('./translations');
const { showToast } = require('./toast');
const locationManager = require('./locationManager');
const analytics = require('./utils/analytics');

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
  const manageLocationsBtn = document.getElementById('manageLocationsBtn');
  const closeModalBtn = document.getElementById('closeLocationModal');
  const addLocationBtn = document.getElementById('addLocationBtn');
  const closeAddEditBtn = document.getElementById('closeAddEditModal');
  const cancelAddEditBtn = document.getElementById('cancelAddEditBtn');
  const saveLocationBtn = document.getElementById('saveLocationBtn');
  const modal = document.getElementById('locationManagerModal');
  const addEditModal = document.getElementById('addEditLocationModal');

  // Open location manager modal
  if (manageLocationsBtn) {
    manageLocationsBtn.addEventListener('click', async () => {
      modal.classList.add('active');
      await loadLocationsList();
    });
  }

  // Close modals
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      modal.classList.remove('active');
    });
  }

  if (closeAddEditBtn) {
    closeAddEditBtn.addEventListener('click', () => {
      addEditModal.classList.remove('active');
      resetAddEditForm();
    });
  }

  if (cancelAddEditBtn) {
    cancelAddEditBtn.addEventListener('click', () => {
      addEditModal.classList.remove('active');
      resetAddEditForm();
    });
  }

  // Close modals when clicking outside
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  });

  addEditModal.addEventListener('click', (e) => {
    if (e.target === addEditModal) {
      addEditModal.classList.remove('active');
      resetAddEditForm();
    }
  });

  // Add new location
  if (addLocationBtn) {
    addLocationBtn.addEventListener('click', () => {
      currentEditingLocationId = null;
      document.getElementById('addEditLocationTitle').textContent = t('addLocation');
      addEditModal.classList.add('active');
      initLocationSelects();
    });
  }

  // Save location
  if (saveLocationBtn) {
    saveLocationBtn.addEventListener('click', async () => {
      await saveLocation();
    });
  }
}

/**
 * Load and display locations list
 */
async function loadLocationsList() {
  const locationsList = document.getElementById('locationsList');
  if (!locationsList) return;

  const locations = await locationManager.getLocations();

  if (locations.length === 0) {
    locationsList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-map-marker-alt"></i>
        <p>${t('noLocations')}</p>
      </div>
    `;
    return;
  }

  locationsList.innerHTML = locations.map(location => `
    <div class="location-item ${location.isActive ? 'active' : ''}" data-location-id="${location.id}">
      <div class="location-info">
        <div class="location-header">
          <h4 class="location-name">
            ${location.name}
            ${location.isActive ? `<span class="active-badge">${t('active')}</span>` : ''}
          </h4>
          ${location.isFavorite ? '<i class="fas fa-star favorite-star"></i>' : ''}
        </div>
        <p class="location-details">
          <i class="fas fa-map-marker-alt"></i>
          ${location.city}, ${location.country}
        </p>
      </div>
      <div class="location-actions">
        ${!location.isActive ? `
          <button class="action-btn activate-btn" data-action="activate" data-id="${location.id}" title="${t('activate')}">
            <i class="fas fa-check-circle"></i>
          </button>
        ` : ''}
        <button class="action-btn edit-btn" data-action="edit" data-id="${location.id}" title="${t('edit')}">
          <i class="fas fa-edit"></i>
        </button>
        ${locations.length > 1 ? `
          <button class="action-btn delete-btn" data-action="delete" data-id="${location.id}" title="${t('delete')}">
            <i class="fas fa-trash"></i>
          </button>
        ` : ''}
      </div>
    </div>
  `).join('');

  // Add event listeners
  locationsList.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const locationId = btn.dataset.id;

      if (action === 'activate') {
        const loc = locations.find(l => l.id === locationId);
        await locationManager.setActiveLocation(locationId);
        analytics.locationAction('activated', loc);
        await loadLocationsList();
      } else if (action === 'edit') {
        await editLocation(locationId);
      } else if (action === 'delete') {
        if (confirm(t('confirmDeleteLocation'))) {
          const loc = locations.find(l => l.id === locationId);
          await locationManager.deleteLocation(locationId);
          analytics.locationAction('deleted', loc);
          await loadLocationsList();
        }
      }
    });
  });
}

/**
 * Initialize location select dropdowns in add/edit modal
 */
function initLocationSelects() {
  const commonConfig = {
    valueField: 'name',
    labelField: 'name',
    searchField: 'name',
    maxOptions: 500,
  };

  // Destroy existing instances if they exist
  if (locationCountrySelect) {
    locationCountrySelect.destroy();
  }
  if (locationCitySelect) {
    locationCitySelect.destroy();
  }

  // Initialize country select
  locationCountrySelect = new TomSelect('#locationCountryInput', {
    ...commonConfig,
    placeholder: t('selectCountry'),
    preload: true,
    load: async (query, callback) => {
      try {
        const res = await fetch('https://countriesnow.space/api/v0.1/countries/positions');
        const json = await res.json();
        callback(json.data);
      } catch (e) {
        callback();
      }
    }
  });

  // Initialize city select
  locationCitySelect = new TomSelect('#locationCityInput', {
    ...commonConfig,
    placeholder: t('selectCity'),
  });
  locationCitySelect.disable();

  // Load cities when country changes
  locationCountrySelect.on('change', async (value) => {
    locationCitySelect.clear();
    locationCitySelect.clearOptions();
    locationCitySelect.disable();

    if (value) {
      try {
        const res = await fetch('https://countriesnow.space/api/v0.1/countries/cities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ country: value })
        });
        const json = await res.json();

        if (json.data) {
          locationCitySelect.addOptions(json.data.map(city => ({ name: city })));
          locationCitySelect.enable();
        }
      } catch (e) {
        console.error('Error loading cities:', e);
      }
    }
  });
}

/**
 * Edit existing location.
 * Snapshots the current values into _originalLocation so saveLocation()
 * can attach them as `prev` in the analytics event.
 */
async function editLocation(locationId) {
  const locations = await locationManager.getLocations();
  const location = locations.find(loc => loc.id === locationId);

  if (!location) return;

  currentEditingLocationId = locationId;

  // Snapshot the original values for the analytics diff on save
  _originalLocation = {
    name      : location.name,
    city      : location.city,
    country   : location.country,
    isFavorite: location.isFavorite,
  };

  document.getElementById('addEditLocationTitle').textContent = t('editLocation');

  const nameInput = document.getElementById('locationNameInput');
  const favoriteToggle = document.getElementById('locationFavoriteToggle');
  const addEditModal = document.getElementById('addEditLocationModal');

  nameInput.value = location.name;
  favoriteToggle.checked = location.isFavorite;

  addEditModal.classList.add('active');
  initLocationSelects();

  // Set country and city after selects are initialized
  setTimeout(() => {
    if (locationCountrySelect) {
      locationCountrySelect.setValue(location.country);

      // Wait for cities to load, then set city
      setTimeout(() => {
        if (locationCitySelect) {
          locationCitySelect.setValue(location.city);
        }
      }, 500);
    }
  }, 300);
}

/**
 * Save location (add or update)
 */
async function saveLocation() {
  const nameInput = document.getElementById('locationNameInput');
  const favoriteToggle = document.getElementById('locationFavoriteToggle');

  const name = nameInput.value.trim();
  const country = locationCountrySelect ? locationCountrySelect.getValue() : '';
  const city = locationCitySelect ? locationCitySelect.getValue() : '';
  const isFavorite = favoriteToggle.checked;

  // Validation
  if (!name) {
    showToast(t('enterLocationName'), 'error');
    return;
  }

  if (!country || !city) {
    showToast(t('selectCountryAndCity'), 'error');
    return;
  }

  const locationData = { name, country, city, isFavorite };
  let success = false;

  if (currentEditingLocationId) {
    const updated = await locationManager.updateLocation(currentEditingLocationId, locationData);
    success = updated !== null;
    if (success) {
      analytics.locationAction('edited', {
        ...locationData,
        prev: _originalLocation,   // what it looked like before the change
      });
    }
  } else {
    const added = await locationManager.addLocation(locationData);
    success = added !== null;
    if (success) {
      analytics.locationAction('added', locationData);
    }
  }

  if (success) {
    document.getElementById('addEditLocationModal').classList.remove('active');
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
  document.getElementById('locationNameInput').value = '';
  document.getElementById('locationFavoriteToggle').checked = true;

  if (locationCountrySelect) {
    locationCountrySelect.clear();
  }
  if (locationCitySelect) {
    locationCitySelect.clear();
  }
}

module.exports = {
  initLocationManagementUI
};