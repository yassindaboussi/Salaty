const { ipcRenderer } = require("electron");
const screenSizeManager = require("../../js/core/screenSize");
const mp3quranApi = require("../../js/services/api/mp3quranApi");
const {
  setLanguage,
  t,
  getLanguage,
  whenReady,
} = require("../../js/core/i18n/translations");
const analytics = require("../../js/utils/analytics");

const MP3QURAN_LANG = { en: "eng", ar: "ar", fr: "fr" };
function mp3quranLang() {
  return MP3QURAN_LANG[getLanguage()] || "eng";
}

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
    await this.loadSettings();
    await this.initScreenSize();
    await this.initTheme();
    this.updateTranslations();

    document.body.classList.remove("page-loading");

    ipcRenderer.send("player-command", { type: "get-state" });

    await this.loadCurrentAlbum();

    return this;
  }

  async loadCurrentAlbum() {
    const storedAlbum = localStorage.getItem("selectedAlbum");
    if (storedAlbum) {
      try {
        const album = JSON.parse(storedAlbum);
        document.querySelector(".playlist-title").innerText = getLocalized(
          album.title,
        );
        await this.loadTracks(album);
      } catch (e) {
        console.error("Error parsing stored album", e);
        this.resultsList.innerHTML = `<div class="error"><p>${t("errorLoadingAlbums")}</p></div>`;
      }
    } else {
      this.resultsList.innerHTML = `<div class="empty-state"><p>${t("noAlbumSelected")}</p></div>`;
    }
  }

  async loadTracks(album) {
    this.resultsList.innerHTML = `<div class="loading"><i class="fas fa-spinner"></i>${t("loadingTracks")}</div>`;
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
      analytics.error(
        "playlist_load_tracks",
        error.message || String(error),
      );
      let errorMsg = t("errorLoadingTracks");
      if (errorMsg.includes("{album}")) {
        errorMsg = errorMsg.replace(
          "{album}",
          getLocalized(album.title) || album.id,
        );
      } else {
        errorMsg += ` ${getLocalized(album.title) || album.id}`;
      }
      this.resultsList.innerHTML = `<div class="error"><i class="fas fa-exclamation-circle"></i>${errorMsg}</div>`;
    }
  }

  filterTracks(query) {
    if (query) {
      const lowerQuery = query.toLowerCase();
      this.tracks = this.originalTracks.filter(
        (t) =>
          t.title.toLowerCase().includes(lowerQuery) ||
          t.artist.toLowerCase().includes(lowerQuery),
      );
    } else {
      this.tracks = [...this.originalTracks];
    }
    this.displayTracks();
  }

  displayTracks() {
    this.resultsList.innerHTML = "";
    if (this.tracks.length === 0) {
      this.resultsList.innerHTML = `<div class="empty-state"><p>${t("noTracksFound")}</p></div>`;
      return;
    }

    const container = document.createElement("div");
    this.tracks.forEach((track, index) => {
      const el = document.createElement("div");
      el.className = "track-item";
      el.dataset.url = track.url;

      if (this.currentTrackData && this.currentTrackData.url === track.url) {
        el.classList.add("active");
      }

      el.innerHTML = `
            <div class="track-info">
                <span class="track-title">${track.title}</span>
                <span class="track-meta">${track.artist}</span>
            </div>
            <i class="fas fa-play-circle start-track-btn"></i>
            `;

      el.addEventListener("click", () => this.playTrack(index));
      container.appendChild(el);
    });
    this.resultsList.appendChild(container);
  }

  async loadSettings() {
    try {
      const settings = await ipcRenderer.invoke("get-settings");
      if (settings) {
        const { state } = require("../../js/core/globalStore");
        state.settings = { ...state.settings, ...settings };

        if (settings.language) {
          setLanguage(settings.language);
        }
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  }

  async initScreenSize() {
    const useBigScreen = await screenSizeManager.applyScreenSize();
    if (useBigScreen) {
      document.body.dataset.screenSize = "big";
      document.body.classList.add("big-screen");
      document
        .querySelector(".playlist-container")
        ?.classList.add("big-screen");
    } else {
      document.body.dataset.screenSize = "small";
      document.body.classList.add("small-screen");
      document
        .querySelector(".playlist-container")
        ?.classList.add("small-screen");
    }
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
    const items = document.querySelectorAll(".track-item");
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
      if (Math.abs(this.volumeSlider.value - volPercent) > 1) {
        this.volumeSlider.value = volPercent;
        this.updateVolumeFill();
      } else if (this.volumeSlider.style.background === "") {
        this.updateVolumeFill();
      }
    }
  }

  updateTranslations() {
    const searchInput = document.getElementById("searchInput");
    if (searchInput) searchInput.placeholder = t("searchInPlaylist");

    const backBtn = document.getElementById("backBtn");
    if (backBtn) backBtn.setAttribute("aria-label", t("back"));

    if (!this.currentTrackData) {
      if (this.currentTrackTitle)
        this.currentTrackTitle.innerText = t("noTrackSelected");
      if (this.currentTrackArtist) this.currentTrackArtist.innerText = "-";
    }
  }

  async initTheme() {
    try {
      const settings = await ipcRenderer.invoke("get-settings");
      if (settings?.theme) {
        const app = document.getElementById("app");
        const classes = app.className
          .split(" ")
          .filter((c) => !c.startsWith("theme-"));
        app.className = classes.join(" ") + ` theme-${settings.theme}`;
      }
    } catch (err) {
      console.error("Failed to load theme:", err);
      document.getElementById("app").classList.add("theme-navy");
    }
  }

  initElements() {
    this.minimizeBtn = document.getElementById("minimizeBtn");
    this.fullscreenBtn = document.getElementById("fullscreenBtn");
    this.closeBtn = document.getElementById("closeBtn");

    this.searchInput = document.getElementById("searchInput");

    this.resultsList = document.getElementById("resultsList");

    this.playPauseBtn = document.getElementById("playPauseBtn");
    this.prevBtn = document.getElementById("prevBtn");
    this.nextBtn = document.getElementById("nextBtn");
    this.progressBar = document.getElementById("progressBar");
    this.progressFill = document.getElementById("progressFill");
    this.volumeSlider = document.getElementById("volumeSlider");

    this.currentTrackTitle = document.getElementById("currentTrackTitle");
    this.currentTrackArtist = document.getElementById("currentTrackArtist");
    this.currentTimeEl = document.getElementById("currentTime");
    this.durationEl = document.getElementById("duration");

    this.backBtn = document.getElementById("backBtn");

    this.updateScreenSizeButton();
  }

  initListeners() {
    this.minimizeBtn.addEventListener("click", async () => {
      await ipcRenderer.invoke("minimize-window");
    });

    if (this.closeBtn) {
      this.closeBtn.addEventListener("click", async () => {
        await ipcRenderer.invoke("close-window");
      });
    }

    if (this.fullscreenBtn) {
      this.fullscreenBtn.addEventListener("click", () =>
        this.toggleScreenSize(),
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

    this.volumeSlider.addEventListener("input", (e) => {
      const vol = e.target.value / 100;
      ipcRenderer.send("player-command", { type: "volume", value: vol });
      this.updateVolumeFill();
    });

    this.backBtn.addEventListener("click", () => {
      ipcRenderer.invoke("navigate-to", "albums");
    });
  }

  updateScreenSizeButton() {
    if (!this.fullscreenBtn) return;

    const isBigScreen = document.body.dataset.screenSize === "big";
    const icon = this.fullscreenBtn.querySelector("i");
    if (isBigScreen) {
      this.fullscreenBtn.setAttribute("aria-label", "Switch to Small Screen");
      if (icon) {
        icon.className = "fas fa-compress";
      }
    } else {
      this.fullscreenBtn.setAttribute("aria-label", "Switch to Big Screen");
      if (icon) {
        icon.className = "fas fa-expand";
      }
    }
  }

  toggleScreenSize() {
    const isCurrentlyBig = document.body.dataset.screenSize === "big";
    if (isCurrentlyBig) {
      ipcRenderer.invoke("resize-window", 320, 575);
      document.body.dataset.screenSize = "small";
      document.body.classList.remove("big-screen");
      document.body.classList.add("small-screen");
      document
        .querySelector(".playlist-container")
        ?.classList.remove("big-screen");
      document
        .querySelector(".playlist-container")
        ?.classList.add("small-screen");
    } else {
      ipcRenderer.invoke("resize-window", 850, 600);
      document.body.dataset.screenSize = "big";
      document.body.classList.remove("small-screen");
      document.body.classList.add("big-screen");
      document
        .querySelector(".playlist-container")
        ?.classList.remove("small-screen");
      document
        .querySelector(".playlist-container")
        ?.classList.add("big-screen");
    }

    this.updateScreenSizeButton();
  }

  updateTime(currentTime, duration) {
    this.lastDuration = duration;
    this.currentTimeEl.innerText = this.formatTime(Math.round(currentTime));
    this.durationEl.innerText = this.formatTime(Math.round(duration));

    if (duration > 0) {
      this.progressFill.style.width = (currentTime / duration) * 100 + "%";
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
      (t) => t.url === track.url,
    );
    if (globalIndex !== -1) {
      ipcRenderer.send("player-command", {
        type: "set-playlist",
        tracks: this.originalTracks,
        startIndex: globalIndex,
      });

      const storedAlbum = localStorage.getItem("selectedAlbum");
      let albumName = "";
      try {
        albumName = storedAlbum
          ? getLocalized(JSON.parse(storedAlbum).title)
          : "";
      } catch {
      }
      analytics.playlistTrackPlay(albumName);
    }
  }

  updatePlayBtn() {
    this.playPauseBtn.innerHTML = this.isPlaying
      ? '<i class="fas fa-pause"></i>'
      : '<i class="fas fa-play"></i>';
  }

  updateVolumeFill() {
    const val = this.volumeSlider.value;
    const percentage = (val / 100) * 100;
    const isRtl = document.documentElement.dir === "rtl";

    if (isRtl) {
      this.volumeSlider.style.background = `linear-gradient(to left, var(--accent-color) ${percentage}%, rgba(255, 255, 255, 0.1) ${percentage}%)`;
    } else {
      this.volumeSlider.style.background = `linear-gradient(to right, var(--accent-color) ${percentage}%, rgba(255, 255, 255, 0.1) ${percentage}%)`;
    }
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await whenReady();
  const playlistManager = new PlaylistManager();
  try {
    await playlistManager.init();
  } catch (err) {
    console.error("[Playlist] init error:", err);
  } finally {
    document.body.classList.remove("page-loading");
  }
});
