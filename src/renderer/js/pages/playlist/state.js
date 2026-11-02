"use strict";

// What the playlist page shows (shared by its modules): the album opened from the archive, its
// tracks, the search, and what the background player says it is playing.

const state = {
  /** @type {any} the album from localStorage "selectedAlbum" (pages/albums/open-album.js) */
  album: null,
  /** @type {{ title: string, artist: string, url: string, filename?: string }[]} */
  tracks: [],
  query: "",
  /** @type {{ title: string, artist: string, url: string } | null} */
  current: null,
  playing: false,
  duration: 0,
  seeking: false, // the user is dragging the position: the time updates wait
};

module.exports = { state };
