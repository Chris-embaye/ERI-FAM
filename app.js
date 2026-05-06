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
  artistFilter: '',    // '' = all artists
  albumFilter: '',     // '' = all albums
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
  analyserNode.fftSize = 256;
  analyserNode.smoothingTimeConstant = 0.8;
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
function fmtAgo(ts) {
  if (!ts) return '';
  const d = Math.floor((Date.now() - ts) / 86400000);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 7)  return d + ' days ago';
  if (d < 30) return Math.floor(d / 7) + ' wk ago';
  if (d < 365) return Math.floor(d / 30) + ' mo ago';
  return Math.floor(d / 365) + ' yr ago';
}

let toastTimer;
function toast(msg, dur=2400) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), dur);
}

function openModal(id)  { const el = document.getElementById(id); if (el) el.classList.add('open'); }
function closeModal(id) { const el = document.getElementById(id); if (el) el.classList.remove('open'); }
function openPanel(id)  { const el = document.getElementById(id); if (el) el.classList.add('open'); }
function closePanel(id) { const el = document.getElementById(id); if (el) el.classList.remove('open'); }

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
  const t = S.currentTrack;
  localStorage.setItem('erifam_last_track', t.id);
  localStorage.setItem('erifam_last_pos',   audio.currentTime.toFixed(2));
  localStorage.setItem('erifam_last_meta',  JSON.stringify({
    id: t.id, title: t.title || '', artist: t.artist || '',
    duration: t.duration || 0, type: t.type || 'local',
    url: t.type === 'cloud' ? t.url : null, mimeType: t.mimeType || 'audio/mpeg'
  }));
  saveQueueState();
}

// ── Queue persistence ──────────────────────────────────────────
function saveQueueState() {
  try {
    const ids = S.queue.map(t => t.id);
    if (!ids.length) { localStorage.removeItem('erifam_queue_state'); return; }
    localStorage.setItem('erifam_queue_state', JSON.stringify({
      ids, idx: S.queueIndex, cid: S.currentTrack?.id
    }));
  } catch(e) {}
}

