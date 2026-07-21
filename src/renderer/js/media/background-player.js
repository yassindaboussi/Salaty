const { ipcRenderer } = require("electron");

class BackgroundPlayer {
  constructor() {
    this.tracks = []; // { title, artist, url, filename }
    this.currentTrackIndex = -1;
    this.sound = null;
    this.isPlaying = false;
    this.stepInterval = null;
    this.listeners = []; // Track event listeners for cleanup

    this.initIPC();
    this.initUI();
    this.initThemeListener();
  }

  // Static method to handle the async creation
  static async create() {
    const instance = new BackgroundPlayer();
    await instance.loadLocalTracks(); // Wait for tracks to load
    return instance;
  }

  initThemeListener() {
    // Listen for theme changes from main process
    const themeListener = (event, data) => {
      const { theme } = data;
      this.applyTheme(theme);
    };
    ipcRenderer.on("apply-theme", themeListener);
    this.listeners.push({ event: "apply-theme", handler: themeListener });
  }

  applyTheme(theme) {
    // Apply theme CSS class to player UI body
    const body = document.body;
    if (body) {
      body.className = `theme-${theme}`;
    }
  }

  initIPC() {
    const playerCommandListener = (event, arg) => {
      switch (arg.type) {
        case "play":
          this.playTrack(arg.index);
          break;
        case "pause":
          this.togglePlay(false);
          break;
        case "resume":
          this.togglePlay(true);
          break;
        case "next":
          this.playNext();
          break;
        case "prev":
          this.playPrevious();
          break;
        case "seek":
          this.seek(arg.value);
          break;
        case "volume":
          Howler.volume(arg.value);
          break;
        case "get-state":
          this.sendState();
          break;
        case "set-playlist":
          this.setPlaylist(arg.tracks, arg.startIndex);
          break;
        case "refresh-tracks":
          this.loadLocalTracks();
          break;
      }
    };
    ipcRenderer.on("player-command", playerCommandListener);
    this.listeners.push({
      event: "player-command",
      handler: playerCommandListener,
    });
  }

  setPlaylist(tracks, startIndex = 0) {
    this.tracks = tracks;
    this.playTrack(startIndex);
  }

  initUI() {
    this.ui = {
      title: document.getElementById("title"),
      artist: document.getElementById("artist"),
      playBtn: document.getElementById("playBtn"),
      prevBtn: document.getElementById("prevBtn"),
      nextBtn: document.getElementById("nextBtn"),
      closeBtn: document.getElementById("closeBtn"),
      playlistBtn: document.getElementById("miniPlaylistBtn"),
    };

    if (this.ui.playBtn) {
      this.ui.playBtn.addEventListener("click", () => this.togglePlay());
      this.ui.prevBtn.addEventListener("click", () => this.playPrevious());
      this.ui.nextBtn.addEventListener("click", () => this.playNext());

      // Logic for close button to hide mini player
      if (this.ui.closeBtn) {
        this.ui.closeBtn.addEventListener("click", () => {
          ipcRenderer.send("close-mini-player");
        });
      }
      // Ajout du gestionnaire pour le bouton miniPlaylistBtn
      if (this.ui.playlistBtn) {
        this.ui.playlistBtn.addEventListener("click", () => {
          ipcRenderer.send("show-main-window");
        });
      }
    }
  }

  sendState() {
    const state = {
      isPlaying: this.isPlaying,
      currentTrackIndex: this.currentTrackIndex,
      currentTrack: this.tracks[this.currentTrackIndex] || null,
      duration: this.sound ? this.sound.duration() : 0,
      currentTime: this.sound ? this.sound.seek() : 0,
      volume: Howler.volume(),
    };
    ipcRenderer.send("player-update", { type: "state", state: state });
    this.updateLocalUI(); // Update UI
  }

  sendTimeUpdate() {
    if (this.sound && this.isPlaying) {
      const seek = this.sound.seek() || 0;
      ipcRenderer.send("player-update", {
        type: "time-update",
        currentTime: seek,
        duration: this.sound.duration(),
      });
    }
  }

