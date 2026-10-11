"use strict";

// The dialog that lists a reciter's recitations (moshaf) when there is more than one.
const { html, setHtml, asButton } = require("../../utils/html");
/** @typedef {import("./index").AlbumsPage} AlbumsPage */

/** @param {AlbumsPage} page */
function openMoshafPicker(page, reciter) {
  page.moshafModalTitle.textContent = reciter.name;
  page.moshafModalList.innerHTML = "";

  reciter.moshaf.forEach((moshaf) => {
    const item = asButton(document.createElement("div"));
    item.className = "moshaf-item";
    setHtml(
      item,
      html`<i class="fas fa-play-circle" aria-hidden="true"></i><span>${moshaf.name}</span>`,
    );
    item.addEventListener("click", () => {
      page.closeMoshafPicker();
      page.openReciter(reciter, moshaf);
    });
    page.moshafModalList.appendChild(item);
  });

  page.moshafModal.classList.add("show");
}

/** @param {AlbumsPage} page */
function closeMoshafPicker(page) {
  page.moshafModal.classList.remove("show");
}

module.exports = { openMoshafPicker, closeMoshafPicker };
