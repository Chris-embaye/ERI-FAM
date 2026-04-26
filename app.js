/* ================================================================
   ERI-FAM — Main App  (ES Module)
   ================================================================ */
'use strict';

// ── Firebase dynamic import ────────────────────────────────────
let db, storage, auth;
const FB_READY = (async () => {
  if (typeof FIREBASE_CONFIG === 'undefined' || FIREBASE_CONFIG.apiKey === 'YOUR_API_KEY') return false;
  try {
    const { initializeApp }           = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
    const { getFirestore, collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, updateDoc, getDocs }
                                       = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const { getStorage, ref, getDownloadURL, uploadBytesResumable, deleteObject }
                                       = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js');
    const { getAuth, signInWithEmailAndPassword, signOut }
                                       = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
    const app = initializeApp(FIREBASE_CONFIG);
    db      = { getFirestore: () => getFirestore(app), collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, updateDoc, getDocs, _db: getFirestore(app) };
    storage = { getStorage: () => getStorage(app), ref, getDownloadURL, uploadBytesResumable, deleteObject, _st: getStorage(app) };
    auth    = { _auth: getAuth(app), signInWithEmailAndPassword, signOut };
    return true;
  } catch (e) { console.warn('[Firebase] Load failed:', e); return false; }
})();

// ── State ──────────────────────────────────────────────────────
const S = {
  tracks: [],          // all local tracks
  cloudTracks: [],     // from Firebase
  queue: [],
  queueIndex: 0,
  playing: false,
  shuffle: false,
  repeat: 'off',       // 'off' | 'one' | 'all'
  volume: 0.8,
  currentTrack: null,
  filter: 'all',
  viewMode: 'grid',    // 'grid' | 'list'
  sleepTimer: null,
  crossfade: 0,
  normalize: false,
  gapless: true,
  likedIds: new Set(),
  shuffleQueue: [],    // pre-shuffled play order
  shuffleIndex: 0,
};

// ── Audio ──────────────────────────────────────────────────────
const audio = new Audio();
audio.volume = S.volume;
audio.preload = 'metadata';

let audioCtx, gainNode, analyserNode, eqBands = [];
let pendingEqRestore = null; // EQ band values to apply once AudioContext is ready
let eqSaveTimer;
const EQ_FREQS = [60, 170, 310, 600, 1000, 3000, 6000,12000, 14000, 16000];
const EQ_PRESETS = {
  flat:       [0,0,0,0,0,0,0,0,0,0],
  bass:       [6,5,4,2,0,0,0,0,0,0],
  treble:     [0,0,0,0,0,2,3,4,5,6],
  vocal:      [-2,-2,0,2,4,4,2,0,-2,-2],
  electronic: [4,3,0,-1,0,0,1,2,3,4],
};

function initAudioCtx() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  gainNode = audioCtx.createGain();
  gainNode.gain.value = 1;
  let prev = audioCtx.createMediaElementSource(audio);
  EQ_FREQS.forEach(freq => {
    const f = audioCtx.createBiquadFilter();
    f.type = 'peaking';
    f.frequency.value = freq;
    f.Q.value = 1;
    f.gain.value = 0;
    prev.connect(f);
    prev = f;
    eqBands.push(f);
  });
  analyserNode = audioCtx.createAnalyser();
  analyserNode.fftSize = 128;
  prev.connect(gainNode);
  gainNode.connect(analyserNode);
  analyserNode.connect(audioCtx.destination);
}

// ── IndexedDB ──────────────────────────────────────────────────
const DB_NAME = 'erifam', DB_VER = 2;
let idb;

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => {
      const d  = e.target.result;
      const tx = e.target.transaction;
      if (!d.objectStoreNames.contains('tracks')) {
        const ts = d.createObjectStore('tracks', { keyPath: 'id' });
        ts.createIndex('title', 'title'); ts.createIndex('artist', 'artist');
      }
      if (!d.objectStoreNames.contains('playlists')) d.createObjectStore('playlists', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('settings'))  d.createObjectStore('settings',  { keyPath: 'key' });
      // v2: audio bytes live in a separate store so loading track metadata
      // never forces the browser to deserialize every MP3 in the library.
      if (!d.objectStoreNames.contains('trackData')) {
        d.createObjectStore('trackData', { keyPath: 'id' });
        if (e.oldVersion >= 1) {
          const tracksStore = tx.objectStore('tracks');
          const dataStore   = tx.objectStore('trackData');
          tracksStore.openCursor().onsuccess = evt => {
            const cursor = evt.target.result;
            if (!cursor) return;
            const rec = cursor.value;
            if (rec.data) {
              dataStore.put({ id: rec.id, data: rec.data });
              delete rec.data;
              cursor.update(rec);
            }
            cursor.continue();
          };
        }
      }
    };
    req.onsuccess = e => { idb = e.target.result; resolve(idb); };
    req.onerror   = () => reject(req.error);
  });
}

function idbGet(store, key) {
  return new Promise((res, rej) => {
    const tx = idb.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}
function idbGetAll(store) {
  return new Promise((res, rej) => {
    const tx = idb.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}
function idbPut(store, val) {
  return new Promise((res, rej) => {
    const tx = idb.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(val);
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}
function idbDelete(store, key) {
  return new Promise((res, rej) => {
    const tx = idb.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => res();
    req.onerror   = () => rej(req.error);
  });
}

// ── Helpers ────────────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function fmtTime(s) { if (!s || isNaN(s)) return '0:00'; return Math.floor(s/60)+':'+Math.floor(s%60).toString().padStart(2,'0'); }
function fmtSize(b) { if (b < 1e6) return (b/1e3).toFixed(0)+' KB'; return (b/1e6).toFixed(1)+' MB'; }

let toastTimer;
function toast(msg, dur=2400) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), dur);
}

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function openPanel(id) { document.getElementById(id).classList.add('open'); }
function closePanel(id) { document.getElementById(id).classList.remove('open'); }

// ── Persistence helpers ────────────────────────────────────────
async function saveSettings() {
  const eqVals = eqBands.length ? eqBands.map(b => b.gain.value) : (pendingEqRestore || []);
  await Promise.all([
    idbPut('settings', { key: 'volume',    value: S.volume }),
    idbPut('settings', { key: 'shuffle',   value: S.shuffle }),
    idbPut('settings', { key: 'repeat',    value: S.repeat }),
    idbPut('settings', { key: 'crossfade', value: S.crossfade }),
    idbPut('settings', { key: 'normalize', value: S.normalize }),
    idbPut('settings', { key: 'gapless',   value: S.gapless }),
    idbPut('settings', { key: 'eqValues',  value: eqVals }),
  ]).catch(() => {});
}

function savePlaybackState() {
  if (!S.currentTrack) return;
  localStorage.setItem('erifam_last_track', S.currentTrack.id);
  localStorage.setItem('erifam_last_pos',   audio.currentTime.toFixed(2));
}

// ── Read file metadata ─────────────────────────────────────────
// Uses seek-to-end so the browser scans the full file — fixes VBR MP3 duration overestimates.
async function readTrackMeta(file) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    a.preload = 'metadata';

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      const dur = isFinite(a.duration) && a.duration > 0 ? a.duration : 0;
      URL.revokeObjectURL(url);
      resolve({ duration: dur });
    };

    a.addEventListener('loadedmetadata', () => {
      try { a.currentTime = 1e10; } catch(e) { finish(); }
    }, { once: true });

    a.addEventListener('seeked', finish, { once: true });
    a.addEventListener('error', finish);
    setTimeout(finish, 5000);
    a.src = url;
  });
}

// ── Import tracks from files ───────────────────────────────────
async function importFiles(files) {
  const arr = Array.from(files);
  if (!arr.length) return;
  toast(`⏳ Adding ${arr.length} track${arr.length>1?'s':''}…`);

  let added = 0;
  for (const file of arr) {
    if (!file.type.match(/audio/)) continue;
    const { duration } = await readTrackMeta(file);
    const buf = await file.arrayBuffer();
    const hashKey = file.name.toLowerCase().trim() + '_' + Math.round(duration);

    const existing = S.tracks.find(t => t.hashKey === hashKey);
    if (existing) continue;

    // Smart metadata extraction from filename
    const { title, artist } = parseFilename(file.name);

    const mimeType = file.type || 'audio/mpeg';
    const id = uid();
    const track = {
      id, title, artist,
      album: '', duration, size: file.size,
      addedAt: Date.now(), playCount: 0, liked: false,
      type: 'local', hashKey, mimeType,
    };
    await idbPut('tracks', track);
    await idbPut('trackData', { id, data: buf });
    track._blobUrl = URL.createObjectURL(new Blob([buf], { type: mimeType }));
    S.tracks.push(track);
    added++;
  }

  if (added > 0) {
    toast(`✅ Added ${added} track${added>1?'s':''}`);
    renderTracks();
    updateStats();
  } else {
    toast('⚠ No new tracks (duplicates skipped)');
  }
}

// ── Load local tracks from IDB ─────────────────────────────────
async function loadLocalTracks() {
  const rows = await idbGetAll('tracks');
  S.tracks = rows.map(t => ({ ...t, _blobUrl: null }));
  renderTracks();
  if (activeLibTab === 'songs')   renderSongs();
  if (activeLibTab === 'artists') renderArtists();
  if (activeLibTab === 'albums')  renderAlbums();
  updateStats();
}

// ── Get blob URL for a local track ────────────────────────────
async function getBlobUrl(track) {
  if (track._blobUrl) return track._blobUrl;
  const stored = await idbGet('trackData', track.id);
  if (stored?.data) {
    track._blobUrl = URL.createObjectURL(new Blob([stored.data], { type: track.mimeType || 'audio/mpeg' }));
    return track._blobUrl;
  }
  return null;
}

// ── Play a track ───────────────────────────────────────────────
async function playTrack(track, queueTracks) {
  if (!track) return;

  // Resume AudioContext if EQ/Visualizer was opened previously.
  if (audioCtx && audioCtx.state !== 'running') await audioCtx.resume().catch(() => {});

  S.currentTrack = track;
  if (queueTracks) {
    S.queue = queueTracks;
    S.queueIndex = queueTracks.indexOf(track);
    if (S.shuffle) buildShuffleQueue(track);
  }

  let src = track.type === 'cloud' ? track.url : await getBlobUrl(track);
  if (!src) { toast('⚠ Could not load track'); return; }

  audio.src = src;
  audio.volume = S.volume;
  try {
    await audio.play();
    S.playing = true;
  } catch(e) {
    console.warn(e);
    if (e.name === 'NotAllowedError') toast('⚠ Tap the track again to play');
    else if (e.name !== 'AbortError') toast('⚠ Could not play — ' + (e.message || e.name));
  }

  track.playCount = (track.playCount || 0) + 1;
  if (track.type === 'local') { const { _blobUrl, data, ...meta } = track; idbPut('tracks', meta); }

  updatePlayerUI();
  updateMediaSession();
  renderTracks();
  showMiniPlayer();
  updateQueueUI();

  // Mark recent
  const recent = JSON.parse(localStorage.getItem('erifam_recent') || '[]');
  const filtered = recent.filter(id => id !== track.id);
  filtered.unshift(track.id);
  localStorage.setItem('erifam_recent', JSON.stringify(filtered.slice(0, 20)));
}

function togglePlay() {
  if (!S.currentTrack) return;
  if (audio.paused) { audio.play(); S.playing = true; }
  else { audio.pause(); S.playing = false; }
  updatePlayerUI();
}

// Fisher-Yates shuffle of the queue, current track always plays first
function buildShuffleQueue(currentTrack) {
  const rest = S.queue.filter(t => t !== currentTrack);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  S.shuffleQueue  = currentTrack ? [currentTrack, ...rest] : rest;
  S.shuffleIndex  = 0;
}

function prevTrack() {
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  if (S.shuffle) {
    S.shuffleIndex = Math.max(0, S.shuffleIndex - 1);
    const track = S.shuffleQueue[S.shuffleIndex];
    S.queueIndex = S.queue.indexOf(track);
    playTrack(track);
    return;
  }
  let idx = S.queueIndex - 1;
  if (idx < 0) idx = S.repeat === 'all' ? S.queue.length - 1 : 0;
  S.queueIndex = idx;
  playTrack(S.queue[idx]);
}

function nextTrack() {
  if (S.shuffle) {
    S.shuffleIndex++;
    if (S.shuffleIndex >= S.shuffleQueue.length) {
      // All songs played — reshuffle and loop
      buildShuffleQueue(null);
    }
    const track = S.shuffleQueue[S.shuffleIndex] || S.shuffleQueue[0];
    S.shuffleIndex = S.shuffleQueue.indexOf(track);
    S.queueIndex   = S.queue.indexOf(track);
    playTrack(track);
    return;
  }
  let idx = S.queueIndex + 1;
  if (idx >= S.queue.length) {
    if (S.repeat === 'all') idx = 0;
    else { audio.pause(); S.playing = false; updatePlayerUI(); return; }
  }
  S.queueIndex = idx;
  playTrack(S.queue[idx]);
}

audio.addEventListener('ended', () => {
  if (S.repeat === 'one') { audio.currentTime = 0; audio.play(); return; }
  nextTrack();
});

audio.addEventListener('timeupdate', updateProgress);
audio.addEventListener('play',  () => {
  S.playing = true; updatePlayIcons();
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
});
audio.addEventListener('pause', () => {
  S.playing = false; updatePlayIcons();
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
  savePlaybackState();
});
window.addEventListener('beforeunload', savePlaybackState);
window.addEventListener('pagehide', savePlaybackState);
document.addEventListener('visibilitychange', () => { if (document.hidden) savePlaybackState(); });
setInterval(() => { if (S.playing && !audio.paused) savePlaybackState(); }, 5000);
audio.addEventListener('error', () => toast('⚠ Could not play this track'));

// ── Media Session API (lock screen / background) ───────────────
function updateMediaSession() {
  if (!('mediaSession' in navigator) || !S.currentTrack) return;
  const t = S.currentTrack;
  const art = t.artwork ? [{ src: t.artwork, sizes: '512x512' }] : [];
  navigator.mediaSession.metadata = new MediaMetadata({
    title: t.title, artist: t.artist, album: t.album || 'ERI-FAM', artwork: art
  });
  navigator.mediaSession.setActionHandler('play',          () => { audio.play(); });
  navigator.mediaSession.setActionHandler('pause',         () => { audio.pause(); });
  navigator.mediaSession.setActionHandler('previoustrack', prevTrack);
  navigator.mediaSession.setActionHandler('nexttrack',     nextTrack);
  navigator.mediaSession.setActionHandler('seekto', d => {
    if (d.seekTime != null) audio.currentTime = d.seekTime;
  });
}

// ── UI Updates ─────────────────────────────────────────────────
const RING_C = 867.08; // 2π × 138 (SVG ring circumference)

function updateProgress() {
  const dur = audio.duration || 0;
  const cur = audio.currentTime || 0;
  const ratio = dur ? cur / dur : 0;
  const pct = ratio * 100;

  document.getElementById('miniProgFill').style.width = pct + '%';
  document.getElementById('fpProgFill').style.width   = pct + '%';
  document.getElementById('fpProgThumb').style.left   = pct + '%';
  document.getElementById('fpCurTime').textContent    = fmtTime(cur);
  document.getElementById('fpDuration').textContent   = fmtTime(dur);

  // Drive circular progress ring
  const ringFill = document.getElementById('fpRingFill');
  const ringDot  = document.getElementById('fpRingDot');
  if (ringFill) ringFill.style.strokeDashoffset = RING_C * (1 - ratio);
  if (ringDot)  ringDot.setAttribute('transform', `rotate(${ratio * 360} 150 150)`);

  if ('mediaSession' in navigator && dur) {
    navigator.mediaSession.setPositionState({ duration: dur, position: cur, playbackRate: 1 });
  }
}

