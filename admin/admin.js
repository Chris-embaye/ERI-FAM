/* ================================================================
   ERI-FAM Admin Panel
   ================================================================ */
'use strict';

// ── Firebase ───────────────────────────────────────────────────
let _db, _st, _auth;
let fbFunctions = {};

async function initFirebase() {
  if (typeof FIREBASE_CONFIG === 'undefined' || FIREBASE_CONFIG.apiKey === 'YOUR_API_KEY') {
    showLoginError('Firebase not configured. Fill in firebase-config.js first.');
    return false;
  }
  try {
    const { initializeApp }  = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
    const fs = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const st = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js');
    const au = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
    const app = initializeApp(FIREBASE_CONFIG);
    _db   = fs.getFirestore(app);
    _st   = st.getStorage(app);
    _auth = au.getAuth(app);
    fbFunctions = { ...fs, ...st, ...au };
    return true;
  } catch(e) { showLoginError('Firebase failed to load: ' + e.message); return false; }
}

// ── Auth ───────────────────────────────────────────────────────
// Pre-fill admin email if configured
if (typeof ADMIN_EMAIL !== 'undefined') document.getElementById('loginEmail').value = ADMIN_EMAIL;

document.getElementById('loginBtn').addEventListener('click', signIn);
document.getElementById('loginEmail').addEventListener('keydown', e => { if (e.key === 'Enter') signIn(); });
document.getElementById('loginPass').addEventListener('keydown',  e => { if (e.key === 'Enter') signIn(); });

async function signIn() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPass').value;
  if (!email || !pass) { showLoginError('Enter email and password.'); return; }
  const btn = document.getElementById('loginBtn');
  btn.textContent = 'Signing in…'; btn.disabled = true;
  const ready = await initFirebase();
  if (!ready) { btn.textContent = 'Sign In'; btn.disabled = false; return; }
  try {
    await fbFunctions.signInWithEmailAndPassword(_auth, email, pass);
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminApp').style.display = 'flex';
    loadDashboard();
  } catch(e) {
    showLoginError(e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found'
      ? 'Invalid email or password.' : e.message);
    btn.textContent = 'Sign In'; btn.disabled = false;
  }
}

function showLoginError(msg) {
  const el = document.getElementById('loginError');
  el.textContent = msg; el.style.display = '';
}

document.getElementById('signOutBtn').addEventListener('click', async () => {
  await fbFunctions.signOut(_auth);
  document.getElementById('adminApp').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
});

// ── Navigation ─────────────────────────────────────────────────
document.querySelectorAll('.sb-item').forEach(btn => {
  btn.addEventListener('click', () => showPage(btn.getAttribute('data-page')));
});
document.getElementById('menuBtn').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

function showPage(name) {
  document.querySelectorAll('.sb-item').forEach(b => b.classList.toggle('active', b.getAttribute('data-page') === name));
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + name));
  document.getElementById('sidebar').classList.remove('open');
  if (name === 'tracks')   loadTracks();
  if (name === 'dashboard') loadDashboard();
  if (name === 'feedback') loadFeedback();
}

// ── Helpers ────────────────────────────────────────────────────
function fmtTime(s) { if (!s || isNaN(s)) return '0:00'; return Math.floor(s/60)+':'+Math.floor(s%60).toString().padStart(2,'0'); }
function fmtSize(b) { if (!b) return '0 B'; if (b < 1e6) return (b/1e3).toFixed(0)+' KB'; return (b/1e6).toFixed(1)+' MB'; }
function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