function restoreQueueState() {
  try {
    const raw = localStorage.getItem('erifam_queue_state');
    if (!raw) return;
    const { ids, idx, cid } = JSON.parse(raw);
    if (!ids?.length) return;
    const all = [...S.tracks, ...S.cloudTracks];
    const restored = ids.map(id => all.find(t => t.id === id)).filter(Boolean);
    if (!restored.length) return;
    S.queue = restored;
    S.queueIndex = Math.min(idx || 0, restored.length - 1);
    if (cid && !S.currentTrack) {
      const cur = restored.find(t => t.id === cid) || restored[S.queueIndex];
      if (cur) { S.currentTrack = cur; updatePlayerUI(); showMiniPlayer(); }
    }
  } catch(e) { localStorage.removeItem('erifam_queue_state'); }
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

// ── Add track from direct URL ──────────────────────────────────
function titleFromUrl(url) {
  try {
    const name = new URL(url).pathname.split('/').pop() || '';
    return decodeURIComponent(name).replace(/\.[^.]+$/, '').replace(/[-_+]/g, ' ').trim() || 'Untitled';
  } catch { return 'Untitled'; }
}

async function addTrackFromUrl() {
  const input = document.getElementById('urlAddInput');
  const url   = input.value.trim();
  if (!url.startsWith('http')) { toast('Enter a valid https:// URL', 'error'); return; }
  const all = [...S.tracks, ...S.cloudTracks];
  if (all.find(t => t.url === url)) { toast('Already in your library'); return; }
  const id    = uid();
  const track = {
    id, title: titleFromUrl(url), artist: '',
    album: '', duration: 0, size: 0,
    addedAt: Date.now(), playCount: 0, liked: false,
    type: 'link', url,
  };
  await idbPut('tracks', track);
  S.tracks.push(track);
  input.value = '';
  toast('✅ Added — tap ⋯ to edit title & artist');
  renderTracks();
  updateStats();
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

  // Premium gating
  if (track.premium) {
    toast('🔒 This is Members Only content. Support us to unlock premium tracks!', 3500);
    const sec = document.getElementById('settingsSupportSection');
    if (sec && sec.style.display !== 'none') {
      document.getElementById('settingsPanel')?.classList.add('open');
      sec.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return;
  }

  // Resume AudioContext if EQ/Visualizer was opened previously.
  if (audioCtx && audioCtx.state !== 'running') await audioCtx.resume().catch(() => {});

  S.currentTrack = track;
  if (queueTracks) {
    S.queue = queueTracks;
    S.queueIndex = queueTracks.indexOf(track);
    if (S.shuffle) buildShuffleQueue(track);
    saveQueueState();
  }

  let src = (track.type === 'cloud' || track.type === 'link') ? track.url : await getBlobUrl(track);
  if (!src) { toast('⚠ Could not load track'); return; }

  audio.src = src;
  audio.volume = S.volume;
  if (S.playbackSpeed && S.playbackSpeed !== 1) audio.playbackRate = S.playbackSpeed;
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
  // Scroll the now-playing track into view in the library
  setTimeout(() => {
    const el = document.querySelector('.track-card.playing, .track-row.playing');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 80);

  // Mark recent
  const recent = JSON.parse(localStorage.getItem('erifam_recent') || '[]');
  const filtered = recent.filter(id => id !== track.id);
  filtered.unshift(track.id);
  localStorage.setItem('erifam_recent', JSON.stringify(filtered.slice(0, 20)));
}

async function togglePlay() {
  if (!S.currentTrack) return;
  if (audio.paused) {
    if (audioCtx && audioCtx.state !== 'running') {
      await audioCtx.resume().catch(e => console.warn('[AudioCtx resume]', e));
    }
    try {
      await audio.play();
    } catch(e) {
      if (e.name !== 'AbortError') toast('⚠ Could not resume — tap again');
      return;
    }
    S.playing = true;
  } else {
    audio.pause();
    S.playing = false;
  }
  updatePlayerUI();
  updateHeaderPlayState();
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
  S.playing = true; updatePlayIcons(); updateHeaderPlayState();
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
});
audio.addEventListener('pause', () => {
  S.playing = false; updatePlayIcons(); updateHeaderPlayState();
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
  const ct2 = document.getElementById('fpCurTime2');
  const d2  = document.getElementById('fpDuration2');
  if (ct2) ct2.textContent = fmtTime(cur);
  if (d2)  d2.textContent  = fmtTime(dur);

  // Drive circular progress ring
  const ringFill = document.getElementById('fpRingFill');
  const ringDot  = document.getElementById('fpRingDot');
  if (ringFill) ringFill.style.strokeDashoffset = RING_C * (1 - ratio);
  if (ringDot)  ringDot.setAttribute('transform', `rotate(${ratio * 360} 150 150)`);

  if ('mediaSession' in navigator && dur) {
    navigator.mediaSession.setPositionState({ duration: dur, position: cur, playbackRate: S.playbackSpeed || 1 });
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

function updateHeaderPlayState() {
  document.getElementById('appHeader').classList.toggle('music-playing', S.playing);
  const vinyl = document.getElementById('fpVinyl');
  if (vinyl) vinyl.classList.toggle('spinning', S.playing);
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
    document.getElementById('fpArt')?.querySelector('.fp-art-ph')?.style.setProperty('display', 'none');
    document.getElementById('fpBg').style.background = `linear-gradient(180deg, rgba(0,0,0,0.6) 0%, var(--bg) 100%)`;
  } else {
    document.getElementById('fpArtImg').style.display = 'none';
    document.getElementById('fpArt')?.querySelector('.fp-art-ph')?.style.setProperty('display', '');
  }
  // Like button
  document.getElementById('likeBtn').classList.toggle('liked', S.likedIds.has(t.id));
  // Track position (e.g. "4 / 18")
  const posEl = document.getElementById('fpPosition');
  if (posEl) posEl.textContent = S.queue.length > 1 ? `${S.queueIndex + 1} / ${S.queue.length}` : '';
  // Up Next
  const upNextEl = document.getElementById('fpUpNext');
  if (upNextEl) {
    const nextIdx = S.shuffle
      ? (S.shuffleIndex + 1 < S.shuffleQueue.length ? S.shuffleQueue.indexOf(S.shuffleQueue[S.shuffleIndex + 1]) : -1)
      : S.queueIndex + 1;
    const nextItem = (nextIdx >= 0 && nextIdx < S.queue.length) ? S.queue[nextIdx] : null;
    if (nextItem) {
      upNextEl.textContent = `Up next: ${nextItem.title}`;
      upNextEl.style.display = '';
    } else {
      upNextEl.style.display = 'none';
    }
  }
  updatePlayIcons();
  updateHeaderPlayState();
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
  // Refresh artist/album selects — defined later in file, guard with typeof
  if (typeof _populateFilterSelects === 'function') _populateFilterSelects();
}

// ── Render tracks ──────────────────────────────────────────────
function getAllTracks() {
  const all = [...S.tracks, ...S.cloudTracks];
  let tracks;
  if (S.filter === 'local') tracks = [...S.tracks];
  else if (S.filter === 'cloud') tracks = [...S.cloudTracks];
  else if (S.filter === 'liked') tracks = all.filter(t => S.likedIds.has(t.id));
  else tracks = all;
  if (S.artistFilter) tracks = tracks.filter(t => (t.artist || '') === S.artistFilter);
  if (S.albumFilter)  tracks = tracks.filter(t => (t.album  || '') === S.albumFilter);
  return tracks;
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
        <div class="tc-title">${esc(t.title)}${t.premium ? ' <span class="tc-premium-lock">🔒</span>' : ''}</div>
        <div class="tc-artist">${esc(t.artist)}</div>
        ${t.type === 'cloud' && t.addedAt ? `<div class="tc-date">${fmtAgo(t.addedAt)}</div>` : ''}
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
        ${t.type === 'cloud' && t.addedAt ? `<div class="tc-date">${fmtAgo(t.addedAt)}</div>` : ''}
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
  document.getElementById('sheetQueue').onclick  = () => { S.queue.push(track); saveQueueState(); toast('Added to queue'); closeSheet(); };
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
  document.querySelector('.nav-item[data-view="search"]')?.classList.add('active');
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

document.getElementById('urlAddBtn').addEventListener('click', addTrackFromUrl);
document.getElementById('urlAddInput').addEventListener('keydown', e => { if (e.key === 'Enter') addTrackFromUrl(); });

// ── Filter chips ───────────────────────────────────────────────
document.querySelectorAll('.filter-chip').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    S.filter = btn.getAttribute('data-filter');
    // Reset secondary artist/album filters when switching main filter
    S.artistFilter = ''; S.albumFilter = '';
    const aSelect = document.getElementById('artistFilterSelect');
    const bSelect  = document.getElementById('albumFilterSelect');
    if (aSelect) aSelect.value = '';
    if (bSelect)  bSelect.value = '';
    renderTracks(document.getElementById('searchInput').value.trim());
    if (typeof _updateDeleteFilteredBtn === 'function') _updateDeleteFilteredBtn();
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
document.getElementById('miniPlay').addEventListener('click', async e => {
  e.stopPropagation();
  await togglePlay();
});
document.getElementById('miniPrev').addEventListener('click', e => { e.stopPropagation(); prevTrack(); });
document.getElementById('miniNext').addEventListener('click', e => { e.stopPropagation(); nextTrack(); });

// ── Full Player ────────────────────────────────────────────────
document.getElementById('fpClose').addEventListener('click', () => closePanel('fullPlayer'));
document.getElementById('playBtn').addEventListener('click', async () => {
  await togglePlay();
});
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
document.getElementById('eqBtn').addEventListener('click', () => {
  try {
    initAudioCtx();
    if (pendingEqRestore) {
      pendingEqRestore.forEach((v, i) => { if (eqBands[i]) eqBands[i].gain.value = v; });
      pendingEqRestore = null;
    }
    audioCtx.resume().catch(() => {});
  } catch(e) { console.warn('[AudioCtx]', e); }
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
    // On iOS/Android, touching a slider can suspend the AudioContext — resume it
    const resumeCtx = () => {
      if (audioCtx && audioCtx.state !== 'running') {
        audioCtx.resume().then(() => { if (S.playing && audio.paused) audio.play().catch(() => {}); });
      }
    };
    inp.addEventListener('touchstart', resumeCtx, { passive: true });
    inp.addEventListener('pointerdown', resumeCtx);
    inp.addEventListener('input', () => {
      resumeCtx();
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
let activeLibTab = 'songs';

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
        <button class="album-art-edit-btn" data-album="${esc(a.name)}" title="Change artwork" aria-label="Change album artwork">📷</button>
      </div>
      <div class="lib-album-info">
        <div class="lib-album-title">${esc(a.name)}</div>
        <div class="lib-album-artist">${esc(a.artist)}</div>
      </div>
    </div>`).join('');
  el.querySelectorAll('.lib-album-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.album-art-edit-btn')) return; // handled separately
      const name  = card.getAttribute('data-album');
      const album = albums.find(a => a.name === name);
      if (album) openAlbumDetail(album);
    });
  });
  el.querySelectorAll('.album-art-edit-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      _pendingArtAlbum = btn.getAttribute('data-album');
      document.getElementById('albumArtInput').click();
    });
  });
}

// Album art upload
let _pendingArtAlbum = null;
document.getElementById('albumArtInput')?.addEventListener('change', async function() {
  const file = this.files[0];
  this.value = '';
  if (!file || !_pendingArtAlbum) return;
  const albumName = _pendingArtAlbum;
  _pendingArtAlbum = null;

  const reader = new FileReader();
  reader.onload = async e => {
    const dataUrl = e.target.result;
    // Update all tracks in this album in IDB and in memory
    const targets = [...S.tracks, ...S.cloudTracks].filter(t => (t.album || '') === albumName);
    for (const t of targets) {
      t.artwork = dataUrl;
      if (S.tracks.find(lt => lt.id === t.id)) {
        const stored = await idbGet('tracks', t.id);
        if (stored) { stored.artwork = dataUrl; await idbPut('tracks', stored); }
      }
    }
    renderAlbums();
    renderTracks();
    toast('🖼 Album artwork updated!');
  };
  reader.readAsDataURL(file);
});

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
document.getElementById('settingsBtn').addEventListener('click',  () => { closeSidebar(); openPanel('settingsPanel'); });
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
    try { localStorage.setItem('erifam_cloud_cache', JSON.stringify(S.cloudTracks)); } catch(e) {}
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
    if (!S.cloudTracks.length) {
      toast('⚠ Could not load songs — check your connection and refresh', 4000);
    }
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
  // ── Step 1: Immediately restore mini player from localStorage (no IDB wait) ──
  const lastId   = localStorage.getItem('erifam_last_track');
  const lastPos  = parseFloat(localStorage.getItem('erifam_last_pos') || '0');
  const lastMeta = JSON.parse(localStorage.getItem('erifam_last_meta') || 'null');
  if (lastId && lastMeta) {
    S.currentTrack = { ...lastMeta, _blobUrl: null };
    updatePlayerUI();
    showMiniPlayer();
  }

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

  // ── Step 2: Restore saved view now that tracks are loaded (no "No songs yet" flash) ──
  const savedView = localStorage.getItem('erifam_view');
  if (savedView && document.getElementById('view-' + savedView)) switchView(savedView);

  // ── Step 3: Wire up audio for the restored track (local tracks only) ──
  if (lastId) {
    const track = S.tracks.find(t => t.id === lastId);
    if (track) {
      S.currentTrack = track;
      const src = await getBlobUrl(track);
      if (src) {
        audio.src = src;
        audio.volume = S.volume;
        audio.addEventListener('loadedmetadata', () => {
          if (lastPos > 1 && lastPos < (audio.duration || 0) - 2) audio.currentTime = lastPos;
        }, { once: true });
        updateMediaSession();
      }
      updatePlayerUI();
      showMiniPlayer();
    }
  }

  renderTopCharts();
  renderPlaylists();
  renderRadioGrid();
  initSwipeGestures();
  initNotificationListener();
  handlePlayParam();

  // Load cached cloud tracks immediately so songs are visible before sync completes
  const _cachedCloud = localStorage.getItem('erifam_cloud_cache');
  if (_cachedCloud) {
    try {
      S.cloudTracks = JSON.parse(_cachedCloud);
      renderTracks(); updateStats();
      if (activeLibTab === 'songs')   renderSongs();
      if (activeLibTab === 'artists') renderArtists();
      if (activeLibTab === 'albums')  renderAlbums();
    } catch(e) { localStorage.removeItem('erifam_cloud_cache'); }
  }

  // Restore queue with local + cached cloud tracks
  restoreQueueState();

  // Always attempt sync — navigator.onLine is unreliable in PWA standalone mode
  // (returns false on some devices even when connection is fine)
  syncCloud().then(() => {
    // ── Step 4: Wire up audio for cloud tracks (available after sync) ──
    if (lastId && lastMeta?.type === 'cloud') {
      const cloudTrack = S.cloudTracks.find(t => t.id === lastId);
      if (cloudTrack) {
        S.currentTrack = cloudTrack;
        if (!audio.src) {
          audio.src = cloudTrack.url;
          audio.volume = S.volume;
          audio.addEventListener('loadedmetadata', () => {
            if (lastPos > 1 && lastPos < (audio.duration || 0) - 2) audio.currentTime = lastPos;
          }, { once: true });
          updateMediaSession();
        }
        updatePlayerUI();
        showMiniPlayer();
      }
    }
    // Re-run queue restore now that fresh cloud tracks are available
    restoreQueueState();
  }).catch(() => {});
  loadPromos();
  registerAppSession();

  // Retry sync after 4s if no tracks loaded yet — handles slow/unreliable
  // network at PWA home-screen launch where network isn't ready at startup
  setTimeout(() => {
    if (!S.cloudTracks.length) syncCloud().catch(() => {});
  }, 4000);
}

async function registerAppSession() {
  try {
    await FB_READY;
    if (!db) return;
    let devId = localStorage.getItem('erifam_device_id');
    if (!devId) {
      devId = 'dev_' + Date.now().toString(36) + Math.random().toString(36).slice(2);
      localStorage.setItem('erifam_device_id', devId);
    }
    // Use updateDoc with merge-like approach via addDoc to a fixed device doc path
    const { doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    await setDoc(doc(db._db, 'app_sessions', devId), {
      lastSeen: serverTimestamp(),
      ua: navigator.userAgent.slice(0, 80),
    });
  } catch(e) { /* non-critical */ }
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

audio.addEventListener('play', () => {
  if (vizActive) startVisualizer();
});
audio.addEventListener('pause', () => {
  stopVisualizer();
});

// iOS safety net: resume AudioContext on any touch if the OS suspended it
document.addEventListener('touchstart', () => {
  if (audioCtx && audioCtx.state !== 'running') audioCtx.resume().catch(() => {});
}, { passive: true });

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
   FEATURE 4 — Live Eritrean Radio  (10-tweak upgrade)
   ════════════════════════════════════════════════════════════════ */
const RADIO_STATIONS = [
  // Only verified, tested working streams are listed here
  { id: 'etem', name: 'Eritrean Music', desc: 'Tigrigna hits & classics', lang: 'Tigrinya', genre: 'music', country: 'Eritrea', icon: '🎶', url: 'https://linuxfreelancer.com:8443/test.mp3' },
];

let radioAudio = null, currentStation = null;
let radioReconnectTimer = null, radioReconnectCount = 0;
let radioSleepTimer = null, radioSleepRemaining = 0, radioSleepTick = null;
let radioFavorites = JSON.parse(localStorage.getItem('radioFavs') || '[]');
let radioRecents   = JSON.parse(localStorage.getItem('radioRecents') || '[]');
let radioActiveGenre = '';
let radioShowFavs   = false;

/* ── helpers ── */
function saveRadioFavs()    { localStorage.setItem('radioFavs',    JSON.stringify(radioFavorites)); }
function saveRadioRecents() { localStorage.setItem('radioRecents', JSON.stringify(radioRecents)); }

function radioAddRecent(station) {
  radioRecents = [station.id, ...radioRecents.filter(id => id !== station.id)].slice(0, 8);
  saveRadioRecents();
  renderRadioRecents();
}

function renderRadioRecents() {
  const wrap = document.getElementById('radioRecents');
  const list = document.getElementById('radioRecentsList');
  const ids = radioRecents.filter(id => RADIO_STATIONS.find(s => s.id === id));
  if (!ids.length) { wrap.hidden = true; return; }
  wrap.hidden = false;
  list.innerHTML = ids.map(id => {
    const s = RADIO_STATIONS.find(s => s.id === id);
    return `<div class="rad-recent-item" data-rid="${s.id}">${s.icon} ${esc(s.name)}<span>${esc(s.lang)}</span></div>`;
  }).join('');
  list.querySelectorAll('.rad-recent-item').forEach(el => {
    el.addEventListener('click', () => playRadio(el.dataset.rid));
  });
}

/* ── grid render ── */
function renderRadioGrid() {
  const query = (document.getElementById('radioSearch')?.value || '').toLowerCase();
  const grid  = document.getElementById('radioGrid');

  let list = RADIO_STATIONS;
  if (radioShowFavs) list = list.filter(s => radioFavorites.includes(s.id));
  if (radioActiveGenre) list = list.filter(s => s.genre === radioActiveGenre);
  if (query) list = list.filter(s =>
    s.name.toLowerCase().includes(query) ||
    s.desc.toLowerCase().includes(query) ||
    s.lang.toLowerCase().includes(query)
  );

  grid.innerHTML = list.map(s => {
    const isFav     = radioFavorites.includes(s.id);
    const isPlaying = currentStation?.id === s.id;
    return `
    <div class="radio-card${isPlaying ? ' playing' : ''}" data-rid="${s.id}">
      <div class="radio-card-icon"><img src="./icons/radio-logo.svg" alt="${esc(s.name)}" class="radio-logo-img"/></div>
      <div class="radio-card-name">${esc(s.name)}</div>
      <div class="radio-card-desc">${esc(s.desc)}</div>
      <div class="radio-card-lang">${esc(s.lang)}</div>
      ${isPlaying
        ? `<div class="radio-live-badge">
             <div class="rad-card-eq">
               <div class="rad-card-eq-bar"></div><div class="rad-card-eq-bar"></div>
               <div class="rad-card-eq-bar"></div><div class="rad-card-eq-bar"></div>
             </div>
             <span class="radio-live-dot"></span> Live
           </div>`
        : '<div class="radio-card-lang" style="color:var(--text-dim)">Tap to stream</div>'}
      <div class="radio-card-actions">
        <button class="radio-card-fav-btn${isFav ? ' faved' : ''}" data-fav="${s.id}">${isFav ? '❤' : '♡'} Fav</button>
        <button class="radio-card-info-btn" data-info="${s.id}">ℹ Info</button>
      </div>
    </div>`;
  }).join('');

  /* event delegation */
  grid.querySelectorAll('.radio-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.radio-card-fav-btn') || e.target.closest('.radio-card-info-btn')) return;
      playRadio(card.dataset.rid);
    });
  });
  grid.querySelectorAll('.radio-card-fav-btn').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); toggleRadioFav(btn.dataset.fav); });
  });
  grid.querySelectorAll('.radio-card-info-btn').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openRadioInfo(btn.dataset.info); });
  });

  document.querySelector('.nav-item[data-view="radio"]')?.classList.toggle('radio-active', !!currentStation);
}

/* ── favorites ── */
function toggleRadioFav(id) {
  if (radioFavorites.includes(id)) {
    radioFavorites = radioFavorites.filter(f => f !== id);
    toast('Removed from favorites');
  } else {
    radioFavorites.push(id);
    toast('❤ Added to favorites');
  }
  saveRadioFavs();
  renderRadioGrid();
  const infoFavBtn = document.getElementById('radInfoFav');
  if (infoFavBtn && document.getElementById('radInfoSheet')._currentId === id) {
    infoFavBtn.classList.toggle('faved', radioFavorites.includes(id));
    infoFavBtn.textContent = radioFavorites.includes(id) ? '❤ Favorited' : '❤ Favorite';
  }
}

/* ── station info sheet ── */
function openRadioInfo(id) {
  const s = RADIO_STATIONS.find(s => s.id === id);
  if (!s) return;
  const sheet = document.getElementById('radInfoSheet');
  sheet._currentId = id;
  document.getElementById('radInfoIcon').textContent = s.icon;
  document.getElementById('radInfoName').textContent = s.name;
  document.getElementById('radInfoDesc').textContent = s.desc;
  const tags = [s.lang, s.genre, s.country].filter(Boolean);
  document.getElementById('radInfoTags').innerHTML = tags.map(t => `<span class="rad-info-tag">${esc(t)}</span>`).join('');
  const favBtn = document.getElementById('radInfoFav');
  const isFav = radioFavorites.includes(id);
  favBtn.classList.toggle('faved', isFav);
  favBtn.textContent = isFav ? '❤ Favorited' : '❤ Favorite';
  document.getElementById('radInfoBackdrop').hidden = false;
  sheet.hidden = false;
}
function closeRadioInfo() {
  document.getElementById('radInfoSheet').hidden = true;
  document.getElementById('radInfoBackdrop').hidden = true;
}
document.getElementById('radInfoClose').addEventListener('click', closeRadioInfo);
document.getElementById('radInfoBackdrop').addEventListener('click', closeRadioInfo);
document.getElementById('radInfoPlay').addEventListener('click', () => {
  const id = document.getElementById('radInfoSheet')._currentId;
  if (id) { playRadio(id); closeRadioInfo(); }
});
document.getElementById('radInfoFav').addEventListener('click', () => {
  const id = document.getElementById('radInfoSheet')._currentId;
  if (id) toggleRadioFav(id);
});
document.getElementById('radInfoShareBtn').addEventListener('click', () => {
  const id = document.getElementById('radInfoSheet')._currentId;
  const s = RADIO_STATIONS.find(s => s.id === id);
  if (!s) return;
  const text = `🎙 ${s.name} — ${s.desc}`;
  if (navigator.share) navigator.share({ title: s.name, text }).catch(() => {});
  else navigator.clipboard?.writeText(text).then(() => toast('Copied to clipboard'));
});

/* ── search filter ── */
document.getElementById('radioSearch')?.addEventListener('input', () => renderRadioGrid());

/* ── genre chips ── */
document.getElementById('radioChips')?.addEventListener('click', e => {
  const chip = e.target.closest('.rad-chip');
  if (!chip) return;
  document.querySelectorAll('#radioChips .rad-chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  if (chip.id === 'radioFavChip') {
    radioShowFavs = true;
    radioActiveGenre = '';
  } else {
    radioShowFavs = false;
    radioActiveGenre = chip.dataset.genre || '';
  }
  renderRadioGrid();
});

/* ── fullscreen ── */
function openRadioFullscreen() {
  if (!currentStation) return;
  document.getElementById('radioFsName').textContent = currentStation.name;
  document.getElementById('radioFsDesc').textContent = currentStation.desc;
  document.getElementById('radioFullscreen').style.display = 'flex';
}

/* ── play ── */
function playRadio(id) {
  const station = RADIO_STATIONS.find(s => s.id === id);
  if (!station) return;
  if (currentStation?.id === id) { openRadioFullscreen(); return; }
  stopRadio(true);
  if (S.playing) { audio.pause(); S.playing = false; updatePlayIcons(); }
  radioAudio = new Audio(station.url);
  radioAudio.volume = parseFloat(document.getElementById('rnpVolume')?.value ?? 1);
  radioAudio.play().catch(() => toast('⚠ Could not connect to this stream'));
  currentStation = station;
  radioReconnectCount = 0;
  radioAddRecent(station);

  /* update now-playing bar */
  document.getElementById('rnpName').textContent = station.name;
  document.getElementById('rnpStatusText').textContent = 'Live';
  document.getElementById('radioNowPlaying').style.display = 'flex';
  document.getElementById('rnpEq').classList.remove('paused');

  renderRadioGrid();
  openRadioFullscreen();
  updateHeaderRadioBtn();

  /* 4. Auto-reconnect on stream error */
  radioAudio.addEventListener('error', radioHandleStreamError);
  radioAudio.addEventListener('stalled', radioHandleStreamError);

  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({ title: station.name, artist: station.desc, album: 'Live Radio', artwork: [] });
    navigator.mediaSession.setActionHandler('pause', stopRadio);
    navigator.mediaSession.setActionHandler('play', () => radioAudio?.play());
  }
}

/* ── auto-reconnect ── */
function radioHandleStreamError() {
  if (!currentStation || radioReconnectCount >= 5) return;
  radioReconnectCount++;
  document.getElementById('rnpStatusText').textContent = `Reconnecting… (${radioReconnectCount}/5)`;
  clearTimeout(radioReconnectTimer);
  radioReconnectTimer = setTimeout(() => {
    if (!currentStation) return;
    const url = currentStation.url;
    radioAudio.src = url;
    radioAudio.load();
    radioAudio.play().then(() => {
      document.getElementById('rnpStatusText').textContent = 'Live';
      radioReconnectCount = 0;
    }).catch(() => {});
  }, 5000);
}

/* ── stop ── */
function stopRadio(keepSleep = false) {
  clearTimeout(radioReconnectTimer);
  if (!keepSleep) cancelRadioSleep();
  if (radioAudio) {
    radioAudio.removeEventListener('error', radioHandleStreamError);
    radioAudio.removeEventListener('stalled', radioHandleStreamError);
    radioAudio.pause(); radioAudio.src = ''; radioAudio = null;
  }
  currentStation = null;
  document.getElementById('radioNowPlaying').style.display = 'none';
  document.getElementById('radioFullscreen').style.display = 'none';
  document.getElementById('rnpEq').classList.add('paused');
  renderRadioGrid();
  updateHeaderRadioBtn();
}

/* ── volume slider ── */
document.getElementById('rnpVolume')?.addEventListener('input', e => {
  if (radioAudio) radioAudio.volume = parseFloat(e.target.value);
});

/* ── share ── */
document.getElementById('rnpShare')?.addEventListener('click', () => {
  if (!currentStation) return;
  const text = `🎙 ${currentStation.name} — ${currentStation.desc}`;
  if (navigator.share) navigator.share({ title: currentStation.name, text }).catch(() => {});
  else navigator.clipboard?.writeText(text).then(() => toast('Copied to clipboard'));
});

/* ── sleep timer ── */
function startRadioSleep(mins) {
  cancelRadioSleep();
  radioSleepRemaining = mins * 60;
  document.getElementById('radioSleepBar').hidden = false;
  document.getElementById('radioSleepPicker').hidden = true;
  updateRadioSleepText();
  radioSleepTick = setInterval(() => {
    radioSleepRemaining--;
    updateRadioSleepText();
    if (radioSleepRemaining <= 0) { cancelRadioSleep(); stopRadio(); }
  }, 1000);
}
function updateRadioSleepText() {
  const m = Math.floor(radioSleepRemaining / 60);
  const s = radioSleepRemaining % 60;
  document.getElementById('radioSleepText').textContent = `Stops in ${m}:${String(s).padStart(2,'0')}`;
}
function cancelRadioSleep() {
  clearInterval(radioSleepTick); radioSleepTick = null; radioSleepRemaining = 0;
  document.getElementById('radioSleepBar').hidden = true;
  document.getElementById('radioSleepPicker').hidden = true;
}

document.getElementById('rnpSleep')?.addEventListener('click', () => {
  const picker = document.getElementById('radioSleepPicker');
  picker.hidden = !picker.hidden;
});
document.getElementById('radioSleepPicker')?.addEventListener('click', e => {
  const opt = e.target.closest('.rad-sp-opt');
  if (opt) startRadioSleep(parseInt(opt.dataset.mins));
});
document.getElementById('radioSleepCancel')?.addEventListener('click', cancelRadioSleep);

/* ── header / fullscreen ── */
function updateHeaderRadioBtn() {
  document.getElementById('radioHeaderBtn')?.classList.toggle('playing', !!currentStation);
}

document.getElementById('rnpStop').addEventListener('click', () => stopRadio());
document.getElementById('radioFsStop').addEventListener('click', () => stopRadio());
document.getElementById('radioFsClose').addEventListener('click', () => {
  document.getElementById('radioFullscreen').style.display = 'none';
});
document.getElementById('radioHeaderBtn').addEventListener('click', () => {
  if (currentStation) { openRadioFullscreen(); } else { switchView('radio'); }
});

/* initialise recents on load */
renderRadioRecents();

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

/* ════════════════════════════════════════════════════════════════
   WORLD SPORTS TV
   ════════════════════════════════════════════════════════════════ */
const SPORTS_STATIONS = [
  // Verified working HLS streams only
  {
    id: 'aljazeera',
    name: 'Al Jazeera English',
    desc: 'Live news & sports events 24/7 — plays directly in app',
    lang: 'English',
    icon: '🌍',
    badge: 'FREE',
    streamUrl: 'https://live-hls-web-aje.getaj.net/AJE/index.m3u8',
    ytUrl: 'https://www.youtube.com/@AlJazeeraEnglish/live',
  },
];

const SPORTS_BADGE_COLOR = { FREE: '#00b356', FREEMIUM: '#f59e0b', PAY: '#ef4444' };

function renderSportsGrid() {
  const grid = document.getElementById('sportsGrid');
  if (!grid) return;
  grid.innerHTML = SPORTS_STATIONS.map(s => {
    const badgeColor = SPORTS_BADGE_COLOR[s.badge] || '#888';
    const hasStream = !!(s.streamUrl || s.embedUrl);
    return `
    <div class="tv-card" data-spid="${s.id}">
      <div class="tv-card-thumb">
        <div style="font-size:2.4rem;display:flex;align-items:center;justify-content:center;height:100%;background:var(--surface);">${s.icon}</div>
        <div class="tv-thumb-overlay">
          <div class="tv-play-btn"><svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>
        </div>
        <div class="tv-live-pill" style="background:${badgeColor}">${s.badge}</div>
        ${hasStream ? '<div class="tv-live-pill" style="right:auto;left:6px;top:6px;background:rgba(0,0,0,.55)"><span class="radio-live-dot" style="width:5px;height:5px;background:#fff"></span> LIVE</div>' : ''}
      </div>
      <div class="tv-card-info">
        <div class="tv-card-name">${esc(s.name)}</div>
        <div class="tv-card-desc">${esc(s.desc)}</div>
        <div class="tv-card-lang">${esc(s.lang)}</div>
      </div>
    </div>`;
  }).join('');

  grid.querySelectorAll('.tv-card[data-spid]').forEach(card => {
    card.addEventListener('click', () => openSportsPlayer(card.dataset.spid));
  });
}

function openSportsPlayer(id) {
  const station = SPORTS_STATIONS.find(s => s.id === id);
  if (!station) return;
  if (S.playing) { audio.pause(); S.playing = false; updatePlayIcons(); }
  if (radioAudio) stopRadio();

  document.getElementById('tvOverlayName').textContent = station.name;
  document.getElementById('tvOverlayDesc').textContent = `${station.name} — ${station.desc} · ${station.lang}`;
  document.getElementById('tvYTLink').href = station.ytUrl || '#';
  document.getElementById('tvYTLink').style.display = station.ytUrl ? '' : 'none';
  document.getElementById('tvYTLink').textContent = station.ytUrl?.includes('youtube') ? '▶ Open on YouTube' : '🌐 Open website';

  const video  = document.getElementById('tvVideo');
  const iframe = document.getElementById('tvIframe');
  const hint   = document.getElementById('tvOverlayHint');

  if (station.streamUrl) {
    iframe.style.display = 'none';
    iframe.src = 'about:blank';
    video.style.display = '';
    hint.textContent = 'Direct live stream';
    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
      if (tvHls) tvHls.destroy();
      tvHls = new Hls({ lowLatencyMode: true });
      tvHls.loadSource(station.streamUrl);
      tvHls.attachMedia(video);
      tvHls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
      tvHls.on(Hls.Events.ERROR, (e, data) => {
        if (data.fatal) {
          hint.textContent = '⚠ Stream unavailable — use the link above';
          toast('⚠ Stream could not load');
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = station.streamUrl;
      video.play().catch(() => {});
    }
  } else if (station.embedUrl) {
    video.style.display = 'none';
    video.pause(); video.src = '';
    if (tvHls) { tvHls.destroy(); tvHls = null; }
    iframe.style.display = '';
    iframe.src = station.embedUrl;
    hint.textContent = 'Streaming in-app';
  } else {
    toast(`⚽ ${station.name} — tap the link to open`);
    return;
  }
  document.getElementById('tvOverlay').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

// Render sports grid alongside the TV grid
document.querySelectorAll('.nav-item').forEach(btn => {
  if (btn.getAttribute('data-view') === 'radio') {
    btn.addEventListener('click', renderSportsGrid, { once: true });
  }
});
renderSportsGrid();

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

window.switchView = switchView;
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
  // Auto-load YouTube: use watch history for smarter first query, show resume bar
  if (viewName === 'youtube') {
    if (!ytState.loaded) {
      ytState.loaded = true;
      ytvShowResumeBar?.();
      const wh = ytvGetWatchHistory?.();
      if (wh?.length) {
        ytvSearch('eritrean music 2025');
      } else {
        ytvSearch('eritrean music 2025');
      }
    } else {
      ytvShowResumeBar?.();
    }
  }
  // Load library content when switching to library view
  if (viewName === 'library') {
    if (activeLibTab === 'songs')     renderSongs();
    if (activeLibTab === 'playlists') renderPlaylists();
    if (activeLibTab === 'artists')   renderArtists();
    if (activeLibTab === 'albums')    renderAlbums();
  }
  // Load community posts on first visit
  if (viewName === 'community') loadCommunityPosts();
}

document.querySelectorAll('.sb-nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!btn.dataset.view) return; // settings btn has no data-view; handled by its own listener
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
const ytState = {
  videoId: null, title: '', author: '', thumb: '',
  loaded: false,
  queue: [],        // current search results
  currentIndex: -1, // index of playing video in queue
  repeat: false,    // loop current video (one)
  repeatAll: false, // loop entire queue
  shuffle: false,   // randomise play order
  invBase: null,    // winning Invidious instance from search (used for audio extraction only)
  audioMode: false, // true = playing via native <audio> element (real background play)
  lastQuery: '',    // last search query (for year re-filter)
  yearFilter: '',   // active year filter ('' = all)
  countdownTimer: null, // autoplay countdown timer handle
};

// Listen for YouTube iframe postMessage events (video ended, etc.)
let _ytvEndedAt = 0;
window.addEventListener('message', e => {
  if (!e.data || typeof e.data !== 'string') return;
  try {
    const d = JSON.parse(e.data);
    // Handle both infoDelivery (periodic) and onStateChange (explicit) — state 0 = ended
    const isEnded = (d.event === 'infoDelivery' && d.info?.playerState === 0) ||
                    (d.event === 'onStateChange' && d.info === 0);
    if (isEnded) {
      const now = Date.now();
      if (now - _ytvEndedAt < 2000) return; // debounce duplicate events
      _ytvEndedAt = now;
      if (ytState.repeat) {
        window.ytvPlayIndex(ytState.currentIndex);
      } else if (ytState.repeatAll || ytState.queue.length > 1) {
        ytvNextWithCountdown();
      } else {
        ytvNextWithCountdown();
      }
    }
  } catch { /* not JSON */ }
});

window.ytvPlayIndex = function ytvPlayIndex(idx) {
  const q = ytState.queue;
  if (!q.length || idx < 0 || idx >= q.length) return;
  ytvCancelCountdown();
  const v = q[idx];
  ytState.currentIndex = idx;
  document.querySelectorAll('.ytv-card').forEach((c, i) => c.classList.toggle('ytv-card-active', i === idx));
  ytvUpdateQueueCounter();
  ytvUpdateQueuePanel();
  window.ytvPlay(v.videoId, v.title, v.thumb || `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`, v.author);
};

function ytvNext() {
  const q = ytState.queue;
  if (!q.length) return;
  let next;
  if (ytState.shuffle && q.length > 1) {
    do { next = Math.floor(Math.random() * q.length); } while (next === ytState.currentIndex);
  } else {
    next = (ytState.currentIndex + 1) % q.length;
  }
  window.ytvPlayIndex(next);
}

function ytvPrev() {
  const q = ytState.queue;
  if (!q.length) return;
  const prev = (ytState.currentIndex - 1 + q.length) % q.length;
  window.ytvPlayIndex(prev);
}

function ytvUpdateQueueCounter() {
  const el = document.getElementById('ytvQueueCounter');
  if (!el || !ytState.queue.length) return;
  el.textContent = `${ytState.currentIndex + 1} / ${ytState.queue.length}`;
}

function ytvUpdateMediaSession() {
  if (!('mediaSession' in navigator) || !ytState.videoId) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title:  ytState.title  || 'YouTube',
    artist: ytState.author || '',
    album:  'ERI-FAM · YouTube',
    artwork: ytState.thumb ? [{ src: ytState.thumb, sizes: '480x360', type: 'image/jpeg' }] : [],
  });
  navigator.mediaSession.setActionHandler('previoustrack', ytvPrev);
  navigator.mediaSession.setActionHandler('nexttrack',     ytvNext);
  navigator.mediaSession.playbackState = 'playing';
}

async function ytvSearch(query, skipHistory = false) {
  const grid   = document.getElementById('ytvGrid');
  const status = document.getElementById('ytvStatus');
  if (!query.trim()) return;
  status.textContent = '⏳ Searching…';
  grid.innerHTML = '';
  ytState.invBase = null; // reset per-search so we re-race for best instance
  ytState.lastQuery = query;

  if (!skipHistory) ytvSaveHistory(query);

  // Append year to query if year filter is active
  const fullQuery = ytState.yearFilter ? `${query} ${ytState.yearFilter}` : query;
  const q = encodeURIComponent(fullQuery);

  // ── Official YouTube Data API v3 (requires key) ──
  if (typeof YOUTUBE_API_KEY !== 'undefined' && YOUTUBE_API_KEY) {
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=20&q=${q}&key=${YOUTUBE_API_KEY}`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (res.ok) {
        const data = await res.json();
        const results = (data.items || []).map(v => ({
          videoId: v.id.videoId,
          title: v.snippet.title,
          author: v.snippet.channelTitle,
          thumb: v.snippet.thumbnails?.medium?.url,
        })).filter(v => v.videoId);
        if (results.length) { status.textContent = ''; ytvRenderResults(results); return; }
      }
    } catch { /* fall through */ }
  }

  // ── Parse helpers ──
  const parsePiped = data => (data.items || [])
    .filter(v => v.url && (v.type === 'stream' || v.type === 'video' || !v.type))
    .map(v => ({
      videoId: (v.url.split('v=')[1] || '').split('&')[0] || v.url.replace('/watch?v=', ''),
      title:   v.title || '',
      author:  v.uploaderName || v.author || '',
      lengthSeconds: v.duration || 0,
      viewCount: v.views || 0,
      thumb: v.thumbnail || null,
    })).filter(v => v.videoId && v.videoId.length > 5);

  const parseInvidious = data => (Array.isArray(data) ? data : [])
    .filter(v => v.type === 'video' && v.videoId)
    .map(v => ({
      videoId: v.videoId,
      title:   v.title || '',
      author:  v.author || '',
      lengthSeconds: v.lengthSeconds || 0,
      viewCount: v.viewCount || 0,
      thumb: v.videoThumbnails?.find(t => t.quality === 'medium' || t.quality === 'mqdefault')?.url || null,
    }));

  // Race all Piped instances in parallel — first response wins
  const pipedBases = [
    'https://pipedapi.kavin.rocks',
    'https://api.piped.yt',
    'https://pipedapi.tokhmi.xyz',
    'https://pipedapi.moomoo.me',
    'https://piped-api.garudalinux.org',
    'https://pa.il.shn.hk',
  ];
  try {
    const results = await Promise.any(
      pipedBases.map(base =>
        fetch(`${base}/search?q=${q}&filter=videos`, { signal: AbortSignal.timeout(7000) })
          .then(r => { if (!r.ok) throw new Error('not ok'); return r.json(); })
          .then(data => { const r = parsePiped(data); if (!r.length) throw new Error('empty'); return r; })
      )
    );
    status.textContent = '';
    ytvRenderResults(results);
    return;
  } catch { /* all Piped instances failed, try Invidious */ }

  // Race all Invidious instances in parallel
  const invidiousBases = [
    'https://inv.nadeko.net',
    'https://invidious.io.lol',
    'https://invidious.privacydev.net',
    'https://iv.melmac.space',
    'https://yt.drgnz.club',
    'https://invidious.perennialte.ch',
    'https://vid.puffyan.us',
  ];
  try {
    const results = await Promise.any(
      invidiousBases.map(base =>
        fetch(`${base}/api/v1/search?q=${q}&type=video&page=1`, { signal: AbortSignal.timeout(7000) })
          .then(r => { if (!r.ok) throw new Error('not ok'); return r.json(); })
          .then(data => {
            const r = parseInvidious(data);
            if (!r.length) throw new Error('empty');
            ytState.invBase = base; // remember for audio extraction in background mode
            return r;
          })
      )
    );
    status.textContent = '';
    ytvRenderResults(results);
    return;
  } catch { ytState.invBase = null; /* all Invidious instances failed, try scraping */ }

  // Last resort: scrape YouTube search HTML via CORS proxy
  try {
    const ytUrl = `https://www.youtube.com/results?search_query=${q}&sp=EgIQAQ%3D%3D`;
    const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(ytUrl)}`, { signal: AbortSignal.timeout(12000) });
    if (res.ok) {
      const html = await res.text();
      const startIdx = html.indexOf('var ytInitialData = ');
      if (startIdx !== -1) {
        const jsonStart = startIdx + 'var ytInitialData = '.length;
        // Walk forward to find the end of the JSON object
        let depth = 0, i = jsonStart, inStr = false, esc = false;
        for (; i < Math.min(html.length, jsonStart + 500000); i++) {
          const c = html[i];
          if (esc) { esc = false; continue; }
          if (c === '\\' && inStr) { esc = true; continue; }
          if (c === '"') { inStr = !inStr; continue; }
          if (!inStr) {
            if (c === '{') depth++;
            else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
          }
        }
        const ytData = JSON.parse(html.slice(jsonStart, i));
        const section = ytData?.contents?.twoColumnSearchResultsRenderer
          ?.primaryContents?.sectionListRenderer?.contents?.[0]
          ?.itemSectionRenderer?.contents || [];
        const results = section
          .filter(item => item.videoRenderer)
          .map(item => {
            const v = item.videoRenderer;
            return {
              videoId: v.videoId,
              title:   v.title?.runs?.[0]?.text || '',
              author:  v.ownerText?.runs?.[0]?.text || '',
              thumb:   `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`,
              viewCount: parseInt((v.viewCountText?.simpleText || '').replace(/\D/g,'') || '0'),
            };
          }).filter(v => v.videoId);
        if (results.length) { status.textContent = ''; ytvRenderResults(results); return; }
      }
    }
  } catch { /* scraping failed too */ }

  status.textContent = '⚠ Could not load results — check your connection and try again';
}

function ytvRenderResults(results) {
  const grid = document.getElementById('ytvGrid');
  // Deduplicate by videoId so the same song can't appear twice
  const seen = new Set();
  const filtered = results.filter(v => {
    if (!v.videoId || seen.has(v.videoId)) return false;
    seen.add(v.videoId);
    return true;
  });
  if (!filtered.length) { grid.innerHTML = '<p class="ytv-empty">No results found.</p>'; return; }
  ytState.queue = filtered;
  if (ytState.currentIndex >= filtered.length) ytState.currentIndex = -1;
  const liked = ytvGetLiked();
  grid.innerHTML = filtered.map((v, idx) => {
    const thumb    = v.thumb || `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`;
    const dur      = v.lengthSeconds ? ytvFmtDur(v.lengthSeconds) : '';
    const views    = v.viewCount     ? ytvFmtViews(v.viewCount)   : '';
    const isActive = idx === ytState.currentIndex;
    const isLiked  = liked.some(l => l.videoId === v.videoId);
    const initial  = (v.author || 'E').trim()[0].toUpperCase();
    const avatarBg = ytvAvatarColor(v.author || '');
    const isWL = ytvGetWatchLater().some(w => w.videoId === v.videoId);
    return `
      <div class="ytv-card${isActive ? ' ytv-card-active' : ''}" data-ytidx="${idx}"
           data-vid="${esc(v.videoId)}" data-title="${esc(v.title || '')}"
           data-thumb="${esc(thumb)}" data-author="${esc(v.author || '')}">
        <div class="ytv-thumb-wrap" onclick="ytvPlayIndex(${idx})">
          <img class="ytv-thumb" src="${thumb}" alt="" loading="lazy" onerror="this.parentNode.style.background='#1a1a1a'"/>
          <div class="ytv-thumb-hover-play">
            <svg width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="18" fill="rgba(0,0,0,.6)"/><polygon points="14,11 27,18 14,25" fill="#fff"/></svg>
          </div>
          ${dur ? `<span class="ytv-dur">${dur}</span>` : ''}
          ${isActive ? '<span class="ytv-now-badge">▶ Now Playing</span>' : ''}
          <button class="ytv-card-ni-btn" data-action="notinterested" title="Not interested">✕</button>
        </div>
        <div class="ytv-card-body" onclick="ytvPlayIndex(${idx})">
          <div class="ytv-card-avatar" style="background:${avatarBg}">${initial}</div>
          <div class="ytv-card-text">
            <div class="ytv-card-title">${esc(v.title || '')}</div>
            <div class="ytv-card-meta">
              <span class="ytv-ch-link" data-action="chfilter">${esc(v.author || '')}</span>${views ? ' · ' + views : ''}
            </div>
          </div>
        </div>
        <div class="ytv-card-actions">
          <button class="ytv-like-btn${isLiked ? ' liked' : ''}" data-action="like">${isLiked ? '❤' : '🤍'}</button>
          <button class="ytv-wl-btn${isWL ? ' wl-saved' : ''}" data-action="watchlater">${isWL ? '🕐' : '🕐'}</button>
          <button class="ytv-share-btn" data-action="share">↗</button>
          <button class="ytv-pl-add-btn" data-action="addtoplaylist">📋</button>
          <button class="ytv-queue-add-btn" data-action="addqueue">+</button>
        </div>
      </div>`;
  }).join('');
}

window.ytvPlay = function(videoId, title, thumb, author) {
  ytState.videoId = videoId;
  ytState.title   = title;
  ytState.thumb   = thumb || `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
  ytState.author  = author;

  // Save to watch history + resume state
  ytvSaveWatchHistory({ videoId, title, thumb: ytState.thumb, author });
  ytvSaveResume({ videoId, title, thumb: ytState.thumb, author });

  const frame  = document.getElementById('ytvFrame');
  const player = document.getElementById('ytvPlayer');

  // Always update info bar + float player
  document.getElementById('ytvBarTitle').textContent  = title;
  document.getElementById('ytvBarAuthor').textContent = author;
  document.getElementById('ytFloatTitle').textContent  = title;
  document.getElementById('ytFloatAuthor').textContent = author;
  document.getElementById('ytFloatThumb').src          = ytState.thumb;
  document.getElementById('ytFloat').hidden            = true;
  // Update channel avatar
  const avatarEl = document.getElementById('ytvAvatar');
  if (avatarEl) {
    avatarEl.textContent = (author || 'E').trim()[0].toUpperCase();
    avatarEl.style.background = ytvAvatarColor(author || '');
  }
  ytvUpdateQueueCounter();

  if (ytState.audioMode) {
    // Already in audio/background mode — extract audio for the new video
    ytvEnterAudioMode();
    player.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }

  // Always embed via youtube-nocookie.com — Invidious embed pages show consent errors
  frame.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&playsinline=1&modestbranding=1&enablejsapi=1&origin=${location.origin}`;
  player.hidden = false;
  ytvUpdateMediaSession();
  player.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

function ytvStop() {
  const frame = document.getElementById('ytvFrame');
  frame.src = '';
  document.getElementById('ytvPlayer').hidden = true;
  document.getElementById('ytFloat').hidden   = true;
  ytvCancelCountdown();
  const qp = document.getElementById('ytvQueuePanel');
  if (qp) qp.hidden = true;
  ytState.videoId      = null;
  ytState.currentIndex = -1;
  if (ytState.audioMode) { audio.pause(); audio.src = ''; S.playing = false; S.currentTrack = null; updatePlayIcons?.(); }
  ytState.audioMode = false;
  document.getElementById('ytvAudioBtn').classList.remove('active');
  document.getElementById('ytvFrameWrap').classList.remove('audio-mode');
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
  document.querySelectorAll('.ytv-card').forEach(c => c.classList.remove('ytv-card-active'));
  const counter = document.getElementById('ytvQueueCounter');
  if (counter) counter.textContent = '';
}

// Audio-only / Background play mode
document.getElementById('ytvAudioBtn').addEventListener('click', () => {
  if (ytState.audioMode || document.getElementById('ytvAudioBtn').classList.contains('active')) {
    ytvExitAudioMode();
  } else {
    ytvEnterAudioMode();
  }
});

async function ytvEnterAudioMode() {
  const videoId = ytState.videoId;
  if (!videoId) return;
  const btn  = document.getElementById('ytvAudioBtn');
  const wrap = document.getElementById('ytvFrameWrap');
  btn.textContent = '⏳'; btn.disabled = true;

  const base = ytState.invBase;
  if (base) {
    // Try to pull a direct audio stream URL from Invidious (itag 251=opus, 140=m4a)
    for (const itag of [251, 140]) {
      try {
        const url = `${base}/latest_version?id=${videoId}&itag=${itag}&local=true`;
        const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(4000) });
        if (res.ok) {
          // Silence the iframe, play through the native <audio> element
          document.getElementById('ytvFrame').src = '';
          wrap.classList.add('audio-mode');
          const ytTrack = {
            id:      'yt_' + videoId,
            title:   ytState.title  || 'YouTube',
            artist:  ytState.author || 'YouTube',
            album:   'YouTube',
            artwork: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            url, type: 'cloud',
          };
          await playTrack(ytTrack);
          ytState.audioMode = true;
          btn.classList.add('active');
          btn.textContent = '🎵 Audio';
          btn.disabled = false;
          toast('🎵 Background play ON — use lock screen or headphone controls');
          return;
        }
      } catch { /* try next itag */ }
    }
  }

  // Fallback: CSS collapse only (iframe audio may still pause in background)
  wrap.classList.add('audio-mode');
  ytState.audioMode = false;
  btn.classList.add('active');
  btn.textContent = '🎵 Audio';
  btn.disabled = false;
  toast('🎵 Audio-only — note: may pause when app is backgrounded');
}

function ytvExitAudioMode() {
  const videoId = ytState.videoId;
  const wrap    = document.getElementById('ytvFrameWrap');
  const frame   = document.getElementById('ytvFrame');
  const btn     = document.getElementById('ytvAudioBtn');

  wrap.classList.remove('audio-mode');
  btn.classList.remove('active');

  if (ytState.audioMode) {
    // Stop native audio and clear track
    audio.pause(); audio.src = '';
    S.playing = false; S.currentTrack = null;
    updatePlayIcons?.(); updateHeaderPlayState?.();
    document.getElementById('miniPlayer')?.classList.remove('active');
  }
  ytState.audioMode = false;

  // Restore iframe
  if (videoId) {
    frame.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&playsinline=1&modestbranding=1&enablejsapi=1&origin=${location.origin}`;
  }
  toast('📺 Video restored');
}

// PiP — guide the user (iframe PiP is browser-native)
document.getElementById('ytvPipBtn').addEventListener('click', () => {
  toast('▶ Tap inside the video → browser menu → Picture in Picture');
});

document.getElementById('ytvCloseBtn').addEventListener('click', ytvStop);

// Prev / Next / Shuffle / Repeat controls
document.getElementById('ytvPrevBtn').addEventListener('click', ytvPrev);
document.getElementById('ytvNextBtn').addEventListener('click', ytvNext);
document.getElementById('ytvShuffleBtn').addEventListener('click', () => {
  ytState.shuffle = !ytState.shuffle;
  document.getElementById('ytvShuffleBtn').classList.toggle('active', ytState.shuffle);
  toast(ytState.shuffle ? '🔀 Shuffle ON' : '🔀 Shuffle OFF');
});
document.getElementById('ytvRepeatBtn').addEventListener('click', () => {
  const btn = document.getElementById('ytvRepeatBtn');
  if (!ytState.repeat && !ytState.repeatAll) {
    ytState.repeat = true; ytState.repeatAll = false;
    btn.classList.add('active'); btn.textContent = '🔂';
    toast('🔂 Repeat ONE');
  } else if (ytState.repeat && !ytState.repeatAll) {
    ytState.repeat = false; ytState.repeatAll = true;
    btn.classList.add('active'); btn.textContent = '🔁';
    toast('🔁 Repeat ALL');
  } else {
    ytState.repeat = false; ytState.repeatAll = false;
    btn.classList.remove('active'); btn.textContent = '🔂';
    toast('Repeat OFF');
  }
});

// Float player controls
document.getElementById('ytFloatOpen').addEventListener('click',  () => switchView('youtube'));
document.getElementById('ytFloatClose').addEventListener('click', ytvStop);
document.getElementById('ytFloatPrev')?.addEventListener('click', ytvPrev);
document.getElementById('ytFloatNext')?.addEventListener('click', ytvNext);

// Search
document.getElementById('ytvSearchBtn').addEventListener('click', () => {
  const q = document.getElementById('ytvSearch').value.trim();
  if (q) ytvSearch(q);
});
document.getElementById('ytvSearch').addEventListener('keydown', e => {
  if (e.key === 'Enter') { const q = e.target.value.trim(); if (q) ytvSearch(q); }
});

// Preset chips (skip liked chip — handled separately in tweaks block)
document.querySelectorAll('.ytv-chip:not(.ytv-chip-liked)').forEach(chip => {
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

// ── YOUTUBE TWEAKS (features 1-10) ────────────────────────────

// 1 & 2. Search History + Watch History helpers
const YTV_HISTORY_KEY  = 'ytv_search_history';
const YTV_WATCH_KEY    = 'ytv_watch_history';
const YTV_RESUME_KEY   = 'ytv_resume';
const YTV_LIKED_KEY    = 'ytv_liked';

function ytvGetSearchHistory() {
  try { return JSON.parse(localStorage.getItem(YTV_HISTORY_KEY) || '[]'); } catch { return []; }
}
function ytvSaveHistory(query) {
  const q = query.trim();
  if (!q || q.length < 2) return;
  let h = ytvGetSearchHistory().filter(x => x !== q);
  h.unshift(q);
  if (h.length > 12) h = h.slice(0, 12);
  localStorage.setItem(YTV_HISTORY_KEY, JSON.stringify(h));
  ytvRenderHistoryRow();
}
function ytvRenderHistoryRow() {
  const row = document.getElementById('ytvHistoryRow');
  if (!row) return;
  const h = ytvGetSearchHistory();
  if (!h.length) { row.hidden = true; return; }
  row.hidden = false;
  row.innerHTML = h.map(q =>
    `<button class="ytv-history-chip" data-q="${esc(q)}">
       🕐 ${esc(q)}
       <span class="ytv-hc-del" data-del="${esc(q)}">✕</span>
     </button>`
  ).join('');
}

// Event delegation for history chips
document.getElementById('ytvHistoryRow')?.addEventListener('click', e => {
  const delBtn = e.target.closest('.ytv-hc-del');
  if (delBtn) {
    let h = ytvGetSearchHistory().filter(x => x !== delBtn.dataset.del);
    localStorage.setItem(YTV_HISTORY_KEY, JSON.stringify(h));
    ytvRenderHistoryRow();
    return;
  }
  const chip = e.target.closest('.ytv-history-chip');
  if (chip && chip.dataset.q) {
    document.getElementById('ytvSearch').value = chip.dataset.q;
    ytvSearch(chip.dataset.q);
  }
});

// Watch history
function ytvGetWatchHistory() {
  try { return JSON.parse(localStorage.getItem(YTV_WATCH_KEY) || '[]'); } catch { return []; }
}
function ytvSaveWatchHistory(entry) {
  let h = ytvGetWatchHistory().filter(v => v.videoId !== entry.videoId);
  h.unshift(entry);
  if (h.length > 50) h = h.slice(0, 50);
  localStorage.setItem(YTV_WATCH_KEY, JSON.stringify(h));
}

// 4. Resume last-played
function ytvSaveResume(entry) {
  localStorage.setItem(YTV_RESUME_KEY, JSON.stringify(entry));
}
function ytvShowResumeBar() {
  const bar = document.getElementById('ytvResumeBar');
  if (!bar) return;
  try {
    const entry = JSON.parse(localStorage.getItem(YTV_RESUME_KEY) || 'null');
    if (!entry?.videoId) { bar.hidden = true; return; }
    document.getElementById('ytvResumeThumb').src     = entry.thumb || '';
    document.getElementById('ytvResumeTitle').textContent = entry.title || '';
    bar.hidden = false;
    document.getElementById('ytvResumePlay').onclick = () => {
      bar.hidden = true;
      window.ytvPlay(entry.videoId, entry.title, entry.thumb, entry.author);
    };
  } catch { bar.hidden = true; }
}
document.getElementById('ytvResumeClose')?.addEventListener('click', () => {
  document.getElementById('ytvResumeBar').hidden = true;
});

// 3. Year filter
document.querySelectorAll('.ytv-year-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ytv-year-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    ytState.yearFilter = btn.dataset.year;
    if (ytState.lastQuery) ytvSearch(ytState.lastQuery, true);
  });
});

// 5. Liked videos
function ytvGetLiked() {
  try { return JSON.parse(localStorage.getItem(YTV_LIKED_KEY) || '[]'); } catch { return []; }
}
function ytvToggleLike(entry) {
  let liked = ytvGetLiked();
  const idx = liked.findIndex(v => v.videoId === entry.videoId);
  if (idx >= 0) {
    liked.splice(idx, 1);
    toast('Removed from Liked');
  } else {
    liked.unshift(entry);
    if (liked.length > 200) liked = liked.slice(0, 200);
    toast('❤ Added to Liked');
  }
  localStorage.setItem(YTV_LIKED_KEY, JSON.stringify(liked));
  return liked;
}

// Liked chip — show liked videos as a queue
document.getElementById('ytvLikedChip')?.addEventListener('click', () => {
  document.querySelectorAll('.ytv-chip').forEach(c => c.classList.remove('active'));
  document.getElementById('ytvLikedChip').classList.add('active');
  const liked = ytvGetLiked();
  if (!liked.length) {
    document.getElementById('ytvGrid').innerHTML = '<p class="ytv-empty">No liked videos yet — tap 🤍 on any card.</p>';
    document.getElementById('ytvStatus').textContent = '';
    return;
  }
  ytvRenderResults(liked);
  document.getElementById('ytvStatus').textContent = '';
});

// Card action event delegation (like, watch-later, share, playlist, add-queue, not-interested, ch-filter)
document.getElementById('ytvGrid')?.addEventListener('click', e => {
  const actionEl = e.target.closest('[data-action]');
  if (!actionEl) return;
  e.stopPropagation();
  const card = e.target.closest('.ytv-card');
  if (!card) return;
  const { vid, title, thumb, author } = card.dataset;
  const action = actionEl.dataset.action;

  if (action === 'like') {
    const liked = ytvToggleLike({ videoId: vid, title, thumb, author });
    const isNow = liked.some(l => l.videoId === vid);
    actionEl.classList.toggle('liked', isNow);
    actionEl.textContent = isNow ? '❤' : '🤍';
  }
  if (action === 'watchlater') {
    const wl = ytvToggleWatchLater({ videoId: vid, title, thumb, author });
    const isNow = wl.some(w => w.videoId === vid);
    actionEl.classList.toggle('wl-saved', isNow);
    toast(isNow ? '🕐 Saved to Watch Later' : 'Removed from Watch Later');
  }
  if (action === 'share') {
    ytvOpenShareSheet({ videoId: vid, title, thumb, author });
  }
  if (action === 'addtoplaylist') {
    ytvOpenPlaylistPanel({ videoId: vid, title, thumb, author });
  }
  if (action === 'addqueue') {
    const already = ytState.queue.some(v => v.videoId === vid);
    if (!already) {
      ytState.queue.push({ videoId: vid, title, thumb, author });
      ytvUpdateQueueCounter();
      toast(`➕ Added — ${ytState.queue.length} in queue`);
    } else { toast('Already in queue'); }
  }
  if (action === 'notinterested') {
    ytvHideVideo(vid);
    card.style.transition = 'opacity .25s, transform .25s';
    card.style.opacity = '0'; card.style.transform = 'scale(.92)';
    setTimeout(() => card.remove(), 260);
    toast('Video hidden');
  }
  if (action === 'chfilter') {
    ytvFilterByChannel(author);
  }
});

// 6. Queue panel
document.getElementById('ytvQueueBtn')?.addEventListener('click', () => {
  const panel = document.getElementById('ytvQueuePanel');
  if (!panel) return;
  const isHidden = panel.hidden;
  panel.hidden = !isHidden;
  if (!isHidden) return;
  ytvUpdateQueuePanel();
});
document.getElementById('ytvQpClose')?.addEventListener('click', () => {
  const panel = document.getElementById('ytvQueuePanel');
  if (panel) panel.hidden = true;
});

function ytvUpdateQueuePanel() {
  const panel  = document.getElementById('ytvQueuePanel');
  const list   = document.getElementById('ytvQpList');
  const count  = document.getElementById('ytvQpCount');
  if (!panel || !list) return;
  const q = ytState.queue;
  if (count) count.textContent = q.length;
  list.innerHTML = q.map((v, idx) => {
    const thumb = v.thumb || `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`;
    const isActive = idx === ytState.currentIndex;
    return `<div class="ytv-qp-item${isActive ? ' ytv-qp-active' : ''}" data-qpidx="${idx}">
      <span class="ytv-qp-num">${isActive ? '▶' : idx + 1}</span>
      <img class="ytv-qp-thumb" src="${thumb}" alt="" loading="lazy"/>
      <div class="ytv-qp-info">
        <div class="ytv-qp-title">${esc(v.title || '')}</div>
        <div class="ytv-qp-author">${esc(v.author || '')}</div>
      </div>
    </div>`;
  }).join('');
}
document.getElementById('ytvQpList')?.addEventListener('click', e => {
  const item = e.target.closest('.ytv-qp-item');
  if (item) {
    window.ytvPlayIndex(parseInt(item.dataset.qpidx, 10));
    document.getElementById('ytvQueuePanel').hidden = true;
  }
});

// 7. Autoplay countdown
function ytvNextWithCountdown() {
  const q = ytState.queue;
  if (!q.length) return;
  let next;
  if (ytState.shuffle && q.length > 1) {
    do { next = Math.floor(Math.random() * q.length); } while (next === ytState.currentIndex);
  } else {
    next = (ytState.currentIndex + 1) % q.length;
  }
  // If same index as current (single item), play immediately
  if (next === ytState.currentIndex) { window.ytvPlayIndex(next); return; }

  let secs = 5;
  const bar  = document.getElementById('ytvCountdown');
  const text = document.getElementById('ytvCountdownText');
  if (!bar || !text) { window.ytvPlayIndex(next); return; }

  ytvCancelCountdown();
  bar.hidden = false;
  text.textContent = `▶ Next video in ${secs}s`;

  ytState.countdownTimer = setInterval(() => {
    secs--;
    if (secs <= 0) {
      ytvCancelCountdown();
      window.ytvPlayIndex(next);
    } else {
      text.textContent = `▶ Next video in ${secs}s`;
    }
  }, 1000);
}
function ytvCancelCountdown() {
  if (ytState.countdownTimer) { clearInterval(ytState.countdownTimer); ytState.countdownTimer = null; }
  const bar = document.getElementById('ytvCountdown');
  if (bar) bar.hidden = true;
}
document.getElementById('ytvCountdownSkip')?.addEventListener('click', () => {
  // Pull the next index from the countdown text and jump immediately
  ytvCancelCountdown();
  ytvNext();
});
document.getElementById('ytvCountdownCancel')?.addEventListener('click', ytvCancelCountdown);

// 10. Smarter first-load — show resume bar when YouTube view opens
(function ytvInitTweaks() {
  ytvRenderHistoryRow();
  ytvShowResumeBar();
  ytvShowRecents();
  // trending loaded after round-3 functions are defined (ytvLoadTrending called at end of round-3 block)
})();

// ── YOUTUBE ROUND 3 — 10 more features ───────────────────────

// Helper: deterministic avatar color from channel name
function ytvAvatarColor(name) {
  const palette = ['#c0392b','#27ae60','#2980b9','#8e44ad','#d35400','#16a085','#c0392b','#1abc9c'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

// 1. Search autocomplete (matches saved history as you type)
const ytvSearchInput = document.getElementById('ytvSearch');
const ytvSugBox      = document.getElementById('ytvSuggestions');
const ytvClearBtn    = document.getElementById('ytvSearchClear');

ytvSearchInput?.addEventListener('input', () => {
  const val = ytvSearchInput.value.trim();
  if (ytvClearBtn) ytvClearBtn.hidden = !val;
  if (!val) { ytvSugBox.hidden = true; return; }
  const matches = ytvGetSearchHistory().filter(q => q.toLowerCase().includes(val.toLowerCase())).slice(0, 6);
  if (!matches.length) { ytvSugBox.hidden = true; return; }
  ytvSugBox.hidden = false;
  ytvSugBox.innerHTML = matches.map(q =>
    `<div class="yt2-sug-item" data-q="${esc(q)}">
       <span class="yt2-sug-icon">🕐</span>${esc(q)}
     </div>`
  ).join('');
});
ytvSugBox?.addEventListener('click', e => {
  const item = e.target.closest('.yt2-sug-item');
  if (item) {
    ytvSearchInput.value = item.dataset.q;
    ytvSugBox.hidden = true;
    ytvSearch(item.dataset.q);
  }
});
ytvClearBtn?.addEventListener('click', () => {
  ytvSearchInput.value = '';
  ytvSugBox.hidden = true;
  ytvClearBtn.hidden = true;
  ytvSearchInput.focus();
});
document.addEventListener('click', e => {
  if (!ytvSugBox?.contains(e.target) && e.target !== ytvSearchInput) {
    if (ytvSugBox) ytvSugBox.hidden = true;
  }
});

// 2. Recently watched row
function ytvShowRecents() {
  const wrap = document.getElementById('ytvRecents');
  const list = document.getElementById('ytvRecentsList');
  if (!wrap || !list) return;
  const wh = ytvGetWatchHistory().slice(0, 10);
  if (!wh.length) { wrap.hidden = true; return; }
  wrap.hidden = false;
  list.innerHTML = wh.map(v =>
    `<div class="yt2-recent-card" data-vid="${esc(v.videoId)}" data-title="${esc(v.title || '')}"
          data-thumb="${esc(v.thumb || '')}" data-author="${esc(v.author || '')}">
       <img class="yt2-recent-thumb" src="${esc(v.thumb || `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`)}"
            alt="" loading="lazy" onerror="this.style.background='#222'"/>
       <div class="yt2-recent-title">${esc(v.title || '')}</div>
       <div class="yt2-recent-ch">${esc(v.author || '')}</div>
     </div>`
  ).join('');
}
document.getElementById('ytvRecentsList')?.addEventListener('click', e => {
  const card = e.target.closest('.yt2-recent-card');
  if (!card) return;
  const { vid, title, thumb, author } = card.dataset;
  // Find in queue or play directly
  const idx = ytState.queue.findIndex(v => v.videoId === vid);
  if (idx >= 0) { window.ytvPlayIndex(idx); }
  else { window.ytvPlay(vid, title, thumb, author); }
  document.getElementById('ytvRecents').hidden = true;
});
document.getElementById('ytvRecentsAll')?.addEventListener('click', () => {
  const wh = ytvGetWatchHistory();
  if (wh.length) { ytvRenderResults(wh); document.getElementById('ytvRecents').hidden = true; }
});

// 3. Add-to-queue button on cards (event delegation — extends existing grid handler)
// Handled inside the existing ytvGrid click handler below:
document.getElementById('ytvGrid')?.addEventListener('click', e => {
  const addBtn = e.target.closest('.ytv-queue-add-btn');
  if (!addBtn) return;
  e.stopPropagation();
  const card = e.target.closest('.ytv-card');
  if (!card) return;
  const { vid, title, thumb, author } = card.dataset;
  // Append if not already in queue
  const already = ytState.queue.some(v => v.videoId === vid);
  if (!already) {
    ytState.queue.push({ videoId: vid, title, thumb, author });
    ytvUpdateQueueCounter();
    toast(`➕ Added to queue — ${ytState.queue.length} videos`);
  } else {
    toast('Already in queue');
  }
});

// 4. Repeat-all is already handled in the repeat button handler above.
// ytvNextWithCountdown respects repeatAll by wrapping around (it already uses % queue.length).

// 5. Sort results
let ytvCurrentSort = 'default';
document.getElementById('ytvSortBtn')?.addEventListener('click', e => {
  e.stopPropagation();
  const panel = document.getElementById('ytvSortPanel');
  if (panel) panel.hidden = !panel.hidden;
});
document.getElementById('ytvSortPanel')?.addEventListener('click', e => {
  const opt = e.target.closest('.yt2-sort-opt');
  if (!opt) return;
  document.querySelectorAll('.yt2-sort-opt').forEach(b => b.classList.remove('active'));
  opt.classList.add('active');
  ytvCurrentSort = opt.dataset.sort;
  document.getElementById('ytvSortPanel').hidden = true;
  ytvApplySort();
});
document.addEventListener('click', e => {
  const panel = document.getElementById('ytvSortPanel');
  if (panel && !panel.hidden && !panel.contains(e.target) && e.target?.id !== 'ytvSortBtn') {
    panel.hidden = true;
  }
});
function ytvApplySort() {
  if (!ytState.queue.length) return;
  const q = [...ytState.queue];
  if (ytvCurrentSort === 'views')    q.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
  if (ytvCurrentSort === 'shortest') q.sort((a, b) => (a.lengthSeconds || 9999) - (b.lengthSeconds || 9999));
  if (ytvCurrentSort === 'longest')  q.sort((a, b) => (b.lengthSeconds || 0) - (a.lengthSeconds || 0));
  ytState.queue = q;
  ytState.currentIndex = -1;
  ytvRenderResults(q);
  const label = { default:'Default', views:'Most Viewed', shortest:'Shortest', longest:'Longest' }[ytvCurrentSort];
  document.getElementById('ytvSortBtn').textContent = `⇅ ${label}`;
}

// 6. Sleep timer
let ytvSleepTimer = null, ytvSleepEnd = 0;
document.getElementById('ytvSleepBtn')?.addEventListener('click', e => {
  e.stopPropagation();
  const picker = document.getElementById('ytvSleepPicker');
  if (!picker) return;
  picker.hidden = !picker.hidden;
  if (!picker.hidden) {
    const btnRect = e.currentTarget.getBoundingClientRect();
    const viewEl  = document.getElementById('view-youtube');
    picker.style.top = (e.currentTarget.offsetTop + e.currentTarget.offsetHeight + 4) + 'px';
  }
});
document.getElementById('ytvSleepPicker')?.addEventListener('click', e => {
  const opt = e.target.closest('.yt2-sp-opt');
  if (!opt) return;
  document.getElementById('ytvSleepPicker').hidden = true;
  ytvStartSleep(parseInt(opt.dataset.mins, 10));
});
document.addEventListener('click', e => {
  const picker = document.getElementById('ytvSleepPicker');
  if (picker && !picker.hidden && !picker.contains(e.target) && e.target?.id !== 'ytvSleepBtn') {
    picker.hidden = true;
  }
});
function ytvStartSleep(mins) {
  if (ytvSleepTimer) clearInterval(ytvSleepTimer);
  ytvSleepEnd = Date.now() + mins * 60 * 1000;
  const bar  = document.getElementById('ytvSleepBar');
  const text = document.getElementById('ytvSleepText');
  if (bar) bar.hidden = false;
  toast(`😴 Sleep timer set — ${mins} min`);
  ytvSleepTimer = setInterval(() => {
    const rem = Math.max(0, ytvSleepEnd - Date.now());
    const m = Math.floor(rem / 60000), s = Math.floor((rem % 60000) / 1000);
    if (text) text.textContent = `Stops in ${m}:${String(s).padStart(2,'0')}`;
    if (rem <= 0) {
      clearInterval(ytvSleepTimer); ytvSleepTimer = null;
      if (bar) bar.hidden = true;
      ytvStop();
      toast('😴 Sleep timer stopped playback');
    }
  }, 1000);
}
document.getElementById('ytvSleepCancel')?.addEventListener('click', () => {
  if (ytvSleepTimer) { clearInterval(ytvSleepTimer); ytvSleepTimer = null; }
  const bar = document.getElementById('ytvSleepBar');
  if (bar) bar.hidden = true;
  toast('Sleep timer cancelled');
});

// 7. Open in YouTube
document.getElementById('ytvOpenYTBtn')?.addEventListener('click', () => {
  if (!ytState.videoId) return;
  window.open(`https://www.youtube.com/watch?v=${ytState.videoId}`, '_blank', 'noopener');
});

// 8. Copy link
document.getElementById('ytvCopyLinkBtn')?.addEventListener('click', () => {
  if (!ytState.videoId) return;
  const url = `https://www.youtube.com/watch?v=${ytState.videoId}`;
  navigator.clipboard?.writeText(url)
    .then(() => toast('🔗 Link copied!'))
    .catch(() => toast('🔗 ' + url));
});

// 9. Theater mode
document.getElementById('ytvTheaterBtn')?.addEventListener('click', () => {
  const isTheater = document.body.classList.toggle('yt2-theater');
  const bg  = document.getElementById('ytvTheaterBg');
  const btn = document.getElementById('ytvTheaterBtn');
  if (bg)  bg.hidden  = !isTheater;
  if (btn) btn.classList.toggle('active', isTheater);
  toast(isTheater ? '🎬 Theater mode ON' : '🎬 Theater mode OFF');
});
// Cancel theater when closing player
const _ytvStopOrig = ytvStop;

// 10. Playback speed (postMessage to YouTube iframe)
document.querySelector('.yt2-speed-row')?.addEventListener('click', e => {
  const btn = e.target.closest('.yt2-spd');
  if (!btn) return;
  const speed = parseFloat(btn.dataset.speed);
  document.querySelectorAll('.yt2-spd').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  // Send to YouTube iframe API
  const frame = document.getElementById('ytvFrame');
  if (frame?.contentWindow) {
    frame.contentWindow.postMessage(
      JSON.stringify({ event: 'command', func: 'setPlaybackRate', args: [speed] }), '*'
    );
  }
  toast(`${speed === 1 ? 'Normal' : speed + '×'} speed`);
});

// ── YOUTUBE ROUND 3 — 10 new features ────────────────────────

// Storage keys
const YTV_WL_KEY  = 'ytv_watch_later';
const YTV_NI_KEY  = 'ytv_not_interested';
const YTV_PL_KEY  = 'ytv_playlists';

// ── 1. Keyboard shortcuts ────────────────────────────────────
document.addEventListener('keydown', e => {
  // Don't fire when user is typing in an input
  if (e.target.matches('input,textarea,select,[contenteditable]')) return;
  if (document.getElementById('view-youtube')?.classList.contains('active') === false) return;

  const frame = document.getElementById('ytvFrame');
  const send  = cmd => frame?.contentWindow?.postMessage(JSON.stringify({ event:'command', func:cmd, args:[] }), '*');

  switch (e.key) {
    case ' ':
    case 'k':
      e.preventDefault();
      send(frame?.src?.includes('autoplay=1') ? 'pauseVideo' : 'playVideo');
      // Toggle pause via postMessage
      frame?.contentWindow?.postMessage(JSON.stringify({ event:'command', func:'getPlayerState', args:[] }), '*');
      toast('⏸ Space');
      break;
    case 'n': case 'N': ytvNext(); break;
    case 'p': case 'P': ytvPrev(); break;
    case 's': case 'S':
      ytState.shuffle = !ytState.shuffle;
      document.getElementById('ytvShuffleBtn')?.classList.toggle('active', ytState.shuffle);
      toast(ytState.shuffle ? '🔀 Shuffle ON' : '🔀 Shuffle OFF');
      break;
    case 'l': case 'L':
      if (ytState.videoId) {
        const liked = ytvToggleLike({ videoId: ytState.videoId, title: ytState.title, thumb: ytState.thumb, author: ytState.author });
        const isNow = liked.some(v => v.videoId === ytState.videoId);
        const btn = document.getElementById('ytvLikeCurrentBtn');
        if (btn) { btn.classList.toggle('active', isNow); btn.textContent = isNow ? '❤ Liked' : '👍 Like'; }
        toast(isNow ? '❤ Liked!' : 'Like removed');
      }
      break;
    case 'w': case 'W':
      if (ytState.videoId) {
        const wl = ytvToggleWatchLater({ videoId: ytState.videoId, title: ytState.title, thumb: ytState.thumb, author: ytState.author });
        toast(wl.some(v => v.videoId === ytState.videoId) ? '🕐 Saved to Watch Later' : 'Removed from Watch Later');
      }
      break;
    case 'f': case 'F':
      document.getElementById('ytvFrameWrap')?.requestFullscreen?.().catch(() => {});
      break;
    case '?':
      const kbHelp = document.getElementById('ytvKbHelp');
      if (kbHelp) kbHelp.hidden = !kbHelp.hidden;
      break;
  }
});
document.getElementById('ytvKbHelpBtn')?.addEventListener('click', () => {
  const el = document.getElementById('ytvKbHelp');
  if (el) el.hidden = !el.hidden;
});
document.getElementById('ytvKbClose')?.addEventListener('click', () => {
  document.getElementById('ytvKbHelp').hidden = true;
});

// ── 2. Watch Later ───────────────────────────────────────────
function ytvGetWatchLater() {
  try { return JSON.parse(localStorage.getItem(YTV_WL_KEY) || '[]'); } catch { return []; }
}
function ytvToggleWatchLater(entry) {
  let wl = ytvGetWatchLater();
  const idx = wl.findIndex(v => v.videoId === entry.videoId);
  if (idx >= 0) wl.splice(idx, 1);
  else { wl.unshift(entry); if (wl.length > 500) wl = wl.slice(0, 500); }
  localStorage.setItem(YTV_WL_KEY, JSON.stringify(wl));
  return wl;
}
// Watch Later current video (player pill button)
document.getElementById('ytvWatchLaterCurrentBtn')?.addEventListener('click', () => {
  if (!ytState.videoId) return;
  const wl = ytvToggleWatchLater({ videoId: ytState.videoId, title: ytState.title, thumb: ytState.thumb, author: ytState.author });
  const isNow = wl.some(v => v.videoId === ytState.videoId);
  const btn = document.getElementById('ytvWatchLaterCurrentBtn');
  if (btn) { btn.classList.toggle('active', isNow); btn.textContent = isNow ? '🕐 Saved' : '🕐 Save'; }
  toast(isNow ? '🕐 Saved to Watch Later' : 'Removed from Watch Later');
});
// Watch Later chip
document.getElementById('ytvWatchLaterChip')?.addEventListener('click', () => {
  document.querySelectorAll('.ytv-chip').forEach(c => c.classList.remove('active'));
  document.getElementById('ytvWatchLaterChip').classList.add('active');
  const wl = ytvGetWatchLater();
  if (!wl.length) {
    document.getElementById('ytvGrid').innerHTML = '<p class="ytv-empty">No saved videos. Tap 🕐 on any card.</p>';
    document.getElementById('ytvStatus').textContent = '';
    return;
  }
  ytvRenderResults(wl);
  document.getElementById('ytvStatus').textContent = '';
});

// ── 3. Channel filter ────────────────────────────────────────
function ytvFilterByChannel(channelName) {
  if (!channelName) return;
  const filtered = ytState.queue.filter(v => v.author === channelName);
  if (!filtered.length) { toast(`No other videos from ${channelName}`); return; }
  document.getElementById('ytvChFilterName').textContent = channelName;
  document.getElementById('ytvChFilterBar').hidden = false;
  ytvRenderResults(filtered);
  toast(`Showing ${filtered.length} videos from ${channelName}`);
}
document.getElementById('ytvChFilterClear')?.addEventListener('click', () => {
  document.getElementById('ytvChFilterBar').hidden = true;
  if (ytState.lastQuery) ytvSearch(ytState.lastQuery, true);
});

// ── 4. Not Interested ────────────────────────────────────────
function ytvGetHidden() {
  try { return JSON.parse(localStorage.getItem(YTV_NI_KEY) || '[]'); } catch { return []; }
}
function ytvHideVideo(videoId) {
  let hidden = ytvGetHidden();
  if (!hidden.includes(videoId)) {
    hidden.unshift(videoId);
    if (hidden.length > 1000) hidden = hidden.slice(0, 1000);
    localStorage.setItem(YTV_NI_KEY, JSON.stringify(hidden));
  }
  // Remove from current queue too
  ytState.queue = ytState.queue.filter(v => v.videoId !== videoId);
}
// Hidden video filtering is handled by the ytvRenderResults patch at the bottom of round-3.

// ── 5. Share bottom sheet ────────────────────────────────────
function ytvOpenShareSheet(entry) {
  const { videoId, title, thumb } = entry || { videoId: ytState.videoId, title: ytState.title, thumb: ytState.thumb };
  if (!videoId) return;
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const bd = document.getElementById('ytvShareBackdrop');
  const sh = document.getElementById('ytvShareSheet');
  document.getElementById('ytvShareThumb').src        = thumb || `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
  document.getElementById('ytvShareVidTitle').textContent = title || '';
  // Show native share button if supported
  const nativeBtn = document.getElementById('ytvShareNative');
  if (nativeBtn) nativeBtn.hidden = !navigator.share;
  bd.hidden = false; sh.hidden = false;

  const close = () => { bd.hidden = true; sh.hidden = true; };
  document.getElementById('ytvShareClose').onclick  = close;
  bd.onclick = close;
  document.getElementById('ytvShareCopy').onclick   = () => { navigator.clipboard?.writeText(url).then(() => toast('🔗 Copied!')).catch(() => toast(url)); close(); };
  document.getElementById('ytvShareWA').onclick     = () => { window.open(`https://wa.me/?text=${encodeURIComponent(title + '\n' + url)}`, '_blank', 'noopener'); close(); };
  document.getElementById('ytvShareTG').onclick     = () => { window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`, '_blank', 'noopener'); close(); };
  document.getElementById('ytvShareTW').onclick     = () => { window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`, '_blank', 'noopener'); close(); };
  document.getElementById('ytvShareNative').onclick = () => { navigator.share?.({ title, url }).catch(() => {}); close(); };
}
// Hook player Share pill to share sheet
document.getElementById('ytvShareCurBtn')?.addEventListener('click', () => ytvOpenShareSheet());

// ── 6. Playback timer bar ────────────────────────────────────
let _ytvTimerStart = 0, _ytvTimerInterval = null, _ytvTimerDur = 0;
function ytvStartTimer() {
  if (_ytvTimerInterval) clearInterval(_ytvTimerInterval);
  _ytvTimerStart = Date.now();
  const bar  = document.getElementById('ytvTimerBar');
  const fill = document.getElementById('ytvTimerFill');
  const text = document.getElementById('ytvTimerText');
  if (bar) bar.hidden = false;
  _ytvTimerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - _ytvTimerStart) / 1000);
    const m = Math.floor(elapsed / 60), s = elapsed % 60;
    if (text) text.textContent = `${m}:${String(s).padStart(2,'0')}`;
    // Animate fill (cap at 20 min = 1200s for visual)
    if (fill) fill.style.width = Math.min(100, (elapsed / 1200) * 100) + '%';
  }, 1000);
}
function ytvStopTimer() {
  if (_ytvTimerInterval) { clearInterval(_ytvTimerInterval); _ytvTimerInterval = null; }
  const bar = document.getElementById('ytvTimerBar');
  if (bar) bar.hidden = true;
  const fill = document.getElementById('ytvTimerFill');
  if (fill) fill.style.width = '0%';
}
// Hook into ytvPlay to start timer, ytvStop to stop it
const _ytvPlayOrig = window.ytvPlay;
window.ytvPlay = function(videoId, title, thumb, author) {
  ytvStartTimer();
  _ytvPlayOrig(videoId, title, thumb, author);
};
const _ytvStopTimerWrap = ytvStop;
// (ytvStop already cancels countdown — we add timer stop via patching below)

// ── 7. Trending section ──────────────────────────────────────
const YTV_TRENDING_QUERIES = [
  'eritrean music 2025', 'new eritrean tigrinya song', 'eritrean wedding music 2025',
  'haile roots eritrean', 'eritrean best hits', 'yonatan tesfatsion',
];
async function ytvLoadTrending() {
  const wrap = document.getElementById('ytvTrending');
  const list = document.getElementById('ytvTrendingList');
  if (!wrap || !list) return;
  wrap.hidden = false;
  list.innerHTML = '<p style="color:rgba(255,255,255,.35);font-size:.78rem;padding:4px 0">Loading…</p>';
  const q = YTV_TRENDING_QUERIES[Math.floor(Math.random() * YTV_TRENDING_QUERIES.length)];
  try {
    // Reuse existing search infrastructure but capture results without rendering to grid
    const results = await ytvFetchOnly(q);
    if (!results?.length) { wrap.hidden = true; return; }
    list.innerHTML = results.slice(0, 8).map((v, i) => {
      const thumb = v.thumb || `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`;
      return `<div class="yt2-trending-card" data-vid="${esc(v.videoId)}"
                   data-title="${esc(v.title||'')}" data-thumb="${esc(thumb)}" data-author="${esc(v.author||'')}">
        <img class="yt2-trending-thumb" src="${thumb}" alt="" loading="lazy" onerror="this.style.background='#222'"/>
        <div class="yt2-tr-play">▶</div>
        <span class="yt2-tr-rank">${i + 1}</span>
        <div class="yt2-trending-title">${esc(v.title || '')}</div>
        <div class="yt2-trending-ch">${esc(v.author || '')}</div>
      </div>`;
    }).join('');
  } catch { wrap.hidden = true; }
}
document.getElementById('ytvTrendingList')?.addEventListener('click', e => {
  const card = e.target.closest('.yt2-trending-card');
  if (!card) return;
  const { vid, title, thumb, author } = card.dataset;
  window.ytvPlay(vid, title, thumb, author);
  document.getElementById('ytvTrending').hidden = true;
});
document.getElementById('ytvTrendingRefresh')?.addEventListener('click', ytvLoadTrending);

// Fetch-only helper (like ytvSearch but returns results without side effects)
async function ytvFetchOnly(query) {
  const q = encodeURIComponent(query);
  const pipedBases = ['https://pipedapi.kavin.rocks','https://api.piped.yt','https://pipedapi.tokhmi.xyz'];
  const parsePiped = data => (data.items || [])
    .filter(v => v.url && (v.type === 'stream' || v.type === 'video' || !v.type))
    .map(v => ({ videoId:(v.url.split('v=')[1]||'').split('&')[0]||v.url.replace('/watch?v=',''), title:v.title||'', author:v.uploaderName||v.author||'', lengthSeconds:v.duration||0, viewCount:v.views||0, thumb:v.thumbnail||null }))
    .filter(v => v.videoId?.length > 5);
  try {
    return await Promise.any(pipedBases.map(base =>
      fetch(`${base}/search?q=${q}&filter=videos`, { signal: AbortSignal.timeout(7000) })
        .then(r => { if (!r.ok) throw new Error(); return r.json(); })
        .then(d => { const r = parsePiped(d); if (!r.length) throw new Error(); return r; })
    ));
  } catch { return []; }
}

// ── 8. Auto-queue-more (endless mode) ────────────────────────
let _ytvAutoFetching = false;
async function ytvAutoQueueMore() {
  if (_ytvAutoFetching || !ytState.author) return;
  _ytvAutoFetching = true;
  toast('♾ Loading more like this…');
  try {
    const more = await ytvFetchOnly(`${ytState.author} eritrean music`);
    const hidden = new Set(ytvGetHidden());
    const existing = new Set(ytState.queue.map(v => v.videoId));
    const fresh = more.filter(v => !existing.has(v.videoId) && !hidden.has(v.videoId));
    if (fresh.length) {
      ytState.queue.push(...fresh);
      ytvUpdateQueueCounter();
      toast(`♾ ${fresh.length} more videos added`);
    } else { toast('No more found'); }
  } catch { /* silent */ }
  _ytvAutoFetching = false;
}
// Hook into ytvNextWithCountdown: when we reach end of queue, auto-fetch more
const _origYtvNextWC = ytvNextWithCountdown;
ytvNextWithCountdown = function() {
  const q = ytState.queue;
  const isLast = !ytState.shuffle && (ytState.currentIndex + 1 >= q.length);
  if (isLast && !ytState.repeatAll) {
    ytvAutoQueueMore().then(() => _origYtvNextWC());
    return;
  }
  _origYtvNextWC();
};

// ── 9. Custom playlists ──────────────────────────────────────
function ytvGetPlaylists() {
  try { return JSON.parse(localStorage.getItem(YTV_PL_KEY) || '[]'); } catch { return []; }
}
function ytvSavePlaylists(pls) { localStorage.setItem(YTV_PL_KEY, JSON.stringify(pls)); }

let _ytvPlPendingVideo = null;
function ytvOpenPlaylistPanel(entry) {
  _ytvPlPendingVideo = entry;
  const panel = document.getElementById('ytvPlPanel');
  const bd    = document.getElementById('ytvPlBackdrop');
  if (!panel || !bd) return;
  panel.hidden = false; bd.hidden = false;
  ytvRenderPlList();
}
function ytvRenderPlList() {
  const list = document.getElementById('ytvPlList');
  if (!list) return;
  const pls = ytvGetPlaylists();
  if (!pls.length) { list.innerHTML = '<p style="padding:14px 16px;color:rgba(255,255,255,.4);font-size:.8rem">No playlists yet. Create one below.</p>'; return; }
  const vid = _ytvPlPendingVideo?.videoId;
  list.innerHTML = pls.map(pl => {
    const inPl = vid && pl.videos.some(v => v.videoId === vid);
    return `<div class="yt2-pl-item" data-plid="${esc(pl.id)}">
      <div class="yt2-pl-item-check${inPl ? ' checked' : ''}">${inPl ? '✓' : ''}</div>
      <span class="yt2-pl-item-name">${esc(pl.name)}</span>
      <span class="yt2-pl-item-count">${pl.videos.length} videos</span>
    </div>`;
  }).join('');
}
document.getElementById('ytvPlList')?.addEventListener('click', e => {
  const item = e.target.closest('.yt2-pl-item');
  if (!item || !_ytvPlPendingVideo) return;
  const plid = item.dataset.plid;
  let pls = ytvGetPlaylists();
  const pl = pls.find(p => p.id === plid);
  if (!pl) return;
  const idx = pl.videos.findIndex(v => v.videoId === _ytvPlPendingVideo.videoId);
  if (idx >= 0) { pl.videos.splice(idx, 1); toast(`Removed from "${pl.name}"`); }
  else { pl.videos.push(_ytvPlPendingVideo); toast(`✓ Added to "${pl.name}"`); }
  ytvSavePlaylists(pls);
  ytvRenderPlList();
});
document.getElementById('ytvPlNewBtn')?.addEventListener('click', () => {
  const inp = document.getElementById('ytvPlNewInput');
  const name = inp?.value.trim();
  if (!name) return;
  let pls = ytvGetPlaylists();
  const newPl = { id: Date.now().toString(36), name, videos: _ytvPlPendingVideo ? [_ytvPlPendingVideo] : [] };
  pls.unshift(newPl);
  ytvSavePlaylists(pls);
  inp.value = '';
  ytvRenderPlList();
  toast(`📋 "${name}" created`);
});
document.getElementById('ytvPlClose')?.addEventListener('click', () => {
  document.getElementById('ytvPlPanel').hidden = true;
  document.getElementById('ytvPlBackdrop').hidden = true;
  _ytvPlPendingVideo = null;
});
document.getElementById('ytvPlBackdrop')?.addEventListener('click', () => {
  document.getElementById('ytvPlPanel')?.hidden && null;
  document.getElementById('ytvPlPanel').hidden = true;
  document.getElementById('ytvPlBackdrop').hidden = true;
});

// Playlists chip → playlist manager
document.getElementById('ytvPlaylistsChip')?.addEventListener('click', () => {
  const panel = document.getElementById('ytvPlmPanel');
  const bd    = document.getElementById('ytvPlBackdrop');
  if (!panel || !bd) return;
  panel.hidden = false; bd.hidden = false;
  ytvRenderPlmList();
});
function ytvRenderPlmList() {
  const list = document.getElementById('ytvPlmList');
  if (!list) return;
  const pls = ytvGetPlaylists();
  if (!pls.length) { list.innerHTML = '<p style="padding:14px 16px;color:rgba(255,255,255,.4);font-size:.8rem">No playlists yet. Tap 📋 on any video card.</p>'; return; }
  list.innerHTML = pls.map(pl => {
    const thumb = pl.videos[0]?.thumb || '';
    const thumb2 = pl.videos[1]?.thumb || '';
    return `<div class="yt2-plm-item" data-plid="${esc(pl.id)}">
      <div class="yt2-plm-item-row">
        <div class="yt2-plm-thumb-stack">
          ${thumb2 ? `<img class="yt2-plm-thumb2" src="${esc(thumb2)}" alt=""/>` : ''}
          <img class="yt2-plm-thumb" src="${esc(thumb)}" alt="" onerror="this.style.background='#222'"/>
        </div>
        <div class="yt2-plm-info">
          <div class="yt2-plm-name">${esc(pl.name)}</div>
          <div class="yt2-plm-cnt">${pl.videos.length} video${pl.videos.length !== 1 ? 's' : ''}</div>
        </div>
        <button class="yt2-plm-play-btn" data-play="${esc(pl.id)}">▶ Play all</button>
        <button class="yt2-plm-del-btn"  data-del="${esc(pl.id)}">🗑</button>
      </div>
    </div>`;
  }).join('');
}
document.getElementById('ytvPlmList')?.addEventListener('click', e => {
  const playBtn = e.target.closest('[data-play]');
  const delBtn  = e.target.closest('[data-del]');
  if (playBtn) {
    const pl = ytvGetPlaylists().find(p => p.id === playBtn.dataset.play);
    if (pl?.videos.length) {
      ytvRenderResults(pl.videos);
      window.ytvPlayIndex(0);
      document.getElementById('ytvPlmPanel').hidden = true;
      document.getElementById('ytvPlBackdrop').hidden = true;
      toast(`▶ Playing "${pl.name}"`);
    }
  }
  if (delBtn) {
    if (!confirm('Delete this playlist?')) return;
    let pls = ytvGetPlaylists().filter(p => p.id !== delBtn.dataset.del);
    ytvSavePlaylists(pls);
    ytvRenderPlmList();
  }
});
document.getElementById('ytvPlmClose')?.addEventListener('click', () => {
  document.getElementById('ytvPlmPanel').hidden = true;
  document.getElementById('ytvPlBackdrop').hidden = true;
});

// ── 10. Card hover zoom is pure CSS (styles added above) ──────
// Init trending on load
ytvLoadTrending();

// Patch ytvStop to also stop timer and close sheets
const _origStop = ytvStop;
ytvStop = function() {
  _origStop();
  ytvStopTimer();
  document.body.classList.remove('yt2-theater');
  const bg = document.getElementById('ytvTheaterBg');
  if (bg) bg.hidden = true;
};

// Patch ytvRenderResults to filter not-interested videos
const _origRender = ytvRenderResults;
ytvRenderResults = function(results) {
  const hidden = new Set(ytvGetHidden());
  _origRender(results.filter(v => !hidden.has(v.videoId)));
};

// ── Offline / reconnect handling while video is playing ────────
function ytvShowOffline() {
  const overlay = document.getElementById('ytvOfflineOverlay');
  if (overlay) overlay.hidden = false;
  const bar = document.getElementById('ytvTimerBar');
  if (bar) bar.hidden = true;
}
function ytvHideOffline() {
  const overlay = document.getElementById('ytvOfflineOverlay');
  if (overlay) overlay.hidden = true;
}
function ytvResumeAfterReconnect() {
  if (!ytState.videoId) return;
  ytvHideOffline();
  if (ytState.audioMode) {
    // Re-extract audio stream for the current video
    ytvEnterAudioMode();
  } else {
    // Reload the iframe — YouTube embed auto-plays on src set
    const frame = document.getElementById('ytvFrame');
    if (frame) {
      frame.src = `https://www.youtube-nocookie.com/embed/${ytState.videoId}?autoplay=1&rel=0&playsinline=1&modestbranding=1&enablejsapi=1&origin=${location.origin}`;
    }
  }
  ytvStartTimer();
  toast('🟢 Back online — resuming video');
}

window.addEventListener('offline', () => {
  if (!ytState.videoId) return;
  ytvShowOffline();
  // Pause native audio if in audio mode so it doesn't error-loop
  if (ytState.audioMode) { try { audio.pause(); } catch {} }
});

window.addEventListener('online', () => {
  if (!ytState.videoId) return;
  ytvResumeAfterReconnect();
});

// Also catch the <audio> stall/error that happens when the stream URL drops mid-play
audio.addEventListener('error', () => {
  if (ytState.audioMode && ytState.videoId) ytvShowOffline();
});
audio.addEventListener('stalled', () => {
  if (ytState.audioMode && ytState.videoId) {
    // Give it 4 seconds before showing the overlay (minor stalls are normal)
    setTimeout(() => {
      if (ytState.audioMode && ytState.videoId && audio.paused) ytvShowOffline();
    }, 4000);
  }
});

// Retry button
document.getElementById('ytvOfflineRetry')?.addEventListener('click', () => {
  if (!navigator.onLine) { toast('Still offline — waiting for connection'); return; }
  ytvResumeAfterReconnect();
});

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

document.getElementById('ytWatchPlayBtn')?.addEventListener('click', () => ytWatchPlay(document.getElementById('ytWatchInput')?.value));
document.getElementById('ytWatchInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') ytWatchPlay(document.getElementById('ytWatchInput')?.value); });

