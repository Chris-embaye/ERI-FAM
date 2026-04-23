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
const DB_NAME = 'erifam', DB_VER = 1;
let idb;

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('tracks')) {
        const ts = d.createObjectStore('tracks', { keyPath: 'id' });
        ts.createIndex('title', 'title'); ts.createIndex('artist', 'artist');
      }
      if (!d.objectStoreNames.contains('playlists')) d.createObjectStore('playlists', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('settings'))  d.createObjectStore('settings',  { keyPath: 'key' });
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

// ── Read file metadata ─────────────────────────────────────────
async function readTrackMeta(file) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const a = new Audio(url);
    a.onloadedmetadata = () => {
      resolve({ duration: a.duration, url });
      // Don't revoke yet — caller handles it
    };
    a.onerror = () => resolve({ duration: 0, url });
    setTimeout(() => resolve({ duration: 0, url }), 3000);
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
    const { duration, url } = await readTrackMeta(file);
    const buf = await file.arrayBuffer();
    const hashKey = file.name.toLowerCase().trim() + '_' + Math.round(duration);

    const existing = S.tracks.find(t => t.hashKey === hashKey);
    if (existing) { URL.revokeObjectURL(url); continue; }

    // Smart metadata extraction from filename
    const { title, artist } = parseFilename(file.name);

    const track = {
      id: uid(), title, artist,
      album: '', duration, size: file.size,
      addedAt: Date.now(), playCount: 0, liked: false,
      type: 'local', hashKey, mimeType: file.type || 'audio/mpeg',
      data: buf,
    };
    await idbPut('tracks', track);
    track._blobUrl = url;
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
  S.tracks = rows.map(t => ({
    ...t,
    _blobUrl: null,
  }));
  renderTracks();
  updateStats();
}

// ── Get blob URL for a local track ────────────────────────────
function getBlobUrl(track) {
  if (track._blobUrl) return track._blobUrl;
  if (track.data) {
    track._blobUrl = URL.createObjectURL(new Blob([track.data], { type: track.mimeType || 'audio/mpeg' }));
    return track._blobUrl;
  }
  return null;
}

// ── Play a track ───────────────────────────────────────────────
async function playTrack(track, queueTracks) {
  if (!track) return;

  // If AudioContext is already wired up (EQ/Visualizer opened before),
  // just resume it — don't call initAudioCtx here so that plain MP3
  // playback never goes through the AudioContext and can't be silenced.
  if (audioCtx && audioCtx.state !== 'running') audioCtx.resume().catch(() => {});

  S.currentTrack = track;
  if (queueTracks) {
    S.queue = queueTracks;
    S.queueIndex = queueTracks.indexOf(track);
    if (S.shuffle) buildShuffleQueue(track);
  }

  let src = track.type === 'cloud' ? track.url : getBlobUrl(track);
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
  if (track.type === 'local') idbPut('tracks', { ...track, _blobUrl: undefined, data: track.data });

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
audio.addEventListener('play',  () => { S.playing = true;  updatePlayIcons(); });
audio.addEventListener('pause', () => { S.playing = false; updatePlayIcons(); });
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
function updateProgress() {
  const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
  document.getElementById('miniProgFill').style.width  = pct + '%';
  document.getElementById('fpProgFill').style.width    = pct + '%';
  document.getElementById('fpProgThumb').style.left    = pct + '%';
  document.getElementById('fpCurTime').textContent     = fmtTime(audio.currentTime);
  document.getElementById('fpDuration').textContent    = fmtTime(audio.duration);
  if ('mediaSession' in navigator && audio.duration) {
    navigator.mediaSession.setPositionState({ duration: audio.duration, position: audio.currentTime, playbackRate: 1 });
  }
}

function updatePlayIcons() {
  const pause = `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
  const play  = `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
  document.getElementById('playIco').parentElement.innerHTML = S.playing ? pause : play;
  document.getElementById('miniPlayIco').parentElement.innerHTML = S.playing
    ? `<svg id="miniPlayIco" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
    : `<svg id="miniPlayIco" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
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
    tracks = tracks.filter(t => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q) || (t.album||'').toLowerCase().includes(q));
  }
  if (S.viewMode === 'grid') renderGrid(tracks);
  else renderList(tracks);
  if (!search) renderSearchResults(tracks, '');
}