  updateLocalUI() {
    if (!this.ui || !this.ui.title) return;

    if (this.currentTrackIndex !== -1 && this.tracks[this.currentTrackIndex]) {
      const track = this.tracks[this.currentTrackIndex];
      this.ui.title.innerText = track.title;
      this.ui.artist.innerText = track.artist;
    } else {
      this.ui.title.innerText = "Salaty Player";
      this.ui.artist.innerText = "Waiting for track...";
    }

    if (this.isPlaying) {
      this.ui.playBtn.innerHTML = '<i class="fas fa-pause"></i>';
    } else {
      this.ui.playBtn.innerHTML = '<i class="fas fa-play"></i>';
    }
  }

  /**
   * Initializes an empty playlist. The real track list always arrives via
   * the "set-playlist" player-command once the user picks a reciter in the
   * Audio Archive — this just puts the player in a clean "idle" state
   * instead of eagerly fetching a hardcoded demo album on every startup.
   */
  async loadLocalTracks() {
    this.tracks = [];
    ipcRenderer.send("player-update", { type: "tracks", tracks: this.tracks });
    this.sendState();
  }

  playTrack(index) {
    if (index < 0 || index >= this.tracks.length) return;

    // Check if we are already playing this exact track
    const track = this.tracks[index];

    // If it's the current track, just resume/toggle instead of re-loading
    if (this.currentTrackIndex === index && this.sound) {
      if (!this.isPlaying) {
        this.togglePlay(true);
      }
      return;
    }

    if (this.sound) {
      this.sound.unload();
    }

    this.currentTrackIndex = index;
    this.isPlaying = true; // Optimistic

    // Notify UI immediately
    this.sendState();

    this.sound = new Howl({
      src: [track.url],
      html5: true,
      onplay: () => {
        this.isPlaying = true;
        this.sendState();
        this.startStepLoop();
      },
      onpause: () => {
        this.isPlaying = false;
        this.sendState();
        this.stopStepLoop();
      },
      onend: () => {
        this.playNext();
      },
      onloaderror: (id, err) => {
        console.error("Load error", err);
      },
    });

    this.sound.play();
  }

  togglePlay(shouldPlay) {
    if (!this.sound) return;

    // If shouldPlay is undefined, toggle
    if (shouldPlay === undefined) {
      shouldPlay = !this.isPlaying;
    }

    if (shouldPlay) {
      this.sound.play();
    } else {
      this.sound.pause();
    }
  }

  playNext() {
    if (this.currentTrackIndex < this.tracks.length - 1) {
      this.playTrack(this.currentTrackIndex + 1);
    } else {
      // Loop or stop? Stop for now
      this.isPlaying = false;
      this.sendState();
    }
  }

  playPrevious() {
    if (this.currentTrackIndex > 0) {
      this.playTrack(this.currentTrackIndex - 1);
    } else {
      // Replay current if at start
      this.seek(0);
    }
  }

  seek(value) {
    // 0 to 1 position or seconds? Actually UI sends seconds?
    // Let's assume input is 0-100 percentage.
    // Or usually it is simpler to send seconds or percentage.
    // Let's assume the UI logic calculates seconds.
    if (this.sound) {
      this.sound.seek(value);
    }
  }

  startStepLoop() {
    if (this.stepInterval) clearInterval(this.stepInterval);
    this.stepInterval = setInterval(() => {
      this.sendTimeUpdate();
    }, 1000); // 1Hz update is enough for IPC
  }

  stopStepLoop() {
    if (this.stepInterval) clearInterval(this.stepInterval);
    this.stepInterval = null;
  }

  cleanup() {
    // Stop playing
    if (this.sound) {
      this.sound.stop();
    }

    // Clear intervals
    this.stopStepLoop();

    // Remove all event listeners
    for (const { event, handler } of this.listeners) {
      ipcRenderer.removeListener(event, handler);
    }
    this.listeners = [];
  }
}

/**
 * Initialisation du lecteur
 */
const player = new BackgroundPlayer();

// On lance l'initialisation asynchrone (chargement des pistes)
// sans bloquer l'export de l'objet lui-même.
player.loadLocalTracks().catch((err) => {
  console.error("Erreur lors du chargement initial des pistes:", err);
});

module.exports = { player };