function updatePlayIcons() {
  const pauseSvg = `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
  const playSvg  = `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
  document.getElementById('playBtn').innerHTML  = S.playing ? pauseSvg : playSvg;
  document.getElementById('miniPlay').innerHTML = S.playing ? pauseSvg : playSvg;
  // Refresh any visible list-row play buttons for the current track
  document.querySelectorAll('.tr-play-btn').forEach(btn => {
    if (!S.currentTrack) return;
    if (btn.dataset.id === S.currentTrack.id)
      btn.innerHTML = S.playing ? pauseSvg : playSvg;
  });
}

function updatePlayerUI() {
  const t = S.currentTrack;
  if (!t) return;
  // Mini player
  document.getElementById('miniTitle').textContent  = t.title;
  document.getElementById('miniArtist').textContent = t.artist;
  if (t.artwork) {
    document.getElementById('miniArt').innerHTML = `<img src="${t.artwork}" alt="" />`;
  } else {
    document.getElementById('miniArt').innerHTML = `<span class="mini-art-ph">🎵</span>`;
  }
  // Full player
  document.getElementById('fpTitle').textContent  = t.title;
  document.getElementById('fpArtist').textContent = t.artist;
  document.getElementById('fpDuration').textContent = fmtTime(t.duration);
  if (t.artwork) {
    document.getElementById('fpArtImg').src = t.artwork;
    document.getElementById('fpArtImg').style.display = '';
    document.getElementById('fpArt').querySelector('.fp-art-ph').style.display = 'none';
    document.getElementById('fpBg').style.background = `linear-gradient(180deg, rgba(0,0,0,0.6) 0%, var(--bg) 100%)`;
  } else {
    document.getElementById('fpArtImg').style.display = 'none';
    document.getElementById('fpArt').querySelector('.fp-art-ph').style.display = '';
  }
  // Like button
  document.getElementById('likeBtn').classList.toggle('liked', S.likedIds.has(t.id));
  updatePlayIcons();
}

function showMiniPlayer() {
  document.getElementById('miniPlayer').style.display = '';
}

function updateStats() {
  const total = S.tracks.length + S.cloudTracks.length;
  const size  = S.tracks.reduce((a, t) => a + (t.size || 0), 0);
  document.getElementById('statTracks').textContent = total + ' tracks';
  document.getElementById('statSize').textContent   = fmtSize(size);
  document.getElementById('settingTrackCount').textContent = total;
  document.getElementById('settingStorage').textContent    = fmtSize(size);
  const statsBar = document.getElementById('statsBar');
  const filterRow = document.getElementById('filterRow');
  if (total > 0) { statsBar.style.display = ''; filterRow.style.display = ''; document.getElementById('emptyState').style.display = 'none'; }
  else           { statsBar.style.display = 'none'; filterRow.style.display = 'none'; document.getElementById('emptyState').style.display = ''; }
}

// ── Render tracks ──────────────────────────────────────────────
function getAllTracks() {
  const all = [...S.tracks, ...S.cloudTracks];
  if (S.filter === 'local') return S.tracks;
  if (S.filter === 'cloud') return S.cloudTracks;
  if (S.filter === 'liked') return all.filter(t => S.likedIds.has(t.id));
  return all;
}

function renderTracks(search = '') {
  let tracks = getAllTracks();
  if (search) {
    const q = search.toLowerCase();
    tracks = tracks.filter(t => (t.title||'').toLowerCase().includes(q) || (t.artist||'').toLowerCase().includes(q) || (t.album||'').toLowerCase().includes(q));
  }
  if (S.viewMode === 'grid') renderGrid(tracks);
  else renderList(tracks);
  if (!search) renderSearchResults(tracks, '');
}

function artEl(t, cls) {
  if (t.artwork) return `<img src="${t.artwork}" alt="" loading="lazy" />`;
  const code = (t.title || '').charCodeAt(0) || 0;
  const emojis = ['🎵','🎶','🎸','🎹','🥁','🎺','🎻','🪗'];
  return `<span style="font-size:${cls==='card'?'2.5rem':'1.4rem'}">${emojis[code % emojis.length]}</span>`;
}

function renderGrid(tracks) {
  const grid = document.getElementById('trackGrid');
  if (!tracks.length) { grid.innerHTML = ''; return; }
  grid.innerHTML = tracks.map((t, i) => {
    const playing   = S.currentTrack && S.currentTrack.id === t.id;
    const selected  = S.selectedIds.has(t.id);
    return `<div class="track-card${playing?' playing':''}${selected?' selected':''}" data-id="${t.id}" data-idx="${i}">
      <div class="tc-art">
        ${artEl(t,'card')}
        <div class="tc-sel-check"></div>
        <div class="tc-play-overlay">
          <div class="tc-play-ico"><svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>
        </div>
        ${playing ? `<div class="tc-eq-bars"><span style="height:8px"></span><span style="height:14px"></span><span style="height:6px"></span></div>` : ''}
      </div>
      <div class="tc-info">
        <div class="tc-title">${esc(t.title)}</div>
        <div class="tc-artist">${esc(t.artist)}</div>
      </div>
      <button class="tc-more" data-id="${t.id}">⋯</button>
    </div>`;
  }).join('');
  grid.style.display = '';
  document.getElementById('trackList').style.display = 'none';
  bindTrackCardEvents(grid, tracks);
}

function renderList(tracks) {
  const list = document.getElementById('trackList');
  if (!tracks.length) { list.innerHTML = ''; return; }
  const sorted = [...tracks].sort((a, b) => a.title.localeCompare(b.title));
  const pauseSvg = `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
  const playSvg  = `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
  let html = '', lastLetter = '';
  sorted.forEach((t, i) => {
    const first  = (t.title[0] || '').toUpperCase();
    const letter = /[A-Z]/.test(first) ? first : '#';
    if (letter !== lastLetter) {
      html += `<div class="alpha-header">${letter}</div>`;
      lastLetter = letter;
    }
    const playing  = S.currentTrack && S.currentTrack.id === t.id;
    const selected = S.selectedIds.has(t.id);
    html += `<div class="track-row${playing?' playing':''}${selected?' selected':''}" data-id="${t.id}" data-idx="${i}">
      <div class="tr-sel-check"></div>
      <div class="tr-art">${artEl(t,'list')}</div>
      <div class="tr-info">
        <div class="tr-title">${esc(t.title)}</div>
        <div class="tr-artist">${esc(t.artist)}</div>
      </div>
      <button class="tr-play-btn${playing?' tr-playing':''}" data-id="${t.id}">${playing && S.playing ? pauseSvg : playSvg}</button>
      <span class="tr-dur">${fmtTime(t.duration)}</span>
    </div>`;
  });
  list.innerHTML = html;
  list.style.display = '';
  document.getElementById('trackGrid').style.display = 'none';
  bindTrackCardEvents(list, sorted);
}

function bindTrackCardEvents(container, tracks) {
  container.querySelectorAll('[data-id]').forEach(el => {
    if (el.classList.contains('tc-more') || el.classList.contains('tr-more')) {
      el.addEventListener('click', e => { e.stopPropagation(); if (!S.selectMode) openTrackSheet(el.getAttribute('data-id')); });
    } else if (el.classList.contains('tr-play-btn')) {
      el.addEventListener('click', e => {
        e.stopPropagation();
        const id    = el.getAttribute('data-id');
        const track = tracks.find(t => t.id === id);
        if (!track) return;
        if (S.currentTrack && S.currentTrack.id === id) togglePlay();
        else playTrack(track, tracks);
      });
    } else {
      let pressTimer;
      el.addEventListener('pointerdown', () => {
        pressTimer = setTimeout(() => {
          S.selectMode = true;
          document.body.classList.add('select-mode');
          toggleSelectTrack(el.getAttribute('data-id'));
        }, 500);
      });
      el.addEventListener('pointerup',     () => clearTimeout(pressTimer));
      el.addEventListener('pointermove',   () => clearTimeout(pressTimer));
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-id');
        if (S.selectMode) { toggleSelectTrack(id); return; }
        const idx   = parseInt(el.getAttribute('data-idx'));
        const track = tracks.find(t => t.id === id) || tracks[idx];
        if (track) playTrack(track, tracks);
      });
    }
  });
}

// ── Selection ──────────────────────────────────────────────────
S.selectedIds = new Set();
S.selectMode  = false;

function toggleSelectTrack(id) {
  if (S.selectedIds.has(id)) S.selectedIds.delete(id);
  else S.selectedIds.add(id);
  if (S.selectedIds.size === 0) exitSelectMode();
  else updateSelectionUI();
  document.querySelectorAll(`[data-id="${id}"]`).forEach(el => {
    if (!el.classList.contains('tc-more') && !el.classList.contains('tr-more'))
      el.classList.toggle('selected', S.selectedIds.has(id));
  });
}

function exitSelectMode() {
  S.selectMode = false;
  S.selectedIds.clear();
  document.body.classList.remove('select-mode');
  updateSelectionUI();
  renderTracks();
}

function updateSelectionUI() {
  const n       = S.selectedIds.size;
  const allVis  = getAllTracks();
  const allSel  = allVis.length > 0 && allVis.every(t => S.selectedIds.has(t.id));
  document.getElementById('selectAllBtn').textContent = allSel ? 'Deselect All' : 'Select All';
  const delBtn = document.getElementById('deleteSelBtn');
  delBtn.style.display   = n > 0 ? '' : 'none';
  delBtn.textContent     = `🗑 Delete ${n}`;
}

document.getElementById('selectAllBtn').addEventListener('click', () => {
  const visible = getAllTracks();
  const allSel  = visible.every(t => S.selectedIds.has(t.id));
  if (allSel) {
    exitSelectMode();
    return;
  }
  S.selectMode = true;
  document.body.classList.add('select-mode');
  visible.forEach(t => S.selectedIds.add(t.id));
  updateSelectionUI();
  renderTracks();
});

document.getElementById('deleteSelBtn').addEventListener('click', async () => {
  const ids = [...S.selectedIds];
  if (!ids.length) return;
  const n = ids.length;
  for (const id of ids) await deleteTrack(id);
  exitSelectMode();
  toast(`🗑 Deleted ${n} track${n > 1 ? 's' : ''}`);
});

function renderSearchResults(tracks, q) {
  const el = document.getElementById('searchResults');
  if (!q) { el.innerHTML = '<p class="empty-msg">Type to search your library…</p>'; return; }
  if (!tracks.length) { el.innerHTML = '<p class="empty-msg">No results found.</p>'; return; }
  el.innerHTML = tracks.map((t, i) => `
    <div class="track-row" data-id="${t.id}" data-idx="${i}">
      <div class="tr-art">${artEl(t,'list')}</div>
      <div class="tr-info"><div class="tr-title">${esc(t.title)}</div><div class="tr-artist">${esc(t.artist)}</div></div>
      <span class="tr-dur">${fmtTime(t.duration)}</span>
    </div>`).join('');
  el.querySelectorAll('.track-row').forEach(row => {
    row.addEventListener('click', () => {
      const id = row.getAttribute('data-id');
      const track = tracks.find(t => t.id === id);
      if (track) playTrack(track, tracks);
    });
  });
}

function esc(str) { return (str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── Track Options Sheet ────────────────────────────────────────
let sheetTrackId = null;
function openTrackSheet(id) {
  const track = [...S.tracks, ...S.cloudTracks].find(t => t.id === id);
  if (!track) return;
  sheetTrackId = id;
  document.getElementById('sheetInfo').innerHTML = `<strong>${esc(track.title)}</strong><span>${esc(track.artist)}</span>`;
  document.getElementById('sheetActions').innerHTML = `
    <button class="sheet-action" id="sheetPlay"><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>Play</button>
    <button class="sheet-action" id="sheetLike"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>${S.likedIds.has(id) ? 'Unlike' : 'Like'}</button>
    <button class="sheet-action" id="sheetAddPl"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add to Playlist</button>
    <button class="sheet-action" id="sheetQueue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/></svg>Add to Queue</button>
    <button class="sheet-action danger" id="sheetDelete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>Delete</button>`;
  document.getElementById('sheetPlay').onclick   = () => { playTrack(track, getAllTracks()); closeSheet(); };
  document.getElementById('sheetLike').onclick   = () => { toggleLike(id); closeSheet(); };
  document.getElementById('sheetAddPl').onclick  = () => { closeSheet(); openAddToPlaylist(id); };
  document.getElementById('sheetQueue').onclick  = () => { S.queue.push(track); toast('Added to queue'); closeSheet(); };
  document.getElementById('sheetDelete').onclick = () => { deleteTrack(id); closeSheet(); };
  addCloudSheetActions(track);
  document.getElementById('sheetOverlay').classList.add('open');
  document.getElementById('trackSheet').classList.add('open');
}

function closeSheet() {
  document.getElementById('sheetOverlay').classList.remove('open');
  document.getElementById('trackSheet').classList.remove('open');
}

function toggleLike(id) {
  if (S.likedIds.has(id)) S.likedIds.delete(id); else S.likedIds.add(id);
  localStorage.setItem('erifam_liked', JSON.stringify([...S.likedIds]));
  idbGet('tracks', id).then(t => { if (t) { t.liked = S.likedIds.has(id); idbPut('tracks', t); } });
  if (S.currentTrack?.id === id) document.getElementById('likeBtn').classList.toggle('liked', S.likedIds.has(id));
  renderTracks();
}

async function deleteTrack(id) {
  const track = S.tracks.find(t => t.id === id);
  if (!track) return;
  if (track._blobUrl) URL.revokeObjectURL(track._blobUrl);
  await idbDelete('tracks', id);
  await idbDelete('trackData', id);
  S.tracks = S.tracks.filter(t => t.id !== id);
  if (S.currentTrack?.id === id) { audio.pause(); S.playing = false; S.currentTrack = null; document.getElementById('miniPlayer').style.display = 'none'; }
  renderTracks(); updateStats();
  toast('🗑 Track removed');
}

// ── Duplicate Detection ────────────────────────────────────────
function findDuplicates() {
  const map = {};
  [...S.tracks].forEach(t => {
    const k = t.title.toLowerCase().trim() + '_' + Math.round(t.duration || 0);
    if (!map[k]) map[k] = [];
    map[k].push(t);
  });
  return Object.values(map).filter(g => g.length > 1);
}

function openDuplicates() {
  const groups = findDuplicates();
  const list = document.getElementById('dupList');
  if (!groups.length) { toast('✅ No duplicates found!'); return; }
  list.innerHTML = groups.map(g => `
    <div class="dup-group">
      <div class="dup-group-title">"${esc(g[0].title)}" — ${g.length} copies</div>
      ${g.map((t,i) => `<div class="dup-item">
        <div class="dup-item-info">
          <div class="dup-item-name">${esc(t.artist)} · ${fmtTime(t.duration)}</div>
          <div class="dup-item-size">${fmtSize(t.size||0)} · Added ${new Date(t.addedAt).toLocaleDateString()}</div>
        </div>
        ${i > 0 ? `<button class="dup-remove" data-id="${t.id}">Remove</button>` : '<span style="font-size:0.7rem;color:var(--green)">Keep</span>'}
      </div>`).join('')}
    </div>`).join('');
  list.querySelectorAll('.dup-remove').forEach(btn => {
    btn.onclick = () => deleteTrack(btn.getAttribute('data-id')).then(() => openDuplicates());
  });
  document.getElementById('removeAllDupsBtn').onclick = async () => {
    const toRemove = groups.flatMap(g => g.slice(1).map(t => t.id));
    for (const id of toRemove) await deleteTrack(id);
    closeModal('dupModal'); toast(`🗑 Removed ${toRemove.length} duplicate${toRemove.length>1?'s':''}`);
  };
  openModal('dupModal');
}

// ── Navigation ─────────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const view = btn.getAttribute('data-view');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    const viewEl = document.getElementById('view-' + view);
    if (viewEl) viewEl.classList.add('active');
  });
});

