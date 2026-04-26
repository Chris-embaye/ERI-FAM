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
  if (name === 'assets')      loadAssets();
  if (name === 'notify')      loadNotifications();
  if (name === 'promotions')  loadPromotions();
  if (name === 'settings')    loadSettings();
  if (name === 'feedback')    loadFeedback();
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
        <div class="app-card-ico">${a.icon || '📱'}</div>
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
  document.getElementById('epName').value   = app.name || '';
  document.getElementById('epDesc').value   = app.description || '';
  document.getElementById('epUrl').value    = app.url || '';
  document.getElementById('epIcon').value   = app.icon || '';
  document.getElementById('epColor').value  = app.color || '#6366f1';
  document.getElementById('epStatus').value = app.status || 'active';
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
    name:        document.getElementById('epName').value.trim()  || currentEditApp.name,
    description: document.getElementById('epDesc').value.trim(),
    url:         document.getElementById('epUrl').value.trim(),
    icon:        document.getElementById('epIcon').value.trim()  || '📱',
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

document.querySelectorAll('.utab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.utab').forEach(b => b.classList.remove('active'));
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
      : '';
    const roleSelect = !isSuper && !isSelf && u.status === 'approved'
      ? `<select class="user-role-select" onchange="updateRole('${u.id}',this.value)">
           <option value="viewer"  ${u.role==='viewer' ?'selected':''}>Viewer</option>
           <option value="editor"  ${u.role==='editor' ?'selected':''}>Editor</option>
           <option value="admin"   ${u.role==='admin'  ?'selected':''}>Admin</option>
         </select>`
      : '';
    return `
      <div class="user-row">
        <div class="user-ava">${initial}</div>
        <div class="user-info">
          <div class="user-name">${esc(u.name||u.email||'Unknown')}${isSelf?' <span style="font-size:.7rem;color:var(--text-mute)">(you)</span>':''}</div>
          <div class="user-email">${esc(u.email||'')}</div>
        </div>
        ${roleSelect}
        <span class="user-badge badge-${u.status}">${u.status}</span>
        <div class="user-actions">${actions}</div>
      </div>`;
  }).join('');
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
  if (sort === 'title')  tracks.sort((a,b) => (a.title||'').localeCompare(b.title||''));
  if (sort === 'artist') tracks.sort((a,b) => (a.artist||'').localeCompare(b.artist||''));
  if (sort === 'oldest') tracks.sort((a,b) => (a.addedAt?.toMillis?.()??0) - (b.addedAt?.toMillis?.()??0));
  return tracks;
}

document.addEventListener('input',  e => { if (e.target.id === 'musicSearch') renderMusicTracks(getFilteredSortedTracks()); });
document.addEventListener('change', e => { if (e.target.id === 'musicSort')   renderMusicTracks(getFilteredSortedTracks()); });

async function loadMusic() {
  const list = document.getElementById('musicTrackList');
  list.innerHTML = '<p class="empty-msg">Loading…</p>';
  try {
    const snap = await fb.getDocs(fb.query(fb.collection(_db, 'tracks'), fb.orderBy('addedAt', 'desc')));
    allTracks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    document.getElementById('musicCount').textContent = allTracks.length + ' track' + (allTracks.length !== 1 ? 's' : '');
    renderMusicTracks();
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

async function loadSettings() {
  try {
    const snap = await fb.getDoc(fb.doc(_db, 'hub_settings', 'global'));
    if (snap.exists()) {
      const s = snap.data();
      document.getElementById('setHubName').value        = s.hubName     || 'HUB';
      document.getElementById('setHubDesc').value        = s.description || '';
      document.getElementById('setAllowReg').checked     = s.allowReg    !== false;
      document.getElementById('setMaintenance').checked  = s.maintenance || false;
    }
    const userSnap = await fb.getDoc(fb.doc(_db, 'hub_users', currentUser.uid));
    if (userSnap.exists()) document.getElementById('setDisplayName').value = userSnap.data().name || '';
  } catch(e) {}
  // Sync profile pic preview
  updateProfilePicPreview(currentUserData?.photoURL || currentUser?.photoURL || '');
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

// ── ANALYTICS ─────────────────────────────────────────────
document.getElementById('refreshAnalyticsBtn').addEventListener('click', loadAnalytics);

async function loadAnalytics() {
  try {
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const [usersSnap, tracksSnap, promosSnap, actSnap] = await Promise.all([
      fb.getDocs(fb.collection(_db, 'hub_users')),
      fb.getDocs(fb.query(fb.collection(_db, 'tracks'), fb.orderBy('plays', 'desc'), fb.limit(10))),
      fb.getDocs(fb.collection(_db, 'hub_promotions')),
      fb.getDocs(fb.query(fb.collection(_db, 'hub_activity'), fb.orderBy('ts', 'desc'), fb.limit(10))),
    ]);

    const users    = usersSnap.docs.map(d => d.data());
    const newUsers = users.filter(u => u.createdAt?.toDate?.() > weekAgo).length;
    const pending  = users.filter(u => u.status === 'pending').length;
    const activePromos = promosSnap.docs.filter(d => d.data().status === 'active').length;

    document.getElementById('anTotalUsers').textContent = users.length;
    document.getElementById('anNewUsers').textContent   = newUsers;
    document.getElementById('anPending').textContent    = pending;
    document.getElementById('anTracks').textContent     = tracksSnap.size;
    document.getElementById('anPromos').textContent     = activePromos;

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
        const time = a.ts?.toDate ? timeAgo(a.ts.toDate()) : '';
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

// ── BOOT ──────────────────────────────────────────────────
bootAuth();
