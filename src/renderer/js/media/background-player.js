const { ipcRenderer } = require("electron");

class BackgroundPlayer {
  constructor() {
    this.tracks = [];
    this.currentTrackIndex = -1;
    this.currentTrackUrl = null;
    this.sound = null;
    this.isPlaying = false;
    this.stepInterval = null;
    this.listeners = [];

    this.initIPC();
    this.initUI();
    this.initThemeListener();
  }

  static async create() {
    const instance = new BackgroundPlayer();
    await instance.loadLocalTracks();
    return instance;
  }

  initThemeListener() {
    const themeListener = (event, data) => {
      const { theme } = data;
      this.applyTheme(theme);
    };
    ipcRenderer.on("apply-theme", themeListener);
    this.listeners.push({ event: "apply-theme", handler: themeListener });
  }

  applyTheme(theme) {
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

      if (this.ui.closeBtn) {
        this.ui.closeBtn.addEventListener("click", () => {
          ipcRenderer.send("close-mini-player");
        });
      }
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
    this.updateLocalUI();
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

  async loadLocalTracks() {
    this.tracks = [];
    ipcRenderer.send("player-update", { type: "tracks", tracks: this.tracks });
    this.sendState();
  }

  playTrack(index) {
    if (index < 0 || index >= this.tracks.length) return;

    const track = this.tracks[index];

    // Only treat this as "the same track is already loaded" if the index
    // AND the actual track URL match. Comparing index alone is unsafe:
    // setPlaylist() replaces the whole tracks array before calling this,
    // so a brand new track can coincidentally share the same start index
    // as whatever was already playing (e.g. picking a different reciter —
    // both naturally start at index 0), which was being wrongly treated
    // as "nothing to do," silently ignoring the request to switch tracks
    // until the original track finished on its own.
    if (
      this.currentTrackIndex === index &&
      this.sound &&
      this.currentTrackUrl === track.url
    ) {
      if (!this.isPlaying) {
        this.togglePlay(true);
      }
      return;
    }

    if (this.sound) {
      this.sound.unload();
    }

    this.currentTrackIndex = index;
    this.currentTrackUrl = track.url;
    this.isPlaying = true;

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
        // Without this, a track that fails to load left isPlaying stuck
        // at true (set optimistically above, before we knew whether the
        // load would succeed) — the UI would show "playing" forever with
        // nothing actually happening. Reset state and move on instead of
        // getting stuck.
        this.isPlaying = false;
        this.sendState();
        this.playNext();
      },
      onplayerror: (id, err) => {
        console.error("Play error", err);
        this.isPlaying = false;
        this.sendState();
      },
    });

    this.sound.play();
  }

  togglePlay(shouldPlay) {
    if (!this.sound) return;

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
      this.isPlaying = false;
      this.sendState();
    }
  }

  playPrevious() {
    if (this.currentTrackIndex > 0) {
      this.playTrack(this.currentTrackIndex - 1);
    } else {
      this.seek(0);
    }
  }

  seek(value) {
    if (this.sound) {
      this.sound.seek(value);
    }
  }

  startStepLoop() {
    if (this.stepInterval) clearInterval(this.stepInterval);
    this.stepInterval = setInterval(() => {
      this.sendTimeUpdate();
    }, 1000);
  }

  stopStepLoop() {
    if (this.stepInterval) clearInterval(this.stepInterval);
    this.stepInterval = null;
  }

  cleanup() {
    if (this.sound) {
      this.sound.stop();
    }

    this.stopStepLoop();

    for (const { event, handler } of this.listeners) {
      ipcRenderer.removeListener(event, handler);
    }
    this.listeners = [];
  }
}

const player = new BackgroundPlayer();

player.loadLocalTracks().catch((err) => {
  console.error("Erreur lors du chargement initial des pistes:", err);
});

module.exports = { player };