// ── YouTube → MP3 ──────────────────────────────────────────────
document.getElementById('ytExtractBtn')?.addEventListener('click', ytExtractMp3);
document.getElementById('heroYtMp3Btn')?.addEventListener('click', () => switchView('youtube'));

async function ytExtractMp3() {
  const inputEl = document.getElementById('ytWatchInput') || document.getElementById('ytUrl');
  const rawInput = inputEl?.value?.trim() || '';
  if (!rawInput) { toast('Paste a YouTube URL first.'); return; }

  let url = rawInput;
  if (!url.startsWith('http')) url = 'https://www.youtube.com/watch?v=' + url;

  const btn = document.getElementById('ytExtractBtn');
  if (btn) { btn.textContent = '⏳…'; btn.disabled = true; }

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

document.getElementById('ytWatchStop')?.addEventListener('click', () => {
  const frame = document.getElementById('ytWatchFrame');
  if (!frame) return;
  frame.src = ''; frame.hidden = true;
  document.getElementById('ytWatchEmpty').style.display = '';
  document.getElementById('ytWatchBar').hidden = true;
});

document.getElementById('ytCollapseBtn')?.addEventListener('click', () => {
  document.getElementById('ytWatchSection')?.classList.toggle('collapsed');
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
const THEMES = ['dark', 'glass', 'neon', 'sunset', 'ocean', 'forest', 'galaxy'];

function applyTheme(theme) {
  THEMES.forEach(t => document.body.classList.toggle('theme-' + t, t === theme && t !== 'dark'));
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

// Hero greeting based on time + stored username
function updateHeroGreeting() {
  const h = new Date().getHours();
  const base =
    h < 5  ? '🌙 Night Owl Mode' :
    h < 12 ? '☀️ Good Morning' :
    h < 17 ? '👋 Good Afternoon' :
    h < 21 ? '🌆 Good Evening' : '🌙 Good Night';
  const name = localStorage.getItem('erifam_username') || '';
  const el = document.getElementById('heroGreeting');
  if (el) el.textContent = name ? `${base}, ${name}!` : base;
}
updateHeroGreeting();

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

// Ambient background colour cycle (paused when tab is hidden to save battery)
const _ambientBg = document.getElementById('ambientBg');
const _ambientPalette = [
  ['rgba(200,145,74,.15)',  'rgba(99,102,241,.12)'],
  ['rgba(139,92,246,.14)', 'rgba(200,145,74,.10)'],
  ['rgba(236,72,153,.12)', 'rgba(99,102,241,.10)'],
  ['rgba(16,185,129,.11)', 'rgba(200,145,74,.12)'],
  ['rgba(6,182,212,.12)',  'rgba(139,92,246,.10)'],
];
let _ambIdx = 0, _ambInterval = null;
function _cycleAmbient() {
  if (!_ambientBg) return;
  const [a, b] = _ambientPalette[_ambIdx % _ambientPalette.length];
  _ambientBg.style.background =
    `radial-gradient(ellipse at 30% 20%, ${a} 0%, transparent 65%),` +
    `radial-gradient(ellipse at 70% 75%, ${b} 0%, transparent 65%)`;
  _ambIdx++;
}
function _startAmbient() { if (!_ambInterval) _ambInterval = setInterval(_cycleAmbient, 6000); }
function _stopAmbient()  { clearInterval(_ambInterval); _ambInterval = null; }
_cycleAmbient();
_startAmbient();
document.addEventListener('visibilitychange', () => {
  if (document.hidden) _stopAmbient(); else _startAmbient();
});

// 3D card tilt on desktop (mouse hover) — passive to avoid blocking scroll
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
}, { passive: true });
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

// ── COMMUNITY POSTS ────────────────────────────────────────
let _communityLoaded = false;

async function loadCommunityPosts() {
  if (_communityLoaded) return; // only fetch once per session
  _communityLoaded = true;
  const grid = document.getElementById('communityPostsGrid');
  if (!grid) return;
  try {
    await FB_READY;
    if (!db) { grid.innerHTML = '<p class="empty-msg">Connect to internet to view posts.</p>'; return; }
    const { getDocs, collection, query, where, orderBy, limit } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const snap = await getDocs(query(collection(db._db, 'community_posts'), where('status','==','approved'), orderBy('approvedAt','desc'), limit(30)));
    if (snap.empty) { grid.innerHTML = '<p class="empty-msg">No community posts yet. Be the first to share!</p>'; return; }
    grid.innerHTML = snap.docs.map(d => {
      const p    = d.data();
      const date = p.approvedAt?.toDate ? p.approvedAt.toDate().toLocaleDateString() : '';
      const tags = (p.tags || []).map(t => `<span class="community-tag">${escHtml(t)}</span>`).join('');
      const img  = p.imageUrl ? `<img class="community-post-img" src="${escHtml(p.imageUrl)}" alt="" loading="lazy" onerror="this.style.display='none'"/>` : '';
      return `
        <div class="community-post-card">
          ${img}
          <div class="community-post-body">
            <div class="community-post-title">${escHtml(p.title || '')}</div>
            <div class="community-post-text">${escHtml(p.body || '')}</div>
            <div class="community-post-foot">
              <div>
                <div class="community-post-author">— ${escHtml(p.authorName || 'Community')}</div>
                <div class="community-post-date">${date}</div>
              </div>
              ${tags ? `<div class="community-post-tags">${tags}</div>` : ''}
            </div>
          </div>
        </div>`;
    }).join('');
  } catch(e) {
    if (grid) grid.innerHTML = '<p class="empty-msg">Could not load posts. Try again later.</p>';
  }
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Community submission modal
const communityModal = document.getElementById('communityModal');
document.getElementById('communitySubmitBtn')?.addEventListener('click', () => {
  communityModal.style.display = 'flex';
  document.getElementById('cmTitle')?.focus();
});
document.getElementById('communityModalCancel')?.addEventListener('click', () => { communityModal.style.display = 'none'; });
communityModal?.addEventListener('click', e => { if (e.target === communityModal) communityModal.style.display = 'none'; });

document.getElementById('communityModalSubmit')?.addEventListener('click', async () => {
  const title = document.getElementById('cmTitle')?.value.trim() || '';
  const body  = document.getElementById('cmBody')?.value.trim()  || '';
  if (!title) { toast('Please enter a title.'); return; }
  const btn = document.getElementById('communityModalSubmit');
  btn.textContent = 'Submitting…'; btn.disabled = true;
  try {
    await FB_READY;
    if (!db) throw new Error('No connection');
    const { addDoc, collection, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const tags = (document.getElementById('cmTags')?.value || '').split(',').map(t => t.trim()).filter(Boolean);
    await addDoc(collection(db._db, 'community_posts'), {
      title,
      body,
      imageUrl:      document.getElementById('cmImageUrl')?.value.trim() || '',
      tags,
      authorName:    document.getElementById('cmName')?.value.trim() || 'Anonymous',
      authorContact: '',
      status:        'pending',
      source:        'community',
      submittedAt:   serverTimestamp(),
      approvedAt:    null,
    });
    communityModal.style.display = 'none';
    // Clear fields
    ['cmName','cmTitle','cmBody','cmImageUrl','cmTags'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    toast('Post submitted! It will appear after admin review.');
  } catch(e) {
    toast('Failed to submit. Check your connection.');
  }
  btn.textContent = 'Submit for Review'; btn.disabled = false;
});

// ── PWA AUTO-UPDATE ────────────────────────────────────────
let _waitingSW = null;

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then(reg => {
    reg.addEventListener('updatefound', () => {
      const newSW = reg.installing;
      newSW?.addEventListener('statechange', () => {
        if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
          _waitingSW = newSW;
          const banner = document.getElementById('updateBanner');
          if (banner) banner.style.display = 'flex';
        }
      });
    });
    // Check if there's already a waiting SW on page load
    if (reg.waiting && navigator.serviceWorker.controller) {
      _waitingSW = reg.waiting;
      const banner = document.getElementById('updateBanner');
      if (banner) banner.style.display = 'flex';
    }
  });
}

document.getElementById('updateNowBtn')?.addEventListener('click', () => {
  if (_waitingSW) {
    _waitingSW.postMessage('SKIP_WAITING');
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
  }
});
document.getElementById('updateDismissBtn')?.addEventListener('click', () => {
  const banner = document.getElementById('updateBanner');
  if (banner) banner.style.display = 'none';
});

// ── USERNAME SYSTEM ────────────────────────────────────────────
function _updateSettingsProfile(name) {
  const el = document.getElementById('settingUsername');
  if (el) el.textContent = name || 'Guest';
  const av = document.querySelector('.settings-avatar');
  if (av) av.textContent = name ? name[0].toUpperCase() : '🎵';
}

function _saveUsername(name) {
  const trimmed = name.trim();
  if (trimmed) localStorage.setItem('erifam_username', trimmed);
  else localStorage.removeItem('erifam_username');
  updateHeroGreeting();
  _updateSettingsProfile(trimmed);
}

function _showUsernameModal() {
  const modal = document.getElementById('usernameModal');
  if (!modal) return;
  const input = document.getElementById('usernameInput');
  if (input) input.value = localStorage.getItem('erifam_username') || '';
  modal.style.display = 'flex';
  setTimeout(() => input?.focus(), 100);
}

document.getElementById('usernameSaveBtn')?.addEventListener('click', () => {
  _saveUsername(document.getElementById('usernameInput')?.value || '');
  localStorage.setItem('erifam_username_seen', '1');
  document.getElementById('usernameModal').style.display = 'none';
});
document.getElementById('usernameSkipBtn')?.addEventListener('click', () => {
  localStorage.setItem('erifam_username_seen', '1');
  document.getElementById('usernameModal').style.display = 'none';
});
document.getElementById('usernameInput')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('usernameSaveBtn')?.click();
});
document.getElementById('changeNameBtn')?.addEventListener('click', _showUsernameModal);

// Show username in settings on load
(function() {
  _updateSettingsProfile(localStorage.getItem('erifam_username') || '');
})();

// Show welcome modal on first visit (after a short delay so app loads first)
if (!localStorage.getItem('erifam_username') && !localStorage.getItem('erifam_username_seen')) {
  setTimeout(_showUsernameModal, 1200);
}

// ── ARTIST / ALBUM FILTER SELECTS ─────────────────────────────
function _populateFilterSelects() {
  const all = [...S.tracks, ...S.cloudTracks];
  const artists = [...new Set(all.map(t => t.artist || '').filter(Boolean))].sort();
  const albums  = [...new Set(all.map(t => t.album  || '').filter(Boolean))].sort();

  const aSelect = document.getElementById('artistFilterSelect');
  const bSelect = document.getElementById('albumFilterSelect');
  if (!aSelect || !bSelect) return;

  const prevArtist = S.artistFilter;
  const prevAlbum  = S.albumFilter;

  aSelect.innerHTML = '<option value="">All Artists</option>' +
    artists.map(a => `<option value="${esc(a)}"${a === prevArtist ? ' selected' : ''}>${esc(a)}</option>`).join('');
  bSelect.innerHTML = '<option value="">All Albums</option>' +
    albums.map(a => `<option value="${esc(a)}"${a === prevAlbum ? ' selected' : ''}>${esc(a)}</option>`).join('');

  // Show "Delete Filtered" button whenever a secondary filter is active
  _updateDeleteFilteredBtn();
}

function _updateDeleteFilteredBtn() {
  const btn = document.getElementById('deleteFilteredBtn');
  if (!btn) return;
  const active = S.artistFilter || S.albumFilter || S.filter !== 'all';
  const n = getAllTracks().filter(t => S.tracks.find(lt => lt.id === t.id)).length;
  btn.style.display = (active && n > 0) ? '' : 'none';
  btn.textContent = `🗑 Delete Filtered (${n})`;
}

document.getElementById('artistFilterSelect')?.addEventListener('change', function() {
  S.artistFilter = this.value;
  renderTracks();
  _updateDeleteFilteredBtn();
});
document.getElementById('albumFilterSelect')?.addEventListener('change', function() {
  S.albumFilter = this.value;
  renderTracks();
  _updateDeleteFilteredBtn();
});

// ── DELETE FILTERED TRACKS ────────────────────────────────────
document.getElementById('deleteFilteredBtn')?.addEventListener('click', async () => {
  const localTracks = getAllTracks().filter(t => S.tracks.find(lt => lt.id === t.id));
  if (!localTracks.length) { toast('No local tracks to delete in this filter'); return; }
  const n = localTracks.length;
  if (!confirm(`Delete ${n} local track${n > 1 ? 's' : ''}? This cannot be undone.`)) return;
  for (const t of localTracks) await deleteTrack(t.id);
  S.artistFilter = ''; S.albumFilter = '';
  const aSelect = document.getElementById('artistFilterSelect');
  const bSelect = document.getElementById('albumFilterSelect');
  if (aSelect) aSelect.value = '';
  if (bSelect) bSelect.value = '';
  _populateFilterSelects();
  renderTracks();
  toast(`🗑 Deleted ${n} track${n > 1 ? 's' : ''}`);
});

// ── KEYBOARD SHORTCUTS ────────────────────────────────────
document.addEventListener('keydown', e => {
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (document.activeElement?.isContentEditable) return;

  switch(e.key) {
    case ' ':
      e.preventDefault();
      if (S.currentTrack) togglePlay();
      break;
    case 'ArrowRight':
      e.preventDefault();
      nextTrack();
      break;
    case 'ArrowLeft':
      e.preventDefault();
      prevTrack();
      break;
    case 'ArrowUp':
      e.preventDefault();
      S.volume = Math.min(1, S.volume + 0.05);
      audio.volume = S.volume;
      document.getElementById('volSlider').value = S.volume * 100;
      idbPut('settings', { key: 'volume', value: S.volume }).catch(() => {});
      toast(`🔊 ${Math.round(S.volume * 100)}%`);
      break;
    case 'ArrowDown':
      e.preventDefault();
      S.volume = Math.max(0, S.volume - 0.05);
      audio.volume = S.volume;
      document.getElementById('volSlider').value = S.volume * 100;
      idbPut('settings', { key: 'volume', value: S.volume }).catch(() => {});
      toast(`🔉 ${Math.round(S.volume * 100)}%`);
      break;
    case 'l': case 'L':
      if (S.currentTrack) document.getElementById('likeBtn')?.click();
      break;
    case 'm': case 'M':
      audio.muted = !audio.muted;
      toast(audio.muted ? '🔇 Muted' : '🔊 Unmuted');
      break;
    case 'f': case 'F':
      document.getElementById('shuffleBtn')?.click();
      break;
    case 'r': case 'R':
      document.getElementById('repeatBtn')?.click();
      break;
    case '?':
      _toggleKeyboardModal();
      break;
  }
});

/* ════════════════════════════════════════════════════════════════
   KILL CODE — tap the header logo 5× to open secret PIN entry
   Code "5455" grants master bypass stored in localStorage.
   ════════════════════════════════════════════════════════════════ */
(function initKillCode() {
  let tapCount = 0, tapTimer = null;

  const logoEl = document.querySelector('.header-logo') || document.querySelector('.header-title');
  if (!logoEl) return;

  logoEl.addEventListener('click', () => {
    tapCount++;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => { tapCount = 0; }, 2000);
    if (tapCount >= 5) {
      tapCount = 0;
      _showKillCodePrompt();
    }
  });

  function _showKillCodePrompt() {
    const overlay = document.createElement('div');
    overlay.setAttribute('data-kill-overlay', '1');
    overlay.innerHTML = `
      <div class="kc-backdrop">
        <div class="kc-card">
          <div class="kc-glyph">⬡</div>
          <div class="kc-title">MASTER ACCESS</div>
          <div class="kc-sub">Enter bypass code</div>
          <input class="kc-input" id="kcInput" type="password" maxlength="10"
            placeholder="· · · ·" autocomplete="off" inputmode="numeric"/>
          <div class="kc-msg" id="kcMsg"></div>
          <div class="kc-btns">
            <button class="kc-cancel" id="kcCancel">Cancel</button>
            <button class="kc-submit" id="kcSubmit">ACCESS</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const input  = overlay.querySelector('#kcInput');
    const msg    = overlay.querySelector('#kcMsg');
    const submit = overlay.querySelector('#kcSubmit');
    const cancel = overlay.querySelector('#kcCancel');

    setTimeout(() => input.focus(), 80);

    function tryCode() {
      if (input.value === '5455') {
        localStorage.setItem('erifam_master', '1');
        msg.style.color = '#00ff88';
        msg.textContent = '✓ Master access granted';
        setTimeout(() => { overlay.remove(); toast('🔓 Master access active'); }, 800);
      } else {
        msg.style.color = '#ff4444';
        msg.textContent = 'Invalid code — try again';
        input.value = '';
        input.focus();
      }
    }

    submit.addEventListener('click', tryCode);
    cancel.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay.firstElementChild && e.target === e.currentTarget) overlay.remove(); });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') tryCode(); });
  }
})();


function _toggleKeyboardModal() {
  const m = document.getElementById('keyboardModal');
  if (!m) return;
  m.style.display = m.style.display === 'none' ? 'flex' : 'none';
}
document.getElementById('keyboardModalClose')?.addEventListener('click', () => {
  const m = document.getElementById('keyboardModal');
  if (m) m.style.display = 'none';
});
document.getElementById('keyboardModal')?.addEventListener('click', e => {
  if (e.target === e.currentTarget) { e.currentTarget.style.display = 'none'; }
});
document.getElementById('kbdHelpBtn')?.addEventListener('click', _toggleKeyboardModal);

// ── ABOUT SECTION (settings panel) ────────────────────────
(async function loadAboutSection() {
  const socialDefs = [
    ['instagram', '📸', 'Instagram', 'instagram.com'],
    ['tiktok',    '🎵', 'TikTok',    'tiktok.com'],
    ['youtube',   '▶️', 'YouTube',   'youtube.com'],
    ['facebook',  '👥', 'Facebook',  'facebook.com'],
    ['twitter',   '🐦', 'Twitter/X', 'x.com'],
    ['telegram',  '✈️', 'Telegram',  't.me'],
  ];
  try {
    const [appMod, fsMod] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'),
    ]);
    const app  = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(FIREBASE_CONFIG);
    const db   = fsMod.getFirestore(app);
    const snap = await fsMod.getDoc(fsMod.doc(db, 'hub_settings', 'about'));
    const empty = document.getElementById('settingsAboutEmpty');
    if (!snap.exists()) { if (empty) empty.textContent = 'Contact info coming soon.'; return; }
    const d = snap.data();
    const hasSomething = d.description || d.email || d.phone || d.website ||
      Object.values(d.socials || {}).some(Boolean);
    if (!hasSomething) { if (empty) empty.textContent = 'Contact info coming soon.'; return; }
    if (empty) empty.style.display = 'none';
    const wrap = document.getElementById('settingsAbout');
    if (wrap) wrap.style.display = '';
    const descEl = document.getElementById('settingsAboutDesc');
    if (descEl) descEl.textContent = d.description || '';
    const contactsEl = document.getElementById('settingsAboutContacts');
    if (contactsEl) contactsEl.innerHTML = [
      d.email   && `<a href="mailto:${d.email}" class="about-contact-link">✉️ ${d.email}</a>`,
      d.phone   && `<a href="tel:${d.phone}"   class="about-contact-link">📞 ${d.phone}</a>`,
      d.website && `<a href="${d.website}" target="_blank" rel="noopener" class="about-contact-link">🌐 Website</a>`,
    ].filter(Boolean).join('');
    const socialsEl = document.getElementById('settingsAboutSocials');
    if (socialsEl) socialsEl.innerHTML = socialDefs
      .filter(([key]) => d.socials?.[key])
      .map(([key, ico, label, domain]) => {
        const h = d.socials[key];
        const url = h.startsWith('http') ? h : `https://${domain}/${h.replace(/^@/, '')}`;
        return `<a href="${url}" target="_blank" rel="noopener" class="about-social-btn">${ico} ${label}</a>`;
      }).join('');
  } catch(e) {
    const empty = document.getElementById('settingsAboutEmpty');
    if (empty) empty.textContent = 'Contact info coming soon.';
  }
})();

