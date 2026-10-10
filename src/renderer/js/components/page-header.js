"use strict";

// Builds the buttons of the page headers, so each page only writes its title:
//
//   <header class="page-header tasbih-header" data-page-header
//           data-controls-class="tasbih-controls" data-back="features">
//     <h1 class="page-header__title" id="tasbihTitle">Tasbih</h1>
//   </header>
//
// becomes  [back]  [title]  [minimize | fullscreen | close]  (layout: page-header.css).
//   data-back            page the back button opens ("home" = back to the home page); leave it
//                        out when the page handles its back button itself
//   data-controls-class  extra class for the buttons group
//   data-id-prefix       for a second header on the same page: "reader" gives readerBackBtn,
//                        readerMinimizeBtn, readerFullscreenBtn, readerCloseBtn
// Buttons written inside the header with data-header-control (e.g. Athkar's "reset all") go
// first in the buttons group. The buttons get their translated names from their tooltips.

const MINIMIZE_ICON =
  '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M19 13H5v-2h14v2z" /></svg>';
const FULLSCREEN_ICON = '<i class="fas fa-expand" aria-hidden="true"></i>';
const CLOSE_ICON =
  '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>';
const BACK_ICON = '<i class="fas fa-arrow-left" aria-hidden="true"></i>';

function buttonHtml({ id, className, tooltip, icon, attrs = "" }) {
  return `<button type="button" class="${className}" id="${id}" data-tooltip="${tooltip}"${attrs}>${icon}</button>`;
}

function renderPageHeader(header) {
  const { idPrefix = "", back, controlsClass } = header.dataset;
  const id = (name) =>
    idPrefix ? idPrefix + name[0].toUpperCase() + name.slice(1) : name;

  header.insertAdjacentHTML(
    "afterbegin",
    buttonHtml({
      id: id("backBtn"),
      className: "back-btn",
      tooltip: "tooltipBack",
      icon: BACK_ICON,
      attrs: back ? ` data-back="${back}"` : "",
    }),
  );

  const controls = document.createElement("div");
  controls.className = ["page-header__controls", controlsClass]
    .filter(Boolean)
    .join(" ");
  controls.append(...header.querySelectorAll("[data-header-control]"));
  controls.insertAdjacentHTML(
    "beforeend",
    buttonHtml({
      id: id("minimizeBtn"),
      className: "control-btn minimize-btn",
      tooltip: "tooltipMinimize",
      icon: MINIMIZE_ICON,
      attrs: ' data-window-action="minimize"',
    }) +
      buttonHtml({
        id: id("fullscreenBtn"),
        className: "control-btn",
        tooltip: "tooltipExpand",
        icon: FULLSCREEN_ICON,
      }) +
      buttonHtml({
        id: id("closeBtn"),
        className: "control-btn close-btn",
        tooltip: "tooltipClose",
        icon: CLOSE_ICON,
        attrs: ' data-window-action="close"',
      }),
  );
  header.append(controls);

  for (const attr of ["pageHeader", "idPrefix", "back", "controlsClass"])
    delete header.dataset[attr];
  header
    .querySelectorAll("[data-header-control]")
    .forEach((el) => el.removeAttribute("data-header-control"));
}

function renderPageHeaders() {
  document.querySelectorAll("[data-page-header]").forEach(renderPageHeader);
}

module.exports = { renderPageHeaders };
