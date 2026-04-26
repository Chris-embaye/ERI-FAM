/* ================================================================
   HUB — App Control Center
   Firebase 10.12.2 · ES Modules
   ================================================================ */
'use strict';

// ── Firebase state ────────────────────────────────────────
let _db, _auth, fb = {};
let _fbPromise      = null; // singleton — prevents double-init
let currentUser     = null;
let currentUserData = null;
let currentEditApp  = null;
let allUsers        = [];
let allApps         = [];
let allPromos       = [];
let activeUserTab   = 'all';

const SUPER_ADMIN = (typeof ADMIN_EMAIL !== 'undefined') ? ADMIN_EMAIL : 'embayechris@gmail.com';
const FB_VER      = '10.12.2';

// ── Firebase init (singleton promise) ────────────────────
function initFB() {
  if (_fbPromise) return _fbPromise; // return same promise if already started
  _fbPromise = _loadFB();
  return _fbPromise;
}

async function _loadFB() {
  if (typeof FIREBASE_CONFIG === 'undefined' || FIREBASE_CONFIG.apiKey === 'YOUR_API_KEY') {
    showAuthError('loginError', 'Firebase not configured. Update firebase-config.js first.');
    return false;
  }
  try {
    const appMod = await import(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-app.js`);
    const fs     = await import(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-firestore.js`);
    const au     = await import(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-auth.js`);
    // Use existing app if already initialized (avoids duplicate-app error)
    const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(FIREBASE_CONFIG);
    _db   = fs.getFirestore(app);
    _auth = au.getAuth(app);
    fb    = { ...appMod, ...fs, ...au };
    return true;
  } catch(e) {
    console.error('[HUB] Firebase init error:', e);
    showAuthError('loginError', 'Firebase failed: ' + e.message);
    _fbPromise = null; // allow retry
    return false;
  }
}

// ── Auth UI ───────────────────────────────────────────────
document.getElementById('toRegister').addEventListener('click', () => switchAuthView('register'));
document.getElementById('toLogin').addEventListener('click',    () => switchAuthView('login'));
document.getElementById('loginBtn').addEventListener('click',   doLogin);
document.getElementById('registerBtn').addEventListener('click',doRegister);
document.getElementById('pendingSignOut').addEventListener('click', doSignOut);
document.getElementById('signOutBtn').addEventListener('click',     doSignOut);

document.getElementById('loginEmail').addEventListener('keydown', e => { if (e.key==='Enter') doLogin(); });
document.getElementById('loginPass').addEventListener('keydown',  e => { if (e.key==='Enter') doLogin(); });

if (typeof ADMIN_EMAIL !== 'undefined') document.getElementById('loginEmail').value = ADMIN_EMAIL;

function switchAuthView(view) {
  document.getElementById('loginView').hidden    = view !== 'login';
  document.getElementById('registerView').hidden = view !== 'register';
  document.getElementById('pendingView').hidden  = view !== 'pending';
}

function showAuthError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.hidden = false;
}
function hideAuthError(id) { document.getElementById(id).hidden = true; }

async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPass').value;
  if (!email || !pass) { showAuthError('loginError', 'Enter email and password.'); return; }
  hideAuthError('loginError');
  const btn = document.getElementById('loginBtn');
  btn.textContent = 'Signing in…'; btn.disabled = true;
  const ready = await initFB();
  if (!ready) { btn.textContent = 'Sign In'; btn.disabled = false; return; }
  try {
    await fb.signInWithEmailAndPassword(_auth, email, pass);
    // onAuthStateChanged handles the rest
  } catch(e) {
    showAuthError('loginError', friendlyAuthError(e.code));
  }
  btn.textContent = 'Sign In'; btn.disabled = false;
}

async function doRegister() {
  const name  = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const pass  = document.getElementById('regPass').value;
  if (!name || !email || !pass) { showAuthError('regError', 'Fill in all fields.'); return; }
  if (pass.length < 6) { showAuthError('regError', 'Password must be at least 6 characters.'); return; }
  hideAuthError('regError');
  const btn = document.getElementById('registerBtn');
  btn.textContent = 'Creating account…'; btn.disabled = true;
  const ready = await initFB();
  if (!ready) { btn.textContent = 'Request Access'; btn.disabled = false; return; }
  try {
    const cred = await fb.createUserWithEmailAndPassword(_auth, email, pass);
    await fb.updateProfile(cred.user, { displayName: name });
    // Check for pre-approved invite
    const invRef  = fb.doc(_db, 'hub_invitations', email.toLowerCase());
    const invSnap = await fb.getDoc(invRef);
    const isSuperAdmin = email.toLowerCase() === SUPER_ADMIN.toLowerCase();
    const role   = isSuperAdmin ? 'super_admin' : (invSnap.exists() ? invSnap.data().role : 'viewer');
    const status = isSuperAdmin ? 'approved'    : (invSnap.exists() ? 'approved' : 'pending');
    await fb.setDoc(fb.doc(_db, 'hub_users', cred.user.uid), {
      email, name, role, status,
      createdAt: fb.serverTimestamp(),
      approvedAt: status === 'approved' ? fb.serverTimestamp() : null
    });
    if (invSnap.exists()) await fb.deleteDoc(invRef);
    // onAuthStateChanged handles navigation
  } catch(e) {
    showAuthError('regError', friendlyAuthError(e.code));
  }
  btn.textContent = 'Request Access'; btn.disabled = false;
}

async function doSignOut() {
  if (_auth) await fb.signOut(_auth);
  document.getElementById('hubApp').hidden  = true;
  document.getElementById('authScreen').hidden = false;
  switchAuthView('login');
  currentUser = null; currentUserData = null;
}

function friendlyAuthError(code) {
  const map = {
    'auth/user-not-found':       'No account found with this email.',
    'auth/wrong-password':       'Incorrect password.',
    'auth/invalid-credential':   'Incorrect email or password.',
    'auth/email-already-in-use': 'An account already exists with this email.',
    'auth/weak-password':        'Password must be at least 6 characters.',
    'auth/invalid-email':        'Please enter a valid email address.',
    'auth/too-many-requests':    'Too many attempts. Try again later.',
  };
  return map[code] || 'Authentication error. Please try again.';
}

// ── Auth state observer ───────────────────────────────────
async function bootAuth() {
  console.log('[HUB] Starting Firebase init...');
  const ready = await initFB();
  if (!ready) { console.error('[HUB] Firebase init failed'); return; }
  console.log('[HUB] Firebase ready, setting up auth listener');
  fb.onAuthStateChanged(_auth, async user => {
    try {
      if (!user) {
        console.log('[HUB] No user signed in');
        document.getElementById('authScreen').hidden = false;
        document.getElementById('hubApp').hidden     = true;
        return;
      }
      console.log('[HUB] User signed in:', user.email);
      currentUser = user;
      // Ensure super admin record exists
      if (user.email.toLowerCase() === SUPER_ADMIN.toLowerCase()) {
        console.log('[HUB] Super admin detected, writing record...');
        await fb.setDoc(fb.doc(_db, 'hub_users', user.uid), {
          email: user.email,
          name:  user.displayName || 'Admin',
          role:  'super_admin',
          status:'approved',
          createdAt: fb.serverTimestamp(),
          approvedAt: fb.serverTimestamp()
        }, { merge: true });
        console.log('[HUB] Super admin record saved');
      }
      console.log('[HUB] Reading user record from Firestore...');
      const snap = await fb.getDoc(fb.doc(_db, 'hub_users', user.uid));
      if (!snap.exists()) {
        console.log('[HUB] No user record found, creating pending...');
        await fb.setDoc(fb.doc(_db, 'hub_users', user.uid), {
          email: user.email,
          name:  user.displayName || user.email,
          role:  'viewer',
          status:'pending',
          createdAt: fb.serverTimestamp(),
          approvedAt: null
        });
        currentUserData = { role: 'viewer', status: 'pending' };
      } else {
        currentUserData = snap.data();
        console.log('[HUB] User data:', currentUserData);
      }
      if (currentUserData.status !== 'approved') {
        console.log('[HUB] User not approved, showing pending screen');
        document.getElementById('authScreen').hidden = false;
        document.getElementById('hubApp').hidden     = true;
        switchAuthView('pending');
        return;
      }
      console.log('[HUB] Access granted, loading hub');
      document.getElementById('authScreen').hidden = true;
      document.getElementById('hubApp').hidden     = false;
      setupUserDisplay();
      loadDashboard();
      loadPendingBadge();
      loadPostsBadge();
    } catch(err) {
      console.error('[HUB] Auth state error:', err);
      showAuthError('loginError', 'Error: ' + err.message);
      document.getElementById('authScreen').hidden = false;
    }
  });
}

function setupUserDisplay() {
  const name     = currentUserData.name || currentUser.displayName || currentUser.email;
  const photoURL = currentUserData.photoURL || currentUser.photoURL || '';
  document.getElementById('sbUserName').textContent = name;
  document.getElementById('sbUserRole').textContent = currentUserData.role.replace('_', ' ');
  const avatarEl = document.getElementById('sbAvatar');
  if (photoURL) {
    avatarEl.innerHTML = `<img src="${photoURL}" alt="${esc(name)}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit"/>`;
  } else {
    avatarEl.innerHTML = '';
    avatarEl.textContent = name.charAt(0).toUpperCase();
  }
}

// ── Navigation ────────────────────────────────────────────
document.querySelectorAll('.sb-item[data-page]').forEach(btn => {
  btn.addEventListener('click', () => {
    showPage(btn.dataset.page);
    document.getElementById('mobTitle').textContent = btn.querySelector('span').textContent.trim();
    // Close mobile sidebar
    document.getElementById('sidebar').classList.remove('mob-open');
    document.getElementById('sidebarOverlay').hidden = true;
  });
});

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sb-item').forEach(b => b.classList.remove('active'));
  const page = document.getElementById('page-' + name);
  const btn  = document.querySelector(`.sb-item[data-page="${name}"]`);
  if (page) page.classList.add('active');
  if (btn)  btn.classList.add('active');
  // Lazy-load page data
  if (name === 'apps')        loadApps();
  if (name === 'users')       loadUsers();
  if (name === 'music')       loadMusic();
  if (name === 'erimusic')    loadEriMusic();
  if (name === 'playlists')   loadPlaylists();
  if (name === 'assets')      loadAssets();
  if (name === 'notify')      loadNotifications();
  if (name === 'promotions')  loadPromotions();
  if (name === 'settings')    loadSettings();
  if (name === 'feedback')    loadFeedback();
  if (name === 'posts')       loadPosts();
  if (name === 'about')       loadAbout();
}

// Sidebar toggle
document.getElementById('sidebarToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('collapsed');
});
// Mobile menu
document.getElementById('mobMenu').addEventListener('click', () => {
  document.getElementById('sidebar').classList.add('mob-open');
  document.getElementById('sidebarOverlay').hidden = false;
});
document.getElementById('sidebarOverlay').addEventListener('click', () => {
  document.getElementById('sidebar').classList.remove('mob-open');
  document.getElementById('sidebarOverlay').hidden = true;
});

// Dashboard quick add
document.getElementById('dashAddApp').addEventListener('click', () => { showPage('apps'); openAppModal(); });

// ── DASHBOARD ─────────────────────────────────────────────
async function loadDashboard() {
  const now  = new Date();
  const hour = now.getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const name  = (currentUserData.name || currentUser.displayName || '').split(' ')[0];
  document.getElementById('dashGreeting').textContent = `${greet}, ${name} 👋`;
  document.getElementById('dashDate').textContent     = now.toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  try {
    const [appsSnap, usersSnap, assetsSnap, notifsSnap, tracksSnap] = await Promise.all([
      fb.getDocs(fb.collection(_db, 'hub_apps')),
      fb.getDocs(fb.collection(_db, 'hub_users')),
      fb.getDocs(fb.collection(_db, 'hub_assets')),
      fb.getDocs(fb.collection(_db, 'hub_notifications')),
      fb.getDocs(fb.collection(_db, 'tracks')),
    ]);
    document.getElementById('statApps').textContent   = appsSnap.size;
    document.getElementById('statUsers').textContent  = usersSnap.docs.filter(d => d.data().status === 'approved').length;
    document.getElementById('statAssets').textContent = assetsSnap.size;
    document.getElementById('statNotifs').textContent = notifsSnap.size;
    document.getElementById('statTracks').textContent = tracksSnap.size;

    // Mini app list
    const apps = appsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    allApps = apps;
    const miniList = document.getElementById('dashAppList');
    if (!apps.length) { miniList.innerHTML = '<p class="empty-msg">No apps yet. <button class="link-btn" onclick="showPage(\'apps\')">Add one →</button></p>'; }
    else {
      miniList.innerHTML = apps.slice(0,5).map(a => `
        <div class="app-mini-item" onclick="openEditor('${a.id}')">
          <div class="app-mini-ico" style="background:${a.color || '#6366f1'}22">${a.icon || '📱'}</div>
          <div><div class="app-mini-name">${esc(a.name)}</div><div class="app-mini-url">${esc(a.url || '')}</div></div>
          <div class="app-mini-dot dot-${a.status || 'active'}"></div>
        </div>`).join('');
    }

    // Activity
    const actEl = document.getElementById('dashActivity');
    const recent = [...appsSnap.docs, ...assetsSnap.docs]
      .filter(d => d.data().createdAt)
      .sort((a,b) => (b.data().createdAt?.toMillis?.() || 0) - (a.data().createdAt?.toMillis?.() || 0))
      .slice(0, 6);
    if (!recent.length) { actEl.innerHTML = '<p class="empty-msg">No recent activity.</p>'; }
    else {
      actEl.innerHTML = recent.map(d => {
        const data = d.data();
        const isApp = !!data.url;
        const text  = isApp ? `App <strong>${esc(data.name)}</strong> added` : `Asset <strong>${esc(data.name)}</strong> uploaded`;
        const time  = data.createdAt?.toDate ? timeAgo(data.createdAt.toDate()) : '';
        return `<div class="activity-item"><div class="act-dot"></div><div><div class="act-text">${text}</div><div class="act-time">${time}</div></div></div>`;
      }).join('');
    }
  } catch(e) { console.warn('[Dashboard]', e); }
}

// ── APPS ──────────────────────────────────────────────────
document.getElementById('addAppBtn').addEventListener('click', () => openAppModal());

async function loadApps() {
  const grid = document.getElementById('appGrid');
  grid.innerHTML = '<p class="empty-msg" style="grid-column:1/-1">Loading…</p>';
  try {
    const snap = await fb.getDocs(fb.query(fb.collection(_db, 'hub_apps'), fb.orderBy('createdAt','desc')));
    allApps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderApps(allApps);
    // Populate notify/asset app filter
    populateAppSelects(allApps);
  } catch(e) {
    grid.innerHTML = `<p class="empty-msg" style="grid-column:1/-1">Error loading apps: ${e.message}</p>`;
  }
}

function renderApps(apps) {
  const grid = document.getElementById('appGrid');
  if (!apps.length) { grid.innerHTML = '<p class="empty-msg" style="grid-column:1/-1">No apps yet. Click + New App to get started.</p>'; return; }
  grid.innerHTML = apps.map(a => `
    <div class="app-card">
      <div class="app-card-top" style="background:linear-gradient(135deg,${a.color||'#6366f1'}33,${a.color||'#6366f1'}11)">
        <div class="app-card-ico">${a.iconUrl ? `<img src="${esc(a.iconUrl)}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit" onerror="this.parentElement.textContent='📱'"/>` : (a.icon || '📱')}</div>
        <span class="app-status-pill status-${a.status||'active'}">${a.status||'active'}</span>
      </div>
      <div class="app-card-body">
        <div class="app-card-name">${esc(a.name)}</div>
        <div class="app-card-desc">${esc(a.description||'')}</div>
        <div class="app-card-url">${esc(a.url||'')}</div>
        <div style="font-size:.72rem;color:var(--text-mute)">${esc(a.category||'')}</div>
      </div>
      <div class="app-card-actions">
        <button class="app-act-edit"   onclick="openAppModal('${a.id}')">✏ Edit</button>
        <button class="app-act-edit"   onclick="openEditor('${a.id}')">🖊 Builder</button>
        <button class="app-act-open"   onclick="window.open('${esc(a.url||'')}','_blank')">↗ Open</button>
        <button class="app-act-delete" onclick="deleteApp('${a.id}')">🗑</button>
      </div>
    </div>`).join('');
}

function populateAppSelects(apps) {
  ['notifyTarget','assetAppFilter','promoTarget'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const first = (id === 'notifyTarget' || id === 'promoTarget')
      ? '<option value="all">📡 All Apps</option>'
      : '<option value="">All Apps</option>';
    sel.innerHTML = first + apps.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('');
  });
}

// App modal
const appModal = document.getElementById('appModal');
document.getElementById('appModalClose').addEventListener('click',  () => appModal.hidden = true);
document.getElementById('appModalCancel').addEventListener('click', () => appModal.hidden = true);
document.getElementById('appModalSave').addEventListener('click',   saveApp);
appModal.addEventListener('click', e => { if (e.target === appModal) appModal.hidden = true; });

function openAppModal(id) {
  const app = id ? allApps.find(a => a.id === id) : null;
  document.getElementById('appModalTitle').textContent = app ? 'Edit App' : 'New App';
  document.getElementById('appModalId').value       = app?.id       || '';
  document.getElementById('appModalName').value     = app?.name     || '';
  document.getElementById('appModalDesc').value     = app?.description || '';
  document.getElementById('appModalUrl').value      = app?.url      || '';
  document.getElementById('appModalIcon').value     = app?.icon     || '';
  document.getElementById('appModalColor').value    = app?.color    || '#6366f1';
  document.getElementById('appModalCategory').value = app?.category || 'Other';
  document.getElementById('appModalStatus').value   = app?.status   || 'active';
  appModal.hidden = false;
  document.getElementById('appModalName').focus();
}

async function saveApp() {
  const id   = document.getElementById('appModalId').value;
  const name = document.getElementById('appModalName').value.trim();
  const url  = document.getElementById('appModalUrl').value.trim();
  if (!name) { toast('App name is required.', 'error'); return; }
  const btn = document.getElementById('appModalSave');
  btn.textContent = 'Saving…'; btn.disabled = true;
  const data = {
    name,
    description: document.getElementById('appModalDesc').value.trim(),
    url,
    icon:        document.getElementById('appModalIcon').value.trim() || '📱',
    color:       document.getElementById('appModalColor').value,
    category:    document.getElementById('appModalCategory').value,
    status:      document.getElementById('appModalStatus').value,
    updatedAt:   fb.serverTimestamp(),
  };
  try {
    if (id) {
      await fb.updateDoc(fb.doc(_db, 'hub_apps', id), data);
    } else {
      data.createdAt = fb.serverTimestamp();
      data.sections  = [];
      await fb.addDoc(fb.collection(_db, 'hub_apps'), data);
      logActivity(`App "${name}" added`);
    }
    appModal.hidden = true;
    toast(id ? 'App updated!' : 'App added!', 'success');
    loadApps();
  } catch(e) {
    toast('Error: ' + e.message, 'error');
  }
  btn.textContent = 'Save App'; btn.disabled = false;
}

async function deleteApp(id) {
  const app = allApps.find(a => a.id === id);
  if (!confirm(`Delete "${app?.name}"? This cannot be undone.`)) return;
  try {
    await fb.deleteDoc(fb.doc(_db, 'hub_apps', id));
    toast('App deleted.', 'warn');
    loadApps();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

// ── EDITOR ────────────────────────────────────────────────
document.getElementById('editorBack').addEventListener('click', () => showPage('apps'));
document.getElementById('editorSave').addEventListener('click', saveEditorChanges);
document.getElementById('editorDelete').addEventListener('click', async () => {
  if (!currentEditApp) return;
  if (!confirm(`Delete "${currentEditApp.name}"? This cannot be undone.`)) return;
  try {
    await fb.deleteDoc(fb.doc(_db, 'hub_apps', currentEditApp.id));
    toast('App deleted.', 'warn');
    logActivity(`App "${currentEditApp.name}" deleted`);
    showPage('apps');
  } catch(e) { toast('Error: ' + e.message, 'error'); }
});
document.getElementById('editorRefresh').addEventListener('click', () => {
  const frame = document.getElementById('editorFrame');
  frame.src = frame.src;
});
document.getElementById('addSectionBtn').addEventListener('click', () => {
  document.getElementById('sectionId').value   = '';
  document.getElementById('sectionName').value = '';
  document.getElementById('sectionModal').hidden = false;
});

function openEditor(appId) {
  const app = allApps.find(a => a.id === appId);
  if (!app) return;
  currentEditApp = { ...app };
  document.getElementById('editorTitle').textContent    = app.name;
  document.getElementById('editorSubtitle').textContent = app.url || '';
  document.getElementById('epName').value    = app.name || '';
  document.getElementById('epDesc').value    = app.description || '';
  document.getElementById('epUrl').value     = app.url || '';
  document.getElementById('epIcon').value    = app.icon || '';
  document.getElementById('epIconUrl').value = app.iconUrl || '';
  document.getElementById('epColor').value   = app.color || '#6366f1';
  document.getElementById('epStatus').value  = app.status || 'active';
  const frame = document.getElementById('editorFrame');
  document.getElementById('chromeUrl').textContent = app.url || 'about:blank';
  frame.src = app.url || 'about:blank';
  renderSections(app.sections || []);
  showPage('editor');
}

function renderSections(sections) {
  const list = document.getElementById('sectionsEditor');
  if (!sections.length) { list.innerHTML = '<p style="font-size:.78rem;color:var(--text-mute);text-align:center;padding:12px 0">No sections yet.</p>'; return; }
  list.innerHTML = sections.map((s,i) => `
    <div class="section-item" draggable="true" data-idx="${i}">
      <span class="section-drag">⠿</span>
      <span class="section-name">${esc(s.name)}</span>
      <span class="section-vis ${s.visible!==false?'on':''}" onclick="toggleSection(${i})">${s.visible!==false?'👁':'🚫'}</span>
      <span class="section-del" onclick="deleteSection(${i})">✕</span>
    </div>`).join('');
  // Drag to reorder
  setupSectionDrag(sections);
}

function setupSectionDrag(sections) {
  const items = document.querySelectorAll('.section-item');
  let dragIdx = null;
  items.forEach(item => {
    item.addEventListener('dragstart', () => { dragIdx = +item.dataset.idx; item.style.opacity = '.5'; });
    item.addEventListener('dragend',   () => { item.style.opacity = '1'; dragIdx = null; });
    item.addEventListener('dragover',  e => { e.preventDefault(); item.classList.add('drag-over'); });
    item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
    item.addEventListener('drop', () => {
      item.classList.remove('drag-over');
      const targetIdx = +item.dataset.idx;
      if (dragIdx === null || dragIdx === targetIdx) return;
      const reordered = [...sections];
      const [moved]   = reordered.splice(dragIdx, 1);
      reordered.splice(targetIdx, 0, moved);
      currentEditApp.sections = reordered;
      renderSections(reordered);
    });
  });
}

window.toggleSection = function(idx) {
  if (!currentEditApp) return;
  const sects = [...(currentEditApp.sections || [])];
  sects[idx] = { ...sects[idx], visible: sects[idx].visible === false };
  currentEditApp.sections = sects;
  renderSections(sects);
};
window.deleteSection = function(idx) {
  if (!currentEditApp) return;
  const sects = [...(currentEditApp.sections || [])];
  sects.splice(idx, 1);
  currentEditApp.sections = sects;
  renderSections(sects);
};

// Section modal
document.getElementById('sectionModalClose').addEventListener('click',  () => document.getElementById('sectionModal').hidden = true);
document.getElementById('sectionModalCancel').addEventListener('click', () => document.getElementById('sectionModal').hidden = true);
document.getElementById('sectionModalSave').addEventListener('click', () => {
  const id   = document.getElementById('sectionId').value.trim().replace(/\s+/g,'_');
  const name = document.getElementById('sectionName').value.trim();
  if (!id || !name) { toast('Fill in section ID and name.', 'error'); return; }
  const sects = [...(currentEditApp?.sections || [])];
  sects.push({ id, name, visible: true, order: sects.length });
  if (currentEditApp) currentEditApp.sections = sects;
  renderSections(sects);
  document.getElementById('sectionModal').hidden = true;
});

async function saveEditorChanges() {
  if (!currentEditApp) return;
  const btn = document.getElementById('editorSave');
  btn.textContent = 'Saving…'; btn.disabled = true;
  const data = {
    name:        document.getElementById('epName').value.trim()    || currentEditApp.name,
    description: document.getElementById('epDesc').value.trim(),
    url:         document.getElementById('epUrl').value.trim(),
    icon:        document.getElementById('epIcon').value.trim()    || '📱',
    iconUrl:     document.getElementById('epIconUrl').value.trim() || '',
    color:       document.getElementById('epColor').value,
    status:      document.getElementById('epStatus').value,
    sections:    currentEditApp.sections || [],
    updatedAt:   fb.serverTimestamp(),
  };
  try {
    await fb.updateDoc(fb.doc(_db, 'hub_apps', currentEditApp.id), data);
    toast('Changes saved!', 'success');
    document.getElementById('editorTitle').textContent = data.name;
    // Refresh iframe
    const frame = document.getElementById('editorFrame');
    document.getElementById('chromeUrl').textContent = data.url;
    if (data.url !== currentEditApp.url) frame.src = data.url;
    currentEditApp = { ...currentEditApp, ...data };
    const idx = allApps.findIndex(a => a.id === currentEditApp.id);
    if (idx !== -1) allApps[idx] = { ...allApps[idx], ...data };
  } catch(e) {
    toast('Error: ' + e.message, 'error');
  }
  btn.textContent = 'Save Changes'; btn.disabled = false;
}

// ── USERS ─────────────────────────────────────────────────
document.getElementById('inviteBtn').addEventListener('click', () => {
  document.getElementById('inviteEmail').value = '';
  document.getElementById('inviteRole').value  = 'editor';
  document.getElementById('inviteModal').hidden = false;
});
document.getElementById('inviteModalClose').addEventListener('click',  () => document.getElementById('inviteModal').hidden = true);
document.getElementById('inviteModalCancel').addEventListener('click', () => document.getElementById('inviteModal').hidden = true);
document.getElementById('inviteModalSave').addEventListener('click',   doInviteUser);
document.getElementById('inviteModal').addEventListener('click', e => { if (e.target === document.getElementById('inviteModal')) document.getElementById('inviteModal').hidden = true; });

document.querySelectorAll('.user-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.user-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeUserTab = btn.dataset.utab;
    renderUsers(allUsers, activeUserTab);
  });
});

async function loadUsers() {
  const list = document.getElementById('userList');
  list.innerHTML = '<p class="empty-msg">Loading…</p>';
  try {
    const snap = await fb.getDocs(fb.query(fb.collection(_db, 'hub_users'), fb.orderBy('createdAt','desc')));
    allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderUsers(allUsers, activeUserTab);
    // Update pending count
    const pending = allUsers.filter(u => u.status === 'pending').length;
    const badge  = document.getElementById('pendingBadge');
    const tabCnt = document.getElementById('pendingTabCount');
    badge.textContent  = pending;
    badge.hidden       = pending === 0;
    tabCnt.textContent = pending;
  } catch(e) {
    list.innerHTML = `<p class="empty-msg">Error: ${e.message}</p>`;
  }
}

function renderUsers(users, tab) {
  // Update stats bar
  const bar = document.getElementById('userStatsBar');
  if (bar && users.length) {
    bar.style.display = 'flex';
    document.getElementById('uStatTotal').textContent    = users.length;
    document.getElementById('uStatApproved').textContent = users.filter(u => u.status === 'approved').length;
    document.getElementById('uStatPending').textContent  = users.filter(u => u.status === 'pending').length;
    document.getElementById('uStatRejected').textContent = users.filter(u => u.status === 'rejected').length;
  }
  const filtered = tab === 'all' ? users : users.filter(u => u.status === tab);
  const list = document.getElementById('userList');
  if (!filtered.length) { list.innerHTML = '<p class="empty-msg">No users in this category.</p>'; return; }
  list.innerHTML = filtered.map(u => {
    const initial = (u.name || u.email || '?').charAt(0).toUpperCase();
    const isSelf  = u.id === currentUser?.uid;
    const isSuper = u.role === 'super_admin';
    const actions = u.status === 'pending'
      ? `<button class="btn-approve" onclick="approveUser('${u.id}')">✓ Approve</button>
         <button class="btn-reject"  onclick="rejectUser('${u.id}')">✕ Reject</button>`
      : u.status === 'approved' && !isSelf && !isSuper
      ? `<button class="btn-remove" onclick="removeUser('${u.id}')">Remove</button>`
      : u.status === 'rejected'
      ? `<button class="btn-approve" onclick="approveUser('${u.id}')">↩ Re-approve</button>
         <button class="btn-sm" style="font-size:.72rem" onclick="moveToPending('${u.id}')">⏳ Move to Pending</button>`
      : '';
    const roleSelect = !isSuper && !isSelf && u.status === 'approved'
      ? `<select class="user-role-select" onchange="updateRole('${u.id}',this.value)">
           <option value="viewer"  ${u.role==='viewer' ?'selected':''}>Viewer</option>
           <option value="editor"  ${u.role==='editor' ?'selected':''}>Editor</option>
           <option value="admin"   ${u.role==='admin'  ?'selected':''}>Admin</option>
         </select>`
      : '';
    const joined = u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString() : '';
    return `
      <div class="user-row">
        <div class="user-ava">${initial}</div>
        <div class="user-info">
          <div class="user-name">${esc(u.name||u.email||'Unknown')}${isSelf?' <span style="font-size:.7rem;color:var(--text-mute)">(you)</span>':''}</div>
          <div class="user-email copy-on-click" title="Click to copy email" data-copy="${esc(u.email||'')}">${esc(u.email||'')}${joined ? ` <span style="color:var(--text-mute);font-size:.7rem">· joined ${joined}</span>` : ''}</div>
        </div>
        ${roleSelect}
        <span class="user-badge badge-${u.status}">${u.status}</span>
        <div class="user-actions">${actions}</div>
      </div>`;
  }).join('');
  // Wire up copy-on-click for emails
  list.querySelectorAll('.copy-on-click').forEach(el => {
    el.addEventListener('click', () => {
      navigator.clipboard.writeText(el.dataset.copy || '').then(() => toast('📋 Email copied!', 'success'));
    });
  });
}

window.approveUser = async function(uid) {
  try {
    await fb.updateDoc(fb.doc(_db, 'hub_users', uid), { status: 'approved', approvedAt: fb.serverTimestamp() });
    toast('User approved!', 'success');
    logActivity('User approved');
    loadUsers();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
};
window.rejectUser = async function(uid) {
  try {
    await fb.updateDoc(fb.doc(_db, 'hub_users', uid), { status: 'rejected' });
    toast('User rejected.', 'warn');
    loadUsers();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
};
window.removeUser = async function(uid) {
  if (!confirm('Remove this user from Hub?')) return;
  try {
    await fb.updateDoc(fb.doc(_db, 'hub_users', uid), { status: 'rejected' });
    toast('User removed.', 'warn');
    loadUsers();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
};
window.moveToPending = async function(uid) {
  try {
    await fb.updateDoc(fb.doc(_db, 'hub_users', uid), { status: 'pending', approvedAt: null });
    toast('User moved back to pending.', 'success');
    loadUsers();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
};
window.updateRole = async function(uid, role) {
  try {
    await fb.updateDoc(fb.doc(_db, 'hub_users', uid), { role });
    toast('Role updated.', 'success');
  } catch(e) { toast('Error: ' + e.message, 'error'); }
};

async function doInviteUser() {
  const email = document.getElementById('inviteEmail').value.trim().toLowerCase();
  const role  = document.getElementById('inviteRole').value;
  if (!email) { toast('Enter an email address.', 'error'); return; }
  const btn = document.getElementById('inviteModalSave');
  btn.textContent = 'Saving…'; btn.disabled = true;
  try {
    await fb.setDoc(fb.doc(_db, 'hub_invitations', email), {
      email, role,
      invitedBy: currentUser.uid,
      createdAt: fb.serverTimestamp(),
      status: 'pending'
    });
    toast(`Invite saved for ${email}. They can now sign up and will get ${role} access.`, 'success');
    document.getElementById('inviteModal').hidden = true;
    logActivity(`Invited ${email} as ${role}`);
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  btn.textContent = 'Send Invite'; btn.disabled = false;
}

async function loadPendingBadge() {
  try {
    const snap = await fb.getDocs(fb.query(fb.collection(_db, 'hub_users'), fb.where('status','==','pending')));
    const count = snap.size;
    const badge = document.getElementById('pendingBadge');
    badge.textContent = count;
    badge.hidden = count === 0;
  } catch(e) {}
}

// ── MUSIC ─────────────────────────────────────────────────
const musicDropZone    = document.getElementById('musicDropZone');
const musicFileInput   = document.getElementById('musicFileInput');
const musicFolderInput = document.getElementById('musicFolderInput');
let allTracks = [];
let _musicArtistFilter = '';
let _musicAlbumFilter  = '';

musicDropZone.addEventListener('click', e => { if (!e.target.closest('.link-btn')) musicFileInput.click(); });
musicDropZone.addEventListener('dragover',  e => { e.preventDefault(); musicDropZone.classList.add('drag-active'); });
musicDropZone.addEventListener('dragleave', () => musicDropZone.classList.remove('drag-active'));
musicDropZone.addEventListener('drop', e => {
  e.preventDefault(); musicDropZone.classList.remove('drag-active');
  handleMusicFiles([...e.dataTransfer.files]);
});
musicFileInput.addEventListener('change',   () => { handleMusicFiles([...musicFileInput.files]);   musicFileInput.value   = ''; });
musicFolderInput.addEventListener('change', () => { handleMusicFiles([...musicFolderInput.files]); musicFolderInput.value = ''; });

function getFilteredSortedTracks() {
  const q    = (document.getElementById('musicSearch')?.value || '').toLowerCase().trim();
  const sort = document.getElementById('musicSort')?.value || 'newest';
  let tracks = q
    ? allTracks.filter(t =>
        (t.title||'').toLowerCase().includes(q) ||
        (t.artist||'').toLowerCase().includes(q) ||
        (t.album||'').toLowerCase().includes(q))
    : [...allTracks];
  if (_musicArtistFilter) tracks = tracks.filter(t => (t.artist || '') === _musicArtistFilter);
  if (_musicAlbumFilter)  tracks = tracks.filter(t => (t.album  || '') === _musicAlbumFilter);
  if (sort === 'title')  tracks.sort((a,b) => (a.title||'').localeCompare(b.title||''));
  if (sort === 'artist') tracks.sort((a,b) => (a.artist||'').localeCompare(b.artist||''));
  if (sort === 'oldest') tracks.sort((a,b) => (a.addedAt?.toMillis?.()??0) - (b.addedAt?.toMillis?.()??0));
  return tracks;
}

function _populateAdminMusicFilters() {
  const artists = [...new Set(allTracks.map(t => t.artist || '').filter(Boolean))].sort();
  const albums  = [...new Set(allTracks.map(t => t.album  || '').filter(Boolean))].sort();
  const aSelect = document.getElementById('musicArtistFilter');
  const bSelect = document.getElementById('musicAlbumFilter');
  if (!aSelect || !bSelect) return;
  aSelect.innerHTML = '<option value="">All Artists</option>' +
    artists.map(a => `<option value="${esc(a)}"${_musicArtistFilter === a ? ' selected' : ''}>${esc(a)}</option>`).join('');
  bSelect.innerHTML = '<option value="">All Albums</option>' +
    albums.map(a  => `<option value="${esc(a)}"${_musicAlbumFilter  === a ? ' selected' : ''}>${esc(a)}</option>`).join('');
}

function _updateMusicDeleteFilteredBtn() {
  const btn = document.getElementById('musicDeleteFilteredBtn');
  const cnt = document.getElementById('musicFilterCount');
  if (!btn) return;
  const active   = _musicArtistFilter || _musicAlbumFilter;
  const filtered = getFilteredSortedTracks();
  if (cnt) cnt.textContent = active ? `${filtered.length} track${filtered.length !== 1 ? 's' : ''} shown` : '';
  btn.style.display = (active && filtered.length > 0) ? '' : 'none';
  if (active) btn.textContent = `🗑 Delete Filtered (${filtered.length})`;
}

document.getElementById('musicArtistFilter').addEventListener('change', function() {
  _musicArtistFilter = this.value;
  renderMusicTracks(getFilteredSortedTracks());
  _updateMusicDeleteFilteredBtn();
});
document.getElementById('musicAlbumFilter').addEventListener('change', function() {
  _musicAlbumFilter = this.value;
  renderMusicTracks(getFilteredSortedTracks());
  _updateMusicDeleteFilteredBtn();
});
document.getElementById('musicDeleteFilteredBtn').addEventListener('click', async () => {
  const toDelete = getFilteredSortedTracks();
  if (!toDelete.length) return;
  const filterDesc = [
    _musicArtistFilter ? `artist: "${_musicArtistFilter}"` : '',
    _musicAlbumFilter  ? `album: "${_musicAlbumFilter}"`   : '',
  ].filter(Boolean).join(', ');
  if (!confirm(`Delete ${toDelete.length} track${toDelete.length !== 1 ? 's' : ''} (${filterDesc})? This cannot be undone.`)) return;
  try {
    await Promise.all(toDelete.map(t => fb.deleteDoc(fb.doc(_db, 'tracks', t.id))));
    toast(`🗑 Deleted ${toDelete.length} track${toDelete.length !== 1 ? 's' : ''}`, 'warn');
    logActivity(`Bulk deleted ${toDelete.length} cloud track(s) (${filterDesc})`);
    _musicArtistFilter = '';
    _musicAlbumFilter  = '';
    loadMusic();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
});

document.addEventListener('input',  e => { if (e.target.id === 'musicSearch') { renderMusicTracks(getFilteredSortedTracks()); _updateMusicDeleteFilteredBtn(); } });
document.addEventListener('change', e => { if (e.target.id === 'musicSort')   { renderMusicTracks(getFilteredSortedTracks()); _updateMusicDeleteFilteredBtn(); } });

async function loadMusic() {
  const list = document.getElementById('musicTrackList');
  list.innerHTML = '<p class="empty-msg">Loading…</p>';
  try {
    const snap = await fb.getDocs(fb.query(fb.collection(_db, 'tracks'), fb.orderBy('addedAt', 'desc')));
    allTracks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    document.getElementById('musicCount').textContent = allTracks.length + ' track' + (allTracks.length !== 1 ? 's' : '');
    const filterBar = document.getElementById('musicFilterBar');
    if (filterBar) filterBar.style.display = allTracks.length ? 'flex' : 'none';
    _populateAdminMusicFilters();
    _updateMusicDeleteFilteredBtn();
    renderMusicTracks(getFilteredSortedTracks());
  } catch(e) {
    list.innerHTML = `<p class="empty-msg">Error: ${e.message}</p>`;
  }
}

function renderMusicTracks(tracks = allTracks) {
  const list = document.getElementById('musicTrackList');
  if (!tracks.length) {
    list.innerHTML = allTracks.length
      ? '<p class="empty-msg">No tracks match your search.</p>'
      : '<p class="empty-msg">No cloud tracks yet. Upload songs above.</p>';
    return;
  }
  list.innerHTML = tracks.map(t => {
    const cover = t.cover
      ? `<img src="${esc(t.cover)}" alt=""/>`
      : '🎵';
    const dur = t.duration ? fmtDuration(t.duration) : '—';
    return `
      <div class="music-track-row">
        <div class="music-track-cover">${cover}</div>
        <div class="music-track-info">
          <div class="music-track-title">${esc(t.title || 'Unknown')}</div>
          <div class="music-track-meta">${esc(t.artist || 'Unknown Artist')}${t.album ? ' · ' + esc(t.album) : ''}</div>
        </div>
        <div class="music-track-dur">${dur}</div>
        <div class="music-track-actions">
          <button class="music-act-edit" onclick="openTrackModal('${t.id}')">✏ Edit</button>
          <button class="music-act-del"  onclick="deleteTrack('${t.id}')">🗑</button>
        </div>
      </div>`;
  }).join('');
}

function fmtDuration(sec) {
  const s = Math.round(sec);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

async function handleMusicFiles(files) {
  const audio_types = ['audio/mpeg','audio/mp4','audio/flac','audio/wav','audio/ogg','audio/x-flac','audio/x-m4a'];
  const audioFiles  = [...files].filter(f => f.type.startsWith('audio/') || audio_types.includes(f.type) || /\.(mp3|m4a|flac|wav|ogg)$/i.test(f.name));
  if (!audioFiles.length) { toast('No audio files found.', 'error'); return; }

  const progWrap = document.getElementById('musicUploadProgress');
  const bar      = document.getElementById('musicUpBar');
  const status   = document.getElementById('musicUpStatus');
  progWrap.hidden = false;
  musicDropZone.hidden = true;

  for (let i = 0; i < audioFiles.length; i++) {
    const file = audioFiles[i];
    status.textContent = `Uploading ${i+1}/${audioFiles.length}: ${file.name}`;
    bar.style.width = ((i / audioFiles.length) * 100) + '%';
    try {
      // Get duration from audio element
      const duration = await getAudioDuration(file);
      // Upload to Cloudinary
      const url = await uploadToCloudinary(file, pct => {
        bar.style.width = ((i / audioFiles.length + pct / audioFiles.length) * 100) + '%';
      });
      // Parse title/artist from filename (e.g. "Artist - Title.mp3")
      const base   = file.name.replace(/\.[^.]+$/, '');
      const parts  = base.split(' - ');
      const artist = parts.length > 1 ? parts[0].trim() : 'Unknown Artist';
      const title  = parts.length > 1 ? parts.slice(1).join(' - ').trim() : base;
      // Save to Firestore tracks collection
      await fb.addDoc(fb.collection(_db, 'tracks'), {
        title, artist, album: '', url, cover: '',
        duration, addedAt: fb.serverTimestamp(),
        uploadedBy: currentUser.uid
      });
      toast(`Uploaded: ${title}`, 'success');
    } catch(e) { toast('Failed: ' + file.name + ' — ' + e.message, 'error'); }
  }

  bar.style.width = '100%';
  status.textContent = 'Done!';
  setTimeout(() => { progWrap.hidden = true; musicDropZone.hidden = false; bar.style.width = '0%'; }, 1200);
  loadMusic();
  logActivity(`${audioFiles.length} track(s) uploaded`);
}

function getAudioDuration(file) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const a   = new Audio();
    a.addEventListener('loadedmetadata', () => { URL.revokeObjectURL(url); resolve(a.duration || 0); });
    a.addEventListener('error', () => { URL.revokeObjectURL(url); resolve(0); });
    a.src = url;
  });
}

// Track edit modal
const trackModal = document.getElementById('trackModal');
document.getElementById('trackModalClose').addEventListener('click',  () => trackModal.hidden = true);
document.getElementById('trackModalCancel').addEventListener('click', () => trackModal.hidden = true);
document.getElementById('trackModalSave').addEventListener('click',   saveTrack);
trackModal.addEventListener('click', e => { if (e.target === trackModal) trackModal.hidden = true; });

document.getElementById('trackCoverFile').addEventListener('change', async function() {
  const file = this.files[0];
  if (!file) return;
  const preview  = document.getElementById('trackCoverPreview');
  const img      = document.getElementById('trackCoverPreviewImg');
  const statusEl = document.getElementById('trackCoverStatus');
  preview.style.display = 'flex';
  statusEl.textContent  = 'Uploading…';
  img.style.opacity     = '0.4';
  try {
    const url = await uploadToCloudinary(file);
    document.getElementById('trackCover').value = url;
    img.src           = url;
    img.style.opacity = '1';
    statusEl.textContent = 'Uploaded!';
    setTimeout(() => { statusEl.textContent = ''; }, 2000);
  } catch(e) {
    statusEl.textContent = 'Failed: ' + e.message;
    img.style.opacity = '1';
  }
  this.value = '';
});

window.openTrackModal = function(id) {
  const t = allTracks.find(x => x.id === id);
  if (!t) return;
  document.getElementById('trackModalId').value    = t.id;
  document.getElementById('trackTitle').value      = t.title  || '';
  document.getElementById('trackArtist').value     = t.artist || '';
  document.getElementById('trackAlbum').value      = t.album  || '';
  document.getElementById('trackCover').value      = t.cover  || '';
  const preview = document.getElementById('trackCoverPreview');
  const img     = document.getElementById('trackCoverPreviewImg');
  if (t.cover) {
    preview.style.display = 'flex';
    img.src = t.cover;
  } else {
    preview.style.display = 'none';
    img.src = '';
  }
  document.getElementById('trackCoverStatus').textContent = '';
  trackModal.hidden = false;
  document.getElementById('trackTitle').focus();
};

async function saveTrack() {
  const id     = document.getElementById('trackModalId').value;
  const title  = document.getElementById('trackTitle').value.trim();
  const artist = document.getElementById('trackArtist').value.trim();
  if (!title || !artist) { toast('Title and artist are required.', 'error'); return; }
  const btn = document.getElementById('trackModalSave');
  btn.textContent = 'Saving…'; btn.disabled = true;
  try {
    await fb.updateDoc(fb.doc(_db, 'tracks', id), {
      title, artist,
      album: document.getElementById('trackAlbum').value.trim(),
      cover: document.getElementById('trackCover').value.trim(),
    });
    toast('Track updated!', 'success');
    trackModal.hidden = true;
    loadMusic();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  btn.textContent = 'Save Track'; btn.disabled = false;
}

window.deleteTrack = async function(id) {
  const t = allTracks.find(x => x.id === id);
  if (!confirm(`Delete "${t?.title || 'this track'}"? This cannot be undone.`)) return;
  try {
    await fb.deleteDoc(fb.doc(_db, 'tracks', id));
    toast('Track deleted.', 'warn');
    loadMusic();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
};

// ── ASSETS ────────────────────────────────────────────────
const dropZone       = document.getElementById('assetDropZone');
const assetFileInput = document.getElementById('assetFileInput');

dropZone.addEventListener('click', () => assetFileInput.click());
dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('drag-active'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-active'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-active');
  handleAssetFiles([...e.dataTransfer.files]);
});
assetFileInput.addEventListener('change', () => handleAssetFiles([...assetFileInput.files]));
document.getElementById('assetAppFilter').addEventListener('change', () => loadAssets());

async function loadAssets() {
  const grid      = document.getElementById('assetGrid');
  const appFilter = document.getElementById('assetAppFilter').value;
  grid.innerHTML  = '<p class="empty-msg" style="grid-column:1/-1">Loading…</p>';
  try {
    let q = fb.collection(_db, 'hub_assets');
    if (appFilter) q = fb.query(q, fb.where('appId','==',appFilter));
    else q = fb.query(q, fb.orderBy('createdAt','desc'));
    const snap = await fb.getDocs(q);
    const assets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!assets.length) { grid.innerHTML = '<p class="empty-msg" style="grid-column:1/-1">No assets yet. Drop files above to upload.</p>'; return; }
    grid.innerHTML = assets.map(a => {
      const isImg = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(a.name);
      const thumb = isImg ? `<img src="${a.url}" alt="${esc(a.name)}" loading="lazy"/>` : fileIcon(a.type);
      return `
        <div class="asset-card">
          <div class="asset-thumb">${thumb}</div>
          <div class="asset-info">
            <div class="asset-name" title="${esc(a.name)}">${esc(a.name)}</div>
            <div class="asset-size">${fmtBytes(a.size||0)}</div>
          </div>
          <div class="asset-actions">
            <button class="asset-copy" onclick="copyUrl('${a.url}')">Copy URL</button>
            <button class="asset-del"  onclick="deleteAsset('${a.id}')">Delete</button>
          </div>
        </div>`;
    }).join('');
  } catch(e) {
    grid.innerHTML = `<p class="empty-msg" style="grid-column:1/-1">Error: ${e.message}</p>`;
  }
}

async function uploadToCloudinary(file, onProgress) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_PRESET);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/auto/upload`);
    xhr.upload.onprogress = e => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
    xhr.onload = () => {
      const data = JSON.parse(xhr.responseText);
      if (xhr.status === 200) resolve(data.secure_url);
      else reject(new Error(data.error?.message || 'Upload failed'));
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(formData);
  });
}

