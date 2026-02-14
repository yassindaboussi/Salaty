const { ipcRenderer } = require('electron');

function setupMiniPlayer() {
    // Check if we are already on playlist page, if so we might skip mini player OR adapt it
    const path = globalThis.location.pathname;
    if (path.includes('playlist.html')) return; // Playlist page handles UI itself

    // Inject HTML
    const miniPlayerHTML = `
        <div id="miniPlayer" class="mini-player hidden">
            <div class="mini-track-info">
                <span id="miniTrackTitle" class="mini-track-title">-</span>
                <span id="miniTrackArtist" class="mini-track-artist">-</span>
            </div>
            <div class="mini-controls">
                <button id="miniPrevBtn" class="mini-btn"><i class="fas fa-step-backward"></i></button>
                <button id="miniPlayBtn" class="mini-btn mini-play-btn"><i class="fas fa-play"></i></button>
                <button id="miniNextBtn" class="mini-btn"><i class="fas fa-step-forward"></i></button>
                <button id="miniPlaylistBtn" class="mini-btn" title="Open Playlist"><i class="fas fa-list"></i></button>
            </div>
        </div>
    `;

    // Inject into body
    let container = document.getElementById('app');
    if (!container) container = document.body;

    // Create temp container to parse string
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = miniPlayerHTML.trim();
    const miniPlayerNode = tempDiv.firstChild;
    container.appendChild(miniPlayerNode);

    // Get Refs
    const miniPlayer = document.getElementById('miniPlayer');
    const titleEl = document.getElementById('miniTrackTitle');
    const artistEl = document.getElementById('miniTrackArtist');
    const playBtn = document.getElementById('miniPlayBtn');
    const prevBtn = document.getElementById('miniPrevBtn');
    const nextBtn = document.getElementById('miniNextBtn');
    const playlistBtn = document.getElementById('miniPlaylistBtn');

    if (!miniPlayer) return;

    let pauseFromMiniPlayer = false;
    // Listeners for Buttons -> IPC
    playBtn.addEventListener('click', () => {
         // We toggle based on icon state or let main logic handle toggle
         if (playBtn.querySelector('.fa-pause')) {
             pauseFromMiniPlayer = true;
             ipcRenderer.send('player-command', { type: 'pause' });
         } else {
             ipcRenderer.send('player-command', { type: 'resume' });
         }
    });

    prevBtn.addEventListener('click', () => ipcRenderer.send('player-command', { type: 'prev' }));
    nextBtn.addEventListener('click', () => ipcRenderer.send('player-command', { type: 'next' }));

    playlistBtn.addEventListener('click', async () => {
        ipcRenderer.invoke('resize-window', 850, 600);
        ipcRenderer.invoke('navigate-to', 'playlist');
    });

    // Listener for State Updates
    ipcRenderer.on('player-update', (event, arg) => {
        if (arg.type === 'state') {
            const state = arg.state;
            if (state.currentTrack && (state.isPlaying || pauseFromMiniPlayer)) {
                miniPlayer.classList.remove('hidden');
                titleEl.innerText = state.currentTrack.title;
                artistEl.innerText = state.currentTrack.artist;
                if (state.isPlaying) {
                    playBtn.innerHTML = '<i class="fas fa-pause"></i>';
                    pauseFromMiniPlayer = false; // Reset si lecture
                } else {
                    playBtn.innerHTML = '<i class="fas fa-play"></i>';
                }
            } else {
                miniPlayer.classList.add('hidden');
                pauseFromMiniPlayer = false; // Reset si masqué
            }
        }
    });

    // Request initial state to see if something is playing
    ipcRenderer.send('player-command', { type: 'get-state' });
}

module.exports = { setupMiniPlayer };