// ── Search ─────────────────────────────────────────────────────
const searchBarEl = document.getElementById('searchBar');
document.getElementById('searchToggleBtn').addEventListener('click', () => {
  searchBarEl.classList.toggle('open');
  if (searchBarEl.classList.contains('open')) document.getElementById('searchInput').focus();
});
document.getElementById('searchClose').addEventListener('click', () => searchBarEl.classList.remove('open'));
document.getElementById('searchInput').addEventListener('input', e => {
  const q = e.target.value.trim();
  const all = getAllTracks();
  if (!q) { renderSearchResults(all, ''); return; }
  const results = all.filter(t => t.title.toLowerCase().includes(q.toLowerCase()) || t.artist.toLowerCase().includes(q.toLowerCase()));
  renderSearchResults(results, q);
  // Switch to search view
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelector('.nav-item[data-view="search"]').classList.add('active');
  document.getElementById('view-search').classList.add('active');
});

// ── Home Search ────────────────────────────────────────────────
document.getElementById('homeSearchInput').addEventListener('input', e => {
  renderTracks(e.target.value.trim());
});

// ── Promotions ─────────────────────────────────────────────────
async function loadPromos() {
  const ready = await FB_READY;
  if (!ready) return;
  try {
    const snap = await db.getDocs(db.query(db.collection(db._db, 'promotions'), db.orderBy('createdAt', 'desc')));
    const promos = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.active !== false);
    renderPromos(promos);
  } catch(e) { console.warn('[Promos]', e); }
}

