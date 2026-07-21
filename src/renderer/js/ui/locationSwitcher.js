let _locationPromptShownThisSession = false;

// src/renderer/js/locationSwitcher.js
const locationManager = require("../services/locationManager");
const { t } = require("../core/i18n/translations");
const { showConfirmDialog } = require("./customDialog");
const { state } = require("../core/globalStore");

let isDropdownOpen = false;

/**
 * Initialize location switcher on main page
 */
async function initLocationSwitcher() {
  const switcherBtn = document.getElementById("locationSwitcherBtn");
  const dropdown = document.getElementById("locationSwitcherDropdown");

  if (!switcherBtn || !dropdown) {
    return;
  }

  // Load locations and update switcher
  await updateLocationSwitcher();

  // Toggle dropdown
  switcherBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleDropdown();
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (isDropdownOpen) {
      // Check if click is on switcher button
      if (e.target === switcherBtn || switcherBtn.contains(e.target)) {
        return;
      }

      // Check if click is on a location item or inside dropdown
      const clickedItem = e.target.closest(".location-switcher-item");
      if (clickedItem || dropdown.contains(e.target)) {
        return;
      }

      // Click was outside, close dropdown
      closeDropdown();
    }
  });

  // Auto-detect location on launch (with delay to ensure UI is fully rendered)
  setTimeout(async () => {
    await checkLocationOnLaunch();
  }, 1500);
}

/**
 * Check location on app launch and notify if different
 */
async function checkLocationOnLaunch() {
  try {
    // Respect the "Auto-Detect Location" setting (Settings > Location).
    // Defaults to enabled so existing behavior is unchanged for users who
    // haven't touched this setting yet.
    if (state.settings.travelMode === false) {
      return;
    }

    // Check if we've already shown the prompt this session (persists across page reloads)
    if (_locationPromptShownThisSession) {
      return;
    }

    // Silently detect current location
    const detected = await locationManager.detectLocation();

    if (!detected) {
      return; // Failed to detect, skip silently
    }

    // Get current active location
    const locations = await locationManager.getLocations();
    const activeLocation = locations.find((loc) => loc.isActive);

    if (!activeLocation) {
      return; // No active location, skip
    }

    // Check if detected location is different from active location
    const isDifferent =
      detected.city !== activeLocation.city ||
      detected.country !== activeLocation.country;

    if (isDifferent) {
      // Mark that we've shown the prompt for this session (persists across page reloads)
      _locationPromptShownThisSession = true;

      // Show confirmation dialog
      const message = t("locationChangedMessage")
        .replace(
          "{currentLocation}",
          `${activeLocation.city}, ${activeLocation.country}`,
        )
        .replace("{detectedLocation}", `${detected.city}, ${detected.country}`);

      const confirmed = await showConfirmDialog(message, {
        confirmText: t("switchLocation") || "Switch",
        cancelText: t("cancel") || "Cancel",
      });

      if (confirmed) {
        // User confirmed, switch location

        // Check if detected location already exists
        const existingLocation = locations.find(
          (loc) =>
            loc.city === detected.city && loc.country === detected.country,
        );

        if (existingLocation) {
          // Activate existing location
          await locationManager.setActiveLocation(existingLocation.id);
        } else {
          // Create new location with detected data
          const newLocation = await locationManager.addLocation({
            name: `${detected.city}`,
            city: detected.city,
            country: detected.country,
            isFavorite: true,
          });

          if (newLocation) {
            // Activate the new location
            await locationManager.setActiveLocation(newLocation.id);
            // Page will reload after activation
          }
        }
      }
      // If user cancels, the module-level flag remains set, so they won't be asked again this session
    }
  } catch (error) {
    // Silently fail - don't interrupt user experience with errors
    console.error("Error checking location on launch:", error);
  }
}

/**
 * Handle detect location from dropdown
 */