async function handleAssetFiles(files) {
  if (!files.length) return;
  const progWrap = document.getElementById('uploadProgress');
  const bar      = document.getElementById('upBar');
  const status   = document.getElementById('upStatus');
  const appId    = document.getElementById('assetAppFilter').value || 'global';
  progWrap.hidden = false;
  dropZone.hidden = true;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    status.textContent = `Uploading ${i+1}/${files.length}: ${file.name}`;
    bar.style.width = ((i / files.length) * 100) + '%';
    try {
      const url = await uploadToCloudinary(file, pct => {
        bar.style.width = ((i / files.length + pct / files.length) * 100) + '%';
      });
      await fb.addDoc(fb.collection(_db, 'hub_assets'), {
        name: file.name, url, storagePath: '', type: file.type,
        size: file.size, appId,
        uploadedBy: currentUser.uid,
        createdAt: fb.serverTimestamp()
      });
    } catch(e) { toast('Failed: ' + file.name + ' — ' + e.message, 'error'); }
  }
  bar.style.width = '100%';
  status.textContent = 'Done!';
  setTimeout(() => { progWrap.hidden = true; dropZone.hidden = false; bar.style.width = '0%'; }, 1200);
  loadAssets();
  logActivity(`${files.length} asset(s) uploaded`);
}