// ── MONETIZE LOADER (donation, sponsors, bio links) ────────
(async function loadMonetize() {
  try {
    const [appMod, fsMod] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'),
    ]);
    const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(FIREBASE_CONFIG);
    const db  = fsMod.getFirestore(app);

    // Donation / support
    const monSnap = await fsMod.getDoc(fsMod.doc(db, 'hub_settings', 'monetize'));
    if (monSnap.exists()) {
      const m   = monSnap.data();
      const don = m.donation || {};
      if (don.enabled !== false) {
        const sec = document.getElementById('settingsSupportSection');
        if (sec) sec.style.display = '';
        const msgEl = document.getElementById('settingsDonateMsg');
        if (msgEl && don.message) msgEl.textContent = don.message;
        const linksEl = document.getElementById('settingsDonateLinks');
        if (linksEl) {
          const defs = [
            [don.paypal,    '💳', 'PayPal',   don.paypal],
            [don.cashapp,   '💵', 'Cash App', don.cashapp ? `https://cash.app/${don.cashapp.replace(/^\$/,'')}` : ''],
            [don.venmo,     '🏦', 'Venmo',    don.venmo   ? `https://venmo.com/${don.venmo.replace(/^@/,'')}` : ''],
            [don.kofi,      '☕', 'Ko-fi',    don.kofi],
            [don.patreon,   '🎨', 'Patreon',  don.patreon],
            [don.gofundme,  '❤️', 'GoFundMe', don.gofundme],
          ].filter(([val]) => val);
          linksEl.innerHTML = defs.map(([, ico, label, url]) =>
            `<a href="${url}" target="_blank" rel="noopener" class="donate-link-btn">${ico} ${label}</a>`
          ).join('');
        }
      }
      // Bio links
      const links = m.links || [];
      if (links.length) {
        const bioSec = document.getElementById('settingsBioSection');
        if (bioSec) bioSec.style.display = '';
        const bioEl = document.getElementById('settingsBioLinks');
        if (bioEl) {
          bioEl.innerHTML = links.map(l =>
            `<a href="${l.url}" target="_blank" rel="noopener" class="settings-bio-link">
               <span class="sbl-emoji">${l.emoji || '🔗'}</span>
               <div class="sbl-info"><div class="sbl-title">${l.title}</div>${l.desc ? `<div class="sbl-desc">${l.desc}</div>` : ''}</div>
               <span class="sbl-arrow">↗</span>
             </a>`
          ).join('');
        }
      }
    }

    // Sponsors
    const spSnap = await fsMod.getDocs(
      fsMod.query(fsMod.collection(db, 'hub_sponsors'),
        fsMod.where('status', '==', 'active'),
        fsMod.where('targetApp', 'in', ['all', 'erifam'])
      )
    );
    const bannerEl = document.getElementById('sponsorBanner');
    if (bannerEl && !spSnap.empty) {
      bannerEl.style.display = '';
      const sponsors = spSnap.docs.map(d => d.data());
      const sp = sponsors[Math.floor(Math.random() * sponsors.length)];
      bannerEl.innerHTML = `
        <a href="${sp.link}" target="_blank" rel="noopener" class="sponsor-banner-link">
          ${sp.logo ? `<img src="${sp.logo}" alt="${sp.name}" class="sp-logo"/>` : `<span class="sp-emoji">🤝</span>`}
          <div class="sp-info">
            <div class="sp-label">Sponsored</div>
            <div class="sp-name">${sp.name}</div>
            ${sp.description ? `<div class="sp-desc">${sp.description}</div>` : ''}
          </div>
          <span class="sp-arrow">↗</span>
        </a>`;
    }
  } catch(e) { console.warn('[Monetize]', e); }
})();


