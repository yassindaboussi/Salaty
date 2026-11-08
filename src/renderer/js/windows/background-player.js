/// <reference types="howler" />
// Howl and Howler are globals from vendor/howler/howler.min.js (a <script> in background-player.html)
"use strict";

require("../core/error-watch"); // first: errors while the page starts are logged too
const { ipcRenderer } = require("electron");
const { setThemeClass } = require("../core/theme");
const { loadSettings } = require("../core/bootstrap");
const { applyTranslations } = require("../core/i18n");
const { initTooltipSystem } = require("../core/tooltips");
const { createPlayerUi } = require("../components/floating-player");

class BackgroundPlayer {
  constructor() {
    this.tracks = [];
    this.currentTrackIndex = -1;
    this.currentTrackUrl = null;
    this.sound = null;
    this.isPlaying = false;
    this.stepInterval = null;
    this.failed = false; // the last track could not be loaded (the page tells the user)
    this.loading = false; // asked to play, the audio not started yet (a radio connecting)

    this.initIPC();
    this.initUI();
    this.initThemeListener();
  }

  initThemeListener() {
    const themeListener = (event, data) => {
      const { theme } = data;
      this.applyTheme(theme);
    };
    ipcRenderer.on("apply-theme", themeListener);
  }

  applyTheme(theme) {
    setThemeClass([document.body], theme);
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
        case "stop":
          this.stop();
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
          this.setPlaylist(arg.tracks, arg.startIndex, arg.autoplay !== false);
          break;
      }
    };
    ipcRenderer.on("player-command", playerCommandListener);
  }

  // autoplay false: the track is loaded paused (the Quran reader switching riwaya while paused)
  setPlaylist(tracks, startIndex = 0, autoplay = true) {
    this.tracks = tracks;
    this.retried = false;
    this.playTrack(startIndex, autoplay);
  }

  initUI() {
    this.ui = createPlayerUi(this); // components/floating-player.js
  }

  sendState() {
    const state = {
      isPlaying: this.isPlaying,
      currentTrackIndex: this.currentTrackIndex,
      trackCount: this.tracks.length,
      currentTrack: this.tracks[this.currentTrackIndex] || null,
      duration: this.sound ? this.sound.duration() : 0,
      currentTime: this.sound ? this.sound.seek() : 0,
      volume: Howler.volume(),
      failed: this.failed,
      loading: this.loading,
    };
    ipcRenderer.send("player-update", { type: "state", state });
    this.updateLocalUI();
  }

  sendTimeUpdate() {
    if (this.sound && this.isPlaying) {
      const seek = this.sound.seek() || 0;
      this.ui?.onTime(seek);
      ipcRenderer.send("player-update", {
        type: "time-update",
        currentTime: seek,
        duration: this.sound.duration(),
      });
    }
  }

  updateLocalUI() {
    this.ui?.render();
  }

  async loadLocalTracks() {
    this.tracks = [];
    ipcRenderer.send("player-update", { type: "tracks", tracks: this.tracks });
    this.sendState();
  }

  playTrack(index, autoplay = true) {
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
    this.isPlaying = autoplay;
    this.failed = false;
    this.loading = autoplay;

    this.sendState();

    this.sound = new Howl({
      src: [track.url],
      html5: true,
      // a radio's URL has no file extension to tell the format by ("/live"): the streams are MP3
      ...(track.live ? { format: ["mp3"] } : {}),
      onplay: () => {
        this.loading = false;
        this.failed = false;
        this.isPlaying = true;
        this.sendState();
        this.startStepLoop();
      },
      onpause: () => {
        this.isPlaying = false;
        this.sendState();
        this.stopStepLoop();
      },
      // a live radio that ends or fails stays on its station (no jump to the next one)
      onend: () => !track.live && this.playNext(),
      onloaderror: (id, err) => {
        console.error("Load error", err);
        // a radio server sometimes drops the first connection: try once more before failing
        if (track.live && !this.retried) {
          this.retried = true;
          this.currentTrackUrl = null;
          setTimeout(() => this.playTrack(index), 1000);
          return;
        }
        // Without this, a track that fails to load left isPlaying stuck
        // at true (set optimistically above, before we knew whether the
        // load would succeed) — the UI would show "playing" forever with
        // nothing actually happening. Reset state and move on instead of
        // getting stuck.
        this.isPlaying = false;
        this.loading = false;
        this.failed = true;
        this.sendState();
        if (!track.live) this.playNext();
      },
      onplayerror: (id, err) => {
        console.error("Play error", err);
        this.isPlaying = false;
        this.loading = false;
        this.sendState();
      },
    });

    if (autoplay) this.sound.play();
    else this.sendState();
  }

  togglePlay(shouldPlay) {
    if (!this.sound) return;

    if (shouldPlay === undefined) {
      shouldPlay = !this.isPlaying;
    }

    const track = this.tracks[this.currentTrackIndex];
    if (shouldPlay && track?.live) {
      // a live stream starts again at "now", not where it was paused
      this.currentTrackUrl = null;
      this.playTrack(this.currentTrackIndex);
    } else if (shouldPlay) {
      this.sound.play();
    } else {
      this.sound.pause();
    }
  }

  // Nothing loaded any more (the radio's stop): the mini players hide.
  stop() {
    if (this.sound) this.sound.unload();
    this.sound = null;
    this.tracks = [];
    this.currentTrackIndex = -1;
    this.currentTrackUrl = null;
    this.isPlaying = false;
    this.loading = false;
    this.stopStepLoop();
    this.sendState();
  }

  playNext() {
    if (this.currentTrackIndex < this.tracks.length - 1) {
      this.playTrack(this.currentTrackIndex + 1);
    } else {
      // the end of the list (or "next" on its last track): the sound stops too, not only
      // the play button
      if (this.sound?.playing()) this.sound.pause();
      this.isPlaying = false;
      this.stopStepLoop();
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
}

const player = new BackgroundPlayer();

player.loadLocalTracks().catch((err) => {
  console.error("Failed to load the initial tracks:", err);
});

// Texts and button tooltips need the saved language first.
loadSettings()
  .then(() => {
    applyTranslations();
    player.updateLocalUI();
  })
  .finally(initTooltipSystem);