function renderPromos(promos) {
  const section = document.getElementById('promoSection');
  const scroll  = document.getElementById('promoScroll');
  if (!promos || !promos.length) { section.style.display = 'none'; return; }
  scroll.innerHTML = promos.map(p => `
    <div class="promo-card" data-url="${esc(p.website || '')}">
      <div class="promo-card-img">
        ${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" />` : `<span class="promo-card-ph">${(p.name||'?')[0].toUpperCase()}</span>`}
      </div>
      <div class="promo-card-body">
        ${p.category ? `<span class="promo-badge">${esc(p.category)}</span>` : ''}
        <div class="promo-name">${esc(p.name)}</div>
        ${p.description ? `<div class="promo-desc">${esc(p.description)}</div>` : ''}
        ${p.website ? `<a class="promo-visit-btn" href="${esc(p.website)}" target="_blank" rel="noopener noreferrer">Visit →</a>` : ''}
      </div>
    </div>`).join('');
  section.style.display = '';
}

document.getElementById('advertiseBtn').addEventListener('click',  () => openModal('advertiseModal'));
document.getElementById('advertiseClose').addEventListener('click',() => closeModal('advertiseModal'));
document.getElementById('advertiseModal').addEventListener('click', e => { if (e.target.id === 'advertiseModal') closeModal('advertiseModal'); });

// ── Upload / Drag & Drop ───────────────────────────────────────
const uploadZone    = document.getElementById('uploadZone');
const fileInput     = document.getElementById('fileInput');
const folderInput   = document.getElementById('folderInput');

uploadZone.addEventListener('click', e => {
  if (e.target.closest('label')) return; // labels trigger their inputs natively
  fileInput.click();
});
fileInput.addEventListener('change',   e => { importFiles(e.target.files); fileInput.value   = ''; });
folderInput.addEventListener('change', e => { importFiles(e.target.files); folderInput.value = ''; });
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => { e.preventDefault(); uploadZone.classList.remove('drag-over'); importFiles(e.dataTransfer.files); });

// ── Filter chips ───────────────────────────────────────────────
document.querySelectorAll('.filter-chip').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    S.filter = btn.getAttribute('data-filter');
    renderTracks(document.getElementById('searchInput').value.trim());
  });
});

// ── View mode ──────────────────────────────────────────────────
document.getElementById('gridViewBtn').addEventListener('click', () => {
  S.viewMode = 'grid';
  document.getElementById('gridViewBtn').classList.add('active');
  document.getElementById('listViewBtn').classList.remove('active');
  renderTracks();
});
document.getElementById('listViewBtn').addEventListener('click', () => {
  S.viewMode = 'list';
  document.getElementById('listViewBtn').classList.add('active');
  document.getElementById('gridViewBtn').classList.remove('active');
  renderTracks();
});

// ── Mini Player ────────────────────────────────────────────────
document.getElementById('miniPlayerExpand').addEventListener('click', e => { if (!e.target.closest('.mini-btn')) openPanel('fullPlayer'); });
document.getElementById('miniPlay').addEventListener('click', e => { e.stopPropagation(); togglePlay(); });
document.getElementById('miniPrev').addEventListener('click', e => { e.stopPropagation(); prevTrack(); });
document.getElementById('miniNext').addEventListener('click', e => { e.stopPropagation(); nextTrack(); });

// ── Full Player ────────────────────────────────────────────────
document.getElementById('fpClose').addEventListener('click', () => closePanel('fullPlayer'));
document.getElementById('playBtn').addEventListener('click', togglePlay);
document.getElementById('prevBtn').addEventListener('click', prevTrack);
document.getElementById('nextBtn').addEventListener('click', nextTrack);

document.getElementById('shuffleBtn').addEventListener('click', () => {
  S.shuffle = !S.shuffle;
  if (S.shuffle && S.queue.length) buildShuffleQueue(S.currentTrack);
  document.getElementById('shuffleBtn').classList.toggle('active', S.shuffle);
  toast(S.shuffle ? '🔀 Shuffle on' : '🔀 Shuffle off');
  idbPut('settings', { key: 'shuffle', value: S.shuffle }).catch(() => {});
});

document.getElementById('repeatBtn').addEventListener('click', () => {
  const modes = ['off','all','one'];
  S.repeat = modes[(modes.indexOf(S.repeat)+1) % 3];
  const btn = document.getElementById('repeatBtn');
  btn.classList.toggle('active', S.repeat !== 'off');
  btn.title = S.repeat === 'one' ? 'Repeat one' : S.repeat === 'all' ? 'Repeat all' : 'Repeat off';
  if (S.repeat === 'one') btn.innerHTML += '<span style="position:absolute;font-size:0.5rem">1</span>';
  toast(S.repeat === 'off' ? 'Repeat off' : S.repeat === 'all' ? '🔁 Repeat all' : '🔂 Repeat one');
  idbPut('settings', { key: 'repeat', value: S.repeat }).catch(() => {});
});

document.getElementById('likeBtn').addEventListener('click', () => {
  if (S.currentTrack) toggleLike(S.currentTrack.id);
});

document.getElementById('fpMenu').addEventListener('click', () => {
  if (S.currentTrack) openTrackSheet(S.currentTrack.id);
});

// Progress seeking
const progTrack = document.getElementById('fpProgressTrack');
progTrack.addEventListener('click', e => {
  if (!audio.duration) return;
  const r = progTrack.getBoundingClientRect();
  audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
});
let seeking = false;
progTrack.addEventListener('mousedown', () => seeking = true);
document.addEventListener('mouseup', () => seeking = false);
document.addEventListener('mousemove', e => {
  if (!seeking || !audio.duration) return;
  const r = progTrack.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  audio.currentTime = pct * audio.duration;
});

// Volume
const volSlider = document.getElementById('volSlider');
volSlider.addEventListener('input', () => {
  S.volume = volSlider.value / 100;
  audio.volume = S.volume;
  idbPut('settings', { key: 'volume', value: S.volume }).catch(() => {});
});

// Skip back 15 s
document.getElementById('skipBackBtn').addEventListener('click', () => {
  audio.currentTime = Math.max(0, audio.currentTime - 15);
});

// Volume icon toggles slider row
document.getElementById('volIconBtn').addEventListener('click', () => {
  const row = document.getElementById('fpVolumeRow');
  row.style.display = row.style.display === 'none' ? 'flex' : 'none';
});

// Ring click-to-seek
document.getElementById('fpRingContainer').addEventListener('click', e => {
  if (!audio.duration) return;
  const ring = e.currentTarget;
  const rect = ring.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top  + rect.height / 2;
  const dx = e.clientX - cx;
  const dy = e.clientY - cy;
  const dist = Math.hypot(dx, dy);
  const ringPx = rect.width * (138 / 300);
  if (Math.abs(dist - ringPx) > 22) return; // only near the ring edge
  let angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
  if (angle < 0) angle += 360;
  audio.currentTime = (angle / 360) * audio.duration;
});

// ── Equalizer ─────────────────────────────────────────────────
document.getElementById('eqBtn').addEventListener('click', async () => {
  const wasPlaying = !audio.paused;
  const savedTime  = audio.currentTime;
  try {
    initAudioCtx();
    // Apply any pending EQ restore now that AudioContext exists
    if (pendingEqRestore) {
      pendingEqRestore.forEach((v, i) => { if (eqBands[i]) eqBands[i].gain.value = v; });
      pendingEqRestore = null;
    }
    if (audioCtx.state !== 'running') await audioCtx.resume();
  } catch(e) { console.warn('[AudioCtx]', e); }
  // Restore playback if routing through AudioCtx paused the audio
  if (wasPlaying && audio.paused) {
    audio.currentTime = savedTime;
    audio.play().catch(() => {});
  }
  openPanel('eqPanel');
});
document.getElementById('eqClose').addEventListener('click', () => closePanel('eqPanel'));
document.getElementById('queueBtn').addEventListener('click',   () => { updateQueueUI(); openPanel('queuePanel'); });
document.getElementById('queueClose').addEventListener('click', () => closePanel('queuePanel'));

function buildEqSliders() {
  const container = document.getElementById('eqSliders');
  container.innerHTML = EQ_FREQS.map((f, i) => `
    <div class="eq-band">
      <input type="range" min="-12" max="12" value="0" orient="vertical" data-band="${i}" />
      <span class="eq-band-label">${f >= 1000 ? (f/1000)+'k' : f}</span>
    </div>`).join('');
  container.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input', () => {
      const idx = parseInt(inp.getAttribute('data-band'));
      if (eqBands[idx]) eqBands[idx].gain.value = parseFloat(inp.value);
      clearTimeout(eqSaveTimer);
      eqSaveTimer = setTimeout(saveSettings, 1000);
    });
  });
}

document.querySelectorAll('.eq-pre').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.eq-pre').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const preset = btn.getAttribute('data-preset');
    const values = EQ_PRESETS[preset] || EQ_PRESETS.flat;
    values.forEach((v, i) => {
      if (eqBands[i]) eqBands[i].gain.value = v;
      const inp = document.querySelector(`[data-band="${i}"]`);
      if (inp) inp.value = v;
    });
    saveSettings();
  });
});

// ── Queue UI ───────────────────────────────────────────────────
function updateQueueUI() {
  const list = document.getElementById('queueList');
  if (!S.queue.length) { list.innerHTML = '<p class="empty-msg">Queue is empty.</p>'; return; }
  list.innerHTML = S.queue.map((t, i) => `
    <div class="queue-item${i === S.queueIndex ? ' active' : ''}" data-idx="${i}">
      <span class="qi-num">${i === S.queueIndex ? '▶' : i+1}</span>
      <div class="qi-art">${artEl(t,'list')}</div>
      <div class="qi-info"><div class="qi-title">${esc(t.title)}</div><div class="qi-artist">${esc(t.artist)}</div></div>
      <span class="qi-dur">${fmtTime(t.duration)}</span>
    </div>`).join('');
  list.querySelectorAll('.queue-item').forEach(item => {
    item.addEventListener('click', () => {
      S.queueIndex = parseInt(item.getAttribute('data-idx'));
      playTrack(S.queue[S.queueIndex]);
    });
  });
}

// ── Sleep Timer ────────────────────────────────────────────────
document.getElementById('sleepBtn').addEventListener('click',  () => openModal('sleepModal'));
document.getElementById('sleepModal').addEventListener('click', e => { if (e.target.id === 'sleepModal') closeModal('sleepModal'); });
document.querySelectorAll('.sleep-opt').forEach(btn => {
  btn.addEventListener('click', () => {
    clearTimeout(S.sleepTimer);
    document.querySelectorAll('.sleep-opt').forEach(b => b.classList.remove('active'));
    const min = parseInt(btn.getAttribute('data-min'));
    if (min === 0) { toast('Sleep timer cancelled'); closeModal('sleepModal'); return; }
    btn.classList.add('active');
    S.sleepTimer = setTimeout(() => { audio.pause(); S.playing = false; toast('😴 Sleep timer — playback stopped'); }, min * 60000);
    toast(`⏱ Sleep timer set for ${min} min`);
    closeModal('sleepModal');
  });
});

// ── Add to Playlist ────────────────────────────────────────────
let addPlTrackId = null;
async function openAddToPlaylist(trackId) {
  addPlTrackId = trackId;
  const playlists = await idbGetAll('playlists');
  const opts = document.getElementById('addPlOptions');
  if (!playlists.length) {
    opts.innerHTML = '<p class="empty-msg" style="padding:10px 0">No playlists yet.</p>';
  } else {
    opts.innerHTML = playlists.map(pl => `
      <div class="pl-option" data-plid="${pl.id}">
        <span>📁</span><span>${esc(pl.name)}</span>
        <span style="margin-left:auto;font-size:0.72rem;color:var(--text-dim)">${(pl.trackIds||[]).length} tracks</span>
      </div>`).join('');
    opts.querySelectorAll('.pl-option').forEach(opt => {
      opt.addEventListener('click', async () => {
        const pl = playlists.find(p => p.id === opt.getAttribute('data-plid'));
        if (!pl) return;
        if (!pl.trackIds.includes(addPlTrackId)) pl.trackIds.push(addPlTrackId);
        await idbPut('playlists', pl);
        toast(`Added to "${pl.name}"`);
        closeModal('addPlModal');
        renderPlaylists();
      });
    });
  }
  openModal('addPlModal');
}

document.getElementById('addToPlBtn').addEventListener('click',  () => { if (S.currentTrack) openAddToPlaylist(S.currentTrack.id); });
document.getElementById('addPlClose').addEventListener('click',  () => closeModal('addPlModal'));
document.getElementById('addPlNew').addEventListener('click',    () => { closeModal('addPlModal'); openModal('newPlModal'); setTimeout(() => document.getElementById('newPlName').focus(), 100); });
document.getElementById('newPlClose').addEventListener('click',  () => closeModal('newPlModal'));
document.getElementById('newPlCreate').addEventListener('click', async () => {
  const name = document.getElementById('newPlName').value.trim();
  if (!name) { document.getElementById('newPlName').focus(); return; }
  const pl = { id: uid(), name, trackIds: addPlTrackId ? [addPlTrackId] : [], createdAt: Date.now() };
  await idbPut('playlists', pl);
  document.getElementById('newPlName').value = '';
  closeModal('newPlModal');
  toast(`✅ Playlist "${name}" created`);
  renderPlaylists();
});
document.getElementById('newPlaylistBtn').addEventListener('click', () => { addPlTrackId = null; openModal('newPlModal'); setTimeout(() => document.getElementById('newPlName').focus(), 100); });

async function renderPlaylists() {
  const playlists = await idbGetAll('playlists');
  const grid = document.getElementById('playlistGrid');
  if (!playlists.length) { grid.innerHTML = '<p class="empty-msg">No playlists yet. Create one!</p>'; return; }
  grid.innerHTML = playlists.map(pl => `
    <div class="pl-card" data-plid="${pl.id}">
      <div class="pl-art">📁</div>
      <div class="pl-name">${esc(pl.name)}</div>
      <div class="pl-count">${(pl.trackIds||[]).length} tracks</div>
    </div>`).join('');
  grid.querySelectorAll('.pl-card').forEach(card => {
    card.addEventListener('click', async () => {
      const pl = playlists.find(p => p.id === card.getAttribute('data-plid'));
      if (!pl) return;
      const tracks = pl.trackIds.map(id => [...S.tracks,...S.cloudTracks].find(t => t.id === id)).filter(Boolean);
      if (tracks.length) playTrack(tracks[0], tracks);
      else toast('Playlist is empty');
    });
  });
}

// ── Library tabs ───────────────────────────────────────────────
let activeLibTab = 'playlists';

document.querySelectorAll('.lib-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    activeLibTab = btn.getAttribute('data-libtab');
    document.querySelectorAll('.lib-tab').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.lib-panel').forEach(p => p.classList.toggle('active', p.id === 'libtab-' + activeLibTab));
    if (activeLibTab === 'artists') renderArtists();
    if (activeLibTab === 'albums')  renderAlbums();
    if (activeLibTab === 'songs')   renderSongs();
  });
});

function renderArtists() {
  const all = [...S.tracks, ...S.cloudTracks];
  const map = {};
  all.forEach(t => {
    const a = t.artist || 'Unknown Artist';
    if (!map[a]) map[a] = { name: a, tracks: [], artwork: null };
    map[a].tracks.push(t);
    if (!map[a].artwork && t.artwork) map[a].artwork = t.artwork;
  });
  const artists = Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  const el = document.getElementById('artistList');
  if (!artists.length) { el.innerHTML = '<p class="empty-msg">No artists yet.</p>'; return; }
  el.innerHTML = artists.map(a => `
    <div class="lib-artist-row" data-artist="${esc(a.name)}">
      <div class="lib-artist-avatar">
        ${a.artwork ? `<img src="${esc(a.artwork)}" alt="" loading="lazy" />` : '🎤'}
      </div>
      <div class="lib-artist-info">
        <div class="lib-artist-name">${esc(a.name)}</div>
        <div class="lib-artist-count">${a.tracks.length} song${a.tracks.length !== 1 ? 's' : ''}</div>
      </div>
      <span class="lib-chevron">›</span>
    </div>`).join('');
  el.querySelectorAll('.lib-artist-row').forEach(row => {
    row.addEventListener('click', () => {
      const name   = row.getAttribute('data-artist');
      const artist = artists.find(a => a.name === name);
      if (artist) openArtistDetail(artist);
    });
  });
}

function openArtistDetail(artist) {
  const panel = document.getElementById('libtab-artists');
  panel.innerHTML = `
    <div class="lib-detail-back" id="artistBack">‹ Artists</div>
    <div class="lib-detail-hdr">
      <div class="lib-detail-avatar">
        ${artist.artwork ? `<img src="${esc(artist.artwork)}" alt="" />` : '🎤'}
      </div>
      <div>
        <div class="lib-detail-name">${esc(artist.name)}</div>
        <div class="lib-detail-meta">${artist.tracks.length} song${artist.tracks.length !== 1 ? 's' : ''}</div>
      </div>
    </div>
    <div class="songs-actions">
      <button class="songs-play-btn" id="artistPlayBtn">
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><polygon points="5 3 19 12 5 21 5 3"/></svg> Play
      </button>
      <button class="songs-shuffle-btn" id="artistShuffleBtn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg> Shuffle
      </button>
    </div>
    <div class="lib-song-list">
      ${artist.tracks.map((t, i) => `
        <div class="lib-song-row${S.currentTrack?.id === t.id ? ' playing' : ''}" data-idx="${i}">
          <span class="lib-song-num">${i + 1}</span>
          <div class="lib-song-info">
            <div class="lib-song-title">${esc(t.title)}</div>
            <div class="lib-song-artist">${esc(t.album || t.artist)}</div>
          </div>
          <span class="lib-song-dur">${fmtTime(t.duration)}</span>
        </div>`).join('')}
    </div>`;
  panel.querySelector('#artistBack').addEventListener('click', () => renderArtists());
  panel.querySelector('#artistPlayBtn').addEventListener('click', () => { S.shuffle = false; playTrack(artist.tracks[0], artist.tracks); });
  panel.querySelector('#artistShuffleBtn').addEventListener('click', () => {
    S.shuffle = true;
    const idx = Math.floor(Math.random() * artist.tracks.length);
    playTrack(artist.tracks[idx], artist.tracks);
  });
  panel.querySelectorAll('.lib-song-row').forEach(row => {
    row.addEventListener('click', () => playTrack(artist.tracks[parseInt(row.dataset.idx)], artist.tracks));
  });
}

function renderAlbums() {
  const all = [...S.tracks, ...S.cloudTracks];
  const map = {};
  all.forEach(t => {
    const key = (t.album || '').trim() || 'Unknown Album';
    if (!map[key]) map[key] = { name: key, artist: t.artist, tracks: [], artwork: null };
    map[key].tracks.push(t);
    if (!map[key].artwork && t.artwork) map[key].artwork = t.artwork;
  });
  const albums = Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  const el = document.getElementById('albumGrid');
  if (!albums.length) { el.innerHTML = '<p class="empty-msg">No albums yet.</p>'; return; }
  el.innerHTML = albums.map(a => `
    <div class="lib-album-card" data-album="${esc(a.name)}">
      <div class="lib-album-art">
        ${a.artwork ? `<img src="${esc(a.artwork)}" alt="" loading="lazy" />` : '💿'}
      </div>
      <div class="lib-album-info">
        <div class="lib-album-title">${esc(a.name)}</div>
        <div class="lib-album-artist">${esc(a.artist)}</div>
      </div>
    </div>`).join('');
  el.querySelectorAll('.lib-album-card').forEach(card => {
    card.addEventListener('click', () => {
      const name  = card.getAttribute('data-album');
      const album = albums.find(a => a.name === name);
      if (album) openAlbumDetail(album);
    });
  });
}

function openAlbumDetail(album) {
  const panel = document.getElementById('libtab-albums');
  panel.innerHTML = `
    <div class="lib-detail-back" id="albumBack">‹ Albums</div>
    <div class="lib-detail-hdr">
      <div class="lib-detail-art">
        ${album.artwork ? `<img src="${esc(album.artwork)}" alt="" />` : '💿'}
      </div>
      <div>
        <div class="lib-detail-name">${esc(album.name)}</div>
        <div class="lib-detail-meta">${esc(album.artist)} · ${album.tracks.length} song${album.tracks.length !== 1 ? 's' : ''}</div>
      </div>
    </div>
    <div class="songs-actions">
      <button class="songs-play-btn" id="albumPlayBtn">
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><polygon points="5 3 19 12 5 21 5 3"/></svg> Play
      </button>
      <button class="songs-shuffle-btn" id="albumShuffleBtn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg> Shuffle
      </button>
    </div>
    <div class="lib-song-list">
      ${album.tracks.map((t, i) => `
        <div class="lib-song-row${S.currentTrack?.id === t.id ? ' playing' : ''}" data-idx="${i}">
          <span class="lib-song-num">${i + 1}</span>
          <div class="lib-song-info">
            <div class="lib-song-title">${esc(t.title)}</div>
            <div class="lib-song-artist">${esc(t.artist)}</div>
          </div>
          <span class="lib-song-dur">${fmtTime(t.duration)}</span>
        </div>`).join('')}
    </div>`;
  panel.querySelector('#albumBack').addEventListener('click', () => renderAlbums());
  panel.querySelector('#albumPlayBtn').addEventListener('click', () => { S.shuffle = false; playTrack(album.tracks[0], album.tracks); });
  panel.querySelector('#albumShuffleBtn').addEventListener('click', () => {
    S.shuffle = true;
    const idx = Math.floor(Math.random() * album.tracks.length);
    playTrack(album.tracks[idx], album.tracks);
  });
  panel.querySelectorAll('.lib-song-row').forEach(row => {
    row.addEventListener('click', () => playTrack(album.tracks[parseInt(row.dataset.idx)], album.tracks));
  });
}

function renderSongs() {
  const tracks = [...S.tracks, ...S.cloudTracks].sort((a, b) => a.title.localeCompare(b.title));
  const el = document.getElementById('songList');
  if (!tracks.length) { el.innerHTML = '<p class="empty-msg">No songs yet.</p>'; return; }
  let html = '', lastLetter = '';
  tracks.forEach((t, i) => {
    const first  = (t.title[0] || '').toUpperCase();
    const letter = /[A-Z]/.test(first) ? first : '#';
    if (letter !== lastLetter) {
      html += `<div class="alpha-header">${letter}</div>`;
      lastLetter = letter;
    }
    html += `<div class="lib-song-row${S.currentTrack?.id === t.id ? ' playing' : ''}" data-idx="${i}">
      <span class="lib-song-num">${S.currentTrack?.id === t.id ? '▶' : i + 1}</span>
      <div class="lib-song-info">
        <div class="lib-song-title">${esc(t.title)}</div>
        <div class="lib-song-artist">${esc(t.artist)}</div>
      </div>
      <span class="lib-song-dur">${fmtTime(t.duration)}</span>
    </div>`;
  });
  el.innerHTML = html;
  el.querySelectorAll('.lib-song-row').forEach(row => {
    row.addEventListener('click', () => playTrack(tracks[parseInt(row.dataset.idx)], tracks));
  });
}

document.getElementById('songsPlayBtn').addEventListener('click', () => {
  const tracks = [...S.tracks, ...S.cloudTracks].sort((a, b) => a.title.localeCompare(b.title));
  if (!tracks.length) { toast('No songs yet'); return; }
  S.shuffle = false;
  playTrack(tracks[0], tracks);
});

document.getElementById('songsShuffleBtn').addEventListener('click', () => {
  const tracks = [...S.tracks, ...S.cloudTracks];
  if (!tracks.length) { toast('No songs yet'); return; }
  S.shuffle = true;
  const idx = Math.floor(Math.random() * tracks.length);
  playTrack(tracks[idx], tracks);
});

// ── Settings ───────────────────────────────────────────────────
document.getElementById('settingsBtn').addEventListener('click',  () => openPanel('settingsPanel'));
document.getElementById('settingsClose').addEventListener('click',() => closePanel('settingsPanel'));
document.getElementById('findDupsBtn').addEventListener('click',  () => { closePanel('settingsPanel'); openDuplicates(); });
document.getElementById('clearCacheBtn').addEventListener('click', async () => {
  if (!confirm('Clear all local music? This cannot be undone.')) return;
  const tx = idb.transaction(['tracks','trackData'], 'readwrite');
  tx.objectStore('tracks').clear();
  tx.objectStore('trackData').clear();
  S.tracks.forEach(t => { if (t._blobUrl) URL.revokeObjectURL(t._blobUrl); });
  S.tracks = []; renderTracks(); updateStats();
  toast('🗑 Local library cleared');
});
document.getElementById('dupClose').addEventListener('click',     () => closeModal('dupModal'));
document.getElementById('sheetOverlay').addEventListener('click', closeSheet);
document.getElementById('goAdminBtn').addEventListener('click',   () => { window.open('./admin/', '_blank'); });

document.getElementById('crossfadeSlider').addEventListener('input', e => {
  S.crossfade = parseInt(e.target.value);
  document.getElementById('crossfadeVal').textContent = S.crossfade + 's';
  idbPut('settings', { key: 'crossfade', value: S.crossfade }).catch(() => {});
});
document.getElementById('normalizeCheck').addEventListener('change', e => {
  S.normalize = e.target.checked;
  idbPut('settings', { key: 'normalize', value: S.normalize }).catch(() => {});
});
document.getElementById('gaplessCheck').addEventListener('change', e => {
  S.gapless = e.target.checked;
  idbPut('settings', { key: 'gapless', value: S.gapless }).catch(() => {});
});

// ── Music Identification ───────────────────────────────────────
document.getElementById('identifyBtn').addEventListener('click', async () => {
  const key = typeof AUDD_API_KEY !== 'undefined' ? AUDD_API_KEY : '';
  if (!key) { toast('⚠ Add AUDD_API_KEY in firebase-config.js'); return; }
  if (!S.currentTrack) { toast('Play a track first'); return; }
  openModal('identifyModal');
  document.getElementById('identifyResult').innerHTML = '<p style="text-align:center;padding:20px">🎵 Listening…</p>';
  try {
    const blobUrl = S.currentTrack._blobUrl || await getBlobUrl(S.currentTrack);
    if (!blobUrl) { toast('⚠ Track not loaded'); return; }
    const blob = await fetch(blobUrl).then(r => r.blob());
    const sliced = blob.slice(0, 500000);
    const form = new FormData();
    form.append('file', sliced, 'sample.mp3');
    form.append('api_token', key);
    form.append('return', 'apple_music,spotify');
    const res = await fetch('https://api.audd.io/', { method: 'POST', body: form });
    const data = await res.json();
    if (data.result) {
      const r = data.result;
      document.getElementById('identifyResult').innerHTML = `
        <div class="id-result-card">
          ${r.apple_music?.artwork?.url ? `<img class="id-result-art" src="${r.apple_music.artwork.url.replace('{w}x{h}','120x120')}" alt="" />` : '<div class="id-result-art" style="display:flex;align-items:center;justify-content:center;font-size:2rem">🎵</div>'}
          <div class="id-result-title">${esc(r.title)}</div>
          <div class="id-result-artist">${esc(r.artist)}</div>
          <div class="id-result-album">${esc(r.album)} · ${r.release_date || ''}</div>
        </div>`;
    } else {
      document.getElementById('identifyResult').innerHTML = '<p style="text-align:center;padding:20px;color:var(--text-sub)">Song not identified.</p>';
    }
  } catch(e) {
    document.getElementById('identifyResult').innerHTML = '<p style="color:var(--red);text-align:center">Error identifying song.</p>';
  }
});
document.getElementById('identifyClose').addEventListener('click', () => closeModal('identifyModal'));

// ── AI Translation ─────────────────────────────────────────────
const transInput  = document.getElementById('transInput');
const transOutput = document.getElementById('transOutput');

transInput.addEventListener('input', () => {
  document.getElementById('transCharCount').textContent = transInput.value.length + ' / 1000';
});
document.getElementById('swapLangBtn').addEventListener('click', () => {
  const f = document.getElementById('transFrom');
  const t = document.getElementById('transTo');
  const tmp = f.value; f.value = t.value; t.value = tmp;
});
document.getElementById('transBtn').addEventListener('click', async () => {
  const text = transInput.value.trim();
  if (!text) return;
  const from = document.getElementById('transFrom').value;
  const to   = document.getElementById('transTo').value;
  transOutput.innerHTML = '<p style="color:var(--text-sub)">⏳ Translating…</p>';
  const key  = typeof GEMINI_API_KEY !== 'undefined' ? GEMINI_API_KEY : '';
  if (key) {
    try {
      const body = { contents: [{ parts: [{ text: `Translate the following text from ${from} to ${to}. Return ONLY the translation, nothing else.\n\n${text}` }] }] };
      const res  = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      const data = await res.json();
      const result = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (result) { transOutput.innerHTML = `<p style="line-height:1.8">${esc(result)}</p>`; return; }
    } catch(e) { console.warn('Gemini failed, falling back to MyMemory'); }
  }
  // Fallback: MyMemory (free)
  try {
    const url  = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
    const data = await (await fetch(url)).json();
    if (data.responseStatus === 200) {
      const d = document.createElement('textarea'); d.innerHTML = data.responseData.translatedText; const decoded = d.value;
      transOutput.innerHTML = `<p style="line-height:1.8">${esc(decoded)}</p>`;
    } else throw new Error();
  } catch {
    transOutput.innerHTML = '<p style="color:var(--red)">Translation failed. Please try again.</p>';
  }
});
document.querySelectorAll('.phrase-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    transInput.value = chip.getAttribute('data-text');
    document.getElementById('transCharCount').textContent = transInput.value.length + ' / 1000';
    document.getElementById('transBtn').click();
  });
});

// ── YouTube → MP3 ─────────────────────────────────────────────
document.getElementById('ytBtn').addEventListener('click', () => openModal('ytModal'));
document.getElementById('ytClose').addEventListener('click', () => closeModal('ytModal'));
document.getElementById('ytConvertBtn').addEventListener('click', async () => {
  const url = document.getElementById('ytUrl').value.trim();
  if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
    document.getElementById('ytStatus').textContent = '⚠ Enter a valid YouTube URL';
    return;
  }
  const statusEl  = document.getElementById('ytStatus');
  const convertBtn = document.getElementById('ytConvertBtn');
  statusEl.textContent = '⏳ Converting… this may take a moment';
  convertBtn.disabled = true;

  // Try cobalt.tools new API (v10+)
  const cobaltResult = await tryCobalt(url);
  if (cobaltResult) {
    triggerDownload(cobaltResult);
    statusEl.innerHTML = '✅ Download started!<br><small>Save the MP3 then add it to ERI-FAM with the + button.</small>';
    convertBtn.disabled = false;
    return;
  }

  // Fallback: open loader.to in new tab
  const loaderUrl = `https://loader.to/api/button/?url=${encodeURIComponent(url)}&f=mp3`;
  statusEl.innerHTML = `Cobalt unavailable — opening <strong>loader.to</strong> as backup…`;
  setTimeout(() => {
    window.open(loaderUrl, '_blank', 'noopener');
    statusEl.innerHTML = '✅ Opened loader.to — download the MP3 then add it to ERI-FAM with the + button.';
    convertBtn.disabled = false;
  }, 800);
});

