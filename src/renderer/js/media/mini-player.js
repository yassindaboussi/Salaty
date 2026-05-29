"use strict";
const { ipcRenderer } = require("electron");

function setupMiniPlayer() {
  if (window.location.pathname.includes("playlist.html")) return;

  // Build DOM directly — no innerHTML string, no double query.
  const wrap = document.createElement("div");
  wrap.id = "miniPlayer";
  wrap.className = "mini-player hidden";

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
  controls.append(prevBtn, playBtn, nextBtn, playlistBtn);

  wrap.append(info, controls);
  (document.getElementById("app") ?? document.body).appendChild(wrap);

  let pausedFromHere = false;

  playBtn.addEventListener("click", () => {
    const paused = !!playBtn.querySelector(".fa-play");
    if (paused) {
      ipcRenderer.send("player-command", { type: "resume" });
    } else {
      pausedFromHere = true;
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

  ipcRenderer.on("player-update", (_e, { type, state }) => {
    if (type !== "state") return;
    const visible = state.currentTrack && (state.isPlaying || pausedFromHere);
    wrap.classList.toggle("hidden", !visible);
    if (!visible) {
      pausedFromHere = false;
      return;
    }
    title.textContent = state.currentTrack.title;
    artist.textContent = state.currentTrack.artist;
    const icon = playBtn.querySelector("i");
    if (icon) icon.className = `fas fa-${state.isPlaying ? "pause" : "play"}`;
    if (state.isPlaying) pausedFromHere = false;
  });

  ipcRenderer.send("player-command", { type: "get-state" });
}

module.exports = { setupMiniPlayer };