/* ════════════════════════════════════════════════════════════════
   NEW FEATURE 1 — Recently Played Section
   Shows last 15 played tracks on the home page
   ════════════════════════════════════════════════════════════════ */
function renderRecentlyPlayed() {
  const section = document.getElementById('recentSection');
  const scroll  = document.getElementById('recentScroll');
  if (!section || !scroll) return;
  const recent = JSON.parse(localStorage.getItem('erifam_recent') || '[]');
  const all    = [...S.tracks, ...S.cloudTracks];
  const tracks = recent.map(id => all.find(t => t.id === id)).filter(Boolean).slice(0, 15);
  if (!tracks.length) { section.style.display = 'none'; return; }
  scroll.innerHTML = tracks.map(t => `
    <div class="recent-card" data-id="${t.id}">
      <div class="recent-art">${t.artwork ? `<img src="${esc(t.artwork)}" alt="" loading="lazy" />` : artEl(t,'card')}</div>
      <div class="recent-title">${esc(t.title)}</div>
      <div class="recent-artist">${esc(t.artist)}</div>
    </div>`).join('');
  scroll.querySelectorAll('.recent-card').forEach(card => {
    card.addEventListener('click', () => {
      const track = tracks.find(t => t.id === card.getAttribute('data-id'));
      if (track) playTrack(track, tracks);
    });
  });
  section.style.display = '';
}