async function handleDetectLocation() {
  try {
    const detected = await locationManager.detectLocation();

    if (detected) {
      // Check if location already exists
      const locations = await locationManager.getLocations();
      const existingLocation = locations.find(
        (loc) => loc.city === detected.city && loc.country === detected.country,
      );

      if (existingLocation) {
        // Activate existing location
        await locationManager.setActiveLocation(existingLocation.id);
      } else {
        // Create new location with detected data
        const newLocation = await locationManager.addLocation({
          name: `${detected.city}`,
          city: detected.city,
          country: detected.country,
          isFavorite: true,
        });

        if (newLocation) {
          // Activate the new location
          await locationManager.setActiveLocation(newLocation.id);
          // Page will reload after activation
        }
      }
    }
  } catch (error) {
    console.error("Error detecting location from dropdown:", error);
  }
}

/**
 * Update location switcher with current locations
 */
async function updateLocationSwitcher() {
  const switcherBtn = document.getElementById("locationSwitcherBtn");
  const dropdown = document.getElementById("locationSwitcherDropdown");

  if (!switcherBtn || !dropdown) {
    return;
  }

  const locations = await locationManager.getLocations();
  const favoriteLocations = locations.filter((loc) => loc.isFavorite);

  // Show switcher button only if there are favorite locations
  if (favoriteLocations.length > 1) {
    switcherBtn.style.display = "flex";
  } else {
    switcherBtn.style.display = "none";
    return;
  }

  // Build dropdown HTML with "Detect Location" option at the top
  const detectLocationItem = `
    <div class="location-switcher-item detect-location-item" data-action="detect">
      <div class="switcher-item-info">
        <div class="switcher-item-name">
          <i class="fas fa-location-crosshairs"></i>
          ${t("detectLocation")}
        </div>
      </div>
    </div>
  `;

  const locationItems = favoriteLocations
    .map(
      (location) => `
    <div class="location-switcher-item ${location.isActive ? "active" : ""}"
         data-location-id="${location.id}">
      <div class="switcher-item-info">
        <div class="switcher-item-name">${location.name}</div>
        <div class="switcher-item-details">${location.city}, ${location.country}</div>
      </div>
      ${location.isActive ? '<i class="fas fa-check switcher-check"></i>' : ""}
    </div>
  `,
    )
    .join("");

  dropdown.innerHTML = detectLocationItem + locationItems;

  // Add event listeners to items
  const items = dropdown.querySelectorAll(".location-switcher-item");

  items.forEach((item) => {
    item.addEventListener("click", async (e) => {
      e.stopPropagation();
      e.preventDefault();

      // Check if this is the detect location action
      if (item.dataset.action === "detect") {
        await handleDetectLocation();
        closeDropdown();
        return;
      }

      // Handle regular location switching
      const locationId = item.dataset.locationId;
      const location = locations.find((loc) => loc.id === locationId);

      if (location && !location.isActive) {
        await locationManager.setActiveLocation(locationId);
        closeDropdown();
        // Page will reload after location change
      } else {
        closeDropdown();
      }
    });
  });
}

/**
 * Toggle dropdown visibility
 */
function toggleDropdown() {
  const dropdown = document.getElementById("locationSwitcherDropdown");
  const switcherBtn = document.getElementById("locationSwitcherBtn");

  if (!dropdown || !switcherBtn) {
    return;
  }

  if (isDropdownOpen) {
    closeDropdown();
  } else {
    openDropdown();
  }
}

/**
 * Open dropdown
 */
function openDropdown() {
  const dropdown = document.getElementById("locationSwitcherDropdown");
  const switcherBtn = document.getElementById("locationSwitcherBtn");

  if (!dropdown || !switcherBtn) {
    return;
  }

  dropdown.classList.add("active");
  switcherBtn.classList.add("active");
  isDropdownOpen = true;
}

/**
 * Close dropdown
 */
function closeDropdown() {
  const dropdown = document.getElementById("locationSwitcherDropdown");
  const switcherBtn = document.getElementById("locationSwitcherBtn");

  if (!dropdown || !switcherBtn) return;

  dropdown.classList.remove("active");
  switcherBtn.classList.remove("active");
  isDropdownOpen = false;
}

module.exports = {
  initLocationSwitcher,
  updateLocationSwitcher,
  closeDropdown, // Export so other pages can close it
};
