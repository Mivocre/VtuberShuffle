console.log('Vtuber Shuffle loaded');

let songs = [];
let playedSongs = new Set();
let currentSong = null;

function getVideoId(url) {
    const match = url.match(/[?&]v=([^#\&\?]*)/);
    return match ? match[1] : null;
}

function updateEmbed(song) {
    const videoId = getVideoId(song.url);
    if (videoId) {
        document.getElementById('videoEmbed').src = `https://www.youtube.com/embed/${videoId}`;
    }
    updateNowPlaying(song);
    updateProfile(song);
}

function updateNowPlaying(song) {
    const artists = song.artists.map(a => a.name).join(', ');
    const affiliations = [...new Set(song.artists.map(a => a.affiliation).filter(a => a))].join(', ');
    const affiliationText = affiliations ? ` (${affiliations})` : '';
    document.getElementById('now-playing').textContent = `Now playing: ${song.title} by ${artists}${affiliationText}`;
}

function updateProfile(song) {
    const firstArtist = song.artists[0];
    document.getElementById('artist-name').textContent = firstArtist ? firstArtist.name : '';
    document.getElementById('artist-affiliation').textContent = firstArtist ? firstArtist.affiliation || '' : '';
}

function addToHistory(song) {
    const historyList = document.getElementById('history-list');
    const li = document.createElement('li');
    const artists = song.artists.map(a => a.name).join(', ');
    const affiliations = [...new Set(song.artists.map(a => a.affiliation).filter(a => a))].join(', ');
    const affiliationText = affiliations ? ` (${affiliations})` : '';
    li.textContent = `${song.title} by ${artists}${affiliationText}`;
    li.style.cursor = 'pointer';
    li.dataset.songId = song.id;
    li.addEventListener('click', function() {
        const songId = parseInt(this.dataset.songId);
        const selectedSong = songs.find(s => s.id === songId);
        if (selectedSong) {
            currentSong = selectedSong;
            updateEmbed(selectedSong);
        }
    });
    historyList.appendChild(li);
}

function pickRandomSong() {
    const availableSongs = songs.filter(song => !playedSongs.has(song.id));
    if (availableSongs.length === 0) {
        // Reset if all played
        playedSongs.clear();
        return songs[Math.floor(Math.random() * songs.length)];
    }
    return availableSongs[Math.floor(Math.random() * availableSongs.length)];
}

async function loadSongs() {
    try {
        const response = await fetch('/api/songs');
        songs = await response.json();
        if (songs.length > 0) {
            currentSong = pickRandomSong();
            playedSongs.add(currentSong.id);
            updateEmbed(currentSong);
        }
    } catch (error) {
        console.error('Error loading songs:', error);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    loadSongs();

    document.getElementById('skip-button').addEventListener('click', function() {
        if (currentSong) {
            addToHistory(currentSong);
        }
        const nextSong = pickRandomSong();
        if (nextSong) {
            currentSong = nextSong;
            playedSongs.add(currentSong.id);
            updateEmbed(currentSong);
        }
    });
});