async function tryCobalt(url) {
  // cobalt.tools API v10+ (new format)
  try {
    const res = await fetch('https://api.cobalt.tools/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ url, downloadMode: 'audio', audioFormat: 'mp3', filenamePattern: 'basic' }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if ((data.status === 'tunnel' || data.status === 'redirect') && data.url) return data.url;
    if (data.url) return data.url;
    return null;
  } catch { return null; }
}

function triggerDownload(href) {
  const a = document.createElement('a');
  a.href = href; a.target = '_blank'; a.rel = 'noopener'; a.click();
}

document.getElementById('ytModal').addEventListener('click', e => { if (e.target.id === 'ytModal') closeModal('ytModal'); });

// ── Firebase Cloud Sync ────────────────────────────────────────
async function syncCloud() {
  const ready = await FB_READY;
  if (!ready) return;
  const banner = document.getElementById('syncBanner');
  banner.style.display = '';
  document.getElementById('syncMsg').textContent = 'Syncing new tracks…';
  try {
    const snap = await db.getDocs(db.query(db.collection(db._db, 'tracks'), db.orderBy('addedAt', 'desc')));
    S.cloudTracks = snap.docs.map(d => ({ ...d.data(), id: d.id, type: 'cloud' }));
    renderTracks(); updateStats();
    if (activeLibTab === 'songs')   renderSongs();
    if (activeLibTab === 'artists') renderArtists();
    if (activeLibTab === 'albums')  renderAlbums();
    document.getElementById('syncMsg').textContent = `✅ ${S.cloudTracks.length} cloud tracks loaded`;
    setTimeout(() => banner.style.display = 'none', 3000);
    renderTopCharts();
  } catch(e) {
    console.warn('[Sync]', e);
    banner.style.display = 'none';
  }
}

document.getElementById('syncNowBtn').addEventListener('click',  () => { closePanel('settingsPanel'); syncCloud(); });
document.getElementById('statSyncBtn').addEventListener('click', () => syncCloud());
document.getElementById('syncDismiss').addEventListener('click', () => document.getElementById('syncBanner').style.display = 'none');

// ── PWA Install ────────────────────────────────────────────────
let deferredPrompt;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferredPrompt = e;
  setTimeout(() => { if (!localStorage.getItem('pwa-dismissed')) document.getElementById('installBanner').style.display = ''; }, 4000);
});
document.getElementById('installBtn').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  document.getElementById('installBanner').style.display = 'none';
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
});
document.getElementById('installDismiss').addEventListener('click', () => {
  document.getElementById('installBanner').style.display = 'none';
  localStorage.setItem('pwa-dismissed', '1');
});

// ── Offline / Online ───────────────────────────────────────────
const offlineBar = document.getElementById('offlineBar');
window.addEventListener('offline', () => { offlineBar.style.display = ''; });
window.addEventListener('online',  () => { offlineBar.style.display = 'none'; syncCloud(); });

// ── Service Worker ─────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(r => console.log('[SW] registered', r.scope))
      .catch(e => console.warn('[SW] failed', e));
  });
}

// ── Init ───────────────────────────────────────────────────────
async function init() {
  await openIDB();

  // Liked tracks
  const liked = JSON.parse(localStorage.getItem('erifam_liked') || '[]');
  S.likedIds = new Set(liked);

  // Restore all settings from IDB
  const [volS, shufS, repS, cfS, normS, gapS, eqS] = await Promise.all([
    idbGet('settings', 'volume'),
    idbGet('settings', 'shuffle'),
    idbGet('settings', 'repeat'),
    idbGet('settings', 'crossfade'),
    idbGet('settings', 'normalize'),
    idbGet('settings', 'gapless'),
    idbGet('settings', 'eqValues'),
  ]);
  if (volS)  { S.volume = volS.value; audio.volume = S.volume; document.getElementById('volSlider').value = S.volume * 100; }
  if (shufS) { S.shuffle = shufS.value; document.getElementById('shuffleBtn').classList.toggle('active', S.shuffle); }
  if (repS && repS.value !== 'off') {
    S.repeat = repS.value;
    const rBtn = document.getElementById('repeatBtn');
    rBtn.classList.add('active');
    rBtn.title = S.repeat === 'one' ? 'Repeat one' : 'Repeat all';
  }
  if (cfS)   { S.crossfade = cfS.value; document.getElementById('crossfadeSlider').value = cfS.value; document.getElementById('crossfadeVal').textContent = cfS.value + 's'; }
  if (normS) { S.normalize = normS.value; document.getElementById('normalizeCheck').checked = normS.value; }
  if (gapS != null) { S.gapless = gapS.value; document.getElementById('gaplessCheck').checked = gapS.value; }
  if (eqS?.value?.length) pendingEqRestore = eqS.value; // applied when AudioCtx opens

  await loadLocalTracks();
  buildEqSliders();

  // Apply saved EQ values to sliders visually (AudioCtx not needed for that)
  if (pendingEqRestore) {
    pendingEqRestore.forEach((v, i) => {
      const inp = document.querySelector(`[data-band="${i}"]`);
      if (inp) inp.value = v;
    });
  }

  // Restore last played track (paused at saved position, no auto-play)
  const lastId  = localStorage.getItem('erifam_last_track');
  const lastPos = parseFloat(localStorage.getItem('erifam_last_pos') || '0');
  if (lastId) {
    const track = S.tracks.find(t => t.id === lastId) || S.cloudTracks.find(t => t.id === lastId);
    if (track) {
      S.currentTrack = track;
      const src = track.type === 'cloud' ? track.url : await getBlobUrl(track);
      if (src) {
        audio.src = src;
        audio.volume = S.volume;
        audio.addEventListener('loadedmetadata', () => {
          if (lastPos > 1 && lastPos < (audio.duration || 0) - 2) {
            audio.currentTime = lastPos;
          }
        }, { once: true });
        updatePlayerUI();
        showMiniPlayer();
        updateMediaSession();
      } else {
        updatePlayerUI();
        showMiniPlayer();
      }
    }
  }

  renderTopCharts();
  renderPlaylists();
  renderRadioGrid();
  initSwipeGestures();
  initNotificationListener();
  handlePlayParam();

  if (navigator.onLine) { syncCloud(); loadPromos(); }

  const savedView = localStorage.getItem('erifam_view');
  if (savedView && document.getElementById('view-' + savedView)) switchView(savedView);
}

init();

/* ════════════════════════════════════════════════════════════════
   FEATURE 1 — Smart Filename Parser
   ════════════════════════════════════════════════════════════════ */
function parseFilename(filename) {
  let name = filename.replace(/\.[^.]+$/, '').trim();
  let artist = 'Unknown Artist', title = name, featStr = '';

  // Remove leading track number: "01 - ", "1. ", "01.", "1 " etc.
  name = name.replace(/^\d{1,3}[\s.\-]+/, '').trim();

  // Extract feat./ft. section: "(feat. X)", "[ft. X]", "feat. X"
  const featRx = /[\(\[]?(?:feat|ft)\.?\s+([^\)\]]+)[\)\]]?/i;
  const featMatch = name.match(featRx);
  if (featMatch) {
    featStr = featMatch[1].trim();
    name = name.replace(featMatch[0], '').trim().replace(/\s{2,}/g, ' ');
  }

  // Primary split on " - "
  if (name.includes(' - ')) {
    const parts = name.split(' - ');
    artist = parts[0].trim();
    title  = parts.slice(1).join(' - ').trim();
  } else if (name.includes(' _ ')) {
    const parts = name.split(' _ ');
    artist = parts[0].trim(); title = parts.slice(1).join(' ').trim();
  } else {
    title = name;
  }

  // Clean up stray parens/brackets
  title  = title.replace(/\s*[\(\[]\s*[\)\]]/g, '').trim();
  artist = artist.replace(/\s*[\(\[]\s*[\)\]]/g, '').trim();

  if (featStr) title += ` (feat. ${featStr})`;
  return { title: title || 'Unknown Title', artist: artist || 'Unknown Artist' };
}

/* ════════════════════════════════════════════════════════════════
   FEATURE 2 — Waveform / Audio Visualizer
   ════════════════════════════════════════════════════════════════ */
let vizActive = false, vizRaf = null;

function startVisualizer() {
  const canvas = document.getElementById('vizCanvas');
  if (!analyserNode || !canvas) return;
  const ctx = canvas.getContext('2d');
  const buf = new Uint8Array(analyserNode.frequencyBinCount);

  function draw() {
    if (!vizActive) return;
    vizRaf = requestAnimationFrame(draw);
    analyserNode.getByteFrequencyData(buf);
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const barW = (W / buf.length) * 2.2;
    let x = 0;
    buf.forEach(val => {
      const h = (val / 255) * H;
      const r = Math.floor(200 + val * 0.22), g = Math.floor(20 + val * 0.08), b = Math.floor(50 + val * 0.1);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, H - h, barW - 1, h);
      x += barW + 1;
    });
  }
  draw();
}

function stopVisualizer() {
  if (vizRaf) cancelAnimationFrame(vizRaf);
  vizRaf = null;
  const canvas = document.getElementById('vizCanvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

document.getElementById('vizToggleBtn').addEventListener('click', async () => {
  const wasPlaying = !audio.paused;
  const savedTime  = audio.currentTime;
  try {
    initAudioCtx();
    if (audioCtx.state !== 'running') await audioCtx.resume();
  } catch(e) { console.warn('[AudioCtx]', e); }
  if (wasPlaying && audio.paused) { audio.currentTime = savedTime; audio.play().catch(() => {}); }
  vizActive = !vizActive;
  const canvas = document.getElementById('vizCanvas');
  const btn = document.getElementById('vizToggleBtn');
  if (vizActive) {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    canvas.style.display = '';
    btn.classList.add('active');
    if (S.playing) startVisualizer();
  } else {
    canvas.style.display = 'none';
    btn.classList.remove('active');
    stopVisualizer();
  }
});

audio.addEventListener('play',  () => { if (vizActive) startVisualizer(); });
audio.addEventListener('pause', () => stopVisualizer());

/* ════════════════════════════════════════════════════════════════
   FEATURE 3 — Swipe Gestures
   ════════════════════════════════════════════════════════════════ */
function initSwipeGestures() {
  // Mini player: swipe left = next, swipe right = prev
  const mini = document.getElementById('miniPlayer');
  let mTouchX = 0;
  mini.addEventListener('touchstart', e => { mTouchX = e.touches[0].clientX; }, { passive: true });
  mini.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - mTouchX;
    if (Math.abs(dx) > 50) { dx < 0 ? nextTrack() : prevTrack(); }
  }, { passive: true });

  // Full player: swipe down = close
  const fp = document.getElementById('fullPlayer');
  let fpTouchY = 0;
  fp.addEventListener('touchstart', e => { fpTouchY = e.touches[0].clientY; }, { passive: true });
  fp.addEventListener('touchend', e => {
    const dy = e.changedTouches[0].clientY - fpTouchY;
    if (dy > 80) closePanel('fullPlayer');
  }, { passive: true });
}

/* ════════════════════════════════════════════════════════════════
   FEATURE 4 — Live Eritrean Radio
   ════════════════════════════════════════════════════════════════ */
const RADIO_STATIONS = [
  { id: 're',    name: 'Radio Erena',       desc: 'Eritrean Diaspora Radio',   lang: 'Tigrinya · Arabic',    icon: '📻', url: 'https://streaming.radioerena.net/radio_erena' },
  { id: 'dh',    name: 'Dimtsi Hafash',     desc: 'Voice of Broad Masses',     lang: 'Tigrinya · Arabic',    icon: '🎙', url: 'https://stream.eritrea.net/live' },
  { id: 've',    name: 'Voice of Eritrea',  desc: 'Community Radio',           lang: 'Tigrinya',             icon: '📡', url: 'https://voiceoferitrea.net/stream' },
  { id: 'awate', name: 'Awate Radio',       desc: 'News & Commentary',         lang: 'Tigrinya · English',   icon: '🗞', url: 'https://awate.com/radio/stream' },
  { id: 'assna', name: 'Assenna Radio',     desc: 'Independent Eritrean Radio',lang: 'Tigrinya',             icon: '🌍', url: 'https://assenna.com/radio/stream' },
  { id: 'zara',  name: 'Radio Zara',        desc: 'Eritrean Music & Culture',  lang: 'Tigrinya · English',   icon: '🎶', url: 'https://radiosalina.net/stream' },
];

let radioAudio = null, currentStation = null;

function renderRadioGrid() {
  const grid = document.getElementById('radioGrid');
  grid.innerHTML = RADIO_STATIONS.map(s => `
    <div class="radio-card${currentStation?.id === s.id ? ' playing' : ''}" data-rid="${s.id}">
      <div class="radio-card-icon">${s.icon}</div>
      <div class="radio-card-name">${esc(s.name)}</div>
      <div class="radio-card-desc">${esc(s.desc)}</div>
      <div class="radio-card-lang">${esc(s.lang)}</div>
      ${currentStation?.id === s.id
        ? '<div class="radio-live-badge"><span class="radio-live-dot"></span> Live</div>'
        : '<div class="radio-card-lang" style="color:var(--text-dim)">Tap to stream</div>'}
    </div>`).join('');
  grid.querySelectorAll('.radio-card').forEach(card => {
    card.addEventListener('click', () => playRadio(card.getAttribute('data-rid')));
  });
}