document.getElementById('recentClearBtn')?.addEventListener('click', () => {
  localStorage.removeItem('erifam_recent');
  document.getElementById('recentSection').style.display = 'none';
  toast('🕐 Recently played cleared');
});

/* ════════════════════════════════════════════════════════════════
   NEW FEATURE 2 — Playlist Detail View + Delete + Rename
   ════════════════════════════════════════════════════════════════ */
async function renderPlaylistsV2() {
  const playlists = await idbGetAll('playlists');
  const grid = document.getElementById('playlistGrid');
  if (!playlists.length) {
    grid.innerHTML = '<p class="empty-msg">No playlists yet. Create one!</p>';
    return;
  }
  grid.innerHTML = playlists.map(pl => `
    <div class="pl-card" data-plid="${pl.id}">
      <div class="pl-art">📁</div>
      <div class="pl-name">${esc(pl.name)}</div>
      <div class="pl-count">${(pl.trackIds||[]).length} tracks</div>
      <button class="pl-card-opts" data-plid="${pl.id}">⋯</button>
    </div>`).join('');
  grid.querySelectorAll('.pl-card').forEach(card => {
    card.addEventListener('click', async e => {
      if (e.target.closest('.pl-card-opts')) {
        e.stopPropagation();
        const pl = playlists.find(p => p.id === e.target.closest('.pl-card-opts').getAttribute('data-plid'));
        if (pl) openPlaylistOptions(pl);
        return;
      }
      const pl = playlists.find(p => p.id === card.getAttribute('data-plid'));
      if (pl) openPlaylistDetail(pl);
    });
  });
}
renderPlaylists = renderPlaylistsV2;

