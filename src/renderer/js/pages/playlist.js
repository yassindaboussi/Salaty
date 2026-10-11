"use strict";

const { ipcRenderer } = require("electron");
const screenSizeManager = require("../core/screen-size");
const mp3quranApi = require("../services/api/mp3quran");
const { t, getLanguage } = require("../core/i18n");
const analytics = require("../services/analytics");
const { html, setHtml, asButton } = require("../utils/html");
// (query renamed: this file uses "query" for search text)
const { byId, query: queryOne, queryAll } = require("../core/dom");

const mp3quranLang = mp3quranApi.apiLanguage;

function getLocalized(obj) {
  if (typeof obj === "string") return obj;
  if (!obj) return "";
  const lang = getLanguage();
  return obj[lang] || obj["en"] || Object.values(obj)[0] || "";
}

class PlaylistManager {
  constructor() {
    this.tracks = [];
    this.originalTracks = [];

    this.initElements();
    this.initListeners();
    this.initIPC();
  }

  async init() {
    // The mini player opens this page at a fixed size: go back to full screen if that is the
    // saved choice (the shell does not touch the size here, see entries/playlist.js).
    await screenSizeManager.applyScreenSize();
    screenSizeManager.initPageScreenSize("playlist-container");
    this.updateTranslations();

    ipcRenderer.send("player-command", { type: "get-state" });

    await this.loadCurrentAlbum();

    return this;
  }

  async loadCurrentAlbum() {
    const storedAlbum = localStorage.getItem("selectedAlbum");
    if (storedAlbum) {
      try {
        const album = JSON.parse(storedAlbum);
        queryOne(".playlist-title", HTMLElement).innerText = getLocalized(
          album.title,
        );
        await this.loadTracks(album);
      } catch (e) {
        console.error("Error parsing stored album", e);
        setHtml(
          this.resultsList,
          html`<div class="error"><p>${t("errorLoadingAlbums")}</p></div>`,
        );
      }
    } else {
      setHtml(
        this.resultsList,
        html`<div class="empty-state"><p>${t("noAlbumSelected")}</p></div>`,
      );
    }
  }

  async loadTracks(album) {
    setHtml(
      this.resultsList,
      html`<div class="loading"><i class="fas fa-spinner" aria-hidden="true"></i>${t("loadingTracks")}</div>`,
    );
    try {
      if (album.source === "mp3quran") {
        this.originalTracks = await mp3quranApi.getReciterTracks(
          album.reciterName,
          { server: album.server, surah_list: album.surahList },
          mp3quranLang(),
        );
      } else if (album.source === "mp3quran-tracks") {
        this.originalTracks = Array.isArray(album.tracks) ? album.tracks : [];
      } else {
        throw new Error("Unsupported album source");
      }
      this.tracks = [...this.originalTracks];
      this.displayTracks();
    } catch (error) {
      console.error("Error loading tracks:", error);
      analytics.error("playlist_load_tracks", error.message || String(error));
      const albumName = (getLocalized(album.title) || album.id) ?? "";
      let errorMsg = t("errorLoadingTracks");
      if (errorMsg.includes("{album}")) {
        errorMsg = errorMsg.replace("{album}", () => albumName);
      } else {
        errorMsg += ` ${albumName}`;
      }
      setHtml(
        this.resultsList,
        html`<div class="error"><i class="fas fa-exclamation-circle" aria-hidden="true"></i>${errorMsg}</div>`,
      );
    }
  }

  filterTracks(query) {
    if (query) {
      const lowerQuery = query.toLowerCase();
      this.tracks = this.originalTracks.filter(
        (track) =>
          track.title.toLowerCase().includes(lowerQuery) ||
          track.artist.toLowerCase().includes(lowerQuery),
      );
    } else {
      this.tracks = [...this.originalTracks];
    }
    this.displayTracks();
  }

  displayTracks() {
    this.resultsList.innerHTML = "";
    if (this.tracks.length === 0) {
      setHtml(
        this.resultsList,
        html`<div class="empty-state"><p>${t("noTracksFound")}</p></div>`,
      );
      return;
    }

    const container = document.createElement("div");
    this.tracks.forEach((track, index) => {
      const el = asButton(document.createElement("div"));
      el.className = "track-item";
      el.dataset.url = track.url;

      if (this.currentTrackData && this.currentTrackData.url === track.url) {
        el.classList.add("active");
      }

      setHtml(
        el,
        html`
            <div class="track-info">
                <span class="track-title">${track.title}</span>
                <span class="track-meta">${track.artist}</span>
            </div>
            <i class="fas fa-play-circle start-track-btn" aria-hidden="true"></i>
            `,
      );

      el.addEventListener("click", () => this.playTrack(index));
      container.appendChild(el);
    });
    this.resultsList.appendChild(container);
  }

  initIPC() {
    ipcRenderer.on("player-update", (event, arg) => {
      if (arg.type === "state") {
        this.updateState(arg.state);
      } else if (arg.type === "time-update") {
        this.updateTime(arg.currentTime, arg.duration);
      }
    });
  }