function playRadio(id) {
  const station = RADIO_STATIONS.find(s => s.id === id);
  if (!station) return;
  if (currentStation?.id === id) { stopRadio(); return; }
  stopRadio();
  // Pause main audio
  if (S.playing) { audio.pause(); S.playing = false; updatePlayIcons(); }
  radioAudio = new Audio(station.url);
  radioAudio.volume = S.volume;
  radioAudio.play().catch(() => toast('⚠ Could not connect to this stream'));
  currentStation = station;
  const rnp = document.getElementById('radioNowPlaying');
  document.getElementById('rnpArt').textContent  = station.icon;
  document.getElementById('rnpName').textContent = station.name;
  rnp.style.display = '';
  renderRadioGrid();
  toast(`📻 ${station.name}`);
  // Media session for radio
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({ title: station.name, artist: station.desc, album: 'Live Radio', artwork: [] });
    navigator.mediaSession.setActionHandler('pause', stopRadio);
    navigator.mediaSession.setActionHandler('play', () => radioAudio?.play());
  }
}

function stopRadio() {
  if (radioAudio) { radioAudio.pause(); radioAudio.src = ''; radioAudio = null; }
  currentStation = null;
  document.getElementById('radioNowPlaying').style.display = 'none';
  renderRadioGrid();
}

document.getElementById('rnpStop').addEventListener('click', stopRadio);

/* ════════════════════════════════════════════════════════════════
   FEATURE 5 — Artist Page (click artist name)
   ════════════════════════════════════════════════════════════════ */
document.getElementById('fpArtist').addEventListener('click', () => {
  const t = S.currentTrack;
  if (!t || !t.artist || t.artist === '—') return;
  openArtistModal(t.artist);
});

function openArtistModal(artistName) {
  const all = [...S.tracks, ...S.cloudTracks].filter(t => t.artist === artistName);
  document.getElementById('artistModalName').textContent = artistName;
  document.getElementById('artistModalCount').textContent = `${all.length} track${all.length !== 1 ? 's' : ''}`;
  const list = document.getElementById('artistModalTracks');
  list.innerHTML = all.map((t, i) => `
    <div class="track-row" data-id="${t.id}" data-idx="${i}">
      <div class="tr-art">${artEl(t,'list')}</div>
      <div class="tr-info">
        <div class="tr-title">${esc(t.title)}</div>
        <div class="tr-artist">${esc(t.album || fmtTime(t.duration))}</div>
      </div>
      <span class="tr-dur">${fmtTime(t.duration)}</span>
    </div>`).join('');
  list.querySelectorAll('.track-row').forEach(row => {
    row.addEventListener('click', () => {
      const track = all.find(t => t.id === row.getAttribute('data-id'));
      if (track) { playTrack(track, all); closeModal('artistModal'); }
    });
  });
  openModal('artistModal');
}

document.getElementById('artistModalClose').addEventListener('click', () => closeModal('artistModal'));
document.getElementById('artistModal').addEventListener('click', e => { if (e.target.id === 'artistModal') closeModal('artistModal'); });

/* ════════════════════════════════════════════════════════════════
   FEATURE 6 — Share a Song
   ════════════════════════════════════════════════════════════════ */
document.getElementById('shareBtn').addEventListener('click', async () => {
  const t = S.currentTrack;
  if (!t) { toast('Play a track first'); return; }
  const shareUrl = `${location.origin}${location.pathname}?play=${t.id}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: t.title, text: `🎵 ${t.title} — ${t.artist} on ERI-FAM`, url: shareUrl });
    } catch (e) { if (e.name !== 'AbortError') toast('Share cancelled'); }
  } else {
    try { await navigator.clipboard.writeText(shareUrl); toast('📋 Link copied to clipboard!'); }
    catch { toast('Share: ' + shareUrl); }
  }
});

// Handle ?play=trackId on load
function handlePlayParam() {
  const params = new URLSearchParams(location.search);
  const playId = params.get('play');
  if (!playId) return;
  const check = setInterval(() => {
    const track = [...S.tracks, ...S.cloudTracks].find(t => t.id === playId);
    if (track) { clearInterval(check); playTrack(track, getAllTracks()); openPanel('fullPlayer'); }
  }, 800);
  setTimeout(() => clearInterval(check), 10000);
}

/* ════════════════════════════════════════════════════════════════
   FEATURE 7 — Top Charts (most played from Firestore)
   ════════════════════════════════════════════════════════════════ */
function renderTopCharts() {
  const section = document.getElementById('topChartsSection');
  const scroll  = document.getElementById('chartScroll');
  const all = [...S.cloudTracks, ...S.tracks].filter(t => (t.playCount || 0) > 0);
  const top = [...all].sort((a, b) => (b.playCount || 0) - (a.playCount || 0)).slice(0, 10);
  if (!top.length) { section.style.display = 'none'; return; }
  scroll.innerHTML = top.map((t, i) => `
    <div class="chart-item" data-id="${t.id}">
      <div class="chart-item-art">
        ${t.artwork ? `<img src="${t.artwork}" alt="" loading="lazy" />` : artEl(t,'card')}
        <div class="chart-rank${i < 3 ? ' top3' : ''}">${i + 1}</div>
      </div>
      <div class="chart-item-info">
        <div class="chart-title">${esc(t.title)}</div>
        <div class="chart-artist">${esc(t.artist)}</div>
        <div class="chart-plays">▶ ${t.playCount || 0}</div>
      </div>
    </div>`).join('');
  scroll.querySelectorAll('.chart-item').forEach(item => {
    item.addEventListener('click', () => {
      const track = top.find(t => t.id === item.getAttribute('data-id'));
      if (track) playTrack(track, top);
    });
  });
  section.style.display = '';
}

/* ════════════════════════════════════════════════════════════════
   FEATURE 8 — Lyrics Panel
   ════════════════════════════════════════════════════════════════ */
document.getElementById('lyricsBtn').addEventListener('click', () => {
  const t = S.currentTrack;
  const body = document.getElementById('lyricsBody');
  if (!t) { toast('Play a track first'); return; }
  const lyrics = t.lyrics || '';
  if (lyrics) {
    body.innerHTML = `
      <div class="lyrics-track-info">
        <h4>${esc(t.title)}</h4><p>${esc(t.artist)}</p>
      </div>
      <div class="lyrics-text">${esc(lyrics)}</div>`;
  } else {
    body.innerHTML = `
      <div class="lyrics-track-info"><h4>${esc(t.title)}</h4><p>${esc(t.artist)}</p></div>
      <p class="empty-msg">No lyrics available for this track.<br>Admin can add lyrics from the admin panel.</p>`;
  }
  openPanel('lyricsPanel');
});
document.getElementById('lyricsClose').addEventListener('click', () => closePanel('lyricsPanel'));

/* ════════════════════════════════════════════════════════════════
   FEATURE 9 — Download Cloud Track for Offline
   ════════════════════════════════════════════════════════════════ */
document.getElementById('dlTrackBtn').addEventListener('click', () => {
  const t = S.currentTrack;
  if (!t) { toast('Play a track first'); return; }
  if (t.type === 'local') { toast('✅ Already saved locally'); return; }
  if (!t.url) { toast('⚠ No download URL'); return; }
  downloadCloudTrack(t);
});

async function downloadCloudTrack(track) {
  if (track._downloading) return;
  track._downloading = true;
  toast('⬇ Downloading…');
  try {
    const res  = await fetch(track.url);
    if (!res.ok) throw new Error('Network error');
    const buf  = await res.arrayBuffer();
    const mimeType = track.mimeType || 'audio/mpeg';
    const local = {
      ...track,
      type: 'local',
      hashKey: track.title.toLowerCase() + '_' + Math.round(track.duration || 0),
      addedAt: Date.now(),
    };
    delete local._blobUrl;
    delete local.data;
    await idbPut('tracks', local);
    await idbPut('trackData', { id: local.id, data: buf });
    local._blobUrl = URL.createObjectURL(new Blob([buf], { type: mimeType }));
    // Remove cloud copy from S.cloudTracks to avoid duplicate display
    S.cloudTracks = S.cloudTracks.filter(t => t.id !== track.id);
    // Add as local
    const existing = S.tracks.findIndex(t => t.id === track.id);
    if (existing > -1) S.tracks[existing] = local;
    else S.tracks.push(local);
    renderTracks(); updateStats(); renderTopCharts();
    toast('✅ Saved to your library!');
  } catch(e) {
    toast('⚠ Download failed: ' + e.message);
  } finally {
    track._downloading = false;
  }
}

// Add cloud-only actions (download + share) after the sheet opens
function addCloudSheetActions(track) {
  if (track.type !== 'cloud') return;
  const actions = document.getElementById('sheetActions');
  const dlBtn = document.createElement('button');
  dlBtn.className = 'sheet-action';
  dlBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;color:var(--text-sub)"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Save Offline`;
  dlBtn.onclick = () => { downloadCloudTrack(track); closeSheet(); };
  actions.appendChild(dlBtn);
  const shareBtn2 = document.createElement('button');
  shareBtn2.className = 'sheet-action';
  shareBtn2.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;color:var(--text-sub)"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>Share Song`;
  shareBtn2.onclick = async () => {
    closeSheet();
    const url = `${location.origin}${location.pathname}?play=${track.id}`;
    if (navigator.share) { try { await navigator.share({ title: track.title, text: `🎵 ${track.title} — ${track.artist}`, url }); } catch(e) {} }
    else { try { await navigator.clipboard.writeText(url); toast('📋 Link copied!'); } catch(e) {} }
  };
  actions.appendChild(shareBtn2);
}

/* ════════════════════════════════════════════════════════════════
   FEATURE 10 — Push Notification Listener
   ════════════════════════════════════════════════════════════════ */
async function initNotificationListener() {
  const ready = await FB_READY;
  if (!ready) return;
  let lastCheck = Date.now() - 60000;
  try {
    db.onSnapshot(
      db.query(db.collection(db._db, 'notifications'), db.orderBy('createdAt', 'desc')),
      snap => {
        snap.docChanges().forEach(change => {
          if (change.type === 'added') {
            const n = change.doc.data();
            if ((n.createdAt || 0) > lastCheck) {
              lastCheck = Date.now();
              showInAppNotification(n);
            }
          }
        });
      }
    );
  } catch(e) { console.warn('[Notifications]', e); }
}

function showInAppNotification(n) {
  const el = document.createElement('div');
  el.className = 'notif-banner';
  el.innerHTML = `
    <div class="notif-inner">
      <span class="notif-icon">🔔</span>
      <div class="notif-text"><strong>${esc(n.title || '')}</strong><span>${esc(n.body || '')}</span></div>
      <button class="notif-close">✕</button>
    </div>`;
  el.querySelector('.notif-close').onclick = () => el.remove();
  if (n.url) el.style.cursor = 'pointer', el.addEventListener('click', () => window.open(n.url));
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 8000);
}

// Notification banner styles (injected dynamically so they don't need separate CSS)
const notifStyle = document.createElement('style');
notifStyle.textContent = `
  .notif-banner {
    position: fixed; top: 60px; left: 50%; transform: translateX(-50%);
    z-index: 9998; max-width: 360px; width: calc(100% - 32px);
    background: var(--surface); border: 1px solid rgba(0,179,86,0.4);
    border-radius: 14px; box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    animation: fadeIn 0.3s ease forwards;
  }
  .notif-inner { display: flex; align-items: center; gap: 10px; padding: 12px 14px; }
  .notif-icon { font-size: 1.4rem; flex-shrink: 0; }
  .notif-text { flex: 1; min-width: 0; }
  .notif-text strong { display: block; font-size: 0.88rem; font-weight: 700; }
  .notif-text span { font-size: 0.78rem; color: var(--text-sub); }
  .notif-close { color: var(--text-dim); padding: 4px 8px; font-size: 1rem; flex-shrink: 0; }
`;
document.head.appendChild(notifStyle);

/* ════════════════════════════════════════════════════════════════
   ERi-TV + LIVE TV PLAYER
   ════════════════════════════════════════════════════════════════ */
const TV_STATIONS = [
  {
    id:        'eritv',
    name:      'ERi-TV',
    desc:      'Eritrean State Television — News, Culture & Entertainment',
    lang:      'Tigrinya · Arabic · English',
    icon:      '📺',
    streamUrl: 'https://jmc-live.ercdn.net/eritreatv/eritreatv.m3u8',
    ytUrl:     'https://www.youtube.com/channel/UCpPhzhCfud9ctQSJJv4Kqlw/live',
  },
  {
    id:       'erisat',
    name:     'ERISAT',
    desc:     'Eritrean Satellite Television — News & Commentary',
    lang:     'Tigrinya · English',
    icon:     '📡',
    embedUrl: 'https://www.youtube.com/embed/live_stream?channel=UCuGlhBoxVNUBIAtP4-0Kqfw&autoplay=1',
    ytUrl:    'https://www.youtube.com/channel/UCuGlhBoxVNUBIAtP4-0Kqfw/live',
  },
  {
    id:       'assenna',
    name:     'ATV Asena',
    desc:     'Independent Eritrean Media — News & Analysis',
    lang:     'Tigrinya',
    icon:     '🎙',
    embedUrl: 'https://www.youtube.com/embed/live_stream?channel=UCXdyJFImjPTccqnZ46ccrmw&autoplay=1',
    ytUrl:    'https://www.youtube.com/c/ATVasena/live',
  },
];

function renderTVGrid() {
  const grid = document.getElementById('tvGrid');
  if (!grid) return;
  grid.innerHTML = TV_STATIONS.map(s => `
    <div class="tv-card" data-tvid="${s.id}">
      <div class="tv-card-thumb">
        ${s.thumb ? `<img src="${s.thumb}" alt="" loading="lazy" />` : s.icon}
        <div class="tv-thumb-overlay">
          <div class="tv-play-btn"><svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>
        </div>
        <div class="tv-live-pill"><span class="radio-live-dot" style="width:5px;height:5px;background:white"></span> LIVE</div>
      </div>
      <div class="tv-card-info">
        <div class="tv-card-name">${esc(s.name)}</div>
        <div class="tv-card-desc">${esc(s.desc)}</div>
        <div class="tv-card-lang">${esc(s.lang)}</div>
      </div>
    </div>`).join('');
  grid.querySelectorAll('.tv-card').forEach(card => {
    card.addEventListener('click', () => openTVPlayer(card.getAttribute('data-tvid')));
  });
}

let tvHls = null;