function openPlaylistOptions(pl) {
  sheetTrackId = null;
  document.getElementById('sheetInfo').innerHTML = `<strong>${esc(pl.name)}</strong><span>${(pl.trackIds||[]).length} tracks</span>`;
  document.getElementById('sheetActions').innerHTML = `
    <button class="sheet-action" id="plOptPlay">
      <svg viewBox="0 0 24 24" fill="currentColor" style="width:20px;height:20px"><polygon points="5 3 19 12 5 21 5 3"/></svg>Play
    </button>
    <button class="sheet-action" id="plOptRename">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px"><path d="M11 4H4a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Rename
    </button>
    <button class="sheet-action danger" id="plOptDelete">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>Delete
    </button>`;
  document.getElementById('plOptPlay').onclick = async () => {
    const all = [...S.tracks, ...S.cloudTracks];
    const tracks = (pl.trackIds||[]).map(id => all.find(t => t.id === id)).filter(Boolean);
    tracks.length ? playTrack(tracks[0], tracks) : toast('Playlist is empty');
    closeSheet();
  };
  document.getElementById('plOptRename').onclick = async () => {
    closeSheet();
    const name = prompt('New name:', pl.name);
    if (!name?.trim()) return;
    pl.name = name.trim();
    await idbPut('playlists', pl);
    renderPlaylists();
    toast(`✅ Renamed to "${pl.name}"`);
  };
  document.getElementById('plOptDelete').onclick = async () => {
    closeSheet();
    if (!confirm(`Delete "${pl.name}"?`)) return;
    await idbDelete('playlists', pl.id);
    renderPlaylists();
    toast('🗑 Playlist deleted');
  };
  document.getElementById('sheetOverlay').classList.add('open');
  document.getElementById('trackSheet').classList.add('open');
}

function openPlaylistDetail(pl) {
  const all    = [...S.tracks, ...S.cloudTracks];
  const tracks = (pl.trackIds||[]).map(id => all.find(t => t.id === id)).filter(Boolean);
  const totalDur = tracks.reduce((a, t) => a + (t.duration||0), 0);
  const panel = document.getElementById('libtab-playlists');
  panel.innerHTML = `
    <div class="lib-detail-back" id="plBack">‹ Playlists</div>
    <div class="pl-detail-hdr">
      <div class="pl-detail-art">📁</div>
      <div>
        <div class="pl-detail-name">${esc(pl.name)}</div>
        <div class="pl-detail-meta">${tracks.length} song${tracks.length!==1?'s':''} · ${fmtTime(totalDur)}</div>
      </div>
    </div>
    <div class="songs-actions">
      <button class="songs-play-btn" id="plDetailPlay">
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><polygon points="5 3 19 12 5 21 5 3"/></svg> Play
      </button>
      <button class="songs-shuffle-btn" id="plDetailShuffle">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg> Shuffle
      </button>
    </div>
    <div class="lib-song-list">
      ${tracks.length ? tracks.map((t, i) => `
        <div class="lib-song-row${S.currentTrack?.id===t.id?' playing':''}" data-idx="${i}">
          <span class="lib-song-num">${i+1}</span>
          <div class="lib-song-info">
            <div class="lib-song-title">${esc(t.title)}</div>
            <div class="lib-song-artist">${esc(t.artist)}</div>
          </div>
          <span class="lib-song-dur">${fmtTime(t.duration)}</span>
          <button class="qi-remove pl-rm" data-id="${t.id}">✕</button>
        </div>`).join('') : '<p class="empty-msg" style="padding:20px 0">No songs yet.</p>'}
    </div>`;
  panel.querySelector('#plBack').addEventListener('click', () => renderPlaylists());
  panel.querySelector('#plDetailPlay')?.addEventListener('click', () => {
    tracks.length ? playTrack(tracks[0], tracks) : toast('Playlist is empty');
  });
  panel.querySelector('#plDetailShuffle')?.addEventListener('click', () => {
    if (!tracks.length) { toast('Playlist is empty'); return; }
    S.shuffle = true;
    playTrack(tracks[Math.floor(Math.random()*tracks.length)], tracks);
  });
  panel.querySelectorAll('.lib-song-row').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.closest('.pl-rm')) return;
      playTrack(tracks[parseInt(row.dataset.idx)], tracks);
    });
  });
  panel.querySelectorAll('.pl-rm').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      pl.trackIds = (pl.trackIds||[]).filter(id => id !== btn.getAttribute('data-id'));
      await idbPut('playlists', pl);
      toast('Removed from playlist');
      openPlaylistDetail(pl);
    });
  });
}

/* ════════════════════════════════════════════════════════════════
   NEW FEATURE 3 — Queue: Remove Items + Clear All
   ════════════════════════════════════════════════════════════════ */
updateQueueUI = function() {
  const list = document.getElementById('queueList');
  if (!S.queue.length) { list.innerHTML = '<p class="empty-msg">Queue is empty.</p>'; return; }
  list.innerHTML = `<button class="queue-clear-btn" id="clearQueueBtn">✕ Clear Queue</button>` +
    S.queue.map((t, i) => `
      <div class="queue-item${i===S.queueIndex?' active':''}" data-idx="${i}">
        <span class="qi-num">${i===S.queueIndex?'▶':i+1}</span>
        <div class="qi-art">${artEl(t,'list')}</div>
        <div class="qi-info">
          <div class="qi-title">${esc(t.title)}</div>
          <div class="qi-artist">${esc(t.artist)}</div>
        </div>
        <span class="qi-dur">${fmtTime(t.duration)}</span>
        ${i!==S.queueIndex?`<button class="qi-remove" data-qi="${i}">✕</button>`:''}
      </div>`).join('');
  list.querySelectorAll('.queue-item').forEach(item => {
    item.addEventListener('click', e => {
      if (e.target.closest('.qi-remove')) return;
      S.queueIndex = parseInt(item.getAttribute('data-idx'));
      playTrack(S.queue[S.queueIndex]);
    });
  });
  list.querySelectorAll('.qi-remove').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute('data-qi'));
      S.queue.splice(idx, 1);
      if (S.queueIndex > idx) S.queueIndex--;
      saveQueueState();
      updateQueueUI();
    });
  });
  document.getElementById('clearQueueBtn')?.addEventListener('click', () => {
    S.queue = []; S.queueIndex = 0;
    saveQueueState();
    updateQueueUI();
    toast('Queue cleared');
  });
};

/* ════════════════════════════════════════════════════════════════
   NEW FEATURE 4 — Lyrics Auto-Fetch (lyrics.ovh API)
   Replaces static lyrics panel with live fetch fallback
   ════════════════════════════════════════════════════════════════ */