let toastT;
function toast(msg) {
  const el = document.getElementById('aToast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2800);
}

function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ── Dashboard ──────────────────────────────────────────────────
async function loadDashboard() {
  document.getElementById('dashDate').textContent = new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  if (!_db) return;
  try {
    const snap = await fbFunctions.getDocs(fbFunctions.collection(_db, 'tracks'));
    const tracks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    document.getElementById('dashTracks').textContent = tracks.length;
    const plays = tracks.reduce((a, t) => a + (t.playCount || 0), 0);
    document.getElementById('dashPlays').textContent = plays.toLocaleString();
    const size = tracks.reduce((a, t) => a + (t.size || 0), 0);
    document.getElementById('dashSize').textContent = fmtSize(size);
    const mostLiked = tracks.sort((a,b) => (b.likes||0) - (a.likes||0))[0];
    document.getElementById('dashLiked').textContent = mostLiked ? mostLiked.title.slice(0,18) : '—';
    // Recent uploads
    const recent = [...tracks].sort((a,b) => (b.addedAt||0) - (a.addedAt||0)).slice(0,5);
    document.getElementById('recentUploads').innerHTML = recent.length
      ? recent.map(t => `<div class="adm-track-row">
          <div class="atr-art">${t.artwork ? `<img src="${t.artwork}" alt="" />` : '🎵'}</div>
          <div class="atr-info"><div class="atr-title">${esc(t.title)}</div><div class="atr-artist">${esc(t.artist)}</div></div>
          <span class="atr-dur">${fmtTime(t.duration)}</span>
        </div>`).join('')
      : '<p style="color:var(--text-dim);padding:12px;font-size:0.82rem">No tracks yet.</p>';
  } catch(e) { console.warn('Dashboard load error', e); }
}

document.getElementById('refreshBtn').addEventListener('click', loadDashboard);

// ── Upload ─────────────────────────────────────────────────────
const adminUploadZone  = document.getElementById('adminUploadZone');
const adminFileInput   = document.getElementById('adminFileInput');
let uploadQueue = [];

adminUploadZone.addEventListener('click', () => adminFileInput.click());
adminFileInput.addEventListener('change', e => addToQueue(e.target.files));
adminUploadZone.addEventListener('dragover', e => { e.preventDefault(); adminUploadZone.classList.add('drag-over'); });
adminUploadZone.addEventListener('dragleave', () => adminUploadZone.classList.remove('drag-over'));
adminUploadZone.addEventListener('drop', e => { e.preventDefault(); adminUploadZone.classList.remove('drag-over'); addToQueue(e.dataTransfer.files); });

function addToQueue(files) {
  Array.from(files).forEach(f => {
    if (!f.type.match(/audio/)) return;
    uploadQueue.push({ file: f, status: 'pending' });
  });
  renderQueue();
  if (uploadQueue.length) {
    document.getElementById('metaForm').style.display = '';
    // Pre-fill title/artist from first file
    let name = uploadQueue[0].file.name.replace(/\.[^.]+$/, '');
    let artist = 'Unknown Artist', title = name;
    if (name.includes(' - ')) [artist, title] = name.split(' - ', 2);
    document.getElementById('metaTitle').value  = title.trim();
    document.getElementById('metaArtist').value = artist.trim();
  }
}

function renderQueue() {
  const el = document.getElementById('uploadQueue');
  if (!uploadQueue.length) { el.innerHTML = ''; return; }
  el.innerHTML = uploadQueue.map((item, i) => `
    <div class="uq-item">
      <span class="uq-icon">🎵</span>
      <div class="uq-info">
        <div class="uq-name">${esc(item.file.name)}</div>
        <div class="uq-size">${fmtSize(item.file.size)}</div>
      </div>
      <span class="uq-status ${item.status}">${item.status === 'done' ? '✅ Done' : item.status === 'error' ? '❌ Error' : '⏳ Pending'}</span>
      ${item.status === 'pending' ? `<button class="uq-remove" data-idx="${i}">✕</button>` : ''}
    </div>`).join('');
  el.querySelectorAll('.uq-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      uploadQueue.splice(parseInt(btn.getAttribute('data-idx')), 1);
      renderQueue();
      if (!uploadQueue.length) document.getElementById('metaForm').style.display = 'none';
    });
  });
}

document.getElementById('clearQueueBtn').addEventListener('click', () => {
  uploadQueue = []; renderQueue();
  document.getElementById('metaForm').style.display = 'none';
});

document.getElementById('uploadAllBtn').addEventListener('click', uploadAll);