  updateState(state) {
    this.isPlaying = state.isPlaying;

    this.currentTrackData = state.currentTrack;

    this.updatePlayBtn();
    const items = queryAll(".track-item", HTMLElement);
    items.forEach((item) => {
      if (
        item.dataset.url === (state.currentTrack ? state.currentTrack.url : "")
      ) {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    });

    if (state.currentTrack) {
      this.currentTrackTitle.innerText = state.currentTrack.title;
      this.currentTrackArtist.innerText = state.currentTrack.artist;
    } else {
      this.currentTrackTitle.innerText = t("noTrackSelected");
      this.currentTrackArtist.innerText = "-";
    }

    if (state.volume !== undefined) {
      const volPercent = Math.round(state.volume * 100);
      if (Math.abs(Number(this.volumeSlider.value) - volPercent) > 1) {
        this.volumeSlider.value = String(volPercent);
        this.updateVolumeFill();
      } else if (this.volumeSlider.style.background === "") {
        this.updateVolumeFill();
      }
    }
  }

  updateTranslations() {
    if (!this.currentTrackData) {
      if (this.currentTrackTitle)
        this.currentTrackTitle.innerText = t("noTrackSelected");
      if (this.currentTrackArtist) this.currentTrackArtist.innerText = "-";
    }
  }

  initElements() {
    this.minimizeBtn = document.getElementById("minimizeBtn");
    this.fullscreenBtn = document.getElementById("fullscreenBtn");
    this.closeBtn = document.getElementById("closeBtn");

    // typed here: set in a method rather than the constructor, so the checker would add undefined
    /** @type {HTMLInputElement} */
    this.searchInput = byId("searchInput", HTMLInputElement);

    /** @type {HTMLElement} */
    this.resultsList = byId("resultsList", HTMLElement);

    /** @type {HTMLButtonElement} */
    this.playPauseBtn = byId("playPauseBtn", HTMLButtonElement);
    /** @type {HTMLButtonElement} */
    this.prevBtn = byId("prevBtn", HTMLButtonElement);
    /** @type {HTMLButtonElement} */
    this.nextBtn = byId("nextBtn", HTMLButtonElement);
    /** @type {HTMLElement} */
    this.progressBar = byId("progressBar", HTMLElement);
    /** @type {HTMLElement} */
    this.progressFill = byId("progressFill", HTMLElement);
    /** @type {HTMLInputElement} */
    this.volumeSlider = byId("volumeSlider", HTMLInputElement);

    /** @type {HTMLElement} */
    this.currentTrackTitle = byId("currentTrackTitle", HTMLElement);
    /** @type {HTMLElement} */
    this.currentTrackArtist = byId("currentTrackArtist", HTMLElement);
    /** @type {HTMLElement} */
    this.currentTimeEl = byId("currentTime", HTMLElement);
    /** @type {HTMLElement} */
    this.durationEl = byId("duration", HTMLElement);
  }

  initListeners() {
    if (this.fullscreenBtn) {
      this.fullscreenBtn.addEventListener("click", () =>
        screenSizeManager.toggleScreenSize("playlist-container"),
      );
    }

    this.searchInput.addEventListener("input", () => {
      const query = this.searchInput.value.trim();
      this.filterTracks(query);
    });

    this.playPauseBtn.addEventListener("click", () => {
      if (this.isPlaying) {
        ipcRenderer.send("player-command", { type: "pause" });
      } else {
        ipcRenderer.send("player-command", { type: "resume" });
      }
    });

    this.prevBtn.addEventListener("click", () =>
      ipcRenderer.send("player-command", { type: "prev" }),
    );
    this.nextBtn.addEventListener("click", () =>
      ipcRenderer.send("player-command", { type: "next" }),
    );

    this.progressBar.addEventListener("click", (e) => {
      const width = this.progressBar.clientWidth;
      const clickX = e.offsetX;
      const ratio = clickX / width;

      if (this.lastDuration) {
        const seekTime = this.lastDuration * ratio;
        ipcRenderer.send("player-command", { type: "seek", value: seekTime });
      }
    });

    this.volumeSlider.addEventListener("input", () => {
      const vol = Number(this.volumeSlider.value) / 100;
      ipcRenderer.send("player-command", { type: "volume", value: vol });
      this.updateVolumeFill();
    });
  }

  updateTime(currentTime, duration) {
    this.lastDuration = duration;
    this.currentTimeEl.innerText = this.formatTime(Math.round(currentTime));
    this.durationEl.innerText = this.formatTime(Math.round(duration));

    if (duration > 0) {
      this.progressFill.style.width = `${(currentTime / duration) * 100}%`;
    }
  }

  formatTime(seconds) {
    if (Number.isNaN(seconds) || seconds < 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  }

  async playTrack(index) {
    const track = this.tracks[index];
    const globalIndex = this.originalTracks.findIndex(
      (candidate) => candidate.url === track.url,
    );
    if (globalIndex !== -1) {
      ipcRenderer.send("player-command", {
        type: "set-playlist",
        tracks: this.originalTracks,
        startIndex: globalIndex,
      });
      analytics.playlistTrackPlay();
    }
  }

  updatePlayBtn() {
    setHtml(
      this.playPauseBtn,
      this.isPlaying
        ? html`<i class="fas fa-pause" aria-hidden="true"></i>`
        : html`<i class="fas fa-play" aria-hidden="true"></i>`,
    );
  }

  updateVolumeFill() {
    const val = this.volumeSlider.value;
    const percentage = (Number(val) / 100) * 100;
    const isRtl = document.documentElement.dir === "rtl";

    if (isRtl) {
      this.volumeSlider.style.background = `linear-gradient(to left, var(--accent-color) ${percentage}%, rgba(255, 255, 255, 0.1) ${percentage}%)`;
    } else {
      this.volumeSlider.style.background = `linear-gradient(to right, var(--accent-color) ${percentage}%, rgba(255, 255, 255, 0.1) ${percentage}%)`;
    }
  }
}

// Settings, theme, window buttons and tooltips: app/app-shell.js.
function initPlaylistPage() {
  return new PlaylistManager().init();
}

module.exports = { initPlaylistPage };