window.copyUrl = function(url) {
  navigator.clipboard.writeText(url).then(() => toast('URL copied!', 'success'));
};
window.deleteAsset = async function(id) {
  if (!confirm('Delete this asset? This cannot be undone.')) return;
  try {
    await fb.deleteDoc(fb.doc(_db, 'hub_assets', id));
    toast('Asset deleted.', 'warn');
    loadAssets();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
};

// ── NOTIFICATIONS ──────────────────────────────────────────
document.getElementById('sendNotifyBtn').addEventListener('click',    doSendNotification);
document.getElementById('refreshNotifBtn').addEventListener('click',  loadNotifications);

async function loadNotifications() {
  const list = document.getElementById('notifHistory');
  list.innerHTML = '<p class="empty-msg">Loading…</p>';
  try {
    const snap = await fb.getDocs(fb.query(fb.collection(_db, 'hub_notifications'), fb.orderBy('createdAt','desc'), fb.limit(30)));
    if (!snap.size) { list.innerHTML = '<p class="empty-msg">No notifications sent yet.</p>'; return; }
    list.innerHTML = snap.docs.map(d => {
      const n = d.data();
      const time = n.createdAt?.toDate ? timeAgo(n.createdAt.toDate()) : '';
      return `
        <div class="notif-item">
          <div class="notif-title">${esc(n.title)}</div>
          <div class="notif-body">${esc(n.body)}</div>
          <div class="notif-meta">
            <span class="notif-target">${esc(n.targetApp === 'all' ? 'All Apps' : (allApps.find(a=>a.id===n.targetApp)?.name||n.targetApp))}</span>
            <span>${time}</span>
            <span style="color:var(--${n.status==='sent'?'success':n.status==='scheduled'?'warn':'text-mute'})">${n.status||'sent'}</span>
          </div>
        </div>`;
    }).join('');
  } catch(e) {
    list.innerHTML = `<p class="empty-msg">Error: ${e.message}</p>`;
  }
}

async function doSendNotification() {
  const title  = document.getElementById('notifyTitle').value.trim();
  const body   = document.getElementById('notifyBody').value.trim();
  const target = document.getElementById('notifyTarget').value;
  const url    = document.getElementById('notifyUrl').value.trim();
  const sched  = document.getElementById('notifySchedule').value;
  if (!title || !body) { toast('Title and message are required.', 'error'); return; }
  const btn = document.getElementById('sendNotifyBtn');
  btn.textContent = 'Sending…'; btn.disabled = true;
  try {
    const data = {
      title, body, targetApp: target, url: url || '',
      status: sched ? 'scheduled' : 'sent',
      scheduledAt: sched ? new Date(sched) : null,
      sentAt: sched ? null : fb.serverTimestamp(),
      createdBy: currentUser.uid,
      createdAt: fb.serverTimestamp()
    };
    await fb.addDoc(fb.collection(_db, 'hub_notifications'), data);
    toast(sched ? 'Notification scheduled!' : 'Notification saved!', 'success');
    document.getElementById('notifyTitle').value    = '';
    document.getElementById('notifyBody').value     = '';
    document.getElementById('notifyUrl').value      = '';
    document.getElementById('notifySchedule').value = '';
    loadNotifications();
    logActivity(`Notification sent: "${title}"`);
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  btn.textContent = 'Send Notification'; btn.disabled = false;
}

// ── FEEDBACK ──────────────────────────────────────────────
document.getElementById('refreshFeedbackBtn').addEventListener('click', loadFeedback);

async function loadFeedback() {
  const list  = document.getElementById('feedbackList');
  const badge = document.getElementById('feedbackBadge');
  list.innerHTML = '<p class="empty-msg">Loading…</p>';
  try {
    const snap = await fb.getDocs(
      fb.query(fb.collection(_db, 'feedback'), fb.orderBy('createdAt', 'desc'), fb.limit(100))
    );
    if (!snap.size) {
      list.innerHTML = '<p class="empty-msg">No feedback yet.</p>';
      badge.hidden = true;
      return;
    }
    badge.textContent = snap.size;
    badge.hidden = false;
    list.innerHTML = snap.docs.map(d => {
      const f    = d.data();
      const time = f.createdAt?.toDate ? timeAgo(f.createdAt.toDate()) : '';
      const msg  = f.message || f.text || f.body || f.content || f.feedback || '';
      const stars = typeof f.rating === 'number'
        ? '<span class="fb-stars">' + '★'.repeat(Math.min(5, f.rating)) + '☆'.repeat(Math.max(0, 5 - f.rating)) + '</span>'
        : '';
      const user = esc(f.email || f.userName || f.displayName || f.user || 'Anonymous');
      return `
        <div class="feedback-item">
          ${stars}
          <div class="feedback-body">${esc(msg || '(no message)')}</div>
          <div class="feedback-meta"><span>${user}</span><span>${time}</span></div>
        </div>`;
    }).join('');
  } catch(e) {
    list.innerHTML = `<p class="empty-msg">No feedback found. (Users submit feedback from the main app.)</p>`;
  }
}

// ── PROMOTIONS ────────────────────────────────────────────
document.getElementById('addPromoBtn').addEventListener('click', () => openPromoModal());

const promoModal = document.getElementById('promoModal');
document.getElementById('promoModalClose').addEventListener('click',  () => promoModal.hidden = true);
document.getElementById('promoModalCancel').addEventListener('click', () => promoModal.hidden = true);
document.getElementById('promoModalSave').addEventListener('click',   savePromotion);
promoModal.addEventListener('click', e => { if (e.target === promoModal) promoModal.hidden = true; });

async function loadPromotions() {
  const grid = document.getElementById('promoGrid');
  grid.innerHTML = '<p class="empty-msg" style="grid-column:1/-1">Loading…</p>';
  try {
    const snap = await fb.getDocs(fb.query(fb.collection(_db, 'hub_promotions'), fb.orderBy('createdAt','desc')));
    allPromos = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const now       = new Date();
    const active    = allPromos.filter(p => p.status === 'active').length;
    const scheduled = allPromos.filter(p => p.status === 'scheduled').length;
    const draft     = allPromos.filter(p => p.status === 'draft').length;
    document.getElementById('promoStatActive').textContent    = active;
    document.getElementById('promoStatScheduled').textContent = scheduled;
    document.getElementById('promoStatDraft').textContent     = draft;
    document.getElementById('promoStatTotal').textContent     = allPromos.length;

    if (!allPromos.length) {
      grid.innerHTML = '<p class="empty-msg" style="grid-column:1/-1">No promotions yet. Click + New Promotion to get started.</p>';
      return;
    }

    grid.innerHTML = allPromos.map(p => {
      const typeIco   = { banner:'🎯', popup:'💬', card:'🃏', ribbon:'🎀', announcement:'📢' }[p.type] || '📢';
      const statusCls = { active:'status-active', scheduled:'status-maintenance', draft:'status-draft' }[p.status] || 'status-draft';
      const target    = p.targetApp === 'all' ? 'All Apps' : (allApps.find(a => a.id === p.targetApp)?.name || p.targetApp);
      const endStr    = p.endDate?.toDate ? `Ends ${timeAgo(p.endDate.toDate())}` : '';
      return `
        <div class="promo-card">
          ${p.image
            ? `<div class="promo-img" style="background-image:url('${esc(p.image)}')"></div>`
            : `<div class="promo-img-placeholder">${typeIco}</div>`}
          <div class="promo-card-body">
            <div class="promo-card-top">
              <span class="promo-type-badge">${typeIco} ${esc(p.type||'banner')}</span>
              <span class="app-status-pill ${statusCls}">${esc(p.status||'draft')}</span>
            </div>
            <div class="promo-card-title">${esc(p.title)}</div>
            <div class="promo-card-msg">${esc(p.message||'')}</div>
            <div class="promo-card-meta">
              <span class="promo-target">📱 ${esc(target)}</span>
              ${endStr ? `<span>${endStr}</span>` : ''}
              ${p.ctaText ? `<span class="promo-cta-badge">${esc(p.ctaText)}</span>` : ''}
            </div>
          </div>
          <div class="promo-card-actions">
            <button class="app-act-edit"   onclick="openPromoModal('${p.id}')">✏ Edit</button>
            ${p.link ? `<button class="app-act-open" onclick="window.open('${esc(p.link)}','_blank')">↗ Link</button>` : ''}
            <button class="app-act-delete" onclick="deletePromo('${p.id}')">🗑</button>
          </div>
        </div>`;
    }).join('');
  } catch(e) {
    grid.innerHTML = `<p class="empty-msg" style="grid-column:1/-1">Error: ${e.message}</p>`;
  }
}

window.openPromoModal = function(id) {
  const p = id ? allPromos.find(x => x.id === id) : null;
  document.getElementById('promoModalTitle').textContent = p ? 'Edit Promotion' : 'New Promotion';
  document.getElementById('promoModalId').value    = p?.id       || '';
  document.getElementById('promoTitle').value      = p?.title    || '';
  document.getElementById('promoType').value       = p?.type     || 'banner';
  document.getElementById('promoMessage').value    = p?.message  || '';
  document.getElementById('promoImage').value      = p?.image    || '';
  document.getElementById('promoCta').value        = p?.ctaText  || '';
  document.getElementById('promoLink').value       = p?.link     || '';
  document.getElementById('promoTarget').value     = p?.targetApp|| 'all';
  document.getElementById('promoStatus').value     = p?.status   || 'active';
  const fmt = ts => ts?.toDate ? ts.toDate().toISOString().slice(0,16) : '';
  document.getElementById('promoStart').value = fmt(p?.startDate);
  document.getElementById('promoEnd').value   = fmt(p?.endDate);
  promoModal.hidden = false;
  document.getElementById('promoTitle').focus();
};

function openPromoModal(id) { window.openPromoModal(id); }

async function savePromotion() {
  const id    = document.getElementById('promoModalId').value;
  const title = document.getElementById('promoTitle').value.trim();
  if (!title) { toast('Title is required.', 'error'); return; }
  const btn = document.getElementById('promoModalSave');
  btn.textContent = 'Saving…'; btn.disabled = true;
  const startVal = document.getElementById('promoStart').value;
  const endVal   = document.getElementById('promoEnd').value;
  const data = {
    title,
    type:      document.getElementById('promoType').value,
    message:   document.getElementById('promoMessage').value.trim(),
    image:     document.getElementById('promoImage').value.trim(),
    ctaText:   document.getElementById('promoCta').value.trim(),
    link:      document.getElementById('promoLink').value.trim(),
    targetApp: document.getElementById('promoTarget').value,
    status:    document.getElementById('promoStatus').value,
    startDate: startVal ? new Date(startVal) : null,
    endDate:   endVal   ? new Date(endVal)   : null,
    updatedAt: fb.serverTimestamp(),
  };
  try {
    if (id) {
      await fb.updateDoc(fb.doc(_db, 'hub_promotions', id), data);
    } else {
      data.createdAt = fb.serverTimestamp();
      data.createdBy = currentUser.uid;
      await fb.addDoc(fb.collection(_db, 'hub_promotions'), data);
      logActivity(`Promotion "${title}" created`);
    }
    promoModal.hidden = true;
    toast(id ? 'Promotion updated!' : 'Promotion created!', 'success');
    loadPromotions();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  btn.textContent = 'Save Promotion'; btn.disabled = false;
}

window.deletePromo = async function(id) {
  const p = allPromos.find(x => x.id === id);
  if (!confirm(`Delete "${p?.title}"? This cannot be undone.`)) return;
  try {
    await fb.deleteDoc(fb.doc(_db, 'hub_promotions', id));
    toast('Promotion deleted.', 'warn');
    logActivity(`Promotion "${p?.title}" deleted`);
    loadPromotions();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
};

// ── PROFILE PICTURE ───────────────────────────────────────
document.getElementById('profilePicInput').addEventListener('change', async function() {
  const file = this.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { toast('Please select an image file.', 'error'); return; }
  if (file.size > 5 * 1024 * 1024)    { toast('Image must be under 5 MB.', 'error');    return; }

  const progWrap = document.getElementById('profileUploadProgress');
  const bar      = document.getElementById('profileUpBar');
  const status   = document.getElementById('profileUpStatus');
  progWrap.hidden   = false;
  bar.style.width   = '0%';
  status.textContent = 'Uploading…';

  try {
    const photoURL = await uploadToCloudinary(file, pct => { bar.style.width = (pct * 100) + '%'; });
    await fb.updateDoc(fb.doc(_db, 'hub_users', currentUser.uid), { photoURL });
    await fb.updateProfile(currentUser, { photoURL });
    currentUserData.photoURL = photoURL;
    bar.style.width    = '100%';
    status.textContent = 'Done!';
    setTimeout(() => { progWrap.hidden = true; }, 1500);
    setupUserDisplay();
    updateProfilePicPreview(photoURL);
    toast('Profile picture updated!', 'success');
  } catch(e) {
    toast('Upload failed: ' + e.message, 'error');
    progWrap.hidden = true;
  }
  this.value = '';
});

function updateProfilePicPreview(photoURL) {
  const el = document.getElementById('profilePicAvatar');
  if (!el) return;
  if (photoURL) {
    el.innerHTML = `<img src="${photoURL}" alt="Profile" style="width:100%;height:100%;object-fit:cover;border-radius:inherit"/>`;
  } else {
    el.innerHTML = '';
    const name = currentUserData?.name || currentUser?.displayName || '';
    el.textContent = name.charAt(0).toUpperCase() || '?';
  }
}

// ── SETTINGS ──────────────────────────────────────────────
document.getElementById('saveGeneralBtn').addEventListener('click', saveGeneralSettings);
document.getElementById('saveAccessBtn').addEventListener('click',  saveAccessSettings);
document.getElementById('exportDataBtn').addEventListener('click',  exportData);
document.getElementById('saveBrandingBtn').addEventListener('click', saveBrandingSettings);
document.getElementById('saveApiBtn').addEventListener('click',      saveApiSettings);

async function loadSettings() {
  try {
    const snap = await fb.getDoc(fb.doc(_db, 'hub_settings', 'global'));
    if (snap.exists()) {
      const s = snap.data();
      document.getElementById('setHubName').value        = s.hubName     || 'HUB';
      document.getElementById('setHubDesc').value        = s.description || '';
      document.getElementById('setAllowReg').checked     = s.allowReg    !== false;
      document.getElementById('setMaintenance').checked  = s.maintenance || false;
      document.getElementById('setHubIcon').value        = s.hubIcon     || '';
      document.getElementById('setAccentColor').value    = s.accentColor || '#6366f1';
      document.getElementById('setCloudName').value      = s.cloudName   || '';
      document.getElementById('setCloudPreset').value    = s.cloudPreset || '';
      document.getElementById('setMaxUpload').value      = s.maxUpload   || 50;
      if (s.accentColor) document.documentElement.style.setProperty('--accent', s.accentColor);
    }
    const userSnap = await fb.getDoc(fb.doc(_db, 'hub_users', currentUser.uid));
    if (userSnap.exists()) document.getElementById('setDisplayName').value = userSnap.data().name || '';
  } catch(e) {}
  // Sync profile pic preview
  updateProfilePicPreview(currentUserData?.photoURL || currentUser?.photoURL || '');
}

async function saveBrandingSettings() {
  const btn = document.getElementById('saveBrandingBtn');
  btn.textContent = 'Saving…'; btn.disabled = true;
  try {
    const color = document.getElementById('setAccentColor').value;
    const icon  = document.getElementById('setHubIcon').value.trim();
    await fb.setDoc(fb.doc(_db, 'hub_settings', 'global'), {
      hubIcon: icon, accentColor: color, updatedAt: fb.serverTimestamp()
    }, { merge: true });
    document.documentElement.style.setProperty('--accent', color);
    toast('Branding saved!', 'success');
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  btn.textContent = 'Save Branding'; btn.disabled = false;
}

async function saveApiSettings() {
  const btn = document.getElementById('saveApiBtn');
  btn.textContent = 'Saving…'; btn.disabled = true;
  try {
    await fb.setDoc(fb.doc(_db, 'hub_settings', 'global'), {
      cloudName:   document.getElementById('setCloudName').value.trim(),
      cloudPreset: document.getElementById('setCloudPreset').value.trim(),
      maxUpload:   parseInt(document.getElementById('setMaxUpload').value) || 50,
      updatedAt:   fb.serverTimestamp(),
    }, { merge: true });
    toast('API config saved!', 'success');
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  btn.textContent = 'Save API Config'; btn.disabled = false;
}

async function saveGeneralSettings() {
  const btn = document.getElementById('saveGeneralBtn');
  btn.textContent = 'Saving…'; btn.disabled = true;
  try {
    await fb.setDoc(fb.doc(_db, 'hub_settings', 'global'), {
      hubName:     document.getElementById('setHubName').value.trim() || 'HUB',
      description: document.getElementById('setHubDesc').value.trim(),
      updatedAt:   fb.serverTimestamp()
    }, { merge: true });
    const name = document.getElementById('setDisplayName').value.trim();
    if (name) {
      await fb.updateDoc(fb.doc(_db, 'hub_users', currentUser.uid), { name });
      currentUserData.name = name;
      setupUserDisplay();
    }
    toast('Settings saved!', 'success');
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  btn.textContent = 'Save General'; btn.disabled = false;
}

async function saveAccessSettings() {
  const btn = document.getElementById('saveAccessBtn');
  btn.textContent = 'Saving…'; btn.disabled = true;
  try {
    await fb.setDoc(fb.doc(_db, 'hub_settings', 'global'), {
      allowReg:    document.getElementById('setAllowReg').checked,
      maintenance: document.getElementById('setMaintenance').checked,
      updatedAt:   fb.serverTimestamp()
    }, { merge: true });
    toast('Access settings saved!', 'success');
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  btn.textContent = 'Save Access'; btn.disabled = false;
}

async function exportData() {
  try {
    const [apps, users, assets, notifs] = await Promise.all([
      fb.getDocs(fb.collection(_db, 'hub_apps')),
      fb.getDocs(fb.collection(_db, 'hub_users')),
      fb.getDocs(fb.collection(_db, 'hub_assets')),
      fb.getDocs(fb.collection(_db, 'hub_notifications')),
    ]);
    const data = {
      exportedAt: new Date().toISOString(),
      apps:    apps.docs.map(d=>({id:d.id,...d.data()})),
      users:   users.docs.map(d=>({id:d.id,...d.data()})),
      assets:  assets.docs.map(d=>({id:d.id,...d.data()})),
      notifications: notifs.docs.map(d=>({id:d.id,...d.data()}))
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a    = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `hub-export-${Date.now()}.json` });
    a.click();
    toast('Data exported!', 'success');
  } catch(e) { toast('Export failed: ' + e.message, 'error'); }
}

// ── ACTIVITY LOG ──────────────────────────────────────────
async function logActivity(text) {
  try {
    await fb.addDoc(fb.collection(_db, 'hub_activity'), {
      text, userId: currentUser?.uid,
      createdAt: fb.serverTimestamp()
    });
  } catch(e) {}
}

// ── HELPERS ───────────────────────────────────────────────
function esc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024, sizes = ['B','KB','MB','GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k,i)).toFixed(1) + ' ' + sizes[i];
}

function timeAgo(date) {
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60)   return 'just now';
  if (diff < 3600) return Math.floor(diff/60)   + 'm ago';
  if (diff < 86400) return Math.floor(diff/3600) + 'h ago';
  return Math.floor(diff/86400) + 'd ago';
}

function fileIcon(type='') {
  if (type.startsWith('image/')) return '🖼';
  if (type.startsWith('audio/')) return '🎵';
  if (type.startsWith('video/')) return '🎬';
  if (type.includes('pdf'))      return '📄';
  return '📁';
}

let toastTimer;
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = 'toast' + (type ? ' ' + type : '');
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
}

// window-level so onclick="" in HTML can call them
window.showPage   = showPage;
window.openEditor = openEditor;
window.openAppModal = openAppModal;

// ── PLAYLISTS ─────────────────────────────────────────────
let allAdminPlaylists = [];

document.getElementById('addPlaylistBtn').addEventListener('click', () => openPlaylistModal());

const playlistModal = document.getElementById('playlistModal');
document.getElementById('playlistModalClose').addEventListener('click',  () => playlistModal.hidden = true);
document.getElementById('playlistModalCancel').addEventListener('click', () => playlistModal.hidden = true);
document.getElementById('playlistModalSave').addEventListener('click',   savePlaylist);
playlistModal.addEventListener('click', e => { if (e.target === playlistModal) playlistModal.hidden = true; });

async function loadPlaylists() {
  const grid = document.getElementById('playlistAdminGrid');
  grid.innerHTML = '<p class="empty-msg" style="grid-column:1/-1">Loading…</p>';
  try {
    const snap = await fb.getDocs(fb.query(fb.collection(_db, 'hub_playlists'), fb.orderBy('createdAt', 'desc')));
    allAdminPlaylists = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!allAdminPlaylists.length) {
      grid.innerHTML = '<p class="empty-msg" style="grid-column:1/-1">No playlists yet. Click + New Playlist to get started.</p>';
      return;
    }
    grid.innerHTML = allAdminPlaylists.map(pl => {
      const cover = pl.cover
        ? `<div class="promo-img" style="background-image:url('${esc(pl.cover)}');height:120px"></div>`
        : `<div class="promo-img-placeholder" style="height:120px">🎵</div>`;
      const statusCls = pl.status === 'public' ? 'status-active' : 'status-draft';
      const tags = (pl.tags || []).map(t => `<span class="promo-cta-badge">${esc(t)}</span>`).join(' ');
      return `
        <div class="app-card">
          ${cover}
          <div class="app-card-body">
            <div class="app-card-name">${esc(pl.name)}</div>
            <div class="app-card-desc">${esc(pl.description || '')}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
              <span class="app-status-pill ${statusCls}">${pl.status || 'draft'}</span>
              ${tags}
            </div>
            <div style="font-size:.72rem;color:var(--text-mute);margin-top:6px">${pl.trackIds?.length || 0} tracks</div>
          </div>
          <div class="app-card-actions">
            <button class="app-act-edit"   onclick="openPlaylistModal('${pl.id}')">✏ Edit</button>
            <button class="app-act-delete" onclick="deletePlaylist('${pl.id}')">🗑</button>
          </div>
        </div>`;
    }).join('');
  } catch(e) {
    if (e.code === 'permission-denied' || (e.message||'').includes('permission')) {
      grid.innerHTML = `<div style="grid-column:1/-1;padding:20px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:12px">
        <div style="font-weight:700;color:#ef4444;margin-bottom:8px">🔒 Firestore Permission Denied</div>
        <p style="font-size:.82rem;color:var(--text-dim);margin-bottom:10px">Add this rule in <a href="https://console.firebase.google.com/" target="_blank" style="color:var(--accent)">Firebase Console → Firestore → Rules</a>:</p>
        <pre style="font-size:.72rem;background:rgba(0,0,0,.35);padding:10px 12px;border-radius:8px;overflow-x:auto">match /hub_playlists/{d} {\n  allow read, write: if request.auth != null;\n}</pre>
        <a href="https://console.firebase.google.com/" target="_blank" class="btn-primary" style="display:inline-block;margin-top:12px;text-decoration:none;font-size:.8rem">Open Firebase Console →</a>
      </div>`;
    } else {
      grid.innerHTML = `<p class="empty-msg" style="grid-column:1/-1">Error: ${e.message}</p>`;
    }
  }
}

window.openPlaylistModal = function(id) {
  const pl = id ? allAdminPlaylists.find(p => p.id === id) : null;
  document.getElementById('playlistModalTitle').textContent = pl ? 'Edit Playlist' : 'New Playlist';
  document.getElementById('playlistModalId').value = pl?.id    || '';
  document.getElementById('plName').value          = pl?.name  || '';
  document.getElementById('plDesc').value          = pl?.description || '';
  document.getElementById('plCover').value         = pl?.cover || '';
  document.getElementById('plStatus').value        = pl?.status|| 'public';
  document.getElementById('plTags').value          = (pl?.tags || []).join(', ');
  playlistModal.hidden = false;
  document.getElementById('plName').focus();
};

function openPlaylistModal(id) { window.openPlaylistModal(id); }

async function savePlaylist() {
  const id   = document.getElementById('playlistModalId').value;
  const name = document.getElementById('plName').value.trim();
  if (!name) { toast('Playlist name is required.', 'error'); return; }
  const btn = document.getElementById('playlistModalSave');
  btn.textContent = 'Saving…'; btn.disabled = true;
  const rawTags = document.getElementById('plTags').value;
  const tags = rawTags.split(',').map(t => t.trim()).filter(Boolean);
  const data = {
    name,
    description: document.getElementById('plDesc').value.trim(),
    cover:       document.getElementById('plCover').value.trim(),
    status:      document.getElementById('plStatus').value,
    tags,
    updatedAt:   fb.serverTimestamp(),
  };
  try {
    if (id) {
      await fb.updateDoc(fb.doc(_db, 'hub_playlists', id), data);
    } else {
      data.createdAt  = fb.serverTimestamp();
      data.createdBy  = currentUser.uid;
      data.trackIds   = [];
      await fb.addDoc(fb.collection(_db, 'hub_playlists'), data);
      logActivity(`Playlist "${name}" created`);
    }
    playlistModal.hidden = true;
    toast(id ? 'Playlist updated!' : 'Playlist created!', 'success');
    loadPlaylists();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  btn.textContent = 'Save Playlist'; btn.disabled = false;
}

window.deletePlaylist = async function(id) {
  const pl = allAdminPlaylists.find(p => p.id === id);
  if (!confirm(`Delete "${pl?.name}"? This cannot be undone.`)) return;
  try {
    await fb.deleteDoc(fb.doc(_db, 'hub_playlists', id));
    toast('Playlist deleted.', 'warn');
    logActivity(`Playlist "${pl?.name}" deleted`);
    loadPlaylists();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
};

// ── ANALYTICS ─────────────────────────────────────────────
document.getElementById('refreshAnalyticsBtn').addEventListener('click', loadAnalytics);

async function loadAnalytics() {
  try {
    const weekAgo    = new Date(Date.now() - 7 * 86400000);
    const dayAgo     = new Date(Date.now() - 86400000);
    const hourAgo    = new Date(Date.now() - 3600000);
    const [usersSnap, tracksSnap, promosSnap, actSnap, sessSnap] = await Promise.all([
      fb.getDocs(fb.collection(_db, 'hub_users')),
      fb.getDocs(fb.query(fb.collection(_db, 'tracks'), fb.orderBy('plays', 'desc'), fb.limit(10))),
      fb.getDocs(fb.collection(_db, 'hub_promotions')),
      fb.getDocs(fb.query(fb.collection(_db, 'hub_activity'), fb.orderBy('createdAt', 'desc'), fb.limit(10))),
      fb.getDocs(fb.collection(_db, 'app_sessions')).catch(() => ({ docs: [] })),
    ]);

    const users    = usersSnap.docs.map(d => d.data());
    const newUsers = users.filter(u => u.createdAt?.toDate?.() > weekAgo).length;
    const pending  = users.filter(u => u.status === 'pending').length;
    const activePromos = promosSnap.docs.filter(d => d.data().status === 'active').length;

    const onlineNow   = sessSnap.docs.filter(d => { const t = d.data().lastSeen?.toDate?.(); return t && t > hourAgo; }).length;
    const activeToday = sessSnap.docs.filter(d => { const t = d.data().lastSeen?.toDate?.(); return t && t > dayAgo; }).length;
    const activeWeek  = sessSnap.docs.filter(d => { const t = d.data().lastSeen?.toDate?.(); return t && t > weekAgo; }).length;

    document.getElementById('anTotalUsers').textContent = users.length;
    document.getElementById('anNewUsers').textContent   = newUsers;
    document.getElementById('anPending').textContent    = pending;
    document.getElementById('anTracks').textContent     = tracksSnap.size;
    document.getElementById('anPromos').textContent     = activePromos;
    if (document.getElementById('anOnlineNow'))   document.getElementById('anOnlineNow').textContent   = onlineNow;
    if (document.getElementById('anActiveToday')) document.getElementById('anActiveToday').textContent = activeToday;
    if (document.getElementById('anActiveWeek'))  document.getElementById('anActiveWeek').textContent  = activeWeek;
    if (document.getElementById('dashOnlineNow')) document.getElementById('dashOnlineNow').textContent = onlineNow;

    // Top tracks bar chart
    const tracksEl = document.getElementById('anTopTracks');
    const tracks   = tracksSnap.docs.map(d => d.data());
    if (!tracks.length) { tracksEl.innerHTML = '<p class="empty-msg">No tracks yet.</p>'; }
    else {
      const max = Math.max(...tracks.map(t => t.plays || 0), 1);
      tracksEl.innerHTML = tracks.slice(0, 6).map(t => {
        const pct = Math.round(((t.plays || 0) / max) * 100);
        return `<div class="an-bar-row">
          <div class="an-bar-label" title="${esc(t.title)}">${esc(t.title || 'Untitled')}</div>
          <div class="an-bar-track"><div class="an-bar-fill" style="width:${Math.max(pct,4)}%"></div></div>
          <div class="an-bar-val">${t.plays || 0}</div>
        </div>`;
      }).join('');
    }

    // Role breakdown
    const roles = {};
    users.forEach(u => { roles[u.role || 'viewer'] = (roles[u.role || 'viewer'] || 0) + 1; });
    const roleEl  = document.getElementById('anRoleChart');
    const roleMax = Math.max(...Object.values(roles), 1);
    const roleColors = { super_admin: '#ef4444', admin: '#f59e0b', editor: '#6366f1', viewer: '#10b981' };
    roleEl.innerHTML = Object.entries(roles).map(([r, n]) => `
      <div class="an-bar-row">
        <div class="an-bar-label">${r.replace('_',' ')}</div>
        <div class="an-bar-track"><div class="an-bar-fill" style="width:${Math.round(n/roleMax*100)}%;background:${roleColors[r]||'#6366f1'}"></div></div>
        <div class="an-bar-val">${n}</div>
      </div>`).join('');

    // Recent activity
    const actEl = document.getElementById('anActivity');
    const acts  = actSnap.docs.map(d => d.data());
    if (!acts.length) { actEl.innerHTML = '<p class="empty-msg">No activity logged yet.</p>'; }
    else {
      actEl.innerHTML = acts.map(a => {
        const time = a.createdAt?.toDate ? timeAgo(a.createdAt.toDate()) : '';
        return `<div class="activity-item"><div class="act-dot"></div><div><div class="act-text">${esc(a.text)}</div><div class="act-time">${time}</div></div></div>`;
      }).join('');
    }
  } catch(e) { console.warn('[Analytics]', e); }
}

// ── BULK APPROVE USERS ────────────────────────────────────
document.getElementById('bulkApproveBtn').addEventListener('click', async () => {
  const pending = allUsers.filter(u => u.status === 'pending');
  if (!pending.length) { toast('No pending users to approve.', 'warn'); return; }
  if (!confirm(`Approve all ${pending.length} pending user(s)?`)) return;
  try {
    await Promise.all(pending.map(u =>
      fb.updateDoc(fb.doc(_db, 'hub_users', u.id), {
        status: 'approved',
        approvedAt: fb.serverTimestamp(),
        approvedBy: currentUser.uid
      })
    ));
    toast(`✓ Approved ${pending.length} user(s)!`, 'success');
    logActivity(`Bulk approved ${pending.length} pending user(s)`);
    loadUsers();
    loadPendingBadge();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
});

// ── DARK MODE ─────────────────────────────────────────────
(function initDarkMode() {
  const btn     = document.getElementById('darkModeBtn');
  const isDark  = localStorage.getItem('hub_dark') === '1';
  if (isDark) document.body.classList.add('dark');
  btn.textContent = isDark ? '☀️' : '🌙';
  btn.addEventListener('click', () => {
    const dark = document.body.classList.toggle('dark');
    localStorage.setItem('hub_dark', dark ? '1' : '0');
    btn.textContent = dark ? '☀️' : '🌙';
  });
})();

// Hook analytics into showPage
const _origShowPage = showPage;
window.showPage = function(name) {
  _origShowPage(name);
  if (name === 'analytics') loadAnalytics();
};

// ── COMMUNITY POSTS ──────────────────────────────────────
let allPosts = [];
let activePostTab = 'pending';

document.getElementById('addPostBtn').addEventListener('click', () => openPostModal());

document.getElementById('approveAllPostsBtn')?.addEventListener('click', async () => {
  const pending = allPosts.filter(p => p.status === 'pending');
  if (!pending.length) { toast('No pending posts to approve.', 'warn'); return; }
  if (!confirm(`Approve all ${pending.length} pending post${pending.length > 1 ? 's' : ''}?`)) return;
  try {
    await Promise.all(pending.map(p =>
      fb.updateDoc(fb.doc(_db, 'community_posts', p.id), {
        status: 'approved',
        approvedAt: fb.serverTimestamp(),
        approvedBy: currentUser.uid,
      })
    ));
    toast(`✅ Approved ${pending.length} post${pending.length > 1 ? 's' : ''}!`, 'success');
    logActivity(`Bulk approved ${pending.length} community post(s)`);
    loadPosts();
    loadPostsBadge();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
});

const postModal = document.getElementById('postModal');
document.getElementById('postModalClose').addEventListener('click',  () => { postModal.hidden = true; });
document.getElementById('postModalCancel').addEventListener('click', () => { postModal.hidden = true; });
document.getElementById('postModalSave').addEventListener('click',   savePost);
postModal.addEventListener('click', e => { if (e.target === postModal) postModal.hidden = true; });

document.querySelectorAll('.post-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.post-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activePostTab = btn.dataset.ptab;
    renderPosts();
  });
});

document.getElementById('postMImageFile').addEventListener('change', async function() {
  const file = this.files[0];
  if (!file) return;
  const preview  = document.getElementById('postMImagePreview');
  const img      = document.getElementById('postMImagePreviewImg');
  const statusEl = document.getElementById('postMImageStatus');
  preview.style.display = 'block';
  statusEl.textContent  = 'Uploading…';
  img.style.opacity     = '0.4';
  try {
    const url = await uploadToCloudinary(file);
    document.getElementById('postMImageUrl').value = url;
    img.src           = url;
    img.style.opacity = '1';
    statusEl.textContent = 'Uploaded!';
    setTimeout(() => { statusEl.textContent = ''; }, 2000);
  } catch(e) {
    statusEl.textContent = 'Failed: ' + e.message;
    img.style.opacity = '1';
  }
  this.value = '';
});

document.getElementById('postMImageUrl').addEventListener('input', function() {
  const url = this.value.trim();
  const preview = document.getElementById('postMImagePreview');
  const img     = document.getElementById('postMImagePreviewImg');
  if (url) { preview.style.display = 'block'; img.src = url; }
  else      { preview.style.display = 'none';  img.src = ''; }
});

async function loadPostsBadge() {
  try {
    const snap  = await fb.getDocs(fb.query(fb.collection(_db, 'community_posts'), fb.where('status','==','pending')));
    const count = snap.size;
    const badge = document.getElementById('postsBadge');
    if (badge) { badge.textContent = count; badge.hidden = count === 0; }
  } catch(e) {}
}

async function loadPosts() {
  document.getElementById('postsList').innerHTML = '<p class="empty-msg">Loading…</p>';
  try {
    const snap = await fb.getDocs(fb.query(fb.collection(_db, 'community_posts'), fb.orderBy('submittedAt', 'desc')));
    allPosts   = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    updatePostsBadge();
    renderPosts();
  } catch(e) {
    document.getElementById('postsList').innerHTML =
      `<p class="empty-msg">Error loading posts: ${esc(e.message)}. Add Firestore rules for community_posts (see Settings → Rules Helper).</p>`;
  }
}

function updatePostsBadge() {
  const pending  = allPosts.filter(p => p.status === 'pending').length;
  const approved = allPosts.filter(p => p.status === 'approved').length;
  const rejected = allPosts.filter(p => p.status === 'rejected').length;
  const badge    = document.getElementById('postsBadge');
  const tabCount = document.getElementById('pendingPostCount');
  if (badge)    { badge.textContent = pending; badge.hidden = pending === 0; }
  if (tabCount) tabCount.textContent = pending;
  // Stats bar
  const bar = document.getElementById('postsStatsBar');
  if (bar && allPosts.length > 0) {
    bar.style.display = 'flex';
    document.getElementById('psCountPending').textContent  = pending;
    document.getElementById('psCountApproved').textContent = approved;
    document.getElementById('psCountRejected').textContent = rejected;
    document.getElementById('psCountTotal').textContent    = allPosts.length;
  } else if (bar) {
    bar.style.display = 'none';
  }
}

function renderPosts() {
  const list  = document.getElementById('postsList');
  const posts = activePostTab === 'all' ? allPosts : allPosts.filter(p => p.status === activePostTab);
  if (!posts.length) {
    list.innerHTML = `<p class="empty-msg">No ${activePostTab === 'all' ? '' : activePostTab + ' '}posts yet.</p>`;
    return;
  }
  const statusColors = { approved: '#10b981', pending: '#f59e0b', rejected: '#ef4444' };
  const statusIco    = { approved: '✅', pending: '⏳', rejected: '❌' };
  list.innerHTML = posts.map(p => {
    const time     = p.submittedAt?.toDate ? timeAgo(p.submittedAt.toDate()) : '';
    const tags     = (p.tags || []).map(t => `<span class="promo-cta-badge">${esc(t)}</span>`).join(' ');
    const imgThumb = p.imageUrl
      ? `<img src="${esc(p.imageUrl)}" alt="" style="width:72px;height:72px;object-fit:cover;border-radius:8px;flex-shrink:0;border:1px solid var(--border)"/>`
      : '';
    const communityTag = p.source === 'community'
      ? '<span class="promo-cta-badge" style="background:rgba(99,102,241,.15);color:#818cf8">community</span>'
      : '';
    const sc = statusColors[p.status] || '#888';
    return `
      <div class="post-review-card" style="border-left:3px solid ${sc}">
        <div class="post-card-inner">
          ${imgThumb}
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
              <span style="font-weight:700;font-size:.95rem">${esc(p.title || '(no title)')}</span>
              <span style="font-size:.73rem;padding:2px 8px;border-radius:20px;background:${sc}22;color:${sc}">${statusIco[p.status]||''} ${esc(p.status)}</span>
              ${communityTag}
            </div>
            <div style="font-size:.82rem;color:var(--text-dim);margin-bottom:6px;line-height:1.5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${esc(p.body || '(no content)')}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
              ${tags}
              <span style="font-size:.72rem;color:var(--text-mute)">by ${esc(p.authorName || 'Anonymous')} · ${time}</span>
            </div>
          </div>
          <div class="post-card-actions">
            ${p.status === 'pending'
              ? `<button class="btn-sm" style="background:rgba(16,185,129,.18);color:#10b981;border-color:rgba(16,185,129,.3)" onclick="approvePost('${p.id}')">✓ Approve</button>
                 <button class="btn-sm" style="background:rgba(239,68,68,.12);color:#ef4444;border-color:rgba(239,68,68,.25)" onclick="rejectPost('${p.id}')">✗ Reject</button>`
              : p.status === 'approved'
              ? `<button class="btn-sm" style="background:rgba(239,68,68,.12);color:#ef4444;border-color:rgba(239,68,68,.25)" onclick="rejectPost('${p.id}')">↩ Unapprove</button>`
              : p.status === 'rejected'
              ? `<button class="btn-sm" style="background:rgba(16,185,129,.18);color:#10b981;border-color:rgba(16,185,129,.3)" onclick="approvePost('${p.id}')">↩ Re-approve</button>
                 <button class="btn-sm" style="font-size:.72rem" onclick="pendingPost('${p.id}')">⏳ Pending</button>`
              : ''}
            <button class="btn-sm" onclick="openPostModal('${p.id}')">✏ Edit</button>
            <button class="btn-sm" style="background:rgba(239,68,68,.1);color:#ef4444" onclick="deletePost('${p.id}')">🗑</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

window.openPostModal = function(id) {
  const p = id ? allPosts.find(x => x.id === id) : null;
  document.getElementById('postModalTitle').textContent = p ? 'Edit Post' : 'New Post';
  document.getElementById('postModalId').value   = p?.id       || '';
  document.getElementById('postMTitle').value    = p?.title    || '';
  document.getElementById('postMBody').value     = p?.body     || '';
  document.getElementById('postMImageUrl').value = p?.imageUrl || '';
  document.getElementById('postMTags').value     = (p?.tags || []).join(', ');
  document.getElementById('postMAuthor').value   = p?.authorName || 'Admin';
  document.getElementById('postMStatus').value   = p?.status   || 'approved';
  const preview = document.getElementById('postMImagePreview');
  const img     = document.getElementById('postMImagePreviewImg');
  if (p?.imageUrl) { preview.style.display = 'block'; img.src = p.imageUrl; }
  else             { preview.style.display = 'none';  img.src = ''; }
  document.getElementById('postMImageStatus').textContent = '';
  postModal.hidden = false;
  document.getElementById('postMTitle').focus();
};

function openPostModal(id) { window.openPostModal(id); }

async function savePost() {
  const id    = document.getElementById('postModalId').value;
  const title = document.getElementById('postMTitle').value.trim();
  const body  = document.getElementById('postMBody').value.trim();
  if (!title) { toast('Title is required.', 'error'); return; }
  const btn  = document.getElementById('postModalSave');
  btn.textContent = 'Saving…'; btn.disabled = true;
  const tags   = document.getElementById('postMTags').value.split(',').map(t => t.trim()).filter(Boolean);
  const status = document.getElementById('postMStatus').value;
  const data   = {
    title, body,
    imageUrl:      document.getElementById('postMImageUrl').value.trim(),
    tags,
    authorName:    document.getElementById('postMAuthor').value.trim() || 'Admin',
    status,
    updatedAt:     fb.serverTimestamp(),
  };
  try {
    if (id) {
      if (status === 'approved') data.approvedAt = fb.serverTimestamp();
      await fb.updateDoc(fb.doc(_db, 'community_posts', id), data);
      toast('Post updated!', 'success');
    } else {
      data.source         = 'admin';
      data.submittedAt    = fb.serverTimestamp();
      data.approvedAt     = status === 'approved' ? fb.serverTimestamp() : null;
      data.authorContact  = '';
      await fb.addDoc(fb.collection(_db, 'community_posts'), data);
      logActivity(`Post "${title}" created`);
      toast('Post published!', 'success');
    }
    postModal.hidden = true;
    loadPosts();
    loadPostsBadge();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  btn.textContent = 'Publish Post'; btn.disabled = false;
}

window.pendingPost = async function(id) {
  try {
    await fb.updateDoc(fb.doc(_db, 'community_posts', id), {
      status: 'pending',
      rejectedAt: null,
    });
    toast('Post moved back to pending.', 'success');
    loadPosts();
    loadPostsBadge();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
};

window.approvePost = async function(id) {
  try {
    await fb.updateDoc(fb.doc(_db, 'community_posts', id), {
      status:     'approved',
      approvedAt: fb.serverTimestamp(),
      approvedBy: currentUser.uid,
    });
    toast('Post approved and published!', 'success');
    logActivity('Community post approved');
    loadPosts();
    loadPostsBadge();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
};

window.rejectPost = async function(id) {
  try {
    await fb.updateDoc(fb.doc(_db, 'community_posts', id), {
      status:     'rejected',
      rejectedAt: fb.serverTimestamp(),
    });
    toast('Post rejected.', 'warn');
    loadPosts();
    loadPostsBadge();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
};

window.deletePost = async function(id) {
  const p = allPosts.find(x => x.id === id);
  if (!confirm(`Delete "${p?.title || 'this post'}"? This cannot be undone.`)) return;
  try {
    await fb.deleteDoc(fb.doc(_db, 'community_posts', id));
    toast('Post deleted.', 'warn');
    logActivity(`Post "${p?.title}" deleted`);
    loadPosts();
    loadPostsBadge();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
};

// ── GLOBAL SEARCH (Ctrl+K) ────────────────────────────────
(function initGlobalSearch() {
  const overlay = document.getElementById('gsearchOverlay');
  const input   = document.getElementById('gsearchInput');
  const results = document.getElementById('gsearchResults');
  if (!overlay || !input || !results) return;

  function openSearch() { overlay.hidden = false; input.value = ''; results.innerHTML = ''; setTimeout(() => input.focus(), 50); }
  function closeSearch() { overlay.hidden = true; }

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
    if (e.key === 'Escape' && !overlay.hidden) closeSearch();
  });
  document.getElementById('mobSearchBtn')?.addEventListener('click', openSearch);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeSearch(); });

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { results.innerHTML = '<p class="gsearch-hint">Start typing to search across users, tracks, apps, and posts…</p>'; return; }
    const hits = [];
    allUsers.filter(u => (u.name||u.email||'').toLowerCase().includes(q)).slice(0,4).forEach(u =>
      hits.push({ icon:'👤', label: u.name||u.email, sub: u.email, action: () => { closeSearch(); showPage('users'); } })
    );
    allApps.filter(a => (a.name||a.url||'').toLowerCase().includes(q)).slice(0,4).forEach(a =>
      hits.push({ icon:'📱', label: a.name, sub: a.url, action: () => { closeSearch(); showPage('apps'); } })
    );
    allTracks.filter(t => (t.title||t.artist||t.album||'').toLowerCase().includes(q)).slice(0,4).forEach(t =>
      hits.push({ icon:'🎵', label: t.title||'Untitled', sub: `${t.artist||''} ${t.album ? '— '+t.album : ''}`.trim(), action: () => { closeSearch(); showPage('music'); } })
    );
    allPosts.filter(p => (p.title||p.body||'').toLowerCase().includes(q)).slice(0,3).forEach(p =>
      hits.push({ icon:'📄', label: p.title||'(no title)', sub: `${p.status} · ${p.authorName||''}`, action: () => { closeSearch(); showPage('posts'); } })
    );
    allPromos.filter(p => (p.title||'').toLowerCase().includes(q)).slice(0,2).forEach(p =>
      hits.push({ icon:'🎯', label: p.title, sub: `${p.type} · ${p.status}`, action: () => { closeSearch(); showPage('promotions'); } })
    );
    if (!hits.length) { results.innerHTML = '<p class="gsearch-hint">No results found.</p>'; return; }
    results.innerHTML = hits.map((h, i) =>
      `<button class="gsearch-item" data-idx="${i}">${h.icon} <span class="gsearch-item-label">${esc(h.label)}</span><span class="gsearch-item-sub">${esc(h.sub||'')}</span></button>`
    ).join('');
    results.querySelectorAll('.gsearch-item').forEach((btn, i) => btn.addEventListener('click', hits[i].action));
  });

  // Keyboard navigation in results
  input.addEventListener('keydown', e => {
    const items = [...results.querySelectorAll('.gsearch-item')];
    const active = results.querySelector('.gsearch-item.focused');
    const idx = active ? items.indexOf(active) : -1;
    if (e.key === 'ArrowDown') { e.preventDefault(); const next = items[(idx + 1) % items.length]; active?.classList.remove('focused'); next?.classList.add('focused'); next?.scrollIntoView({ block:'nearest' }); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); const prev = items[(idx - 1 + items.length) % items.length]; active?.classList.remove('focused'); prev?.classList.add('focused'); prev?.scrollIntoView({ block:'nearest' }); }
    if (e.key === 'Enter' && active) active.click();
  });
})();

// ── CSV EXPORT ────────────────────────────────────────────
function _downloadCSV(rows, filename) {
  const csv  = rows.map(r => r.map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a    = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
  a.click(); URL.revokeObjectURL(a.href);
}

document.getElementById('exportUsersBtn').addEventListener('click', () => {
  if (!allUsers.length) { toast('No users loaded yet. Open the Users page first.', 'warn'); return; }
  const rows = [['Name','Email','Role','Status','Joined']];
  allUsers.forEach(u => rows.push([
    u.name || '', u.email || '', u.role || '', u.status || '',
    u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString() : ''
  ]));
  _downloadCSV(rows, `hub-users-${new Date().toISOString().slice(0,10)}.csv`);
  toast('📥 Users CSV downloaded!', 'success');
});

document.getElementById('exportTracksBtn').addEventListener('click', () => {
  if (!allTracks.length) { toast('No tracks loaded yet. Open the Music page first.', 'warn'); return; }
  const rows = [['Title','Artist','Album','Duration','Plays','Added']];
  allTracks.forEach(t => rows.push([
    t.title || '', t.artist || '', t.album || '',
    t.duration ? new Date(t.duration * 1000).toISOString().substr(11, 8).replace(/^0+:?/, '') : '',
    t.plays || 0,
    t.addedAt?.toDate ? t.addedAt.toDate().toLocaleDateString() : ''
  ]));
  _downloadCSV(rows, `hub-tracks-${new Date().toISOString().slice(0,10)}.csv`);
  toast('📥 Tracks CSV downloaded!', 'success');
});

// ── ABOUT US ──────────────────────────────────────────────
document.getElementById('saveAboutBtn').addEventListener('click', saveAbout);

async function loadAbout() {
  try {
    const snap = await fb.getDoc(fb.doc(_db, 'hub_settings', 'about'));
    if (!snap.exists()) return;
    const d = snap.data();
    document.getElementById('aboutName').value      = d.name        || '';
    document.getElementById('aboutLogo').value      = d.logo        || '';
    document.getElementById('aboutDesc').value      = d.description || '';
    document.getElementById('aboutEmail').value     = d.email       || '';
    document.getElementById('aboutPhone').value     = d.phone       || '';
    document.getElementById('aboutWebsite').value   = d.website     || '';
    document.getElementById('aboutInstagram').value = d.socials?.instagram || '';
    document.getElementById('aboutTiktok').value    = d.socials?.tiktok    || '';
    document.getElementById('aboutYoutube').value   = d.socials?.youtube   || '';
    document.getElementById('aboutFacebook').value  = d.socials?.facebook  || '';
    document.getElementById('aboutTwitter').value   = d.socials?.twitter   || '';
    document.getElementById('aboutTelegram').value  = d.socials?.telegram  || '';
    _renderAboutPreview(d);
  } catch(e) { console.warn('[About]', e); }
}

async function saveAbout() {
  const btn = document.getElementById('saveAboutBtn');
  btn.textContent = 'Saving…'; btn.disabled = true;
  const data = {
    name:        document.getElementById('aboutName').value.trim(),
    logo:        document.getElementById('aboutLogo').value.trim(),
    description: document.getElementById('aboutDesc').value.trim(),
    email:       document.getElementById('aboutEmail').value.trim(),
    phone:       document.getElementById('aboutPhone').value.trim(),
    website:     document.getElementById('aboutWebsite').value.trim(),
    socials: {
      instagram: document.getElementById('aboutInstagram').value.trim(),
      tiktok:    document.getElementById('aboutTiktok').value.trim(),
      youtube:   document.getElementById('aboutYoutube').value.trim(),
      facebook:  document.getElementById('aboutFacebook').value.trim(),
      twitter:   document.getElementById('aboutTwitter').value.trim(),
      telegram:  document.getElementById('aboutTelegram').value.trim(),
    },
    updatedAt: fb.serverTimestamp(),
  };
  try {
    await fb.setDoc(fb.doc(_db, 'hub_settings', 'about'), data, { merge: true });
    toast('✅ About Us saved! Both apps will now show this info.', 'success');
    logActivity('About Us page updated');
    _renderAboutPreview(data);
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  btn.textContent = '💾 Save Changes'; btn.disabled = false;
}

function _toSocialUrl(handle, domain) {
  if (!handle) return '#';
  if (handle.startsWith('http')) return handle;
  return `https://${domain}/${handle.replace(/^@/, '')}`;
}

function _renderAboutPreview(d) {
  const el = document.getElementById('aboutPreview');
  if (!el) return;
  const s = d.socials || {};
  const socialDefs = [
    [s.instagram, '📸', 'Instagram', 'instagram.com'],
    [s.tiktok,    '🎵', 'TikTok',    'tiktok.com'],
    [s.youtube,   '▶️', 'YouTube',   'youtube.com'],
    [s.facebook,  '👥', 'Facebook',  'facebook.com'],
    [s.twitter,   '🐦', 'Twitter/X', 'x.com'],
    [s.telegram,  '✈️', 'Telegram',  't.me'],
  ].filter(([h]) => h);
  const socialHTML = socialDefs.map(([h, ico, label, domain]) =>
    `<a href="${esc(_toSocialUrl(h, domain))}" target="_blank" class="about-prev-social">${ico} ${label}</a>`
  ).join('');
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:18px;margin-bottom:18px;flex-wrap:wrap">
      ${d.logo
        ? `<img src="${esc(d.logo)}" alt="logo" style="width:72px;height:72px;border-radius:18px;object-fit:cover;border:2px solid var(--border2)"/>`
        : `<div style="width:72px;height:72px;border-radius:18px;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;font-size:2rem">🎵</div>`}
      <div>
        <div style="font-weight:800;font-size:1.15rem">${esc(d.name || 'ERI-FAM')}</div>
        ${d.description ? `<div style="font-size:.84rem;color:var(--text-dim);margin-top:5px;max-width:400px;line-height:1.6">${esc(d.description)}</div>` : ''}
      </div>
    </div>
    ${(d.email || d.phone || d.website) ? `<div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:14px">
      ${d.email   ? `<a href="mailto:${esc(d.email)}"   style="font-size:.82rem;color:var(--accent)">✉️ ${esc(d.email)}</a>` : ''}
      ${d.phone   ? `<a href="tel:${esc(d.phone)}"      style="font-size:.82rem;color:var(--accent)">📞 ${esc(d.phone)}</a>` : ''}
      ${d.website ? `<a href="${esc(d.website)}" target="_blank" style="font-size:.82rem;color:var(--accent)">🌐 Website</a>` : ''}
    </div>` : ''}
    ${socialHTML ? `<div style="display:flex;gap:8px;flex-wrap:wrap">${socialHTML}</div>` : ''}`;
}

// ── ESCAPE KEY — close any open modal ─────────────────────
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  ['appModal','trackModal','promoModal','playlistModal','postModal'].forEach(id => {
    const m = document.getElementById(id);
    if (m && !m.hidden) m.hidden = true;
  });
});

// ── MONETIZE PAGE ─────────────────────────────────────────
let allSponsors  = [];
let allRevenue   = [];
let _bioLinks    = [];

// Wire showPage for monetize
const _origShowPage2 = window.showPage;
window.showPage = function(name) {
  _origShowPage2(name);
  if (name === 'monetize') loadMonetize();
};

document.getElementById('saveMonetizeBtn')?.addEventListener('click', saveMonetizeSettings);

async function loadMonetize() {
  try {
    const snap = await fb.getDoc(fb.doc(_db, 'hub_settings', 'monetize'));
    if (snap.exists()) {
      const d = snap.data();
      const don = d.donation || {};
      document.getElementById('donateEnabled').checked  = don.enabled !== false;
      document.getElementById('donateMessage').value    = don.message   || '';
      document.getElementById('donatePaypal').value     = don.paypal    || '';
      document.getElementById('donateCashapp').value    = don.cashapp   || '';
      document.getElementById('donateVenmo').value      = don.venmo     || '';
      document.getElementById('donateKofi').value       = don.kofi      || '';
      document.getElementById('donatePatreon').value    = don.patreon   || '';
      document.getElementById('donateGofundme').value   = don.gofundme  || '';
      _bioLinks = d.links || [];
      _renderBioLinks();
    }
    await Promise.all([loadSponsors(), loadRevenue()]);
    // Load dashboard revenue total
    _updateRevenueDashStat();
  } catch(e) { console.warn('[Monetize]', e); }
}

async function saveMonetizeSettings() {
  const btn = document.getElementById('saveMonetizeBtn');
  btn.textContent = 'Saving…'; btn.disabled = true;
  const data = {
    donation: {
      enabled:  document.getElementById('donateEnabled').checked,
      message:  document.getElementById('donateMessage').value.trim(),
      paypal:   document.getElementById('donatePaypal').value.trim(),
      cashapp:  document.getElementById('donateCashapp').value.trim(),
      venmo:    document.getElementById('donateVenmo').value.trim(),
      kofi:     document.getElementById('donateKofi').value.trim(),
      patreon:  document.getElementById('donatePatreon').value.trim(),
      gofundme: document.getElementById('donateGofundme').value.trim(),
    },
    links: _bioLinks,
    updatedAt: fb.serverTimestamp(),
  };
  try {
    await fb.setDoc(fb.doc(_db, 'hub_settings', 'monetize'), data, { merge: true });
    toast('✅ Monetize settings saved! Apps updated.', 'success');
    logActivity('Monetize settings updated');
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  btn.textContent = '💾 Save Settings'; btn.disabled = false;
}

// ── SPONSORS ──────────────────────────────────────────────
const sponsorModal = document.getElementById('sponsorModal');
document.getElementById('addSponsorBtn')?.addEventListener('click', () => openSponsorModal());
document.getElementById('sponsorModalClose')?.addEventListener('click',  () => sponsorModal.hidden = true);
document.getElementById('sponsorModalCancel')?.addEventListener('click', () => sponsorModal.hidden = true);
document.getElementById('sponsorModalSave')?.addEventListener('click',   saveSponsor);
sponsorModal?.addEventListener('click', e => { if (e.target === sponsorModal) sponsorModal.hidden = true; });

async function loadSponsors() {
  const grid = document.getElementById('sponsorGrid');
  if (!grid) return;
  try {
    const snap = await fb.getDocs(fb.query(fb.collection(_db, 'hub_sponsors'), fb.orderBy('createdAt', 'desc')));
    allSponsors = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderSponsors();
  } catch(e) {
    grid.innerHTML = '<p class="empty-msg" style="grid-column:1/-1">Error loading sponsors.</p>';
  }
}

function renderSponsors() {
  const grid = document.getElementById('sponsorGrid');
  if (!grid) return;
  if (!allSponsors.length) {
    grid.innerHTML = '<p class="empty-msg" style="grid-column:1/-1">No sponsors yet. Add a sponsor slot to start earning.</p>';
    return;
  }
  grid.innerHTML = allSponsors.map(s => {
    const statusCls = s.status === 'active' ? 'status-active' : 'status-draft';
    const logo = s.logo
      ? `<img src="${esc(s.logo)}" alt="${esc(s.name)}" style="width:48px;height:48px;object-fit:contain;border-radius:10px;border:1px solid var(--border)"/>`
      : `<div style="width:48px;height:48px;border-radius:10px;background:var(--card2);display:flex;align-items:center;justify-content:center;font-size:1.4rem">🤝</div>`;
    return `
      <div class="sponsor-card">
        <div class="sponsor-card-top">
          ${logo}
          <div style="flex:1;min-width:0">
            <div class="sponsor-card-name">${esc(s.name)}</div>
            <div class="sponsor-card-desc">${esc(s.description || '')}</div>
          </div>
          <span class="app-status-pill ${statusCls}">${esc(s.status)}</span>
        </div>
        <div style="font-size:.72rem;color:var(--text-mute);margin:8px 0">Target: ${esc(s.targetApp === 'all' ? 'All Apps' : s.targetApp)}</div>
        <div class="sponsor-card-actions">
          <button class="app-act-edit"   onclick="openSponsorModal('${s.id}')">✏ Edit</button>
          ${s.link ? `<button class="app-act-open" onclick="window.open('${esc(s.link)}','_blank')">↗ Visit</button>` : ''}
          <button class="app-act-delete" onclick="deleteSponsor('${s.id}')">🗑</button>
        </div>
      </div>`;
  }).join('');
}

window.openSponsorModal = function(id) {
  const s = id ? allSponsors.find(x => x.id === id) : null;
  document.getElementById('sponsorModalTitle').textContent = s ? 'Edit Sponsor' : 'New Sponsor';
  document.getElementById('sponsorModalId').value    = s?.id          || '';
  document.getElementById('sponsorName').value       = s?.name        || '';
  document.getElementById('sponsorLogo').value       = s?.logo        || '';
  document.getElementById('sponsorLink').value       = s?.link        || '';
  document.getElementById('sponsorDesc').value       = s?.description || '';
  document.getElementById('sponsorTarget').value     = s?.targetApp   || 'all';
  document.getElementById('sponsorStatus').value     = s?.status      || 'active';
  sponsorModal.hidden = false;
  document.getElementById('sponsorName').focus();
};
function openSponsorModal(id) { window.openSponsorModal(id); }

async function saveSponsor() {
  const id   = document.getElementById('sponsorModalId').value;
  const name = document.getElementById('sponsorName').value.trim();
  const link = document.getElementById('sponsorLink').value.trim();
  if (!name || !link) { toast('Name and link are required.', 'error'); return; }
  const btn = document.getElementById('sponsorModalSave');
  btn.textContent = 'Saving…'; btn.disabled = true;
  const data = {
    name, link,
    logo:        document.getElementById('sponsorLogo').value.trim(),
    description: document.getElementById('sponsorDesc').value.trim(),
    targetApp:   document.getElementById('sponsorTarget').value,
    status:      document.getElementById('sponsorStatus').value,
    updatedAt:   fb.serverTimestamp(),
  };
  try {
    if (id) {
      await fb.updateDoc(fb.doc(_db, 'hub_sponsors', id), data);
    } else {
      data.createdAt = fb.serverTimestamp();
      data.createdBy = currentUser.uid;
      await fb.addDoc(fb.collection(_db, 'hub_sponsors'), data);
      logActivity(`Sponsor "${name}" added`);
    }
    sponsorModal.hidden = true;
    toast(id ? 'Sponsor updated!' : 'Sponsor added!', 'success');
    loadSponsors();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  btn.textContent = 'Save Sponsor'; btn.disabled = false;
}

window.deleteSponsor = async function(id) {
  const s = allSponsors.find(x => x.id === id);
  if (!confirm(`Remove sponsor "${s?.name}"?`)) return;
  try {
    await fb.deleteDoc(fb.doc(_db, 'hub_sponsors', id));
    toast('Sponsor removed.', 'warn');
    logActivity(`Sponsor "${s?.name}" removed`);
    loadSponsors();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
};

// ── REVENUE TRACKER ───────────────────────────────────────
const revenueModal = document.getElementById('revenueModal');
document.getElementById('addRevenueBtn')?.addEventListener('click', () => openRevenueModal());
document.getElementById('revenueModalClose')?.addEventListener('click',  () => revenueModal.hidden = true);
document.getElementById('revenueModalCancel')?.addEventListener('click', () => revenueModal.hidden = true);
document.getElementById('revenueModalSave')?.addEventListener('click',   saveRevenueEntry);
revenueModal?.addEventListener('click', e => { if (e.target === revenueModal) revenueModal.hidden = true; });

async function loadRevenue() {
  const list = document.getElementById('revenueList');
  if (!list) return;
  try {
    const snap = await fb.getDocs(fb.query(fb.collection(_db, 'hub_revenue'), fb.orderBy('createdAt', 'desc'), fb.limit(30)));
    allRevenue = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderRevenue();
    _updateRevenueDashStat();
  } catch(e) {
    list.innerHTML = '<p class="empty-msg">Error loading revenue.</p>';
  }
}

function renderRevenue() {
  const list = document.getElementById('revenueList');
  const totalEl = document.getElementById('revTotal');
  if (!list) return;
  const usdEntries = allRevenue.filter(r => r.currency === 'USD' || !r.currency);
  const total = usdEntries.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  if (totalEl) totalEl.textContent = '$' + total.toFixed(2);
  if (!allRevenue.length) { list.innerHTML = '<p class="empty-msg">No revenue logged yet. Click + Log Payment to add.</p>'; return; }
  list.innerHTML = allRevenue.map(r => {
    const date = r.date ? new Date(r.date).toLocaleDateString() : (r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString() : '');
    const cur  = r.currency || 'USD';
    const sym  = { USD:'$', ETB:'', EUR:'€', GBP:'£' }[cur] || '';
    return `
      <div class="revenue-item">
        <div class="revenue-item-left">
          <div class="revenue-amount">${sym}${parseFloat(r.amount || 0).toFixed(2)} <span class="revenue-currency">${cur}</span></div>
          <div class="revenue-meta">${esc(r.source || 'Other')} ${date ? '· ' + date : ''}</div>
          ${r.note ? `<div class="revenue-note">${esc(r.note)}</div>` : ''}
        </div>
        <button class="revenue-del" onclick="deleteRevenueEntry('${r.id}')">✕</button>
      </div>`;
  }).join('');
}

function _updateRevenueDashStat() {
  const el = document.getElementById('statRevenue');
  if (!el) return;
  const total = allRevenue.filter(r => r.currency === 'USD' || !r.currency)
    .reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  el.textContent = '$' + total.toFixed(0);
}

function openRevenueModal(id) {
  const r = id ? allRevenue.find(x => x.id === id) : null;
  document.getElementById('revenueModalTitle').textContent = r ? 'Edit Entry' : 'Log Payment';
  document.getElementById('revenueModalId').value  = r?.id     || '';
  document.getElementById('revAmount').value       = r?.amount || '';
  document.getElementById('revCurrency').value     = r?.currency || 'USD';
  document.getElementById('revSource').value       = r?.source   || 'PayPal';
  document.getElementById('revDate').value         = r?.date     || new Date().toISOString().slice(0, 10);
  document.getElementById('revNote').value         = r?.note     || '';
  revenueModal.hidden = false;
  document.getElementById('revAmount').focus();
}

async function saveRevenueEntry() {
  const id     = document.getElementById('revenueModalId').value;
  const amount = parseFloat(document.getElementById('revAmount').value);
  if (!amount || amount <= 0) { toast('Enter a valid amount.', 'error'); return; }
  const btn = document.getElementById('revenueModalSave');
  btn.textContent = 'Saving…'; btn.disabled = true;
  const data = {
    amount,
    currency:  document.getElementById('revCurrency').value,
    source:    document.getElementById('revSource').value,
    date:      document.getElementById('revDate').value,
    note:      document.getElementById('revNote').value.trim(),
    createdAt: fb.serverTimestamp(),
  };
  try {
    if (id) {
      await fb.updateDoc(fb.doc(_db, 'hub_revenue', id), data);
    } else {
      data.loggedBy = currentUser.uid;
      await fb.addDoc(fb.collection(_db, 'hub_revenue'), data);
      logActivity(`Revenue logged: $${amount} from ${data.source}`);
    }
    revenueModal.hidden = true;
    toast('Revenue entry saved!', 'success');
    loadRevenue();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  btn.textContent = 'Save Entry'; btn.disabled = false;
}

window.deleteRevenueEntry = async function(id) {
  if (!confirm('Remove this revenue entry?')) return;
  try {
    await fb.deleteDoc(fb.doc(_db, 'hub_revenue', id));
    toast('Entry removed.', 'warn');
    loadRevenue();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
};

// ── BIO LINKS ─────────────────────────────────────────────
const bioLinkModal = document.getElementById('bioLinkModal');
document.getElementById('addBioLinkBtn')?.addEventListener('click', () => openBioLinkModal());
document.getElementById('bioLinkModalClose')?.addEventListener('click',  () => bioLinkModal.hidden = true);
document.getElementById('bioLinkModalCancel')?.addEventListener('click', () => bioLinkModal.hidden = true);
document.getElementById('bioLinkModalSave')?.addEventListener('click',   saveBioLink);
bioLinkModal?.addEventListener('click', e => { if (e.target === bioLinkModal) bioLinkModal.hidden = true; });

function openBioLinkModal(id) {
  const link = id ? _bioLinks.find(l => l.id === id) : null;
  document.getElementById('bioLinkModalTitle').textContent = link ? 'Edit Link' : 'Add Link';
  document.getElementById('bioLinkModalId').value    = link?.id    || '';
  document.getElementById('bioLinkEmoji').value      = link?.emoji || '';
  document.getElementById('bioLinkTitle').value      = link?.title || '';
  document.getElementById('bioLinkUrl').value        = link?.url   || '';
  document.getElementById('bioLinkDesc').value       = link?.desc  || '';
  bioLinkModal.hidden = false;
  document.getElementById('bioLinkTitle').focus();
}

function saveBioLink() {
  const id    = document.getElementById('bioLinkModalId').value;
  const title = document.getElementById('bioLinkTitle').value.trim();
  const url   = document.getElementById('bioLinkUrl').value.trim();
  if (!title || !url) { toast('Title and URL are required.', 'error'); return; }
  const entry = {
    id:    id || Date.now().toString(),
    emoji: document.getElementById('bioLinkEmoji').value.trim() || '🔗',
    title, url,
    desc:  document.getElementById('bioLinkDesc').value.trim(),
  };
  if (id) {
    const idx = _bioLinks.findIndex(l => l.id === id);
    if (idx !== -1) _bioLinks[idx] = entry;
  } else {
    _bioLinks.push(entry);
  }
  _renderBioLinks();
  bioLinkModal.hidden = true;
  toast('Link saved! Click "Save Settings" to publish.', 'success');
}

function _renderBioLinks() {
  const list = document.getElementById('bioLinkList');
  if (!list) return;
  if (!_bioLinks.length) { list.innerHTML = '<p class="empty-msg">No links yet. Add your merch store, booking page, etc.</p>'; return; }
  list.innerHTML = _bioLinks.map(l => `
    <div class="bio-link-item" data-lid="${esc(l.id)}">
      <span class="bio-link-drag">⠿</span>
      <span class="bio-link-emoji">${esc(l.emoji)}</span>
      <div class="bio-link-info">
        <div class="bio-link-title">${esc(l.title)}</div>
        <div class="bio-link-url">${esc(l.url)}</div>
      </div>
      <button class="btn-sm" style="font-size:.72rem" onclick="openBioLinkModal('${esc(l.id)}')">✏</button>
      <button class="btn-sm" style="font-size:.72rem;color:var(--danger)" onclick="deleteBioLink('${esc(l.id)}')">✕</button>
    </div>`).join('');
  _setupBioLinkDrag();
}

window.openBioLinkModal = openBioLinkModal;

window.deleteBioLink = function(id) {
  _bioLinks = _bioLinks.filter(l => l.id !== id);
  _renderBioLinks();
  toast('Link removed. Click Save Settings to publish.', 'warn');
};

function _setupBioLinkDrag() {
  const list  = document.getElementById('bioLinkList');
  const items = list?.querySelectorAll('.bio-link-item');
  if (!items?.length) return;
  let dragId = null;
  items.forEach(item => {
    item.setAttribute('draggable', 'true');
    item.addEventListener('dragstart', () => { dragId = item.dataset.lid; item.style.opacity = '.4'; });
    item.addEventListener('dragend',   () => { item.style.opacity = '1'; dragId = null; });
    item.addEventListener('dragover',  e => { e.preventDefault(); item.classList.add('drag-over'); });
    item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
    item.addEventListener('drop', () => {
      item.classList.remove('drag-over');
      const toId   = item.dataset.lid;
      if (!dragId || dragId === toId) return;
      const fromIdx = _bioLinks.findIndex(l => l.id === dragId);
      const toIdx   = _bioLinks.findIndex(l => l.id === toId);
      const [moved] = _bioLinks.splice(fromIdx, 1);
      _bioLinks.splice(toIdx, 0, moved);
      _renderBioLinks();
    });
  });
}

// ── BULK TRACK EDITOR ─────────────────────────────────────
let _bulkSelected = new Set();
let _selectMode   = false;

document.getElementById('toggleSelectBtn')?.addEventListener('click', () => {
  _selectMode = !_selectMode;
  _bulkSelected.clear();
  document.getElementById('toggleSelectBtn').textContent = _selectMode ? '✕ Cancel' : '☐ Select';
  renderMusicTracks(getFilteredSortedTracks());
  _updateBulkBar();
});

document.getElementById('bulkClearBtn')?.addEventListener('click', () => {
  _bulkSelected.clear();
  _updateBulkBar();
  renderMusicTracks(getFilteredSortedTracks());
});

document.getElementById('bulkApplyBtn')?.addEventListener('click', async () => {
  if (!_bulkSelected.size) return;
  const artist = document.getElementById('bulkArtist').value.trim();
  const album  = document.getElementById('bulkAlbum').value.trim();
  if (!artist && !album) { toast('Enter an artist or album to apply.', 'error'); return; }
  const updates = {};
  if (artist) updates.artist = artist;
  if (album)  updates.album  = album;
  const btn = document.getElementById('bulkApplyBtn');
  btn.textContent = 'Saving…'; btn.disabled = true;
  try {
    await Promise.all([..._bulkSelected].map(id => fb.updateDoc(fb.doc(_db, 'tracks', id), updates)));
    toast(`✓ Updated ${_bulkSelected.size} track${_bulkSelected.size !== 1 ? 's' : ''}!`, 'success');
    logActivity(`Bulk updated ${_bulkSelected.size} track(s) (${Object.keys(updates).join(', ')})`);
    _bulkSelected.clear();
    document.getElementById('bulkArtist').value = '';
    document.getElementById('bulkAlbum').value  = '';
    loadMusic();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  btn.textContent = '✓ Apply'; btn.disabled = false;
});

document.getElementById('bulkDeleteBtn')?.addEventListener('click', async () => {
  if (!_bulkSelected.size) return;
  if (!confirm(`Delete ${_bulkSelected.size} selected track${_bulkSelected.size !== 1 ? 's' : ''}? This cannot be undone.`)) return;
  try {
    await Promise.all([..._bulkSelected].map(id => fb.deleteDoc(fb.doc(_db, 'tracks', id))));
    toast(`🗑 Deleted ${_bulkSelected.size} track${_bulkSelected.size !== 1 ? 's' : ''}`, 'warn');
    logActivity(`Bulk deleted ${_bulkSelected.size} track(s)`);
    _bulkSelected.clear();
    loadMusic();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
});

function _updateBulkBar() {
  const bar = document.getElementById('musicBulkBar');
  const cnt = document.getElementById('musicBulkCount');
  if (!bar) return;
  bar.style.display = (_selectMode && _bulkSelected.size > 0) ? 'flex' : 'none';
  if (cnt) cnt.textContent = `${_bulkSelected.size} selected`;
}

// Override renderMusicTracks to support select mode + inline editing + premium badge
const _origRenderMusicTracks = renderMusicTracks;
window.renderMusicTracks = renderMusicTracks;

// Patch renderMusicTracks to add checkboxes, premium badge, and inline editing
(function patchRenderMusic() {
  const orig = renderMusicTracks;
  renderMusicTracks = function(tracks = allTracks) {
    const list = document.getElementById('musicTrackList');
    if (!tracks.length) {
      list.innerHTML = allTracks.length
        ? '<p class="empty-msg">No tracks match your search.</p>'
        : '<p class="empty-msg">No cloud tracks yet. Upload songs above.</p>';
      return;
    }
    list.innerHTML = tracks.map(t => {
      const cover = t.cover ? `<img src="${esc(t.cover)}" alt=""/>` : '🎵';
      const dur   = t.duration ? fmtDuration(t.duration) : '—';
      const premBadge = t.premium ? '<span class="premium-badge">🔒 Premium</span>' : '';
      const cb    = _selectMode
        ? `<input type="checkbox" class="track-cb" data-id="${t.id}" ${_bulkSelected.has(t.id) ? 'checked' : ''} style="margin-right:4px;cursor:pointer"/>`
        : '';
      return `
        <div class="music-track-row ${_selectMode ? 'select-mode' : ''}" data-track-id="${t.id}">
          ${cb}
          <div class="music-track-cover">${cover}</div>
          <div class="music-track-info">
            <div class="music-track-title" data-field="title" data-id="${t.id}">${esc(t.title || 'Unknown')}</div>
            <div class="music-track-meta">
              <span data-field="artist" data-id="${t.id}">${esc(t.artist || 'Unknown Artist')}</span>${t.album ? ` · <span data-field="album" data-id="${t.id}">${esc(t.album)}</span>` : ''}
              ${premBadge}
            </div>
          </div>
          <div class="music-track-dur">${dur}</div>
          <div class="music-track-actions">
            <button class="music-act-edit" onclick="openTrackModal('${t.id}')">✏ Edit</button>
            <button class="music-act-del"  onclick="deleteTrack('${t.id}')">🗑</button>
          </div>
        </div>`;
    }).join('');

    // Checkboxes
    list.querySelectorAll('.track-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) _bulkSelected.add(cb.dataset.id);
        else _bulkSelected.delete(cb.dataset.id);
        _updateBulkBar();
      });
    });

    // Inline editing — double-click title/artist/album to edit in place
    list.querySelectorAll('[data-field]').forEach(el => {
      el.style.cursor = 'text';
      el.title = 'Double-click to edit';
      el.addEventListener('dblclick', () => {
        const field = el.dataset.field;
        const id    = el.dataset.id;
        const orig  = el.textContent;
        const input = document.createElement('input');
        input.value     = orig;
        input.className = 'inline-track-input';
        el.replaceWith(input);
        input.focus();
        input.select();
        const finish = async (save) => {
          const val = input.value.trim() || orig;
          const span = document.createElement(el.tagName);
          span.className     = el.className;
          span.dataset.field = field;
          span.dataset.id    = id;
          span.textContent   = val;
          input.replaceWith(span);
          span.style.cursor = 'text';
          span.title = 'Double-click to edit';
          span.addEventListener('dblclick', el.ondblclick);
          if (save && val !== orig) {
            try {
              await fb.updateDoc(fb.doc(_db, 'tracks', id), { [field]: val });
              const t = allTracks.find(x => x.id === id);
              if (t) t[field] = val;
              toast(`✓ ${field} updated`, 'success');
            } catch(e) { toast('Save failed: ' + e.message, 'error'); }
          }
        };
        input.addEventListener('blur',    () => finish(true));
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter')  { e.preventDefault(); finish(true); }
          if (e.key === 'Escape') { e.preventDefault(); finish(false); }
        });
      });
    });
  };
  window.renderMusicTracks = renderMusicTracks;
})();

// ── PREMIUM GATING (track modal patch) ────────────────────
const _origOpenTrackModal = window.openTrackModal;
window.openTrackModal = function(id) {
  _origOpenTrackModal(id);
  const t = allTracks.find(x => x.id === id);
  const cb = document.getElementById('trackPremium');
  if (cb) cb.checked = !!(t?.premium);
};

const _origSaveTrack = saveTrack;
async function saveTrack() {
  const id      = document.getElementById('trackModalId').value;
  const title   = document.getElementById('trackTitle').value.trim();
  const artist  = document.getElementById('trackArtist').value.trim();
  const premium = document.getElementById('trackPremium')?.checked || false;
  if (!title || !artist) { toast('Title and artist are required.', 'error'); return; }
  const btn = document.getElementById('trackModalSave');
  btn.textContent = 'Saving…'; btn.disabled = true;
  try {
    await fb.updateDoc(fb.doc(_db, 'tracks', id), {
      title, artist,
      album:   document.getElementById('trackAlbum').value.trim(),
      cover:   document.getElementById('trackCover').value.trim(),
      premium,
    });
    toast('Track updated!', 'success');
    document.getElementById('trackModal').hidden = true;
    loadMusic();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  btn.textContent = 'Save Track'; btn.disabled = false;
}
// Re-wire the save button to the new function
document.getElementById('trackModalSave').onclick = saveTrack;

// ── SCHEDULED POSTS ───────────────────────────────────────
// Show/hide publishAt field based on status selection
document.getElementById('postMStatus')?.addEventListener('change', function() {
  const grp = document.getElementById('postPublishAtGroup');
  if (grp) grp.style.display = this.value === 'scheduled' ? '' : 'none';
});

// Patch openPostModal to populate publishAt
const _origOpenPostModal = window.openPostModal;
window.openPostModal = function(id) {
  _origOpenPostModal(id);
  const p   = id ? allPosts.find(x => x.id === id) : null;
  const grp = document.getElementById('postPublishAtGroup');
  const inp = document.getElementById('postPublishAt');
  const fmt = ts => ts?.toDate ? ts.toDate().toISOString().slice(0,16) : '';
  if (inp) inp.value = fmt(p?.publishAt);
  if (grp) grp.style.display = (p?.status === 'scheduled') ? '' : 'none';
};

// Patch savePost to include publishAt
const _origSavePost = savePost;
async function savePost() {
  const id      = document.getElementById('postModalId').value;
  const title   = document.getElementById('postMTitle').value.trim();
  const body    = document.getElementById('postMBody').value.trim();
  const status  = document.getElementById('postMStatus').value;
  const pubAt   = document.getElementById('postPublishAt')?.value;
  if (!title) { toast('Title is required.', 'error'); return; }
  if (status === 'scheduled' && !pubAt) { toast('Set a Publish At date for scheduled posts.', 'error'); return; }
  const btn  = document.getElementById('postModalSave');
  btn.textContent = 'Saving…'; btn.disabled = true;
  const tags   = document.getElementById('postMTags').value.split(',').map(t => t.trim()).filter(Boolean);
  const data   = {
    title, body,
    imageUrl:   document.getElementById('postMImageUrl').value.trim(),
    tags,
    authorName: document.getElementById('postMAuthor').value.trim() || 'Admin',
    status,
    publishAt:  (status === 'scheduled' && pubAt) ? new Date(pubAt) : null,
    updatedAt:  fb.serverTimestamp(),
  };
  try {
    if (id) {
      if (status === 'approved') data.approvedAt = fb.serverTimestamp();
      await fb.updateDoc(fb.doc(_db, 'community_posts', id), data);
      toast('Post updated!', 'success');
    } else {
      data.source         = 'admin';
      data.submittedAt    = fb.serverTimestamp();
      data.approvedAt     = status === 'approved' ? fb.serverTimestamp() : null;
      data.authorContact  = '';
      await fb.addDoc(fb.collection(_db, 'community_posts'), data);
      logActivity(`Post "${title}" created (${status})`);
      toast('Post saved!', 'success');
    }
    document.getElementById('postModal').hidden = true;
    loadPosts();
    loadPostsBadge();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  btn.textContent = 'Publish Post'; btn.disabled = false;
}
document.getElementById('postModalSave').onclick = savePost;

// Show scheduled posts with clock icon in renderPosts patch
const _origRenderPosts = renderPosts;
renderPosts = function() {
  _origRenderPosts();
  // Add scheduled status color + clock
  document.querySelectorAll('.post-review-card').forEach(card => {
    const statusSpan = card.querySelector('[style*="background"]');
    if (!statusSpan) return;
    const txt = statusSpan.textContent;
    if (txt.includes('scheduled')) {
      card.style.borderLeftColor = '#a855f7';
      statusSpan.style.background = 'rgba(168,85,247,.15)';
      statusSpan.style.color = '#c084fc';
    }
  });
};

// ── PLAYLIST TRACK MANAGER ────────────────────────────────
let _plCurrentTrackIds = [];

document.getElementById('plCoverFile')?.addEventListener('change', async function() {
  const file = this.files[0];
  if (!file) return;
  const preview  = document.getElementById('plCoverPreview');
  const img      = document.getElementById('plCoverPreviewImg');
  const statusEl = document.getElementById('plCoverStatus');
  preview.style.display = 'flex';
  statusEl.textContent  = 'Uploading…';
  img.style.opacity = '0.4';
  try {
    const url = await uploadToCloudinary(file);
    document.getElementById('plCover').value = url;
    img.src = url;
    img.style.opacity = '1';
    statusEl.textContent = 'Uploaded!';
    setTimeout(() => { statusEl.textContent = ''; }, 2000);
  } catch(e) {
    statusEl.textContent = 'Failed: ' + e.message;
    img.style.opacity = '1';
  }
  this.value = '';
});

// Patch openPlaylistModal to include track manager
const _origOpenPlaylistModal = window.openPlaylistModal;
window.openPlaylistModal = function(id) {
  _origOpenPlaylistModal(id);
  const pl = id ? allAdminPlaylists.find(p => p.id === id) : null;
  _plCurrentTrackIds = [...(pl?.trackIds || [])];
  _renderPlTrackOrder();
  // Sync cover preview
  const coverUrl = document.getElementById('plCover').value;
  const preview  = document.getElementById('plCoverPreview');
  const img      = document.getElementById('plCoverPreviewImg');
  if (coverUrl) { preview.style.display = 'flex'; img.src = coverUrl; }
  else          { preview.style.display = 'none'; }
};

document.getElementById('plTrackSearch')?.addEventListener('input', function() {
  const q     = this.value.trim().toLowerCase();
  const res   = document.getElementById('plTrackSearchResults');
  if (!res) return;
  if (!q) { res.hidden = true; return; }
  const hits = allTracks.filter(t =>
    ((t.title||'') + ' ' + (t.artist||'')).toLowerCase().includes(q) &&
    !_plCurrentTrackIds.includes(t.id)
  ).slice(0, 8);
  if (!hits.length) { res.hidden = true; return; }
  res.hidden = false;
  res.innerHTML = hits.map(t =>
    `<div class="pl-search-result" data-id="${t.id}">${esc(t.title)} <span style="color:var(--text-mute);font-size:.75rem">— ${esc(t.artist||'')}</span></div>`
  ).join('');
  res.querySelectorAll('.pl-search-result').forEach(el => {
    el.addEventListener('click', () => {
      _plCurrentTrackIds.push(el.dataset.id);
      document.getElementById('plTrackSearch').value = '';
      res.hidden = true;
      _renderPlTrackOrder();
    });
  });
});

function _renderPlTrackOrder() {
  const container = document.getElementById('plTrackOrder');
  if (!container) return;
  if (!_plCurrentTrackIds.length) {
    container.innerHTML = '<p style="font-size:.78rem;color:var(--text-mute);text-align:center;padding:10px 0">No tracks yet. Search above to add.</p>';
    return;
  }
  container.innerHTML = _plCurrentTrackIds.map((tid, idx) => {
    const t = allTracks.find(x => x.id === tid);
    if (!t) return '';
    return `
      <div class="pl-track-item" draggable="true" data-idx="${idx}" data-id="${tid}">
        <span class="pl-track-drag">⠿</span>
        <span class="pl-track-num">${idx + 1}</span>
        <div class="pl-track-info">
          <div style="font-size:.82rem;font-weight:600">${esc(t.title)}</div>
          <div style="font-size:.72rem;color:var(--text-mute)">${esc(t.artist||'')}</div>
        </div>
        <button class="revenue-del" onclick="_plRemoveTrack(${idx})" style="flex-shrink:0">✕</button>
      </div>`;
  }).filter(Boolean).join('');

  // Drag to reorder
  const items = container.querySelectorAll('.pl-track-item');
  let dragIdx = null;
  items.forEach(item => {
    item.addEventListener('dragstart', () => { dragIdx = +item.dataset.idx; item.style.opacity = '.4'; });
    item.addEventListener('dragend',   () => { item.style.opacity = '1'; dragIdx = null; });
    item.addEventListener('dragover',  e => { e.preventDefault(); item.classList.add('drag-over'); });
    item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
    item.addEventListener('drop', () => {
      item.classList.remove('drag-over');
      const toIdx = +item.dataset.idx;
      if (dragIdx === null || dragIdx === toIdx) return;
      const [moved] = _plCurrentTrackIds.splice(dragIdx, 1);
      _plCurrentTrackIds.splice(toIdx, 0, moved);
      _renderPlTrackOrder();
    });
  });
}

window._plRemoveTrack = function(idx) {
  _plCurrentTrackIds.splice(idx, 1);
  _renderPlTrackOrder();
};

// Patch savePlaylist to include trackIds
const _origSavePlaylist = savePlaylist;
async function savePlaylist() {
  const id   = document.getElementById('playlistModalId').value;
  const name = document.getElementById('plName').value.trim();
  if (!name) { toast('Playlist name is required.', 'error'); return; }
  const btn = document.getElementById('playlistModalSave');
  btn.textContent = 'Saving…'; btn.disabled = true;
  const rawTags = document.getElementById('plTags').value;
  const tags = rawTags.split(',').map(t => t.trim()).filter(Boolean);
  const data = {
    name,
    description: document.getElementById('plDesc').value.trim(),
    cover:       document.getElementById('plCover').value.trim(),
    status:      document.getElementById('plStatus').value,
    tags,
    trackIds:    _plCurrentTrackIds,
    updatedAt:   fb.serverTimestamp(),
  };
  try {
    if (id) {
      await fb.updateDoc(fb.doc(_db, 'hub_playlists', id), data);
    } else {
      data.createdAt = fb.serverTimestamp();
      data.createdBy = currentUser.uid;
      await fb.addDoc(fb.collection(_db, 'hub_playlists'), data);
      logActivity(`Playlist "${name}" created`);
    }
    document.getElementById('playlistModal').hidden = true;
    toast(id ? 'Playlist updated!' : 'Playlist created!', 'success');
    loadPlaylists();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  btn.textContent = 'Save Playlist'; btn.disabled = false;
}
document.getElementById('playlistModalSave').onclick = savePlaylist;

// Add escape key for new modals
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  ['sponsorModal','revenueModal','bioLinkModal'].forEach(id => {
    const m = document.getElementById(id);
    if (m && !m.hidden) m.hidden = true;
  });
});

// ── BOOT ──────────────────────────────────────────────────
bootAuth();

// ── ERITREAN INFO MUSIC WIDGET MANAGEMENT ──────────────────────────
// Manages 'eri_tracks' Firestore collection → feeds Eritrean Info phone widget

let _eriTracks = [];

// File input + upload button wiring
(function initEriMusicUI() {
  const fileInput = document.getElementById('eriMusicFile');
  const fnameEl   = document.getElementById('eriMusicFileName');
  const uploadBtn = document.getElementById('eriMusicUploadBtn');
  if (!fileInput) return;

  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0];
    fnameEl.textContent = f ? f.name : 'No file chosen';
    _validateEriUploadBtn();
  });

  ['eriMusicTitle', 'eriMusicArtist'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', _validateEriUploadBtn);
  });

  function _validateEriUploadBtn() {
    const title  = document.getElementById('eriMusicTitle')?.value.trim();
    const artist = document.getElementById('eriMusicArtist')?.value.trim();
    const file   = document.getElementById('eriMusicFile')?.files[0];
    uploadBtn.disabled = !(title && artist && file);
  }

  uploadBtn.addEventListener('click', handleEriMusicUpload);
})();

async function loadEriMusic() {
  const list = document.getElementById('eriMusicList');
  if (!list) return;
  list.innerHTML = '<p class="empty-msg">Loading…</p>';
  try {
    const snap = await fb.getDocs(
      fb.query(fb.collection(_db, 'eri_tracks'), fb.orderBy('addedAt', 'desc'))
    );
    _eriTracks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    document.getElementById('eriMusicCount').textContent =
      _eriTracks.length + ' song' + (_eriTracks.length !== 1 ? 's' : '');
    renderEriTracks();
  } catch(e) {
    list.innerHTML = `<p class="empty-msg">Error: ${e.message}</p>`;
  }
}

function cleanEriTitle(raw) {
  if (!raw) return 'Unknown';
  let s = String(raw);
  try { s = decodeURIComponent(s.replace(/\+/g, ' ')); } catch(e) {}
  if (s.includes('==')) s = s.split('==')[0].trim();
  s = s.replace(/\.(mp3|m4a|wav|flac|ogg|aac|opus)$/i, '').replace(/_+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return s || 'Unknown';
}

function renderEriTracks() {
  const list = document.getElementById('eriMusicList');
  if (!_eriTracks.length) {
    list.innerHTML = '<p class="empty-msg">No songs yet — upload the first one above.</p>';
    return;
  }
  list.innerHTML = _eriTracks.map((t, i) => {
    const dur = t.duration ? fmtDuration(t.duration) : '—';
    return `
      <div class="music-track-row eri-track-row">
        <div class="music-track-cover">🎵</div>
        <div class="music-track-info">
          <div class="music-track-title">${esc(cleanEriTitle(t.title))}</div>
          <div class="music-track-meta">${esc(t.artist || 'Eritrean Artist')}</div>
        </div>
        <div class="music-track-dur">${dur}</div>
        <div class="music-track-actions">
          <button class="music-act-del" onclick="deleteEriTrack('${t.id}')">🗑 Remove</button>
        </div>
      </div>`;
  }).join('');
}

async function deleteEriTrack(id) {
  if (!confirm('Remove this song from the Eritrean Info music widget?')) return;
  try {
    await fb.deleteDoc(fb.doc(_db, 'eri_tracks', id));
    _eriTracks = _eriTracks.filter(t => t.id !== id);
    document.getElementById('eriMusicCount').textContent =
      _eriTracks.length + ' song' + (_eriTracks.length !== 1 ? 's' : '');
    renderEriTracks();
    toast('Song removed', 'success');
  } catch(e) {
    toast('Delete failed: ' + e.message, 'error');
  }
}

async function handleEriMusicUpload() {
  const title  = document.getElementById('eriMusicTitle').value.trim();
  const artist = document.getElementById('eriMusicArtist').value.trim();
  const file   = document.getElementById('eriMusicFile').files[0];
  if (!title || !artist || !file) return;

  const btn     = document.getElementById('eriMusicUploadBtn');
  const prog    = document.getElementById('eriMusicProgress');
  const bar     = document.getElementById('eriMusicBar');
  const statusEl = document.getElementById('eriMusicStatus');
  const msgEl   = document.getElementById('eriMusicMsg');

  btn.disabled = true;
  prog.hidden  = false;
  msgEl.hidden = true;
  bar.style.width = '0%';
  statusEl.textContent = 'Getting duration…';

  try {
    const duration = await getAudioDuration(file);
    statusEl.textContent = 'Uploading audio…';
    const url = await uploadToCloudinary(file, pct => {
      bar.style.width = Math.round(pct * 100) + '%';
    });
    bar.style.width = '95%';
    statusEl.textContent = 'Saving to database…';
    await fb.addDoc(fb.collection(_db, 'eri_tracks'), {
      title, artist, url, duration,
      addedAt: fb.serverTimestamp(),
      uploadedBy: currentUser?.uid || ''
    });
    bar.style.width = '100%';
    statusEl.textContent = 'Done!';

    // Reset form
    document.getElementById('eriMusicTitle').value  = '';
    document.getElementById('eriMusicArtist').value = '';
    document.getElementById('eriMusicFile').value   = '';
    document.getElementById('eriMusicFileName').textContent = 'No file chosen';

    msgEl.textContent = `✅ "${title}" added to Eritrean Info music widget!`;
    msgEl.style.color = '#22c55e';
    msgEl.hidden = false;
    setTimeout(() => { prog.hidden = true; bar.style.width = '0%'; btn.disabled = true; }, 1500);
    loadEriMusic();
    logActivity?.(`Eri Music: uploaded "${title}" by ${artist}`);
  } catch(e) {
    bar.style.width = '0%';
    prog.hidden = true;
    msgEl.textContent = '❌ Upload failed: ' + e.message;
    msgEl.style.color = '#f87171';
    msgEl.hidden = false;
    btn.disabled = false;
    console.error('[EriMusic]', e);
  }
}