function artEl(t, cls) {
  if (t.artwork) return `<img src="${t.artwork}" alt="" loading="lazy" />`;
  const colors = ['#1a2a1a','#0d1a2a','#2a1a1a','#1a1a2a'];
  const c = colors[t.title.charCodeAt(0) % colors.length];
  const emojis = ['🎵','🎶','🎸','🎹','🥁','🎺','🎻','🪗'];
  const em = emojis[t.title.charCodeAt(0) % emojis.length];
  return `<span style="font-size:${cls==='card'?'2.5rem':'1.4rem'}">${em}</span>`;
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
  list.innerHTML = tracks.map((t, i) => {
    const playing   = S.currentTrack && S.currentTrack.id === t.id;
    const selected  = S.selectedIds.has(t.id);
    return `<div class="track-row${playing?' playing':''}${selected?' selected':''}" data-id="${t.id}" data-idx="${i}">
      <div class="tr-sel-check"></div>
      <div class="tr-art">${artEl(t,'list')}</div>
      <div class="tr-info">
        <div class="tr-title">${esc(t.title)}</div>
        <div class="tr-artist">${esc(t.artist)}</div>
      </div>
      <span class="tr-dur">${fmtTime(t.duration)}</span>
      <button class="tr-more" data-id="${t.id}">⋯</button>
    </div>`;
  }).join('');
  list.style.display = '';
  document.getElementById('trackGrid').style.display = 'none';
  bindTrackCardEvents(list, tracks);
}