function openTVPlayer(id) {
  const station = TV_STATIONS.find(s => s.id === id);
  if (!station) return;
  if (S.playing) { audio.pause(); S.playing = false; updatePlayIcons(); }
  if (radioAudio) stopRadio();

  document.getElementById('tvOverlayName').textContent = station.name;
  document.getElementById('tvOverlayDesc').textContent = `${station.name} — ${station.desc} · ${station.lang}`;
  document.getElementById('tvYTLink').href = station.ytUrl || '#';
  document.getElementById('tvYTLink').style.display = station.ytUrl ? '' : 'none';

  const video  = document.getElementById('tvVideo');
  const iframe = document.getElementById('tvIframe');
  const hint   = document.getElementById('tvOverlayHint');

  if (station.streamUrl) {
    iframe.style.display = 'none';
    iframe.src = 'about:blank';
    video.style.display = '';
    hint.textContent = 'Direct satellite stream';
    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
      if (tvHls) tvHls.destroy();
      tvHls = new Hls({ lowLatencyMode: true });
      tvHls.loadSource(station.streamUrl);
      tvHls.attachMedia(video);
      tvHls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
      tvHls.on(Hls.Events.ERROR, (e, data) => {
        if (data.fatal) toast('⚠ Stream error — try the YouTube link above');
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = station.streamUrl;
      video.play().catch(() => {});
    } else {
      toast('⚠ Browser cannot play this stream');
    }
  } else if (station.embedUrl) {
    video.style.display = 'none';
    video.pause(); video.src = '';
    if (tvHls) { tvHls.destroy(); tvHls = null; }
    iframe.style.display = '';
    iframe.src = station.embedUrl;
    hint.textContent = 'Streaming via YouTube';
  } else {
    window.open(station.ytUrl, '_blank', 'noopener,noreferrer');
    toast(`📺 Opening ${station.name}…`);
    return;
  }

  document.getElementById('tvOverlay').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeTVPlayer() {
  if (tvHls) { tvHls.destroy(); tvHls = null; }
  const video = document.getElementById('tvVideo');
  video.pause(); video.src = '';
  document.getElementById('tvIframe').src = 'about:blank';
  document.getElementById('tvOverlay').style.display = 'none';
  document.body.style.overflow = '';
}

document.getElementById('tvClose').addEventListener('click', closeTVPlayer);

// Render TV grid when radio view is first shown
document.querySelectorAll('.nav-item').forEach(btn => {
  if (btn.getAttribute('data-view') === 'radio') {
    btn.addEventListener('click', renderTVGrid, { once: true });
  }
});
// Also render on init if already on radio view
renderTVGrid();

/* ════════════════════════════════════════════════════════════════
   USER FEEDBACK SYSTEM
   ════════════════════════════════════════════════════════════════ */
let feedbackRating = 0;

// FAB opens feedback modal
document.getElementById('feedbackFab').addEventListener('click', () => {
  feedbackRating = 0;
  updateStars(0);
  document.getElementById('feedbackName').value  = '';
  document.getElementById('feedbackText').value  = '';
  document.getElementById('feedbackCharCount').textContent = '0 / 500';
  document.getElementById('starLabel').textContent = 'Tap to rate';
  openModal('feedbackModal');
});
document.getElementById('feedbackCloseBtn').addEventListener('click', () => closeModal('feedbackModal'));
document.getElementById('feedbackModal').addEventListener('click', e => { if (e.target.id === 'feedbackModal') closeModal('feedbackModal'); });

// Star rating
const starBtns = document.querySelectorAll('.star-btn');
const starLabels = ['', 'Poor 😔', 'Fair 🙂', 'Good 👍', 'Great 😊', 'Amazing! 🔥'];
starBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    feedbackRating = parseInt(btn.getAttribute('data-val'));
    updateStars(feedbackRating);
    document.getElementById('starLabel').textContent = starLabels[feedbackRating] || '';
  });
  btn.addEventListener('mouseenter', () => updateStars(parseInt(btn.getAttribute('data-val')), true));
  btn.addEventListener('mouseleave', () => updateStars(feedbackRating));
});

function updateStars(val, hovering = false) {
  starBtns.forEach(b => {
    const bv = parseInt(b.getAttribute('data-val'));
    b.classList.toggle('active',   !hovering && bv <= val);
    b.classList.toggle('hovered',   hovering && bv <= val);
  });
}

// Character count
document.getElementById('feedbackText').addEventListener('input', e => {
  document.getElementById('feedbackCharCount').textContent = e.target.value.length + ' / 500';
});

// Submit feedback
document.getElementById('feedbackSubmitBtn').addEventListener('click', async () => {
  const message = document.getElementById('feedbackText').value.trim();
  const name    = document.getElementById('feedbackName').value.trim();
  if (!message) { document.getElementById('feedbackText').focus(); toast('⚠ Please write a message'); return; }
  if (!feedbackRating) { toast('⚠ Please select a rating'); return; }
  const btn = document.getElementById('feedbackSubmitBtn');
  btn.textContent = 'Sending…'; btn.disabled = true;
  try {
    const ready = await FB_READY;
    if (ready) {
      await db.addDoc(db.collection(db._db, 'feedback'), {
        rating: feedbackRating,
        message,
        name: name || 'Anonymous',
        createdAt: Date.now(),
        appVersion: '2.0',
      });
    } else {
      // Fallback: store locally so it's not lost
      const pending = JSON.parse(localStorage.getItem('erifam_feedback_pending') || '[]');
      pending.push({ rating: feedbackRating, message, name: name || 'Anonymous', createdAt: Date.now() });
      localStorage.setItem('erifam_feedback_pending', JSON.stringify(pending));
    }
    closeModal('feedbackModal');
    // Thank you animation
    setTimeout(() => {
      toast(`🙏  የቐንየለይ (Thank you)! Your feedback was received`);
    }, 200);
  } catch(e) {
    toast('⚠ Could not submit — saved locally');
    console.warn('[Feedback]', e);
  } finally {
    btn.textContent = 'Send Feedback'; btn.disabled = false;
  }
});

// ── SIDEBAR ────────────────────────────────────────────────────
const appSidebar     = document.getElementById('appSidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');

function openSidebar()  { appSidebar.classList.add('open'); sidebarOverlay.hidden = false; }
function closeSidebar() { appSidebar.classList.remove('open'); sidebarOverlay.hidden = true; }

document.getElementById('sidebarOpenBtn').addEventListener('click', openSidebar);
document.getElementById('sidebarClose').addEventListener('click', closeSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);

function switchView(viewName) {
  localStorage.setItem('erifam_view', viewName);
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  const viewEl = document.getElementById('view-' + viewName);
  if (viewEl) viewEl.classList.add('active');
  const navBtn = document.querySelector(`.nav-item[data-view="${viewName}"]`);
  if (navBtn) navBtn.classList.add('active');
  // Show/hide floating YT player when navigating away from YouTube view
  const ytFloat = document.getElementById('ytFloat');
  if (ytFloat && ytState.videoId) {
    ytFloat.hidden = (viewName === 'youtube');
  }
  // Auto-load Eritrean music on first YouTube view open
  if (viewName === 'youtube' && !ytState.loaded) {
    ytState.loaded = true;
    ytvSearch('eritrean music 2024');
  }
  // Load library content when switching to library view
  if (viewName === 'library') {
    if (activeLibTab === 'songs')     renderSongs();
    if (activeLibTab === 'playlists') renderPlaylists();
    if (activeLibTab === 'artists')   renderArtists();
    if (activeLibTab === 'albums')    renderAlbums();
  }
}

document.querySelectorAll('.sb-nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    switchView(btn.dataset.view);
    closeSidebar();
  });
});

document.querySelectorAll('.sb-sub-item').forEach(btn => {
  btn.addEventListener('click', () => {
    switchView(btn.dataset.view);
    if (btn.dataset.libtab) {
      activeLibTab = btn.dataset.libtab;
      document.querySelectorAll('.lib-tab').forEach(t => t.classList.toggle('active', t.dataset.libtab === btn.dataset.libtab));
      document.querySelectorAll('.lib-panel').forEach(p => p.classList.toggle('active', p.id === 'libtab-' + btn.dataset.libtab));
      if (btn.dataset.libtab === 'songs')   renderSongs();
      if (btn.dataset.libtab === 'artists') renderArtists();
      if (btn.dataset.libtab === 'albums')  renderAlbums();
    }
    closeSidebar();
  });
});

document.querySelectorAll('.sb-grp-hd').forEach(btn => {
  btn.addEventListener('click', () => {
    const grp = document.getElementById(btn.dataset.grp);
    const isOpen = grp.classList.contains('open');
    document.querySelectorAll('.sb-grp.open').forEach(g => g.classList.remove('open'));
    if (!isOpen) grp.classList.add('open');
  });
});

// ── YOUTUBE VANCED ────────────────────────────────────────────
const ytState = { videoId: null, title: '', author: '', thumb: '', loaded: false };

async function ytvSearch(query) {
  const grid   = document.getElementById('ytvGrid');
  const status = document.getElementById('ytvStatus');
  if (!query.trim()) return;
  status.textContent = '⏳ Searching…';
  grid.innerHTML = '';

  // ── Official YouTube Data API v3 (most reliable, requires key) ──
  if (typeof YOUTUBE_API_KEY !== 'undefined' && YOUTUBE_API_KEY) {
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=20&q=${encodeURIComponent(query)}&key=${YOUTUBE_API_KEY}`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.items) && data.items.length) {
          const results = data.items.map(v => ({
            videoId: v.id.videoId,
            title: v.snippet.title,
            author: v.snippet.channelTitle,
            lengthSeconds: 0,
            viewCount: 0,
            thumb: v.snippet.thumbnails?.medium?.url,
          })).filter(v => v.videoId);
          status.textContent = '';
          ytvRenderResults(results);
          return;
        }
      }
    } catch { /* fall through to proxy */ }
  }

  // ── Fallback: CORS proxies + Piped API ──
  const pipedUrl = `https://pipedapi.kavin.rocks/search?q=${encodeURIComponent(query)}&filter=videos`;
  const attempts = [
    () => fetch(pipedUrl, { signal: AbortSignal.timeout(6000) }),
    () => fetch(`https://corsproxy.io/?${encodeURIComponent(pipedUrl)}`, { signal: AbortSignal.timeout(9000) }),
    () => fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(pipedUrl)}`, { signal: AbortSignal.timeout(9000) }),
  ];
  for (const attempt of attempts) {
    try {
      const res = await attempt();
      if (!res.ok) continue;
      const data = await res.json();
      if (!Array.isArray(data.items) || !data.items.length) continue;
      const results = data.items
        .filter(v => v.url && v.type === 'stream')
        .map(v => ({
          videoId: v.url.replace('/watch?v=', ''),
          title: v.title,
          author: v.uploaderName,
          lengthSeconds: v.duration,
          viewCount: v.views,
        }))
        .filter(v => v.videoId);
      if (!results.length) continue;
      status.textContent = '';
      ytvRenderResults(results);
      return;
    } catch { /* try next */ }
  }

  status.textContent = '⚠ Search unavailable — add a YouTube API key in firebase-config.js';
}

function ytvRenderResults(results) {
  const grid = document.getElementById('ytvGrid');
  if (!results.length) { grid.innerHTML = '<p class="ytv-empty">No results found.</p>'; return; }
  grid.innerHTML = results.filter(v => v.videoId).map(v => {
    const thumb = v.thumb || `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`;
    const dur   = v.lengthSeconds ? ytvFmtDur(v.lengthSeconds) : '';
    const views = v.viewCount     ? ytvFmtViews(v.viewCount)   : '';
    const safeTitle  = (v.title  || '').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
    const safeAuthor = (v.author || '').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
    return `
      <div class="ytv-card" onclick="ytvPlay('${v.videoId}','${safeTitle}','${thumb}','${safeAuthor}')">
        <div class="ytv-thumb-wrap">
          <img class="ytv-thumb" src="${thumb}" alt="" loading="lazy" onerror="this.parentNode.style.background='#222'"/>
          ${dur ? `<span class="ytv-dur">${dur}</span>` : ''}
        </div>
        <div class="ytv-card-info">
          <div class="ytv-card-title">${esc(v.title || '')}</div>
          <div class="ytv-card-meta">${esc(v.author || '')}${views ? ' · ' + views : ''}</div>
        </div>
      </div>`;
  }).join('');
}

window.ytvPlay = function(videoId, title, thumb, author) {
  ytState.videoId = videoId;
  ytState.title   = title;
  ytState.thumb   = thumb;
  ytState.author  = author;

  const frame  = document.getElementById('ytvFrame');
  const player = document.getElementById('ytvPlayer');
  const wrap   = document.getElementById('ytvFrameWrap');

  frame.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&playsinline=1&modestbranding=1`;
  wrap.classList.remove('audio-mode');
  player.hidden = false;
  document.getElementById('ytvBarTitle').textContent  = title;
  document.getElementById('ytvBarAuthor').textContent = author;
  document.getElementById('ytvAudioBtn').classList.remove('active');

  // Float player info
  document.getElementById('ytFloatTitle').textContent  = title;
  document.getElementById('ytFloatAuthor').textContent = author;
  document.getElementById('ytFloatThumb').src          = thumb;
  document.getElementById('ytFloat').hidden            = true;

  player.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

function ytvStop() {
  const frame = document.getElementById('ytvFrame');
  frame.src = '';
  document.getElementById('ytvPlayer').hidden = true;
  document.getElementById('ytFloat').hidden   = true;
  ytState.videoId = null;
}

// Audio-only mode — collapse the video frame, keep audio
document.getElementById('ytvAudioBtn').addEventListener('click', () => {
  const wrap = document.getElementById('ytvFrameWrap');
  const on   = wrap.classList.toggle('audio-mode');
  document.getElementById('ytvAudioBtn').classList.toggle('active', on);
  toast(on ? '🎵 Audio-only — video hidden, music keeps playing' : '📺 Video restored');
});

// PiP — guide the user (iframe PiP is browser-native)
document.getElementById('ytvPipBtn').addEventListener('click', () => {
  toast('▶ Tap inside the video → browser menu → Picture in Picture');
});

document.getElementById('ytvCloseBtn').addEventListener('click', ytvStop);

// Float player controls
document.getElementById('ytFloatOpen').addEventListener('click',  () => switchView('youtube'));
document.getElementById('ytFloatClose').addEventListener('click', ytvStop);

// Search
document.getElementById('ytvSearchBtn').addEventListener('click', () => {
  const q = document.getElementById('ytvSearch').value.trim();
  if (q) ytvSearch(q);
});
document.getElementById('ytvSearch').addEventListener('keydown', e => {
  if (e.key === 'Enter') { const q = e.target.value.trim(); if (q) ytvSearch(q); }
});

// Preset chips
document.querySelectorAll('.ytv-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.ytv-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    document.getElementById('ytvSearch').value = '';
    ytvSearch(chip.dataset.q);
  });
});

function ytvFmtDur(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${m}:${String(sec).padStart(2,'0')}`;
}
function ytvFmtViews(n) {
  if (n >= 1e9) return (n/1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
  if (n >= 1e3) return Math.round(n/1e3) + 'K';
  return String(n);
}

// ── YOUTUBE WATCH PLAYER ───────────────────────────────────────
function parseYtId(input) {
  input = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return { type: 'video', id: input };
  const listM = input.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  if (listM) return { type: 'list', id: listM[1] };
  const vidM = input.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (vidM) return { type: 'video', id: vidM[1] };
  return null;
}

function ytWatchPlay(input) {
  const parsed = parseYtId(input);
  if (!parsed) { toast('Paste a valid YouTube URL or video ID'); return; }
  const frame = document.getElementById('ytWatchFrame');
  const empty = document.getElementById('ytWatchEmpty');
  const bar   = document.getElementById('ytWatchBar');
  const src = parsed.type === 'list'
    ? `https://www.youtube.com/embed/videoseries?list=${parsed.id}&autoplay=1&rel=0`
    : `https://www.youtube.com/embed/${parsed.id}?autoplay=1&rel=0&playsinline=1`;
  frame.src = src;
  frame.hidden = false;
  empty.style.display = 'none';
  bar.hidden = false;
}

document.getElementById('ytWatchPlayBtn').addEventListener('click', () => ytWatchPlay(document.getElementById('ytWatchInput').value));
document.getElementById('ytWatchInput').addEventListener('keydown', e => { if (e.key === 'Enter') ytWatchPlay(document.getElementById('ytWatchInput').value); });

// ── YouTube → MP3 ──────────────────────────────────────────────
document.getElementById('ytExtractBtn').addEventListener('click', ytExtractMp3);
document.getElementById('heroYtMp3Btn')?.addEventListener('click', () => {
  switchView('home');
  setTimeout(() => document.getElementById('ytWatchInput')?.focus(), 300);
});

