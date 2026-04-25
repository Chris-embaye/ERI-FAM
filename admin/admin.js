/* ================================================================
   HUB — App Control Center
   Firebase 10.12.2 · ES Modules
   ================================================================ */
'use strict';

// ── Firebase state ────────────────────────────────────────
let _db, _st, _auth, fb = {};
let _fbPromise      = null; // singleton — prevents double-init
let currentUser     = null;
let currentUserData = null;
let currentEditApp  = null;
let allUsers        = [];
let allApps         = [];
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
    const st     = await import(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-storage.js`);
    const au     = await import(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-auth.js`);
    // Use existing app if already initialized (avoids duplicate-app error)
    const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(FIREBASE_CONFIG);
    _db   = fs.getFirestore(app);
    _st   = st.getStorage(app);
    _auth = au.getAuth(app);
    fb    = { ...appMod, ...fs, ...st, ...au };
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
  const ready = await initFB();
  if (!ready) return;
  fb.onAuthStateChanged(_auth, async user => {
    if (!user) {
      document.getElementById('authScreen').hidden = false;
      document.getElementById('hubApp').hidden     = true;
      return;
    }
    currentUser = user;
    // Ensure super admin record exists
    if (user.email.toLowerCase() === SUPER_ADMIN.toLowerCase()) {
      await fb.setDoc(fb.doc(_db, 'hub_users', user.uid), {
        email: user.email,
        name:  user.displayName || 'Admin',
        role:  'super_admin',
        status:'approved',
        createdAt: fb.serverTimestamp(),
        approvedAt: fb.serverTimestamp()
      }, { merge: true });
    }
    const snap = await fb.getDoc(fb.doc(_db, 'hub_users', user.uid));
    if (!snap.exists()) {
      // No record — create pending
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
    }
    if (currentUserData.status !== 'approved') {
      document.getElementById('authScreen').hidden = false;
      document.getElementById('hubApp').hidden     = true;
      switchAuthView('pending');
      return;
    }
    // Approved — show hub
    document.getElementById('authScreen').hidden = true;
    document.getElementById('hubApp').hidden     = false;
    setupUserDisplay();
    loadDashboard();
    loadPendingBadge();
  });
}

function setupUserDisplay() {
  const name = currentUserData.name || currentUser.displayName || currentUser.email;
  document.getElementById('sbUserName').textContent = name;
  document.getElementById('sbUserRole').textContent = currentUserData.role.replace('_', ' ');
  document.getElementById('sbAvatar').textContent   = name.charAt(0).toUpperCase();
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
  if (name === 'apps')     loadApps();
  if (name === 'users')    loadUsers();
  if (name === 'assets')   loadAssets();
  if (name === 'notify')   loadNotifications();
  if (name === 'settings') loadSettings();
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
    const [appsSnap, usersSnap, assetsSnap, notifsSnap] = await Promise.all([
      fb.getDocs(fb.collection(_db, 'hub_apps')),
      fb.getDocs(fb.collection(_db, 'hub_users')),
      fb.getDocs(fb.collection(_db, 'hub_assets')),
      fb.getDocs(fb.collection(_db, 'hub_notifications')),
    ]);
    document.getElementById('statApps').textContent   = appsSnap.size;
    document.getElementById('statUsers').textContent  = usersSnap.docs.filter(d => d.data().status === 'approved').length;
    document.getElementById('statAssets').textContent = assetsSnap.size;
    document.getElementById('statNotifs').textContent = notifsSnap.size;

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
  ['notifyTarget','assetAppFilter'].forEach(id => {
    const sel = document.getElementById(id);
    const first = id === 'notifyTarget' ? '<option value="all">📡 All Apps</option>' : '<option value="">All Apps</option>';
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
            <button class="asset-del"  onclick="deleteAsset('${a.id}','${a.storagePath||''}')">Delete</button>
          </div>
        </div>`;
    }).join('');
  } catch(e) {
    grid.innerHTML = `<p class="empty-msg" style="grid-column:1/-1">Error: ${e.message}</p>`;
  }
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
      const path    = `hub_assets/${appId}/${Date.now()}_${file.name}`;
      const ref     = fb.ref(_st, path);
      const task    = fb.uploadBytesResumable(ref, file);
      await new Promise((res, rej) => {
        task.on('state_changed',
          snap => { bar.style.width = ((i / files.length + snap.bytesTransferred / snap.totalBytes / files.length) * 100) + '%'; },
          rej, res
        );
      });
      const url = await fb.getDownloadURL(ref);
      await fb.addDoc(fb.collection(_db, 'hub_assets'), {
        name: file.name, url, storagePath: path, type: file.type,
        size: file.size, appId,
        uploadedBy: currentUser.uid,
        createdAt: fb.serverTimestamp()
      });
    } catch(e) { toast('Failed: ' + file.name, 'error'); }
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
window.deleteAsset = async function(id, path) {
  if (!confirm('Delete this asset? This cannot be undone.')) return;
  try {
    if (path) await fb.deleteObject(fb.ref(_st, path));
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

// ── BOOT ──────────────────────────────────────────────────
bootAuth();