async function fetchLyricsOvh(title, artist) {
  try {
    const res = await fetch(
      `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
      { signal: AbortSignal.timeout(7000) }
    );
    if (res.ok) {
      const d = await res.json();
      return d.lyrics?.trim() || null;
    }
  } catch {}
  return null;
}

// Replace the lyrics button listener by cloning the element to remove old handlers
{
  const lyricsBtn = document.getElementById('lyricsBtn');
  const newBtn = lyricsBtn.cloneNode(true);
  lyricsBtn.parentNode.replaceChild(newBtn, lyricsBtn);
  newBtn.addEventListener('click', async () => {
    const t    = S.currentTrack;
    const body = document.getElementById('lyricsBody');
    if (!t) { toast('Play a track first'); return; }
    openPanel('lyricsPanel');
    if (t.lyrics) {
      body.innerHTML = `
        <div class="lyrics-track-info"><h4>${esc(t.title)}</h4><p>${esc(t.artist)}</p></div>
        <div class="lyrics-text">${esc(t.lyrics).replace(/\n/g,'<br>')}</div>`;
      return;
    }
    body.innerHTML = `
      <div class="lyrics-track-info"><h4>${esc(t.title)}</h4><p>${esc(t.artist)}</p></div>
      <p style="text-align:center;padding:24px;color:var(--text-sub)">⏳ Searching for lyrics…</p>`;
    const lyrics = await fetchLyricsOvh(t.title, t.artist);
    if (lyrics) {
      t.lyrics = lyrics;
      body.innerHTML = `
        <div class="lyrics-track-info"><h4>${esc(t.title)}</h4><p>${esc(t.artist)}</p></div>
        <div class="lyrics-text">${esc(lyrics).replace(/\n/g,'<br>')}</div>
        <p style="font-size:.67rem;color:var(--text-dim);text-align:center;margin-top:14px">via lyrics.ovh</p>`;
    } else {
      body.innerHTML = `
        <div class="lyrics-track-info"><h4>${esc(t.title)}</h4><p>${esc(t.artist)}</p></div>
        <p class="empty-msg" style="padding:20px 0">No lyrics found.<br><small style="color:var(--text-dim)">Tigrinya songs may not be in the lyrics database yet.</small></p>`;
    }
  });
}

/* ════════════════════════════════════════════════════════════════
   NEW FEATURE 5 — Sort Options (title / artist / newest / plays)
   ════════════════════════════════════════════════════════════════ */
let _sortMode = 'default';

document.getElementById('sortSelect')?.addEventListener('change', function() {
  _sortMode = this.value;
  const q = document.getElementById('homeSearchInput')?.value?.trim() || '';
  let tracks = getAllTracks();
  if (q) {
    const lq = q.toLowerCase();
    tracks = tracks.filter(t =>
      (t.title||'').toLowerCase().includes(lq) ||
      (t.artist||'').toLowerCase().includes(lq)
    );
  }
  switch (_sortMode) {
    case 'title':  tracks.sort((a,b) => (a.title||'').localeCompare(b.title)); break;
    case 'artist': tracks.sort((a,b) => (a.artist||'').localeCompare(b.artist)); break;
    case 'newest': tracks.sort((a,b) => (b.addedAt||0) - (a.addedAt||0)); break;
    case 'oldest': tracks.sort((a,b) => (a.addedAt||0) - (b.addedAt||0)); break;
    case 'plays':  tracks.sort((a,b) => (b.playCount||0) - (a.playCount||0)); break;
  }
  if (S.viewMode === 'grid') renderGrid(tracks);
  else renderList(tracks);
});

/* ════════════════════════════════════════════════════════════════
   NEW FEATURE 6 — Browser Push Notification Permission
   Asked 35 s after first use; shown once only
   ════════════════════════════════════════════════════════════════ */
function requestPushPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'default') return;
  if (localStorage.getItem('erifam_notif_asked')) return;
  setTimeout(async () => {
    localStorage.setItem('erifam_notif_asked', '1');
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      toast('🔔 Notifications enabled!');
      try {
        new Notification('ERI-FAM 🎵', {
          body: "We'll notify you when new Eritrean music is added.",
          icon: './icons/icon-192.png',
        });
      } catch {}
    }
  }, 35000);
}
requestPushPermission();

function showNativeNotification(title, body) {
  if (Notification.permission === 'granted') {
    try { new Notification(title, { body, icon: './icons/icon-192.png' }); } catch {}
  }
}

/* ════════════════════════════════════════════════════════════════
   NEW FEATURE 7 — Share to WhatsApp / Telegram / X / Email
   Replaces the single Share button with a rich sheet
   ════════════════════════════════════════════════════════════════ */
{
  const shareBtn = document.getElementById('shareBtn');
  const newShareBtn = shareBtn.cloneNode(true);
  shareBtn.parentNode.replaceChild(newShareBtn, shareBtn);
  newShareBtn.addEventListener('click', () => {
    if (!S.currentTrack) { toast('Play a track first'); return; }
    openShareSheet(S.currentTrack);
  });
}

function openShareSheet(t) {
  const url  = `${location.origin}${location.pathname}?play=${t.id}`;
  const text = `🎵 ${t.title} — ${t.artist} | ERI-FAM`;
  document.getElementById('shareSheetTitle').textContent = `${t.title} — ${t.artist}`;
  const apps = [
    {
      ico: '💬', label: 'WhatsApp',
      action: () => window.open(`https://wa.me/?text=${encodeURIComponent(text+'\n'+url)}`, '_blank', 'noopener'),
    },
    {
      ico: '✈️', label: 'Telegram',
      action: () => window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank', 'noopener'),
    },
    {
      ico: '𝕏', label: 'Twitter/X',
      action: () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text+'\n'+url)}`, '_blank', 'noopener'),
    },
    {
      ico: '📧', label: 'Email',
      action: () => window.open(`mailto:?subject=${encodeURIComponent(t.title)}&body=${encodeURIComponent(text+'\n\n'+url)}`),
    },
    {
      ico: '📋', label: 'Copy Link',
      action: async () => {
        try { await navigator.clipboard.writeText(url); toast('📋 Link copied!'); }
        catch { toast(url); }
      },
    },
    {
      ico: '📱', label: 'More…',
      action: async () => {
        if (navigator.share) {
          try { await navigator.share({ title: t.title, text, url }); } catch {}
        } else {
          try { await navigator.clipboard.writeText(url); toast('📋 Copied!'); } catch {}
        }
      },
    },
  ];
  document.getElementById('shareAppsGrid').innerHTML = apps.map((a, i) =>
    `<div class="share-app-btn" data-si="${i}">
       <span class="share-ico">${a.ico}</span>
       <span>${a.label}</span>
     </div>`
  ).join('');
  document.querySelectorAll('.share-app-btn').forEach((btn, i) => {
    btn.addEventListener('click', () => { apps[i].action(); closeModal('shareSheetModal'); });
  });
  openModal('shareSheetModal');
}

document.getElementById('shareSheetClose')?.addEventListener('click', () => closeModal('shareSheetModal'));
document.getElementById('shareSheetModal')?.addEventListener('click', e => {
  if (e.target.id === 'shareSheetModal') closeModal('shareSheetModal');
});

/* ════════════════════════════════════════════════════════════════
   NEW FEATURE 8 — Download / Saved-Offline Badge on Track Cards
   Shows a green "✓ saved" chip on tracks saved offline
   ════════════════════════════════════════════════════════════════ */
const _savedOfflineIds = new Set(JSON.parse(localStorage.getItem('erifam_offline_ids') || '[]'));

const _baseDownloadCloudTrack = downloadCloudTrack;
downloadCloudTrack = async function(track) {
  await _baseDownloadCloudTrack(track);
  _savedOfflineIds.add(track.id);
  localStorage.setItem('erifam_offline_ids', JSON.stringify([..._savedOfflineIds]));
  renderTracks();
};

const _baseRenderGrid = renderGrid;
renderGrid = function(tracks) {
  const grid = document.getElementById('trackGrid');
  if (!tracks.length) { grid.innerHTML = ''; return; }
  grid.innerHTML = tracks.map((t, i) => {
    const playing  = S.currentTrack && S.currentTrack.id === t.id;
    const selected = S.selectedIds.has(t.id);
    const saved    = _savedOfflineIds.has(t.id);
    return `<div class="track-card${playing?' playing':''}${selected?' selected':''}" data-id="${t.id}" data-idx="${i}">
      <div class="tc-art" style="position:relative">
        ${artEl(t,'card')}
        ${saved ? '<span class="tc-saved-badge">✓ saved</span>' : ''}
        <div class="tc-sel-check"></div>
        <div class="tc-play-overlay">
          <div class="tc-play-ico"><svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>
        </div>
        ${playing ? '<div class="tc-eq-bars"><span style="height:8px"></span><span style="height:14px"></span><span style="height:6px"></span></div>' : ''}
      </div>
      <div class="tc-info">
        <div class="tc-title">${esc(t.title)}${t.premium?' <span class="tc-premium-lock">🔒</span>':''}</div>
        <div class="tc-artist">${esc(t.artist)}</div>
      </div>
      <button class="tc-more" data-id="${t.id}">⋯</button>
    </div>`;
  }).join('');
  grid.style.display = '';
  document.getElementById('trackList').style.display = 'none';
  bindTrackCardEvents(grid, tracks);
};

/* ════════════════════════════════════════════════════════════════
   NEW FEATURE 9 — Artist Profile: Total Duration + Play Count
   ════════════════════════════════════════════════════════════════ */
openArtistModal = function(artistName) {
  const all        = [...S.tracks, ...S.cloudTracks].filter(t => t.artist === artistName);
  const totalDur   = all.reduce((a, t) => a + (t.duration||0), 0);
  const totalPlays = all.reduce((a, t) => a + (t.playCount||0), 0);
  document.getElementById('artistModalName').textContent = artistName;
  document.getElementById('artistModalCount').innerHTML =
    `${all.length} track${all.length!==1?'s':''} · ${fmtTime(totalDur)}` +
    (totalPlays > 0 ? ` · <span style="color:var(--accent)">▶ ${totalPlays} plays</span>` : '');
  const list = document.getElementById('artistModalTracks');
  list.innerHTML = all.map((t, i) => `
    <div class="track-row" data-id="${t.id}" data-idx="${i}">
      <div class="tr-art">${artEl(t,'list')}</div>
      <div class="tr-info">
        <div class="tr-title">${esc(t.title)}</div>
        <div class="tr-artist">${esc(t.album||fmtTime(t.duration))}${t.playCount>0?' · ▶ '+t.playCount:''}</div>
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
};

/* ════════════════════════════════════════════════════════════════
   NEW FEATURE 10 — New Releases Badge + Native Notification
   Detects newly added cloud tracks since last visit
   ════════════════════════════════════════════════════════════════ */
function checkNewReleases(cloudTracks) {
  const lastVisit = parseInt(localStorage.getItem('erifam_last_visit') || '0');
  const now = Date.now();
  if (lastVisit > 0) {
    const newTracks = cloudTracks.filter(t => (t.addedAt||0) > lastVisit);
    if (newTracks.length > 0) {
      const sample = newTracks.slice(0, 2).map(t => `"${t.title}"`).join(', ');
      const msg = newTracks.length === 1
        ? `New: ${sample} just added!`
        : `${newTracks.length} new tracks including ${sample}`;
      setTimeout(() => showInAppNotification({ title: '🎵 New Music Added!', body: msg }), 1500);
      showNativeNotification('🎵 ERI-FAM — New Music!', msg);
      const syncBtn = document.getElementById('statSyncBtn');
      if (syncBtn && !syncBtn.querySelector('.new-releases-badge')) {
        const badge = document.createElement('span');
        badge.className = 'new-releases-badge';
        badge.textContent = newTracks.length;
        syncBtn.appendChild(badge);
        syncBtn.addEventListener('click', () => badge.remove(), { once: true });
      }
    }
  }
  localStorage.setItem('erifam_last_visit', String(now));
}

// Hook new features into the existing sync and load flows
const _baseSyncCloud = syncCloud;
syncCloud = async function() {
  await _baseSyncCloud();
  renderRecentlyPlayed();
  checkNewReleases(S.cloudTracks);
};

const _baseLoadLocalTracks = loadLocalTracks;
loadLocalTracks = async function() {
  await _baseLoadLocalTracks();
  setTimeout(renderRecentlyPlayed, 100);
};

/* ════════════════════════════════════════════════════════════════
   NEW FEATURE 11 — Skip Forward 15 Seconds
   ════════════════════════════════════════════════════════════════ */
document.getElementById('skipFwdBtn')?.addEventListener('click', () => {
  if (!audio.duration) return;
  audio.currentTime = Math.min(audio.currentTime + 15, audio.duration);
});

/* ════════════════════════════════════════════════════════════════
   NEW FEATURE 12 — Playback Speed Control (0.5× – 2×)
   ════════════════════════════════════════════════════════════════ */
{
  S.playbackSpeed = parseFloat(localStorage.getItem('erifam_speed') || '1');
  audio.playbackRate = S.playbackSpeed;

  function updateSpeedUI() {
    const sp = S.playbackSpeed;
    const label = document.getElementById('speedLabel');
    if (label) label.textContent = sp === 1 ? '1×' : sp + '×';
    document.getElementById('speedBtn')?.classList.toggle('active', sp !== 1);
    document.querySelectorAll('.speed-opt').forEach(b =>
      b.classList.toggle('active', parseFloat(b.dataset.speed) === sp)
    );
  }

  document.getElementById('speedBtn')?.addEventListener('click', () => openModal('speedModal'));
  document.getElementById('speedModalClose')?.addEventListener('click', () => closeModal('speedModal'));
  document.getElementById('speedModal')?.addEventListener('click', e => {
    if (e.target.id === 'speedModal') closeModal('speedModal');
  });

  document.querySelectorAll('.speed-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      S.playbackSpeed = parseFloat(btn.dataset.speed);
      audio.playbackRate = S.playbackSpeed;
      localStorage.setItem('erifam_speed', String(S.playbackSpeed));
      updateSpeedUI();
      closeModal('speedModal');
      toast(`⏩ Speed: ${S.playbackSpeed}×`);
    });
  });

  updateSpeedUI();
}

/* ════════════════════════════════════════════════════════════════
   NEW FEATURE 13 — "Play Next" in Track Options Sheet
   ════════════════════════════════════════════════════════════════ */
{
  const _baseOTS = openTrackSheet;
  openTrackSheet = function(id) {
    _baseOTS(id);
    const track = [...S.tracks, ...S.cloudTracks].find(t => t.id === id);
    if (!track) return;
    const actions = document.getElementById('sheetActions');
    const playNextBtn = document.createElement('button');
    playNextBtn.className = 'sheet-action';
    playNextBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/></svg>Play Next`;
    playNextBtn.addEventListener('click', () => {
      const insertIdx = Math.min(S.queueIndex + 1, S.queue.length);
      S.queue.splice(insertIdx, 0, track);
      saveQueueState();
      toast('▶ Will play next');
      closeSheet();
    });
    const queueBtn = actions.querySelector('#sheetQueue');
    if (queueBtn) actions.insertBefore(playNextBtn, queueBtn);
    else actions.appendChild(playNextBtn);
  };
}

/* ════════════════════════════════════════════════════════════════
   NEW FEATURE 14 — Listening History Page
   Stores the last 100 played tracks with timestamps
   ════════════════════════════════════════════════════════════════ */
{
  const HIST_KEY = 'erifam_history';
  const MAX_HIST = 100;

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HIST_KEY) || '[]'); } catch { return []; }
  }

  function saveHistory(hist) {
    localStorage.setItem(HIST_KEY, JSON.stringify(hist.slice(0, MAX_HIST)));
  }

  function addHistoryEntry(track) {
    if (!track?.id) return;
    const hist = loadHistory();
    const filtered = hist.filter(h => h.id !== track.id);
    filtered.unshift({ id: track.id, title: track.title || 'Unknown', artist: track.artist || '—', playedAt: Date.now() });
    saveHistory(filtered);
  }

  function fmtHistDate(ts) {
    const d = new Date(ts);
    const diffMins = Math.floor((Date.now() - ts) / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function renderHistory() {
    const list = document.getElementById('historyList');
    if (!list) return;
    const hist = loadHistory();
    if (!hist.length) {
      list.innerHTML = '<p class="empty-msg" style="padding:40px 0;text-align:center">No listening history yet.<br><small style="color:var(--text-dim)">Play some tracks to see them here.</small></p>';
      return;
    }
    const allTracks = [...S.tracks, ...S.cloudTracks];
    list.innerHTML = hist.map((h, i) => {
      const track = allTracks.find(t => t.id === h.id);
      return `<div class="track-row hist-row" data-hist-idx="${i}" style="cursor:pointer">
        <div class="tr-art">${track ? artEl(track, 'list') : '<div style="width:44px;height:44px;border-radius:8px;background:var(--surface);display:flex;align-items:center;justify-content:center;font-size:1.2rem">🎵</div>'}</div>
        <div class="tr-info">
          <div class="tr-title">${esc(h.title)}</div>
          <div class="tr-artist">${esc(h.artist)}</div>
        </div>
        <span class="tr-dur" style="white-space:nowrap;color:var(--text-dim);font-size:0.72rem">${fmtHistDate(h.playedAt)}</span>
      </div>`;
    }).join('');
    list.querySelectorAll('.hist-row').forEach((row, i) => {
      row.addEventListener('click', () => {
        const h = hist[i];
        const track = allTracks.find(t => t.id === h.id);
        if (track) { playTrack(track, allTracks); switchView('home'); }
        else toast('Track not in library');
      });
    });
  }

  // Record track on each play (async to preserve await playTrack() call sites)
  const _basePTH = playTrack;
  playTrack = async function(track, queueTracks) {
    await _basePTH(track, queueTracks);
    addHistoryEntry(track);
  };

  // Render history when view opens
  const _baseSVH = switchView;
  switchView = function(viewName) {
    _baseSVH(viewName);
    if (viewName === 'history') renderHistory();
  };
  window.switchView = switchView;

  document.getElementById('clearHistoryBtn')?.addEventListener('click', () => {
    if (!confirm('Clear all listening history?')) return;
    localStorage.removeItem(HIST_KEY);
    renderHistory();
    toast('🗑 History cleared');
  });
}

/* ════════════════════════════════════════════════════════════════
   NEW FEATURE 15 — Lyrics Auto-Scroll While Playing
   Smoothly scrolls the lyrics panel in sync with playback progress
   ════════════════════════════════════════════════════════════════ */
{
  let lyricsAutoScroll = true;

  function autoScrollLyrics() {
    const panel = document.getElementById('lyricsPanel');
    if (!panel?.classList.contains('open')) return;
    if (!lyricsAutoScroll) return;
    const dur = audio.duration;
    const cur = audio.currentTime;
    if (!dur || !cur) return;
    const body = document.getElementById('lyricsBody');
    if (!body) return;
    const scrollRange = body.scrollHeight - body.clientHeight;
    if (scrollRange <= 0) return;
    const target = scrollRange * (cur / dur);
    body.scrollTo({ top: target, behavior: 'smooth' });
  }

  let _lastLyricsScroll = 0;
  audio.addEventListener('timeupdate', () => {
    const now = Date.now();
    if (now - _lastLyricsScroll < 3000) return;
    _lastLyricsScroll = now;
    autoScrollLyrics();
  });

  document.getElementById('lyricsBody')?.addEventListener('scroll', () => {
    lyricsAutoScroll = false;
    clearTimeout(window._lyricsScrollTimer);
    window._lyricsScrollTimer = setTimeout(() => { lyricsAutoScroll = true; }, 5000);
  }, { passive: true });
}
