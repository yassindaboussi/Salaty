const locationManager = require("../services/locationManager");
const { t } = require("../core/i18n/translations");
const { showConfirmDialog } = require("./customDialog");
const { state } = require("../core/globalStore");

let isDropdownOpen = false;

async function initLocationSwitcher() {
  const switcherBtn = document.getElementById("locationSwitcherBtn");
  const dropdown = document.getElementById("locationSwitcherDropdown");

  if (!switcherBtn || !dropdown) {
    return;
  }

  await updateLocationSwitcher();

  switcherBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleDropdown();
  });

  document.addEventListener("click", (e) => {
    if (isDropdownOpen) {
      if (e.target === switcherBtn || switcherBtn.contains(e.target)) {
        return;
      }

      const clickedItem = e.target.closest(".location-switcher-item");
      if (clickedItem || dropdown.contains(e.target)) {
        return;
      }

      closeDropdown();
    }
  });

  setTimeout(async () => {
    await checkLocationOnLaunch();
  }, 1500);
}

async function checkLocationOnLaunch() {
  try {
    if (state.settings.travelMode !== true) {
      return;
    }

    if (sessionStorage.getItem("locationPromptShown") === "1") {
      return;
    }

    const detected = await locationManager.detectLocation();

    if (!detected) {
      return;
    }

    const locations = await locationManager.getLocations();
    const activeLocation = locations.find((loc) => loc.isActive);

    if (!activeLocation) {
      return;
    }

    const isDifferent =
      detected.city !== activeLocation.city ||
      detected.country !== activeLocation.country;

    if (isDifferent) {
      sessionStorage.setItem("locationPromptShown", "1");

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

        const existingLocation = locations.find(
          (loc) =>
            loc.city === detected.city && loc.country === detected.country,
        );

        if (existingLocation) {
          await locationManager.setActiveLocation(existingLocation.id);
        } else {
          const newLocation = await locationManager.addLocation({
            name: `${detected.city}`,
            city: detected.city,
            country: detected.country,
            isFavorite: true,
          });

          if (newLocation) {
            await locationManager.setActiveLocation(newLocation.id);
          }
        }
      }
    }
  } catch (error) {
    console.error("Error checking location on launch:", error);
  }
}

async function handleDetectLocation() {
  try {
    const detected = await locationManager.detectLocation();

    if (detected) {
      const locations = await locationManager.getLocations();
      const existingLocation = locations.find(
        (loc) => loc.city === detected.city && loc.country === detected.country,
      );

      if (existingLocation) {
        await locationManager.setActiveLocation(existingLocation.id);
      } else {
        const newLocation = await locationManager.addLocation({
          name: `${detected.city}`,
          city: detected.city,
          country: detected.country,
          isFavorite: true,
        });

        if (newLocation) {
          await locationManager.setActiveLocation(newLocation.id);
        }
      }
    }
  } catch (error) {
    console.error("Error detecting location from dropdown:", error);
  }
}

async function updateLocationSwitcher() {
  const switcherBtn = document.getElementById("locationSwitcherBtn");
  const dropdown = document.getElementById("locationSwitcherDropdown");

  if (!switcherBtn || !dropdown) {
    return;
  }

  const locations = await locationManager.getLocations();
  const favoriteLocations = locations.filter((loc) => loc.isFavorite);

  if (favoriteLocations.length > 1) {
    switcherBtn.style.display = "flex";
  } else {
    switcherBtn.style.display = "none";
    return;
  }

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

  const items = dropdown.querySelectorAll(".location-switcher-item");

  items.forEach((item) => {
    item.addEventListener("click", async (e) => {
      e.stopPropagation();
      e.preventDefault();

      if (item.dataset.action === "detect") {
        await handleDetectLocation();
        closeDropdown();
        return;
      }

      const locationId = item.dataset.locationId;
      const location = locations.find((loc) => loc.id === locationId);

      if (location && !location.isActive) {
        await locationManager.setActiveLocation(locationId);
        closeDropdown();
      } else {
        closeDropdown();
      }
    });
  });
}

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
  closeDropdown,
};