async function ytExtractMp3() {
  const rawInput = document.getElementById('ytWatchInput').value.trim();
  if (!rawInput) { toast('Paste a YouTube URL above first.'); return; }

  let url = rawInput;
  if (!url.startsWith('http')) url = 'https://www.youtube.com/watch?v=' + url;

  const btn = document.getElementById('ytExtractBtn');
  btn.textContent = '⏳…'; btn.disabled = true;

  try {
    const res = await fetch('https://api.cobalt.tools/api/json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ url, aFormat: 'mp3', isAudioOnly: true, filenamePattern: 'basic' }),
    });
    if (!res.ok) throw new Error('Cobalt API error ' + res.status);
    const data = await res.json();
    if (data.status === 'error') throw new Error(data.text || 'Conversion failed');

    const downloadUrl = data.url;
    if (!downloadUrl) throw new Error('No audio URL returned');

    toast('⬇️ Downloading audio…');
    try {
      const audioRes = await fetch(downloadUrl);
      if (!audioRes.ok) throw new Error('fetch failed');
      const blob = await audioRes.blob();
      const filename = data.filename || 'youtube_audio.mp3';
      const file = new File([blob], filename, { type: blob.type || 'audio/mpeg' });
      await importFiles([file]);
      toast('✅ Added to your library!');
    } catch {
      // CORS blocked — fall back to browser download
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = data.filename || 'audio.mp3';
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast('💾 File downloading — drag it into the app to add it!', 3500);
    }
  } catch(e) {
    toast('❌ ' + (e.message || 'Convert failed. Try again.'), 3500);
  }
  btn.textContent = '↓ MP3'; btn.disabled = false;
}

document.querySelectorAll('.yt-pre').forEach(btn => {
  btn.addEventListener('click', () => ytWatchPlay(btn.dataset.vid));
});

document.getElementById('ytWatchStop').addEventListener('click', () => {
  const frame = document.getElementById('ytWatchFrame');
  frame.src = ''; frame.hidden = true;
  document.getElementById('ytWatchEmpty').style.display = '';
  document.getElementById('ytWatchBar').hidden = true;
});

document.getElementById('ytCollapseBtn').addEventListener('click', () => {
  document.getElementById('ytWatchSection').classList.toggle('collapsed');
});

// ── SETTINGS: ACCENT COLOR ─────────────────────────────────────
function applyAccent(hex) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  document.documentElement.style.setProperty('--accent', hex);
  const dk = '#' + [r,g,b].map(v => Math.max(0,v-30).toString(16).padStart(2,'0')).join('');
  document.documentElement.style.setProperty('--accent-dk', dk);
  document.documentElement.style.setProperty('--accent-glow', `rgba(${r},${g},${b},0.30)`);
  document.documentElement.style.setProperty('--gold', hex);
  localStorage.setItem('eri_accent', hex);
}

const savedAccent = localStorage.getItem('eri_accent');
if (savedAccent) applyAccent(savedAccent);

document.querySelectorAll('.setting-swatch').forEach(sw => {
  sw.addEventListener('click', () => {
    document.querySelectorAll('.setting-swatch').forEach(s => s.classList.remove('active'));
    sw.classList.add('active');
    document.getElementById('settingAccentColor').value = sw.dataset.color;
  });
  if (savedAccent && sw.dataset.color === savedAccent) sw.classList.add('active');
});

document.getElementById('applyColorBtn').addEventListener('click', () => {
  applyAccent(document.getElementById('settingAccentColor').value);
  toast('🎨 Color applied!');
});

document.getElementById('settingAccentColor').addEventListener('input', function() {
  document.querySelectorAll('.setting-swatch').forEach(s => s.classList.remove('active'));
});

// ── SETTINGS: THEME ────────────────────────────────────────────
function applyTheme(theme) {
  document.body.classList.toggle('theme-glass', theme === 'glass');
  document.querySelectorAll('.theme-opt-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
  localStorage.setItem('eri_theme', theme);
}

applyTheme(localStorage.getItem('eri_theme') || 'dark');

document.querySelectorAll('.theme-opt-btn').forEach(btn => {
  btn.addEventListener('click', () => applyTheme(btn.dataset.theme));
});

// ── SETTINGS: LANGUAGE ─────────────────────────────────────────
const LANG_DICT = {
  en: {
    'nav-home':'Home','nav-radio':'Radio','nav-youtube':'YouTube','nav-translate':'Translate','nav-library':'Library',
    'lib-tab-songs':'Songs','lib-tab-playlists':'Playlists','lib-tab-artists':'Artists','lib-tab-albums':'Albums',
    'fp-label':'Now Playing',
    'extra-eq':'EQ','extra-sleep':'Sleep','extra-playlist':'Playlist','extra-lyrics':'Lyrics','extra-share':'Share','extra-save':'Save',
    'hero-sub':'Your Eritrean music, anywhere',
    'songs-play':'Play','songs-shuffle':'Shuffle',
  },
  ti: {
    'nav-home':'ቤት','nav-radio':'ሬድዮ','nav-youtube':'ዩቱብ','nav-translate':'ትርጉም','nav-library':'ቤተ-መጻሕፍቲ',
    'lib-tab-songs':'ደርፍታት','lib-tab-playlists':'ዝርዝር ደርፊ','lib-tab-artists':'ደረፍቲ','lib-tab-albums':'ኣልበማት',
    'fp-label':'ሕጂ ይጻወት',
    'extra-eq':'ኢኪዩ','extra-sleep':'ዕረፍቲ','extra-playlist':'ዝርዝር','extra-lyrics':'ቃላት','extra-share':'ኣካፍል','extra-save':'ምቅሓት',
    'hero-sub':'ሙዚቃ ኤርትራ፡ ኣብ ዝደለኻዮ',
    'songs-play':'ጸወት','songs-shuffle':'ቀያዪር',
  },
  ar: {
    'nav-home':'الرئيسية','nav-radio':'راديو','nav-youtube':'يوتيوب','nav-translate':'ترجمة','nav-library':'المكتبة',
    'lib-tab-songs':'الأغاني','lib-tab-playlists':'قوائم التشغيل','lib-tab-artists':'الفنانون','lib-tab-albums':'الألبومات',
    'fp-label':'يعزف الآن',
    'extra-eq':'إيكيو','extra-sleep':'نوم','extra-playlist':'قائمة','extra-lyrics':'كلمات','extra-share':'مشاركة','extra-save':'حفظ',
    'hero-sub':'موسيقى إريتريا في أي مكان',
    'songs-play':'تشغيل','songs-shuffle':'عشوائي',
  },
  it: {
    'nav-home':'Home','nav-radio':'Radio','nav-youtube':'YouTube','nav-translate':'Traduttore','nav-library':'Libreria',
    'lib-tab-songs':'Brani','lib-tab-playlists':'Playlist','lib-tab-artists':'Artisti','lib-tab-albums':'Album',
    'fp-label':'In riproduzione',
    'extra-eq':'EQ','extra-sleep':'Timer','extra-playlist':'Playlist','extra-lyrics':'Testi','extra-share':'Condividi','extra-save':'Salva',
    'hero-sub':'La tua musica eritrea, ovunque',
    'songs-play':'Riproduci','songs-shuffle':'Casuale',
  },
  fr: {
    'nav-home':'Accueil','nav-radio':'Radio','nav-youtube':'YouTube','nav-translate':'Traduire','nav-library':'Bibliothèque',
    'lib-tab-songs':'Chansons','lib-tab-playlists':'Playlists','lib-tab-artists':'Artistes','lib-tab-albums':'Albums',
    'fp-label':'En cours de lecture',
    'extra-eq':'EQ','extra-sleep':'Sommeil','extra-playlist':'Playlist','extra-lyrics':'Paroles','extra-share':'Partager','extra-save':'Sauver',
    'hero-sub':'Votre musique érythréenne, partout',
    'songs-play':'Jouer','songs-shuffle':'Aléatoire',
  },
  de: {
    'nav-home':'Start','nav-radio':'Radio','nav-youtube':'YouTube','nav-translate':'Übersetzen','nav-library':'Bibliothek',
    'lib-tab-songs':'Songs','lib-tab-playlists':'Playlists','lib-tab-artists':'Künstler','lib-tab-albums':'Alben',
    'fp-label':'Jetzt läuft',
    'extra-eq':'EQ','extra-sleep':'Schlaf','extra-playlist':'Playlist','extra-lyrics':'Text','extra-share':'Teilen','extra-save':'Speichern',
    'hero-sub':'Deine eritreische Musik, überall',
    'songs-play':'Abspielen','songs-shuffle':'Zufällig',
  },
  es: {
    'nav-home':'Inicio','nav-radio':'Radio','nav-youtube':'YouTube','nav-translate':'Traducir','nav-library':'Biblioteca',
    'lib-tab-songs':'Canciones','lib-tab-playlists':'Listas','lib-tab-artists':'Artistas','lib-tab-albums':'Álbumes',
    'fp-label':'Reproduciendo',
    'extra-eq':'EQ','extra-sleep':'Sueño','extra-playlist':'Lista','extra-lyrics':'Letra','extra-share':'Compartir','extra-save':'Guardar',
    'hero-sub':'Tu música eritrea, en cualquier lugar',
    'songs-play':'Reproducir','songs-shuffle':'Aleatorio',
  },
  am: {
    'nav-home':'ቤት','nav-radio':'ራዲዮ','nav-youtube':'ዩቲዩብ','nav-translate':'ተርጓሚ','nav-library':'ቤተ-መጻህፍት',
    'lib-tab-songs':'ዘፈኖች','lib-tab-playlists':'ዝርዝሮች','lib-tab-artists':'አርቲስቶች','lib-tab-albums':'አልበሞች',
    'fp-label':'አሁን እየተጫወተ',
    'extra-eq':'ኢኪዩ','extra-sleep':'ተኛ','extra-playlist':'ዝርዝር','extra-lyrics':'ግጥም','extra-share':'አጋራ','extra-save':'አስቀምጥ',
    'hero-sub':'የኤርትራ ሙዚቃዎ፣ ሁሉ ቦታ',
    'songs-play':'አጫውት','songs-shuffle':'ቀይር',
  },
};

function applyLanguage(lang) {
  const dict = LANG_DICT[lang] || LANG_DICT['en'];
  document.documentElement.lang = lang;
  document.documentElement.dir = (lang === 'ar') ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key] !== undefined) el.textContent = dict[key];
  });
}

const savedLang = localStorage.getItem('eri_lang');
if (savedLang) {
  const sel = document.getElementById('settingLang');
  if (sel) sel.value = savedLang;
  applyLanguage(savedLang);
}

document.getElementById('applyLangBtn').addEventListener('click', () => {
  const lang = document.getElementById('settingLang').value;
  localStorage.setItem('eri_lang', lang);
  applyLanguage(lang);
  toast('✅ Language applied!');
});


// ── 3D HERO · MOOD · AMBIENT · TILT ───────────────────────────

// Hero greeting based on time
(function() {
  const h = new Date().getHours();
  const greet =
    h < 5  ? '🌙 Night Owl Mode' :
    h < 12 ? '☀️ Good Morning' :
    h < 17 ? '👋 Good Afternoon' :
    h < 21 ? '🌆 Good Evening' : '🌙 Good Night';
  const el = document.getElementById('heroGreeting');
  if (el) el.textContent = greet;
})();

// Hero quick buttons
document.getElementById('heroPlayBtn')?.addEventListener('click', () => {
  document.getElementById('songsPlayBtn')?.click();
  switchView('library');
});
document.getElementById('heroShuffleBtn')?.addEventListener('click', () => {
  document.getElementById('songsShuffleBtn')?.click();
  switchView('library');
});

// Mood chips
document.querySelectorAll('.mood-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.mood-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    const keywords = (chip.dataset.mood || '').toLowerCase().split(' ').filter(Boolean);
    const grid = document.getElementById('trackGrid');
    const list = document.getElementById('trackList');
    if (!keywords.length) {
      grid?.querySelectorAll('.track-card').forEach(c => c.style.display = '');
      list?.querySelectorAll('.track-row').forEach(r => r.style.display = '');
    } else {
      grid?.querySelectorAll('.track-card').forEach(card => {
        const txt = (card.querySelector('.tc-title')?.textContent + ' ' + card.querySelector('.tc-artist')?.textContent).toLowerCase();
        card.style.display = keywords.some(k => txt.includes(k)) ? '' : 'none';
      });
      list?.querySelectorAll('.track-row').forEach(row => {
        const txt = (row.querySelector('.tr-title')?.textContent + ' ' + row.querySelector('.tr-artist')?.textContent).toLowerCase();
        row.style.display = keywords.some(k => txt.includes(k)) ? '' : 'none';
      });
    }
  });
});

// Show mood row when tracks exist
const _moodObserver = new MutationObserver(() => {
  const grid = document.getElementById('trackGrid');
  const moodRow = document.getElementById('moodRow');
  if (moodRow && grid && grid.children.length > 0) {
    moodRow.style.display = 'flex';
    _moodObserver.disconnect();
  }
});
const _tg = document.getElementById('trackGrid');
if (_tg) _moodObserver.observe(_tg, { childList: true });

// Ambient background colour cycle
const _ambientBg = document.getElementById('ambientBg');
const _ambientPalette = [
  ['rgba(200,145,74,.15)',  'rgba(99,102,241,.12)'],
  ['rgba(139,92,246,.14)', 'rgba(200,145,74,.10)'],
  ['rgba(236,72,153,.12)', 'rgba(99,102,241,.10)'],
  ['rgba(16,185,129,.11)', 'rgba(200,145,74,.12)'],
  ['rgba(6,182,212,.12)',  'rgba(139,92,246,.10)'],
];
let _ambIdx = 0;
function _cycleAmbient() {
  if (!_ambientBg) return;
  const [a, b] = _ambientPalette[_ambIdx % _ambientPalette.length];
  _ambientBg.style.background =
    `radial-gradient(ellipse at 30% 20%, ${a} 0%, transparent 65%),` +
    `radial-gradient(ellipse at 70% 75%, ${b} 0%, transparent 65%)`;
  _ambIdx++;
}
_cycleAmbient();
setInterval(_cycleAmbient, 6000);

// 3D card tilt on desktop (mouse hover)
let _tiltRaf = null;
document.addEventListener('mousemove', e => {
  cancelAnimationFrame(_tiltRaf);
  _tiltRaf = requestAnimationFrame(() => {
    const card = e.target.closest('.track-card');
    document.querySelectorAll('.track-card').forEach(c => {
      if (c !== card) { c.style.transform = ''; c.style.boxShadow = ''; }
    });
    if (!card) return;
    const r = card.getBoundingClientRect();
    const dx = (e.clientX - r.left - r.width  / 2) / (r.width  / 2);
    const dy = (e.clientY - r.top  - r.height / 2) / (r.height / 2);
    card.style.transform = `perspective(700px) rotateY(${dx*8}deg) rotateX(${-dy*8}deg) scale(1.04) translateZ(10px)`;
    card.style.boxShadow = `${-dx*10}px ${dy*10}px 36px rgba(0,0,0,.65), 0 0 0 1px rgba(200,145,74,.28)`;
  });
});
document.addEventListener('mouseleave', () => {
  document.querySelectorAll('.track-card').forEach(c => { c.style.transform = ''; c.style.boxShadow = ''; });
}, true);

// ── Full-player fullscreen toggle ──────────────────────────
document.getElementById('fpFullscreenBtn')?.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
});
document.addEventListener('fullscreenchange', () => {
  const btn = document.getElementById('fpFullscreenBtn');
  if (!btn) return;
  const isFs = !!document.fullscreenElement;
  btn.title = isFs ? 'Exit Fullscreen' : 'Fullscreen';
  btn.querySelector('svg')?.setAttribute('data-fs', isFs ? '1' : '0');
});