function bindTrackCardEvents(container, tracks) {
  container.querySelectorAll('[data-id]').forEach(el => {
    if (el.classList.contains('tc-more') || el.classList.contains('tr-more')) {
      el.addEventListener('click', e => { e.stopPropagation(); if (!S.selectMode) openTrackSheet(el.getAttribute('data-id')); });
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
document.getElementById('miniPlayerExpand').addEventListener('click', () => openPanel('fullPlayer'));
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
});

document.getElementById('repeatBtn').addEventListener('click', () => {
  const modes = ['off','all','one'];
  S.repeat = modes[(modes.indexOf(S.repeat)+1) % 3];
  const btn = document.getElementById('repeatBtn');
  btn.classList.toggle('active', S.repeat !== 'off');
  btn.title = S.repeat === 'one' ? 'Repeat one' : S.repeat === 'all' ? 'Repeat all' : 'Repeat off';
  if (S.repeat === 'one') btn.innerHTML += '<span style="position:absolute;font-size:0.5rem">1</span>';
  toast(S.repeat === 'off' ? 'Repeat off' : S.repeat === 'all' ? '🔁 Repeat all' : '🔂 Repeat one');
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
});

// ── Equalizer ─────────────────────────────────────────────────
document.getElementById('eqBtn').addEventListener('click', () => {
  try { initAudioCtx(); } catch(e) { console.warn('[AudioCtx]', e); }
  if (audioCtx && audioCtx.state !== 'running') audioCtx.resume().catch(() => {});
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
  el.innerHTML = tracks.map((t, i) => `
    <div class="lib-song-row${S.currentTrack?.id === t.id ? ' playing' : ''}" data-idx="${i}">
      <span class="lib-song-num">${i + 1}</span>
      <div class="lib-song-info">
        <div class="lib-song-title">${esc(t.title)}</div>
        <div class="lib-song-artist">${esc(t.artist)}</div>
      </div>
      <span class="lib-song-dur">${fmtTime(t.duration)}</span>
    </div>`).join('');
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
  const tx = idb.transaction('tracks', 'readwrite');
  tx.objectStore('tracks').clear();
  S.tracks = []; renderTracks(); updateStats();
  toast('🗑 Local library cleared');
});
document.getElementById('dupClose').addEventListener('click',     () => closeModal('dupModal'));
document.getElementById('sheetOverlay').addEventListener('click', closeSheet);
document.getElementById('goAdminBtn').addEventListener('click',   () => { window.open('./admin/', '_blank'); });

document.getElementById('crossfadeSlider').addEventListener('input', e => {
  S.crossfade = parseInt(e.target.value);
  document.getElementById('crossfadeVal').textContent = S.crossfade + 's';
});

// ── Music Identification ───────────────────────────────────────
document.getElementById('identifyBtn').addEventListener('click', async () => {
  const key = typeof AUDD_API_KEY !== 'undefined' ? AUDD_API_KEY : '';
  if (!key) { toast('⚠ Add AUDD_API_KEY in firebase-config.js'); return; }
  if (!S.currentTrack) { toast('Play a track first'); return; }
  openModal('identifyModal');
  document.getElementById('identifyResult').innerHTML = '<p style="text-align:center;padding:20px">🎵 Listening…</p>';
  try {
    const blob = new Blob([S.currentTrack.data], { type: 'audio/mpeg' });
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

  // Load liked from localStorage
  const liked = JSON.parse(localStorage.getItem('erifam_liked') || '[]');
  S.likedIds = new Set(liked);

  // Load settings
  const vol = await idbGet('settings', 'volume');
  if (vol) { S.volume = vol.value; audio.volume = S.volume; document.getElementById('volSlider').value = S.volume * 100; }

  await loadLocalTracks();
  renderTopCharts();
  buildEqSliders();
  renderPlaylists();
  renderRadioGrid();
  initSwipeGestures();
  initNotificationListener();
  handlePlayParam();

  // Cloud sync if online
  if (navigator.onLine) syncCloud();
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

document.getElementById('vizToggleBtn').addEventListener('click', () => {
  try { initAudioCtx(); } catch(e) { console.warn('[AudioCtx]', e); }
  if (audioCtx && audioCtx.state !== 'running') audioCtx.resume().catch(() => {});
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
  radioAudio.crossOrigin = 'anonymous';
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
    const local = {
      ...track,
      type: 'local',
      data: buf,
      hashKey: track.title.toLowerCase() + '_' + Math.round(track.duration || 0),
      addedAt: Date.now(),
    };
    delete local._blobUrl;
    await idbPut('tracks', local);
    local._blobUrl = URL.createObjectURL(new Blob([buf]));
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
    id:       'eritv',
    name:     'ERi-TV',
    desc:     'Eritrean State Television — News, Culture & Entertainment',
    lang:     'Tigrinya · Arabic · English',
    icon:     '📺',
    embedUrl: 'https://famelack.com/tv/er/YRWHSN7GJpzMLf',
    ytUrl:    'https://famelack.com/tv/er/YRWHSN7GJpzMLf',
  },
  {
    id:    'eritv2',
    name:  'ERi-TV 2',
    desc:  'Culture, Sports & Entertainment Channel',
    lang:  'Tigrinya · Arabic',
    icon:  '🎬',
    ytUrl: 'https://www.youtube.com/@EritvEritrea/live',
  },
  {
    id:    'erisat',
    name:  'ERISAT',
    desc:  'Eritrean Satellite Television — News & Commentary',
    lang:  'Tigrinya · English',
    icon:  '📡',
    ytUrl: 'https://www.youtube.com/@ERISATEritrea/live',
  },
  {
    id:    'assenna',
    name:  'Assenna TV',
    desc:  'Independent Eritrean Media — News & Analysis',
    lang:  'Tigrinya',
    icon:  '🎙',
    ytUrl: 'https://www.youtube.com/@assennacom/live',
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

function openTVPlayer(id) {
  const station = TV_STATIONS.find(s => s.id === id);
  if (!station) return;
  if (S.playing) { audio.pause(); S.playing = false; updatePlayIcons(); }
  if (radioAudio) stopRadio();

  if (station.embedUrl) {
    // Use the in-app fullscreen overlay
    document.getElementById('tvOverlayName').textContent = station.name;
    document.getElementById('tvOverlayDesc').textContent = `${station.name} — ${station.desc} · ${station.lang}`;
    document.getElementById('tvYTLink').href = station.ytUrl;
    document.getElementById('tvIframe').src = station.embedUrl;
    document.getElementById('tvOverlay').style.display = 'flex';
    document.body.style.overflow = 'hidden';
  } else {
    window.open(station.ytUrl, '_blank', 'noopener,noreferrer');
    toast(`📺 Opening ${station.name} on YouTube…`);
  }
}

function closeTVPlayer() {
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