async function uploadAll() {
  if (!uploadQueue.length) { toast('No files in queue'); return; }
  if (!_db) { toast('⚠ Firebase not connected'); return; }
  const cloudName  = typeof CLOUDINARY_CLOUD  !== 'undefined' ? CLOUDINARY_CLOUD  : '';
  const preset     = typeof CLOUDINARY_PRESET !== 'undefined' ? CLOUDINARY_PRESET : '';
  if (!cloudName || !preset) { toast('⚠ Set CLOUDINARY_CLOUD and CLOUDINARY_PRESET in firebase-config.js'); return; }
  const title   = document.getElementById('metaTitle').value.trim();
  const artist  = document.getElementById('metaArtist').value.trim();
  const album   = document.getElementById('metaAlbum').value.trim();
  const genre   = document.getElementById('metaGenre').value.trim();
  const artwork = document.getElementById('metaArtwork').value.trim();
  const lyrics  = document.getElementById('metaLyrics').value.trim();
  const tags    = document.getElementById('metaTags').value.split(',').map(t => t.trim()).filter(Boolean);
  if (!title || !artist) { toast('⚠ Title and Artist are required'); return; }
  const progDiv  = document.getElementById('uploadProgress');
  const upBar    = document.getElementById('upBar');
  const upStatus = document.getElementById('upStatus');
  progDiv.style.display = '';
  let done = 0;
  for (let i = 0; i < uploadQueue.length; i++) {
    const item = uploadQueue[i];
    if (item.status === 'done') { done++; continue; }
    upStatus.textContent = `Uploading ${i+1} of ${uploadQueue.length}: ${item.file.name}`;
    try {
      // Upload to Cloudinary (free, no server needed)
      const form = new FormData();
      form.append('file', item.file);
      form.append('upload_preset', preset);
      form.append('resource_type', 'auto');
      const xhr = new XMLHttpRequest();
      const url = await new Promise((res, rej) => {
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`);
        xhr.upload.onprogress = e => {
          if (e.lengthComputable) upBar.style.width = (((i + e.loaded/e.total) / uploadQueue.length) * 100) + '%';
        };
        xhr.onload = () => {
          const data = JSON.parse(xhr.responseText);
          if (data.secure_url) res(data.secure_url);
          else rej(new Error(data.error?.message || 'Upload failed'));
        };
        xhr.onerror = () => rej(new Error('Network error'));
        xhr.send(form);
      });
      // Get duration
      const dur = await getFileDuration(item.file);
      // Auto-parse title from filename if multiple files
      const trackTitle = uploadQueue.length > 1
        ? (item.file.name.replace(/\.[^.]+$/,'').includes(' - ')
          ? item.file.name.replace(/\.[^.]+$/,'').split(' - ')[1]
          : item.file.name.replace(/\.[^.]+$/,''))
        : title;
      const trackId = Date.now().toString(36) + Math.random().toString(36).slice(2);
      // Save metadata to Firestore
      await fbFunctions.addDoc(fbFunctions.collection(_db, 'tracks'), {
        id: trackId, title: trackTitle.trim(), artist, album, genre, tags,
        artwork: artwork || '', lyrics: lyrics || '', url, duration: dur, size: item.file.size,
        addedAt: Date.now(), playCount: 0, likes: 0, type: 'cloud'
      });
      item.status = 'done'; done++;
    } catch(e) { item.status = 'error'; console.error('Upload error', e); toast('⚠ ' + e.message); }
    renderQueue();
  }
  upBar.style.width = '100%';
  upStatus.textContent = `✅ Uploaded ${done} of ${uploadQueue.length} tracks`;
  toast(`✅ ${done} track${done>1?'s':''} uploaded to cloud`);
  setTimeout(() => { progDiv.style.display = 'none'; upBar.style.width = '0%'; }, 3000);
  loadDashboard();
}

function getFileDuration(file) {
  return new Promise(res => {
    const a = new Audio(URL.createObjectURL(file));
    a.onloadedmetadata = () => { URL.revokeObjectURL(a.src); res(a.duration); };
    a.onerror = () => res(0);
    setTimeout(() => res(0), 4000);
  });
}

// ── Manage Tracks ──────────────────────────────────────────────
let allTracks = [];
let selectedIds = new Set();

async function loadTracks() {
  if (!_db) { toast('⚠ Firebase not connected'); return; }
  const list = document.getElementById('adminTrackList');
  list.innerHTML = '<p style="padding:20px;color:var(--text-dim)">Loading…</p>';
  try {
    const snap = await fbFunctions.getDocs(fbFunctions.query(fbFunctions.collection(_db, 'tracks'), fbFunctions.orderBy('addedAt','desc')));
    allTracks = snap.docs.map(d => ({ docId: d.id, ...d.data() }));
    document.getElementById('trackCount').textContent = allTracks.length + ' tracks';
    renderAdminTracks(allTracks);
  } catch(e) { list.innerHTML = `<p style="color:var(--red);padding:20px">${e.message}</p>`; }
}

function renderAdminTracks(tracks) {
  const list = document.getElementById('adminTrackList');
  if (!tracks.length) { list.innerHTML = '<p style="padding:20px;color:var(--text-dim)">No tracks found.</p>'; return; }
  list.innerHTML = tracks.map((t, i) => `
    <div class="adm-track-row" data-docid="${t.docId}">
      <input type="checkbox" class="atr-check" data-docid="${t.docId}" />
      <span class="atr-num">${i+1}</span>
      <div class="atr-art">${t.artwork ? `<img src="${t.artwork}" alt="" loading="lazy" />` : '🎵'}</div>
      <div class="atr-info">
        <div class="atr-title">${esc(t.title)}</div>
        <div class="atr-artist">${esc(t.artist)}${t.album ? ' · ' + esc(t.album) : ''}</div>
      </div>
      <span class="atr-dur">${fmtTime(t.duration)}</span>
      <span class="atr-plays">▶ ${t.playCount || 0}</span>
      <div class="atr-btns">
        <button class="atr-btn edit-btn" data-docid="${t.docId}">✏ Edit</button>
        <button class="atr-btn delete delete-btn" data-docid="${t.docId}">🗑</button>
      </div>
    </div>`).join('');

  list.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.getAttribute('data-docid')));
  });
  list.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteCloudTrack(btn.getAttribute('data-docid')));
  });
  list.querySelectorAll('.atr-check').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = cb.getAttribute('data-docid');
      if (cb.checked) selectedIds.add(id); else selectedIds.delete(id);
      document.getElementById('deleteSelectedBtn').style.display = selectedIds.size ? '' : 'none';
    });
  });
}

document.getElementById('trackSearch').addEventListener('input', e => {
  const q = e.target.value.toLowerCase();
  const filtered = q ? allTracks.filter(t => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)) : allTracks;
  renderAdminTracks(filtered);
});

document.getElementById('deleteSelectedBtn').addEventListener('click', async () => {
  if (!selectedIds.size) return;
  if (!confirm(`Delete ${selectedIds.size} selected track${selectedIds.size>1?'s':''}?`)) return;
  for (const id of selectedIds) await deleteCloudTrack(id);
  selectedIds.clear();
  document.getElementById('deleteSelectedBtn').style.display = 'none';
});

async function deleteCloudTrack(docId) {
  if (!_db) return;
  try {
    const track = allTracks.find(t => t.docId === docId);
    await fbFunctions.deleteDoc(fbFunctions.doc(_db, 'tracks', docId));
    // Also delete from storage if url is Firebase Storage
    if (track?.url && track.url.includes('firebasestorage')) {
      try {
        const path = decodeURIComponent(track.url.split('/o/')[1].split('?')[0]);
        await fbFunctions.deleteObject(fbFunctions.ref(_st, path));
      } catch(e) { console.warn('Storage delete failed', e); }
    }
    allTracks = allTracks.filter(t => t.docId !== docId);
    renderAdminTracks(allTracks);
    document.getElementById('trackCount').textContent = allTracks.length + ' tracks';
    toast('🗑 Track deleted');
  } catch(e) { toast('⚠ Delete failed: ' + e.message); }
}

// Edit modal
function openEditModal(docId) {
  const t = allTracks.find(t => t.docId === docId);
  if (!t) return;
  document.getElementById('editId').value      = docId;
  document.getElementById('editTitle').value   = t.title || '';
  document.getElementById('editArtist').value  = t.artist || '';
  document.getElementById('editAlbum').value   = t.album || '';
  document.getElementById('editGenre').value   = t.genre || '';
  document.getElementById('editArtwork').value = t.artwork || '';
  document.getElementById('editLyrics').value  = t.lyrics || '';
  openModal('editModal');
}
document.getElementById('editCancelBtn').addEventListener('click', () => closeModal('editModal'));
document.getElementById('editModal').addEventListener('click',     e => { if (e.target.id === 'editModal') closeModal('editModal'); });
document.getElementById('editSaveBtn').addEventListener('click', async () => {
  const docId = document.getElementById('editId').value;
  const updates = {
    title:   document.getElementById('editTitle').value.trim(),
    artist:  document.getElementById('editArtist').value.trim(),
    album:   document.getElementById('editAlbum').value.trim(),
    genre:   document.getElementById('editGenre').value.trim(),
    artwork: document.getElementById('editArtwork').value.trim(),
    lyrics:  document.getElementById('editLyrics').value.trim(),
  };
  if (!updates.title || !updates.artist) { toast('Title and Artist required'); return; }
  try {
    await fbFunctions.updateDoc(fbFunctions.doc(_db, 'tracks', docId), updates);
    const idx = allTracks.findIndex(t => t.docId === docId);
    if (idx > -1) allTracks[idx] = { ...allTracks[idx], ...updates };
    renderAdminTracks(allTracks);
    closeModal('editModal');
    toast('✅ Track updated');
  } catch(e) { toast('⚠ Update failed: ' + e.message); }
});

// ── Push Notifications ─────────────────────────────────────────
document.getElementById('sendNotifyBtn').addEventListener('click', async () => {
  if (!_db) { toast('⚠ Firebase not connected'); return; }
  const title    = document.getElementById('notifyTitle').value.trim();
  const body     = document.getElementById('notifyBody').value.trim();
  const url      = document.getElementById('notifyUrl').value.trim();
  const schedule = document.getElementById('notifySchedule').value;
  if (!title || !body) { toast('Title and message are required'); return; }
  try {
    await fbFunctions.addDoc(fbFunctions.collection(_db, 'notifications'), {
      title, body, url: url || '',
      scheduledAt: schedule ? new Date(schedule).getTime() : Date.now(),
      sentAt: schedule ? null : Date.now(),
      createdAt: Date.now()
    });
    document.getElementById('notifyTitle').value = '';
    document.getElementById('notifyBody').value  = '';
    document.getElementById('notifyUrl').value   = '';
    document.getElementById('notifySchedule').value = '';
    toast('✅ Notification saved' + (schedule ? ' (scheduled)' : ' and sent'));
  } catch(e) { toast('⚠ Failed: ' + e.message); }
});

// ── App Settings ───────────────────────────────────────────────
document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
  if (!_db) { toast('⚠ Firebase not connected'); return; }
  const settings = {
    appName:       document.getElementById('setAppName').value.trim(),
    tagline:       document.getElementById('setTagline').value.trim(),
    featuredTrack: document.getElementById('setFeatured').value.trim(),
    maintenance:   document.getElementById('setMaintenance').checked,
    allowReg:      document.getElementById('setAllowReg').checked,
    updatedAt:     Date.now()
  };
  try {
    const docRef = fbFunctions.doc(_db, 'appSettings', 'config');
    await fbFunctions.updateDoc(docRef, settings).catch(async () => {
      await fbFunctions.addDoc(fbFunctions.collection(_db, 'appSettings'), { ...settings });
    });
    toast('✅ Settings saved');
  } catch(e) { toast('⚠ Save failed: ' + e.message); }
});

// ── Feedback ───────────────────────────────────────────────────
let allFeedback = [];

async function loadFeedback() {
  if (!_db) { toast('⚠ Firebase not connected'); return; }
  const list = document.getElementById('feedbackList');
  list.innerHTML = '<p style="padding:20px;color:var(--text-dim);font-size:0.85rem">Loading…</p>';
  try {
    const snap = await fbFunctions.getDocs(fbFunctions.query(fbFunctions.collection(_db, 'feedback'), fbFunctions.orderBy('createdAt', 'desc')));
    allFeedback = snap.docs.map(d => ({ docId: d.id, ...d.data() }));
    renderFeedback();
  } catch(e) {
    list.innerHTML = `<p style="color:var(--red);padding:20px">${e.message}</p>`;
  }
}

function renderFeedback() {
  const list = document.getElementById('feedbackList');
  if (!allFeedback.length) {
    list.innerHTML = '<p style="color:var(--text-dim);padding:20px;font-size:0.85rem">No feedback yet. Share the app with users!</p>';
    document.getElementById('fbTotal').textContent = '0';
    document.getElementById('fbAvgRating').textContent = '—';
    document.getElementById('fbFiveStars').textContent = '0';
    return;
  }
  const total     = allFeedback.length;
  const avg       = (allFeedback.reduce((a, f) => a + (f.rating || 0), 0) / total).toFixed(1);
  const fiveStars = allFeedback.filter(f => f.rating === 5).length;
  document.getElementById('fbTotal').textContent     = total;
  document.getElementById('fbAvgRating').textContent = avg + ' ★';
  document.getElementById('fbFiveStars').textContent = fiveStars;

  list.innerHTML = allFeedback.map(f => {
    const stars = '★'.repeat(f.rating || 0) + '☆'.repeat(5 - (f.rating || 0));
    const date  = f.createdAt ? new Date(f.createdAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : '';
    return `<div class="feedback-card" data-docid="${f.docId}">
      <div class="feedback-card-header">
        <span class="feedback-stars">${stars}</span>
        <span class="feedback-meta">${date}</span>
      </div>
      ${f.name ? `<div class="feedback-name">${esc(f.name)}</div>` : ''}
      <div class="feedback-text">${esc(f.message || '')}</div>
      <div style="text-align:right;margin-top:8px">
        <button class="feedback-del" data-docid="${f.docId}">🗑 Delete</button>
      </div>
    </div>`;
  }).join('');

  list.querySelectorAll('.feedback-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      const docId = btn.getAttribute('data-docid');
      if (!confirm('Delete this feedback?')) return;
      try {
        await fbFunctions.deleteDoc(fbFunctions.doc(_db, 'feedback', docId));
        allFeedback = allFeedback.filter(f => f.docId !== docId);
        renderFeedback();
        toast('🗑 Deleted');
      } catch(e) { toast('⚠ ' + e.message); }
    });
  });
}

document.getElementById('refreshFeedbackBtn').addEventListener('click', loadFeedback);
