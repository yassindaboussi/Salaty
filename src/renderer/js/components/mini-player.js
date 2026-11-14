"use strict";
const { ipcRenderer } = require("electron");
const { hideTooltip } = require("../core/tooltips");
const { html, setHtml } = require("../utils/html");
const { bindQuranMiniPlayer } = require("./mini-player-quran");

/**
 * @param {string} [ownPlayerFor] what the page shows in its own panel ("radio"): hidden for that
 */
function setupMiniPlayer(ownPlayerFor) {
  const wrap = document.createElement("div");
  wrap.id = "miniPlayer";
  wrap.className = "mini-player";

  const info = document.createElement("div");
  info.className = "mini-track-info";
  const title = document.createElement("span");
  title.id = "miniTrackTitle";
  title.className = "mini-track-title";
  title.textContent = "-";
  const artist = document.createElement("span");
  artist.id = "miniTrackArtist";
  artist.className = "mini-track-artist";
  artist.textContent = "-";
  info.append(title, artist);

  const controls = document.createElement("div");
  controls.className = "mini-controls";
  // Icon buttons; the tooltip key also gives each one its (translated) accessible name.
  const mkBtn = (id, icon, tooltip, cls = "") => {
    const b = document.createElement("button");
    b.type = "button";
    b.id = id;
    b.className = `mini-btn ${cls}`.trim();
    b.dataset.tooltip = tooltip;
    setHtml(b, html`<i class="fas fa-${icon}" aria-hidden="true"></i>`);
    return b;
  };
  const prevBtn = mkBtn(
    "miniPrevBtn",
    "step-backward",
    "tooltipPrev",
    "mini-prev-btn",
  );
  const playBtn = mkBtn(
    "miniPlayBtn",
    "play",
    "tooltipPlayPause",
    "mini-play-btn",
  );
  const nextBtn = mkBtn(
    "miniNextBtn",
    "step-forward",
    "tooltipNext",
    "mini-next-btn",
  );
  const playlistBtn = mkBtn(
    "miniPlaylistBtn",
    "list",
    "tooltipPlaylist",
    "mini-playlist-btn",
  );
  const closeBtn = mkBtn(
    "miniCloseBtn",
    "times",
    "tooltipClose",
    "mini-close-btn",
  );
  controls.append(prevBtn, playBtn, nextBtn, playlistBtn, closeBtn);

  title.dir = "auto"; // an Arabic surah name inside the left-to-right title bar
  artist.dir = "auto";
  wrap.append(info, controls);

  // The player lives in the title bar, between the title and the window buttons, so it never
  // covers the page (Windows title bar guidance: buttons may sit in the title bar while its
  // empty space and text still drag the window). Only its buttons are no-drag.
  function placeInTitleBar() {
    const header = [...document.querySelectorAll(".page-header")].find(
      (h) => h instanceof HTMLElement && h.offsetParent !== null,
    );
    const buttons = header?.querySelector(".page-header__controls");
    if (header && buttons) {
      if (wrap.nextElementSibling !== buttons)
        header.insertBefore(wrap, buttons);
      return;
    }
    // the home page: the empty space between its buttons
    const space = document.querySelector(".draggable-header-space");
    if (space && wrap.parentElement !== space) space.append(wrap);
  }

  function showMiniPlayer() {
    placeInTitleBar();
    wrap.classList.add("visible"); // fades in by CSS (@starting-style)
  }

  function hideMiniPlayer() {
    // Removed immediately (not after a fade transition) — display:none
    // must apply right away so the element is fully out of the render
    // tree with no window where it could still contribute a phantom
    // drag region or swallow clicks/hover.
    wrap.classList.remove("visible");
  }

  playBtn.addEventListener("click", () => {
    const paused = Boolean(playBtn.querySelector(".fa-play"));
    if (paused) {
      ipcRenderer.send("player-command", { type: "resume" });
    } else {
      ipcRenderer.send("player-command", { type: "pause" });
    }
  });
  // back to what is playing: the radio page for a radio, the Quran reader for a surah, else
  // the playlist
  const OWN_PAGES = new Set(["radio", "quran"]);
  let page = "playlist";
  // a Quran surah: previous / next by ayah, its reader, the riwaya (mini-player-quran.js)
  const quran = bindQuranMiniPlayer(
    { prev: prevBtn, next: nextBtn, open: playlistBtn, artist },
    {
      prev: () => ipcRenderer.send("player-command", { type: "prev" }),
      next: () => ipcRenderer.send("player-command", { type: "next" }),
      open: () => {
        if (page !== "quran") ipcRenderer.invoke("navigate-to", page, 850, 600);
      },
    },
  );

  function trackKeyOf(track) {
    return track ? track.url || `${track.title}|${track.artist}` : null;
  }
  let lastTrackKey = null;
  let closedAt = 0;
  closeBtn.addEventListener("click", () => {
    closedAt = Date.now();
    ipcRenderer.send("player-command", { type: "pause" });
    hideTooltip();
    // sessionStorage (not a plain variable) so this survives navigating to
    // another page and back — this app fully reloads its JS on every page
    // navigation, so a plain variable here would forget the dismissal the
    // instant you left the page, making the close button appear to do
    // nothing once you navigated anywhere.
    sessionStorage.setItem("miniPlayerDismissedTrackKey", lastTrackKey || "");
    hideMiniPlayer();
    window.dispatchEvent(new Event("mini-player-closed")); // e.g. the archive's cards come back
  });

  ipcRenderer.on("player-update", (_e, { type, state, currentTime }) => {
    if (type === "time-update") quran.onTime(currentTime || 0);
    if (type !== "state") return;
    lastTrackKey = trackKeyOf(state.currentTrack);
    // The closed track playing again (its "continue" card, the playlist…) is the user wanting it:
    // the player comes back. Not in the moment after the ✕ itself, while its pause arrives.
    if (
      state.isPlaying &&
      lastTrackKey === sessionStorage.getItem("miniPlayerDismissedTrackKey") &&
      Date.now() - closedAt > 1500
    ) {
      sessionStorage.removeItem("miniPlayerDismissedTrackKey");
    }
    const dismissedTrackKey = sessionStorage.getItem(
      "miniPlayerDismissedTrackKey",
    );
    // (a page showing its own player for it hides this one: body.has-own-player, CSS)
    const visible =
      Boolean(state.currentTrack) &&
      lastTrackKey !== dismissedTrackKey &&
      !(ownPlayerFor && state.currentTrack.page === ownPlayerFor);
    if (visible) {
      showMiniPlayer();
    } else {
      hideMiniPlayer();
      return;
    }
    page = OWN_PAGES.has(state.currentTrack.page)
      ? state.currentTrack.page
      : "playlist";
    title.textContent = state.currentTrack.title;
    artist.textContent = state.currentTrack.artist;
    // after the title and artist: a surah adds the riwaya; previous / next go by ayah
    if (!quran.apply(state)) {
      // off where the list has nothing before / after (radios: the stations as the radio
      // page lists them)
      const at = state.currentTrackIndex ?? 0;
      prevBtn.disabled = at <= 0;
      nextBtn.disabled = at >= (state.trackCount ?? 1) - 1;
    }
    const icon = playBtn.querySelector("i");
    if (icon) icon.className = `fas fa-${state.isPlaying ? "pause" : "play"}`;
  });

  ipcRenderer.send("player-command", { type: "get-state" });
}

module.exports = { setupMiniPlayer };
