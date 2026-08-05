"use strict";
const { ipcRenderer } = require("electron");
const { hideTooltip } = require("../core/tooltipSystem");

function setupMiniPlayer() {
  if (window.location.pathname.includes("playlist.html")) return;

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
  const mkBtn = (id, icon, cls = "") => {
    const b = document.createElement("button");
    b.id = id;
    b.className = `mini-btn ${cls}`.trim();
    b.innerHTML = `<i class="fas fa-${icon}"></i>`;
    return b;
  };
  const prevBtn = mkBtn("miniPrevBtn", "step-backward");
  const playBtn = mkBtn("miniPlayBtn", "play", "mini-play-btn");
  const nextBtn = mkBtn("miniNextBtn", "step-forward");
  const playlistBtn = mkBtn("miniPlaylistBtn", "list");
  playlistBtn.title = "Open Playlist";
  const closeBtn = mkBtn("miniCloseBtn", "times", "mini-close-btn");
  closeBtn.title = "Close";
  closeBtn.setAttribute("data-tooltip", "tooltipClose");
  controls.append(prevBtn, playBtn, nextBtn, playlistBtn, closeBtn);

  wrap.append(info, controls);
  (document.getElementById("app") ?? document.body).appendChild(wrap);

  function showMiniPlayer() {
    if (wrap.classList.contains("visible")) return;
    wrap.classList.add("visible");
    // Force layout before adding "active" so the browser actually
    // animates from the initial (translated-up, transparent) state
    // instead of jumping straight to the final one.
    requestAnimationFrame(() => wrap.classList.add("active"));
  }

  function hideMiniPlayer() {
    // Removed immediately (not after a fade transition) — display:none
    // must apply right away so the element is fully out of the render
    // tree with no window where it could still contribute a phantom
    // drag region or swallow clicks/hover.
    wrap.classList.remove("active", "visible");
  }

  playBtn.addEventListener("click", () => {
    const paused = !!playBtn.querySelector(".fa-play");
    if (paused) {
      ipcRenderer.send("player-command", { type: "resume" });
    } else {
      ipcRenderer.send("player-command", { type: "pause" });
    }
  });
  prevBtn.addEventListener("click", () =>
    ipcRenderer.send("player-command", { type: "prev" }),
  );
  nextBtn.addEventListener("click", () =>
    ipcRenderer.send("player-command", { type: "next" }),
  );
  playlistBtn.addEventListener("click", () =>
    ipcRenderer.invoke("navigate-to", "playlist", 850, 600),
  );

  function trackKeyOf(track) {
    return track ? track.url || `${track.title}|${track.artist}` : null;
  }
  let lastTrackKey = null;
  closeBtn.addEventListener("click", () => {
    ipcRenderer.send("player-command", { type: "pause" });
    hideTooltip();
    // sessionStorage (not a plain variable) so this survives navigating to
    // another page and back — this app fully reloads its JS on every page
    // navigation, so a plain variable here would forget the dismissal the
    // instant you left the page, making the close button appear to do
    // nothing once you navigated anywhere.
    sessionStorage.setItem("miniPlayerDismissedTrackKey", lastTrackKey || "");
    hideMiniPlayer();
  });

  ipcRenderer.on("player-update", (_e, { type, state }) => {
    if (type !== "state") return;
    lastTrackKey = trackKeyOf(state.currentTrack);
    const dismissedTrackKey = sessionStorage.getItem("miniPlayerDismissedTrackKey");
    const visible = !!state.currentTrack && lastTrackKey !== dismissedTrackKey;
    if (visible) {
      showMiniPlayer();
    } else {
      hideMiniPlayer();
      return;
    }
    title.textContent = state.currentTrack.title;
    artist.textContent = state.currentTrack.artist;
    const icon = playBtn.querySelector("i");
    if (icon) icon.className = `fas fa-${state.isPlaying ? "pause" : "play"}`;
  });

  ipcRenderer.send("player-command", { type: "get-state" });
}

module.exports = { setupMiniPlayer };
