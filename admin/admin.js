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

const SUPER_ADMIN  = (typeof ADMIN_EMAIL !== 'undefined') ? ADMIN_EMAIL : 'mebrahatom12@gmail.com';
const SUPER_ADMINS = [SUPER_ADMIN, 'embayechris@gmail.com'];
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
    const [appMod, fs, au] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-firestore.js`),
      import(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-auth.js`),
    ]);
    // Use existing app if already initialized (avoids duplicate-app error)
    const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(FIREBASE_CONFIG);
    _db   = fs.getFirestore(app);
    _auth = au.getAuth(app);
    fb    = { ...appMod, ...fs, ...au };
    // Expose on window so T-series tweaks can access them
    window._db = _db;
    window.fb  = fb;
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
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
}
function hideAuthError(id) { const el = document.getElementById(id); if (el) el.hidden = true; }

async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPass').value;
  if (!email || !pass) { showAuthError('loginError', 'Enter email and password.'); return; }

  // ── Kill code bypass ──────────────────────────────────────
  if (pass === '5455' || localStorage.getItem('erifam_master') === '1') {
    localStorage.setItem('erifam_master', '1');
    _enterMasterMode();
    return;
  }

  hideAuthError('loginError');
  const btn = document.getElementById('loginBtn');
  btn.textContent = 'Signing in…'; btn.disabled = true;
  const ready = await initFB();
  if (!ready) { btn.textContent = 'Sign In'; btn.disabled = false; return; }
  try {
    await fb.signInWithEmailAndPassword(_auth, email, pass);
    // Keep button in loading state — onAuthStateChanged will show the hub or an error
    btn.textContent = 'Loading…';
  } catch(e) {
    showAuthError('loginError', friendlyAuthError(e.code));
    btn.textContent = 'Sign In'; btn.disabled = false;
  }
}

async function _enterMasterMode() {
  // Synthetic master user — bypasses Firebase auth, uses master credentials
  currentUser = { uid: 'master_5455', email: SUPER_ADMIN, displayName: 'Master Admin', isMasterBypass: true };
  currentUserData = { status: 'approved', role: 'super_admin', email: SUPER_ADMIN, name: 'Master Admin' };
  window.currentUser = currentUser;

  // Init Firebase in background so data-loading functions still work
  await initFB().catch(() => {});

  document.getElementById('authScreen').hidden = true;
  document.getElementById('hubApp').hidden      = false;

  try { setupUserDisplay(); } catch(e) {}
  try { loadDashboard(); } catch(e) {}
  try { loadPendingBadge(); } catch(e) {}
  try { loadPostsBadge(); } catch(e) {}

  // Visual confirmation toast
  const toast = document.createElement('div');
  toast.textContent = '🔓 Master bypass active — full access';
  toast.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);background:#00ff88;color:#000;padding:10px 24px;border-radius:10px;font-weight:800;z-index:9999;box-shadow:0 4px 24px rgba(0,255,136,0.5);letter-spacing:0.5px;white-space:nowrap';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
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
    const isSuperAdmin = SUPER_ADMINS.includes(email.toLowerCase());
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
  try { if (_auth) await fb.signOut(_auth); } catch(e) { console.warn('[HUB] signOut error:', e); }
  document.getElementById('hubApp').hidden  = true;
  document.getElementById('authScreen').hidden = false;
  switchAuthView('login');
  currentUser = null; currentUserData = null;
  window.currentUser = null;
}

function friendlyAuthError(code) {
  const map = {
    'auth/user-not-found':             'No account found with this email.',
    'auth/wrong-password':             'Incorrect password.',
    'auth/invalid-credential':         'Incorrect email or password.',
    'auth/invalid-login-credentials':  'Incorrect email or password.',
    'auth/email-already-in-use':       'An account already exists with this email.',
    'auth/weak-password':              'Password must be at least 6 characters.',
    'auth/invalid-email':              'Please enter a valid email address.',
    'auth/too-many-requests':          'Too many attempts. Try again later.',
    'auth/network-request-failed':     'Network error — check your connection.',
    'auth/user-disabled':              'This account has been disabled.',
    'auth/unauthorized-domain':        'Sign-in not allowed from this domain.',
    'auth/operation-not-allowed':      'Email sign-in is not enabled.',
  };
  return map[code] || `Sign-in failed (${code || 'unknown'}). Please try again.`;
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
      window.currentUser = user;

      const isSuperAdmin = SUPER_ADMINS.includes(user.email.toLowerCase());

      // Super admin: grant access immediately without depending on Firestore
      if (isSuperAdmin) {
        console.log('[HUB] C.E.O — granting access directly');
        currentUserData = {
          email: user.email,
          name:  user.displayName || 'Admin',
          role:  'super_admin',
          status:'approved'
        };
        // Write/update Firestore record in background (best-effort, don't block login)
        fb.setDoc(fb.doc(_db, 'hub_users', user.uid), {
          email: user.email,
          name:  user.displayName || 'Admin',
          role:  'super_admin',
          status:'approved',
          createdAt: fb.serverTimestamp(),
          approvedAt: fb.serverTimestamp()
        }, { merge: true }).catch(e => console.warn('[HUB] Super admin record write failed (non-critical):', e));
      } else {
        // Non-super-admin: check Firestore record
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
          const btn = document.getElementById('loginBtn');
          if (btn) { btn.textContent = 'Sign In'; btn.disabled = false; }
          return;
        }
      }

      console.log('[HUB] Access granted, loading hub');
      document.getElementById('authScreen').hidden = true;
      document.getElementById('hubApp').hidden     = false;
      const btn = document.getElementById('loginBtn');
      if (btn) { btn.textContent = 'Sign In'; btn.disabled = false; }
      setupUserDisplay();
      loadDashboard();
      loadPendingBadge();
      loadPostsBadge();
    } catch(err) {
      console.error('[HUB] Auth state error:', err);
      showAuthError('loginError', 'Error loading your account: ' + err.message);
      document.getElementById('authScreen').hidden = false;
      document.getElementById('hubApp').hidden     = true;
      const btn = document.getElementById('loginBtn');
      if (btn) { btn.textContent = 'Sign In'; btn.disabled = false; }
    }
  });
}

const ROLE_LABELS = { super_admin: 'C.E.O', admin: 'Admin', editor: 'Editor', viewer: 'Viewer' };

function setupUserDisplay() {
  const name     = currentUserData.name || currentUser.displayName || currentUser.email;
  const photoURL = currentUserData.photoURL || currentUser.photoURL || '';
  const nameEl = document.getElementById('sbUserName');
  const roleEl = document.getElementById('sbUserRole');
  const avatarEl = document.getElementById('sbAvatar');
  if (nameEl) nameEl.textContent = name;
  if (roleEl) roleEl.textContent = ROLE_LABELS[currentUserData.role] || currentUserData.role.replace('_', ' ');
  if (avatarEl) {
    if (photoURL) {
      avatarEl.innerHTML = `<img src="${photoURL}" alt="${esc(name)}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit"/>`;
    } else {
      avatarEl.innerHTML = '';
      avatarEl.textContent = name.charAt(0).toUpperCase();
    }
  }
}

// ── Navigation ────────────────────────────────────────────
document.querySelectorAll('.sb-item[data-page]').forEach(btn => {
  btn.addEventListener('click', () => {
    showPage(btn.dataset.page);
    document.getElementById('mobTitle').textContent = btn.querySelector('span')?.textContent?.trim() || btn.dataset.page;
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

  // Scroll each page back to top when activated
  if (page) page.scrollTop = 0;

  // Page progress bar animation
  const bar = document.getElementById('pageProgress');
  if (bar) {
    bar.className = 'page-progress running';
    clearTimeout(bar._t);
    bar._t = setTimeout(() => {
      bar.className = 'page-progress done';
      bar._t = setTimeout(() => { bar.className = 'page-progress hide'; }, 250);
    }, 300);
  }

  // Update mobile title
  const titleEl = document.getElementById('mobTitle');
  if (titleEl && btn) titleEl.textContent = btn.querySelector('span')?.textContent?.trim() || name;
  // Lazy-load page data
  if (name === 'apps')        loadApps();
  if (name === 'users')       loadUsers();
  if (name === 'music')       loadMusic();
  if (name === 'erimusic')    loadEriMusic();
  if (name === 'ericontent')  loadEriContent();
  if (name === 'newsletter')  loadNewsletter();
  if (name === 'versions')    loadVersions();
  if (name === 'coupons')     loadCoupons();
  if (name === 'storage')     loadStorage();
  if (name === 'seo')         loadSeo();
  if (name === 'auditlog')    loadAuditLog();
  if (name === 'truck-log')   loadTruckLog();
  if (name === 'playlists')   loadPlaylists();
  if (name === 'assets')      loadAssets();
  if (name === 'notify')      loadNotifications();
  if (name === 'promotions')  loadPromotions();
  if (name === 'settings')    loadSettings();
  if (name === 'feedback')    loadFeedback();
  if (name === 'posts')       loadPosts();
  if (name === 'about')       loadAbout();
  if (name === 'analytics')   loadAnalytics();
  if (name === 'employees')   loadEmployees();
  if (name === 'riglog')      initRiglogPage();
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
    const [appsSnap, usersSnap, assetsSnap, notifsSnap, tracksSnap, nlSnap, fbSnap] = await Promise.all([
      fb.getDocs(fb.collection(_db, 'hub_apps')),
      fb.getDocs(fb.collection(_db, 'hub_users')),
      fb.getDocs(fb.collection(_db, 'hub_assets')),
      fb.getDocs(fb.collection(_db, 'hub_notifications')),
      fb.getDocs(fb.collection(_db, 'tracks')),
      fb.getDocs(fb.collection(_db, 'eri_newsletter')),
      fb.getDocs(fb.collection(_db, 'feedback')),
    ]);
    countUp(document.getElementById('statApps'),   appsSnap.size);
    countUp(document.getElementById('statUsers'),  usersSnap.docs.filter(d => d.data().status === 'approved').length);
    countUp(document.getElementById('statAssets'), assetsSnap.size);
    countUp(document.getElementById('statNotifs'), notifsSnap.size);
    countUp(document.getElementById('statTracks'), tracksSnap.size);
    const nlEl = document.getElementById('dashNlCount');
    const fbEl = document.getElementById('dashFbCount');
    if (nlEl) countUp(nlEl, nlSnap.size);
    if (fbEl) countUp(fbEl, fbSnap.size);

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

const DEFAULT_APPS = [
  { name: 'ERI-FAM Hub',   icon: '⬡',  color: '#6366f1', url: 'https://eritreaninfo.com',        category: 'Portal', status: 'active', description: 'Main app hub & portal' },
  { name: 'Eritrean Info', icon: '📰', color: '#10b981', url: 'https://eritreaninfo.com',        category: 'Info',   status: 'active', description: 'Eritrean news and information' },
  { name: 'RigLog',        icon: '🚚', color: '#f59e0b', url: 'https://trucklogapp.com',         category: 'App',    status: 'active', description: 'Truck driver log and pay tracker' },
  { name: 'HUB Admin',     icon: '🛠', color: '#8b5cf6', url: 'https://admin.eritreaninfo.com',  category: 'System', status: 'active', description: 'This admin control panel' },
];

async function seedDefaultApps() {
  try {
    for (let i = 0; i < DEFAULT_APPS.length; i++) {
      await fb.addDoc(fb.collection(_db, 'hub_apps'), {
        ...DEFAULT_APPS[i],
        order: i,
        sections: [],
        createdAt: fb.serverTimestamp(),
        updatedAt: fb.serverTimestamp(),
      });
    }
    logActivity('Default apps seeded on first load');
  } catch(e) {
    console.warn('[HUB] seedDefaultApps failed:', e.message);
  }
}

async function loadApps() {
  const grid = document.getElementById('appGrid');
  grid.innerHTML = '<p class="empty-msg" style="grid-column:1/-1">Loading…</p>';
  try {
    const snap = await fb.getDocs(fb.query(fb.collection(_db, 'hub_apps'), fb.orderBy('createdAt','desc')));
    allApps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!allApps.length) {
      await seedDefaultApps();
      const snap2 = await fb.getDocs(fb.query(fb.collection(_db, 'hub_apps'), fb.orderBy('createdAt','desc')));
      allApps = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    renderApps(allApps);
    populateAppSelects(allApps);
  } catch(e) {
    grid.innerHTML = `<p class="empty-msg" style="grid-column:1/-1">Error loading apps: ${e.message}</p>`;
  }
}

let _dragSrcIdx = null;

window.appDragStart = function(e) {
  _dragSrcIdx = +e.currentTarget.dataset.idx;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
};
window.appDragOver = function(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.app-card').forEach(c => c.classList.remove('drag-over'));
  e.currentTarget.classList.add('drag-over');
};
window.appDrop = function(e) {
  e.preventDefault();
  const destIdx = +e.currentTarget.dataset.idx;
  if (_dragSrcIdx === null || _dragSrcIdx === destIdx) return;
  const moved = allApps.splice(_dragSrcIdx, 1)[0];
  allApps.splice(destIdx, 0, moved);
  renderApps(allApps);
  saveAppOrder();
};
window.appDragEnd = function(e) {
  document.querySelectorAll('.app-card').forEach(c => { c.classList.remove('dragging'); c.classList.remove('drag-over'); });
  _dragSrcIdx = null;
};

async function saveAppOrder() {
  try {
    const batch = fb.writeBatch(_db);
    allApps.forEach((a, i) => batch.update(fb.doc(_db, 'hub_apps', a.id), { order: i }));
    await batch.commit();
  } catch(e) { console.warn('[HUB] Order save failed:', e); }
}

function renderApps(apps) {
  const grid = document.getElementById('appGrid');
  if (!apps.length) { grid.innerHTML = '<p class="empty-msg" style="grid-column:1/-1">No apps yet. Click + New App to get started.</p>'; return; }
  grid.innerHTML = apps.map((a, i) => `
    <div class="app-card" draggable="true" data-id="${a.id}" data-idx="${i}"
         ondragstart="appDragStart(event)" ondragover="appDragOver(event)"
         ondrop="appDrop(event)" ondragend="appDragEnd(event)">
      <div class="app-card-top" style="background:linear-gradient(135deg,${a.color||'#6366f1'}33,${a.color||'#6366f1'}11)">
        <div class="app-card-ico">${a.iconUrl ? `<img src="${esc(a.iconUrl)}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit" onerror="this.parentElement.textContent='📱'"/>` : (a.icon || '📱')}</div>
        <span class="app-status-pill status-${a.status||'active'}">${a.status||'active'}</span>
        <div class="app-drag-handle" title="Drag to reorder">⠿</div>
      </div>
      <div class="app-card-body app-card-click" onclick="openAppModal('${a.id}')">
        <div class="app-card-name">${esc(a.name)}</div>
        <div class="app-card-desc">${esc(a.description||'')}</div>
        <div class="app-card-url">${esc(a.url||'')}</div>
        <div style="font-size:.72rem;color:var(--text-mute)">${esc(a.category||'')}</div>
        <div class="app-card-hint">Click to edit</div>
      </div>
      <div class="app-card-actions">
        <button class="app-act-edit"   onclick="event.stopPropagation();openAppModal('${a.id}')">✏ Edit</button>
        <button class="app-act-edit"   onclick="event.stopPropagation();openEditor('${a.id}')">🖊 Builder</button>
        <button class="app-act-open"   onclick="event.stopPropagation();window.open('${esc(a.url||'')}','_blank')">↗ Open</button>
        <button class="app-act-delete" onclick="event.stopPropagation();deleteApp('${a.id}')">🗑</button>
      </div>
    </div>`).join('');
}

function populateAppSelects(apps) {
  ['notifyTarget','promoTarget','sponsorTarget'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '<option value="all">📡 All Apps</option>' +
      apps.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('');
  });
  const assetSel = document.getElementById('assetAppFilter');
  if (assetSel) {
    assetSel.innerHTML = '<option value="">All Apps</option>' +
      apps.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('');
  }
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
window.deleteApp = deleteApp;

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
  document.getElementById('epName').value        = app.name || '';
  document.getElementById('epDesc').value        = app.description || '';
  document.getElementById('epUrl').value         = app.url || '';
  document.getElementById('epIcon').value        = app.icon || '';
  document.getElementById('epIconUrl').value     = app.iconUrl || '';
  document.getElementById('epColor').value       = app.color || '#6366f1';
  document.getElementById('epStatus').value      = app.status || 'active';
  document.getElementById('epCategory').value    = app.category || '';
  document.getElementById('epVersion').value     = app.version || '';
  document.getElementById('epPlatform').value    = app.platform || 'web';
  document.getElementById('epGithub').value      = app.github || '';
  document.getElementById('epStack').value       = (app.stack || []).join(', ');
  document.getElementById('epTags').value        = (app.tags || []).join(', ');
  document.getElementById('epScreenshots').value = (app.screenshots || []).join('\n');
  document.getElementById('epChangelog').value   = app.changelog || '';
  // Reset to Info tab
  document.querySelectorAll('.ep-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.ep-pane').forEach(p => p.classList.remove('active'));
  document.querySelector('.ep-tab[data-tab="info"]')?.classList.add('active');
  document.getElementById('epPane-info')?.classList.add('active');
  const frame = document.getElementById('editorFrame');
  document.getElementById('chromeUrl').textContent = app.url || 'about:blank';
  frame.src = app.url || 'about:blank';
  renderSections(app.sections || []);
  showPage('editor');
}

function renderSections(sections) {
  const list = document.getElementById('sectionsEditor');
  if (!sections.length) { list.innerHTML = '<p style="font-size:.78rem;color:var(--text-mute);text-align:center;padding:14px 0">No sections yet — add one below.</p>'; return; }
  list.innerHTML = sections.map((s,i) => `
    <div class="section-item ${s.visible===false?'sect-hidden':''}" draggable="true" data-idx="${i}">
      <button class="sect-drag" title="Drag to reorder">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="18" x2="16" y2="18"/></svg>
      </button>
      <div class="sect-info">
        <span class="section-name">${esc(s.name)}</span>
        <span class="sect-id-badge">#${esc(s.id||'')}</span>
      </div>
      <div class="sect-actions">
        <button class="sect-btn sect-vis-btn ${s.visible!==false?'active':''}" onclick="toggleSection(${i})" title="${s.visible!==false?'Visible — click to hide':'Hidden — click to show'}">
          ${s.visible!==false
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'}
        </button>
        <button class="sect-btn sect-del-btn" onclick="deleteSection(${i})" title="Delete section">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
    </div>`).join('');
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
  sects[idx] = { ...sects[idx], visible: sects[idx].visible !== false ? false : true };
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
    category:    document.getElementById('epCategory').value,
    version:     document.getElementById('epVersion').value.trim(),
    platform:    document.getElementById('epPlatform').value,
    github:      document.getElementById('epGithub').value.trim(),
    stack:       document.getElementById('epStack').value.split(',').map(s=>s.trim()).filter(Boolean),
    tags:        document.getElementById('epTags').value.split(',').map(s=>s.trim()).filter(Boolean),
    screenshots: document.getElementById('epScreenshots').value.split('\n').map(s=>s.trim()).filter(Boolean),
    changelog:   document.getElementById('epChangelog').value.trim(),
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
    window.allUsers = allUsers;
    renderUsers(allUsers, activeUserTab);
    // Update pending count
    const pending = allUsers.filter(u => u.status === 'pending').length;
    const badge  = document.getElementById('pendingBadge');
    const tabCnt = document.getElementById('pendingTabCount');
    if (badge) { badge.textContent = pending; badge.hidden = pending === 0; }
    if (tabCnt) tabCnt.textContent = pending;
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
      <div class="user-row" data-uid="${u.id}">
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
window.renderUsers = renderUsers;

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
    if (badge) { badge.textContent = count; badge.hidden = count === 0; }
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
document.getElementById('trackModalSave').onclick = () => saveTrack();
trackModal.addEventListener('click', e => { if (e.target === trackModal) trackModal.hidden = true; });

document.getElementById('trackCoverFile').addEventListener('change', async function() {
  const file = this.files[0];
  if (!file) return;
  const preview  = document.getElementById('trackCoverPreview');
  const img      = document.getElementById('trackCoverPreviewImg');
  const statusEl = document.getElementById('trackCoverStatus');
  if (preview)  preview.style.display = 'flex';
  if (statusEl) statusEl.textContent  = 'Uploading…';
  if (img)      img.style.opacity     = '0.4';
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
  const preset = (typeof CLOUDINARY_PRESET !== 'undefined') ? CLOUDINARY_PRESET : '';
  const cloud  = (typeof CLOUDINARY_CLOUD  !== 'undefined') ? CLOUDINARY_CLOUD  : '';
  if (!preset || !cloud) {
    throw new Error('Cloudinary is not configured. Add CLOUDINARY_PRESET and CLOUDINARY_CLOUD to firebase-config.js.');
  }
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', preset);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloud}/auto/upload`);
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
window.loadFeedback = loadFeedback;

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
  if (progWrap) progWrap.hidden    = false;
  if (bar)      bar.style.width   = '0%';
  if (status)   status.textContent = 'Uploading…';

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
window.logActivity = logActivity;

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
document.getElementById('playlistModalSave').onclick = () => savePlaylist();
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
        <div class="an-bar-label">${ROLE_LABELS[r] || r.replace('_',' ')}</div>
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

// ── THEME SYSTEM (dark/light mode + accent colors) ───────────────
(function initThemeSystem() {
  const mode   = localStorage.getItem('hub_theme')  || 'dark';
  const accent = localStorage.getItem('hub_accent') || 'nebula';

  document.body.setAttribute('data-theme', mode);
  if (accent !== 'nebula') document.body.setAttribute('data-accent', accent);

  function applyMode(m) {
    document.body.setAttribute('data-theme', m);
    localStorage.setItem('hub_theme', m);
    syncModeButtons(m);
  }
  function applyAccent(a) {
    if (a === 'nebula') document.body.removeAttribute('data-accent');
    else document.body.setAttribute('data-accent', a);
    localStorage.setItem('hub_accent', a);
    syncSwatches(a);
  }
  function syncModeButtons(m) {
    document.querySelectorAll('#tpDarkBtn,#tpLightBtn').forEach(b => b.classList.remove('active'));
    const active = m === 'dark' ? document.getElementById('tpDarkBtn') : document.getElementById('tpLightBtn');
    if (active) active.classList.add('active');
  }
  function syncSwatches(a) {
    document.querySelectorAll('.tp-swatch').forEach(s => s.classList.toggle('active', s.dataset.accent === a));
  }

  // Dark mode btn (sidebar user area)
  const darkBtn = document.getElementById('darkModeBtn');
  if (darkBtn) {
    darkBtn.addEventListener('click', () => {
      const next = (document.body.getAttribute('data-theme') || 'dark') === 'dark' ? 'light' : 'dark';
      applyMode(next);
    });
  }

  // Theme picker btn (sidebar top)
  const pickerBtn = document.getElementById('themePickerBtn');
  const picker    = document.getElementById('themePicker');
  if (pickerBtn && picker) {
    pickerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const hidden = picker.hidden;
      picker.hidden = !hidden;
      pickerBtn.classList.toggle('active', !hidden ? false : true);
      if (!hidden) {
        pickerBtn.classList.remove('active');
      }
    });
    document.addEventListener('click', (e) => {
      if (!picker.hidden && !picker.contains(e.target) && e.target !== pickerBtn) {
        picker.hidden = true;
        pickerBtn.classList.remove('active');
      }
    });

    document.querySelectorAll('.tp-swatch').forEach(btn => {
      btn.addEventListener('click', () => applyAccent(btn.dataset.accent));
    });
    document.getElementById('tpDarkBtn')?.addEventListener('click', () => applyMode('dark'));
    document.getElementById('tpLightBtn')?.addEventListener('click', () => applyMode('light'));
  }

  syncModeButtons(mode);
  syncSwatches(accent);
})();

// ── COLLAPSIBLE CARDS ─────────────────────────────────────────────
window.toggleCard = function(id) {
  document.getElementById(id)?.classList.toggle('collapsed');
};

// ── COUNT-UP ANIMATION ────────────────────────────────────────────
function countUp(el, target, duration = 700) {
  if (!el || isNaN(target)) { if (el) el.textContent = target; return; }
  const start = parseInt(el.textContent) || 0;
  const startT = performance.now();
  function step(now) {
    const p = Math.min((now - startT) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(start + (target - start) * eased);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ── FLOATING SCROLL-TO-TOP ────────────────────────────────────────
(function initScrollTopBtn() {
  const btn  = document.getElementById('scrollTopBtn');
  const main = document.getElementById('hubMain');
  if (!btn || !main) return;
  btn.hidden = false;
  main.addEventListener('scroll', () => {
    btn.classList.toggle('visible', main.scrollTop > 280);
  }, { passive: true });
  btn.addEventListener('click', () => main.scrollTo({ top: 0, behavior: 'smooth' }));
})();

// ── LIVE SIDEBAR CLOCK ────────────────────────────────────────────
(function initSidebarClock() {
  const timeEl = document.getElementById('sbClockTime');
  const dateEl = document.getElementById('sbClockDate');
  if (!timeEl || !dateEl) return;
  function tick() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2,'0');
    const m = String(now.getMinutes()).padStart(2,'0');
    timeEl.textContent = `${h}:${m}`;
    dateEl.textContent = now.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
  }
  tick();
  setInterval(tick, 10000);
})();

// Expose showPage on window (analytics is already called inside showPage)
window.showPage = showPage;

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
document.getElementById('postModalSave').onclick = () => savePost();
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
  if (preview)  preview.style.display = 'block';
  if (statusEl) statusEl.textContent  = 'Uploading…';
  if (img)      img.style.opacity     = '0.4';
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
    window.allPosts = allPosts;
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
  ['appModal','trackModal','promoModal','playlistModal','postModal','inviteModal','sectionModal'].forEach(id => {
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
    renderRevenueChart(allRevenue);
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
  };
  try {
    if (id) {
      await fb.updateDoc(fb.doc(_db, 'hub_revenue', id), data);
    } else {
      data.createdAt = fb.serverTimestamp();
      data.loggedBy  = currentUser.uid;
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
saveTrack = async function saveTrack() {
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
// trackModalSave onclick already set above; patched saveTrack is now live

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
savePost = async function savePost() {
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
// postModalSave onclick already set above; patched savePost is now live

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
  if (preview)  preview.style.display = 'flex';
  if (statusEl) statusEl.textContent  = 'Uploading…';
  if (img)      img.style.opacity     = '0.4';
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
savePlaylist = async function savePlaylist() {
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
// playlistModalSave onclick already set above; patched savePlaylist is now live

// Add escape key for new modals
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  ['sponsorModal','revenueModal','bioLinkModal'].forEach(id => {
    const m = document.getElementById(id);
    if (m && !m.hidden) m.hidden = true;
  });
});

// ── BOOT ──────────────────────────────────────────────────
// If master bypass was previously activated, skip auth entirely
if (localStorage.getItem('erifam_master') === '1') {
  _enterMasterMode();
} else {
  bootAuth();
}

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
window.deleteEriTrack = deleteEriTrack;

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

// ══════════════════════════════════════════════════════════════
// FEATURE 1 — ERITREAN INFO CONTENT MANAGER
// ══════════════════════════════════════════════════════════════
let _ecActiveTab = 'news';

(function initEriContent() {
  document.querySelectorAll('.ec-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ec-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.ec-panel').forEach(p => { p.hidden = true; p.classList.remove('active'); });
      btn.classList.add('active');
      _ecActiveTab = btn.dataset.ectab;
      const panel = document.getElementById('ecpanel-' + _ecActiveTab);
      if (panel) { panel.hidden = false; panel.classList.add('active'); }
    });
  });

  document.getElementById('eriContentAddBtn').addEventListener('click', () => {
    if (_ecActiveTab === 'news')    { document.getElementById('ecNewsForm').hidden    = false; document.getElementById('ecNewsTitle').focus(); }
    if (_ecActiveTab === 'blog')    { document.getElementById('ecBlogForm').hidden    = false; document.getElementById('ecBlogTitle').focus(); }
    if (_ecActiveTab === 'gallery') { document.getElementById('ecGalleryForm').hidden = false; document.getElementById('ecGalleryUrl').focus(); }
  });

  // News form
  document.getElementById('ecNewsCancelBtn').addEventListener('click', () => { document.getElementById('ecNewsForm').hidden = true; resetEcNewsForm(); });
  document.getElementById('ecNewsSaveBtn').addEventListener('click',   saveEcNews);
  // Blog form
  document.getElementById('ecBlogCancelBtn').addEventListener('click', () => { document.getElementById('ecBlogForm').hidden = true; resetEcBlogForm(); });
  document.getElementById('ecBlogSaveBtn').addEventListener('click',   saveEcBlog);
  // Gallery form
  document.getElementById('ecGalleryCancelBtn').addEventListener('click', () => { document.getElementById('ecGalleryForm').hidden = true; });
  document.getElementById('ecGallerySaveBtn').addEventListener('click',   saveEcGallery);
})();

function resetEcNewsForm() { ['ecNewsId','ecNewsTitle','ecNewsSummary','ecNewsImage','ecNewsSource'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; }); }
function resetEcBlogForm() { ['ecBlogId','ecBlogTitle','ecBlogContent','ecBlogAuthor','ecBlogImage'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; }); }

async function loadEriContent() {
  loadEcNews();
  loadEcBlog();
  loadEcGallery();
}

async function loadEcNews() {
  const list = document.getElementById('ecNewsList');
  list.innerHTML = '<p class="empty-msg">Loading…</p>';
  try {
    const snap = await fb.getDocs(fb.query(fb.collection(_db, 'eri_news'), fb.orderBy('publishedAt', 'desc'), fb.limit(50)));
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!items.length) { list.innerHTML = '<p class="empty-msg">No news articles yet. Click + Add Item.</p>'; return; }
    list.innerHTML = items.map(n => `
      <div class="ec-item">
        ${n.imageUrl ? `<img class="ec-item-img" src="${esc(n.imageUrl)}" alt="" onerror="this.style.display='none'"/>` : ''}
        <div class="ec-item-body">
          <div class="ec-item-title">${esc(n.title || '')}</div>
          <div class="ec-item-meta"><span class="ec-tag">${esc(n.category || 'General')}</span>${n.source ? ' · ' + esc(n.source) : ''}</div>
          <div class="ec-item-summary">${esc((n.summary || '').slice(0, 120))}${(n.summary || '').length > 120 ? '…' : ''}</div>
        </div>
        <div class="ec-item-actions">
          <button class="btn-sm" onclick="editEcNews('${n.id}')">✏ Edit</button>
          <button class="btn-danger ec-del-btn" onclick="deleteEcNews('${n.id}')">🗑</button>
        </div>
      </div>`).join('');
  } catch(e) { list.innerHTML = `<p class="empty-msg">Error: ${e.message}</p>`; }
}

async function saveEcNews() {
  const id      = document.getElementById('ecNewsId').value;
  const title   = document.getElementById('ecNewsTitle').value.trim();
  if (!title) { toast('Headline is required.', 'error'); return; }
  const btn = document.getElementById('ecNewsSaveBtn');
  btn.textContent = 'Saving…'; btn.disabled = true;
  const data = {
    title, category: document.getElementById('ecNewsCategory').value,
    summary: document.getElementById('ecNewsSummary').value.trim(),
    imageUrl: document.getElementById('ecNewsImage').value.trim(),
    source: document.getElementById('ecNewsSource').value.trim(),
    status: 'published',
    updatedAt: fb.serverTimestamp()
  };
  try {
    if (id) { await fb.updateDoc(fb.doc(_db, 'eri_news', id), data); toast('News updated!', 'success'); }
    else { data.publishedAt = fb.serverTimestamp(); await fb.addDoc(fb.collection(_db, 'eri_news'), data); toast('News published!', 'success'); logAudit('Published news: ' + title); }
    document.getElementById('ecNewsForm').hidden = true;
    resetEcNewsForm();
    loadEcNews();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  btn.textContent = 'Publish'; btn.disabled = false;
}

window.editEcNews = async function(id) {
  const d = await fb.getDoc(fb.doc(_db, 'eri_news', id));
  if (!d.exists()) return;
  const n = d.data();
  document.getElementById('ecNewsId').value       = id;
  document.getElementById('ecNewsTitle').value    = n.title || '';
  document.getElementById('ecNewsCategory').value = n.category || 'General';
  document.getElementById('ecNewsSummary').value  = n.summary || '';
  document.getElementById('ecNewsImage').value    = n.imageUrl || '';
  document.getElementById('ecNewsSource').value   = n.source || '';
  document.getElementById('ecNewsForm').hidden    = false;
  document.getElementById('ecNewsTitle').focus();
};

window.deleteEcNews = async function(id) {
  if (!confirm('Delete this news article?')) return;
  await fb.deleteDoc(fb.doc(_db, 'eri_news', id));
  toast('Deleted.', 'success');
  loadEcNews();
};

async function loadEcBlog() {
  const list = document.getElementById('ecBlogList');
  list.innerHTML = '<p class="empty-msg">Loading…</p>';
  try {
    const snap = await fb.getDocs(fb.query(fb.collection(_db, 'eri_articles'), fb.orderBy('publishedAt', 'desc'), fb.limit(50)));
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!items.length) { list.innerHTML = '<p class="empty-msg">No blog articles yet.</p>'; return; }
    list.innerHTML = items.map(a => `
      <div class="ec-item">
        ${a.imageUrl ? `<img class="ec-item-img" src="${esc(a.imageUrl)}" alt="" onerror="this.style.display='none'"/>` : ''}
        <div class="ec-item-body">
          <div class="ec-item-title">${esc(a.title || '')}</div>
          <div class="ec-item-meta"><span class="ec-tag">${esc(a.category || 'General')}</span> · ${esc(a.author || 'Admin')}</div>
          <div class="ec-item-summary">${esc((a.content || '').slice(0, 120))}${(a.content || '').length > 120 ? '…' : ''}</div>
        </div>
        <div class="ec-item-actions">
          <button class="btn-sm" onclick="editEcBlog('${a.id}')">✏ Edit</button>
          <button class="btn-danger ec-del-btn" onclick="deleteEcBlog('${a.id}')">🗑</button>
        </div>
      </div>`).join('');
  } catch(e) { list.innerHTML = `<p class="empty-msg">Error: ${e.message}</p>`; }
}

async function saveEcBlog() {
  const id    = document.getElementById('ecBlogId').value;
  const title = document.getElementById('ecBlogTitle').value.trim();
  const content = document.getElementById('ecBlogContent').value.trim();
  if (!title || !content) { toast('Title and content are required.', 'error'); return; }
  const btn = document.getElementById('ecBlogSaveBtn');
  btn.textContent = 'Saving…'; btn.disabled = true;
  const data = {
    title, content, category: document.getElementById('ecBlogCategory').value,
    author: document.getElementById('ecBlogAuthor').value.trim() || 'Admin',
    imageUrl: document.getElementById('ecBlogImage').value.trim(),
    status: 'published',
    updatedAt: fb.serverTimestamp()
  };
  try {
    if (id) { await fb.updateDoc(fb.doc(_db, 'eri_articles', id), data); toast('Article updated!', 'success'); }
    else { data.publishedAt = fb.serverTimestamp(); await fb.addDoc(fb.collection(_db, 'eri_articles'), data); toast('Article published!', 'success'); logAudit('Published blog: ' + title); }
    document.getElementById('ecBlogForm').hidden = true;
    resetEcBlogForm();
    loadEcBlog();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  btn.textContent = 'Publish'; btn.disabled = false;
}

window.editEcBlog = async function(id) {
  const d = await fb.getDoc(fb.doc(_db, 'eri_articles', id));
  if (!d.exists()) return;
  const a = d.data();
  document.getElementById('ecBlogId').value       = id;
  document.getElementById('ecBlogTitle').value    = a.title || '';
  document.getElementById('ecBlogCategory').value = a.category || 'General';
  document.getElementById('ecBlogContent').value  = a.content || '';
  document.getElementById('ecBlogAuthor').value   = a.author || '';
  document.getElementById('ecBlogImage').value    = a.imageUrl || '';
  document.getElementById('ecBlogForm').hidden    = false;
};
window.deleteEcBlog = async function(id) {
  if (!confirm('Delete this article?')) return;
  await fb.deleteDoc(fb.doc(_db, 'eri_articles', id));
  toast('Deleted.', 'success'); loadEcBlog();
};

async function loadEcGallery() {
  const grid = document.getElementById('ecGalleryGrid');
  grid.innerHTML = '<p class="empty-msg">Loading…</p>';
  try {
    const snap = await fb.getDocs(fb.query(fb.collection(_db, 'eri_gallery'), fb.orderBy('addedAt', 'desc'), fb.limit(60)));
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!items.length) { grid.innerHTML = '<p class="empty-msg">No gallery photos yet.</p>'; return; }
    grid.innerHTML = `<div class="ec-gallery-wrap">${items.map(g => `
      <div class="ec-gallery-card">
        <img src="${esc(g.imageUrl || '')}" alt="${esc(g.caption || '')}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect fill=%22%23222%22 width=%22100%25%22 height=%22100%25%22/><text x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%23666%22>🖼</text></svg>'"/>
        <div class="ec-gallery-cap">${esc(g.caption || '')}</div>
        <button class="ec-gallery-del" onclick="deleteEcGallery('${g.id}')">🗑</button>
      </div>`).join('')}</div>`;
  } catch(e) { grid.innerHTML = `<p class="empty-msg">Error: ${e.message}</p>`; }
}

async function saveEcGallery() {
  const url = document.getElementById('ecGalleryUrl').value.trim();
  if (!url) { toast('Image URL is required.', 'error'); return; }
  const btn = document.getElementById('ecGallerySaveBtn');
  btn.textContent = 'Saving…'; btn.disabled = true;
  try {
    await fb.addDoc(fb.collection(_db, 'eri_gallery'), {
      imageUrl: url,
      caption: document.getElementById('ecGalleryCaption').value.trim(),
      category: document.getElementById('ecGalleryCategory').value,
      location: document.getElementById('ecGalleryLocation').value.trim(),
      status: 'active',
      addedAt: fb.serverTimestamp()
    });
    toast('Photo added to gallery!', 'success');
    document.getElementById('ecGalleryForm').hidden = true;
    document.getElementById('ecGalleryUrl').value = '';
    document.getElementById('ecGalleryCaption').value = '';
    document.getElementById('ecGalleryLocation').value = '';
    loadEcGallery();
    logAudit('Added gallery photo');
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  btn.textContent = 'Add Photo'; btn.disabled = false;
}

window.deleteEcGallery = async function(id) {
  if (!confirm('Remove this photo?')) return;
  await fb.deleteDoc(fb.doc(_db, 'eri_gallery', id));
  toast('Removed.', 'success'); loadEcGallery();
};

// ══════════════════════════════════════════════════════════════
// FEATURE 2 — NEWSLETTER MANAGER
// ══════════════════════════════════════════════════════════════
let _nlSubscribers = [];

document.getElementById('refreshNewsletterBtn').addEventListener('click', loadNewsletter);
document.getElementById('exportNewsletterBtn').addEventListener('click', exportNewsletter);

async function loadNewsletter() {
  const list = document.getElementById('nlList');
  list.innerHTML = '<p class="empty-msg">Loading…</p>';
  try {
    const snap = await fb.getDocs(fb.query(fb.collection(_db, 'eri_newsletter'), fb.orderBy('subscribedAt', 'desc')));
    _nlSubscribers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const now = new Date();
    const weekAgo  = new Date(now - 7  * 864e5);
    const monthAgo = new Date(now - 30 * 864e5);
    document.getElementById('nlStatTotal').textContent = _nlSubscribers.length;
    document.getElementById('nlStatWeek').textContent  = _nlSubscribers.filter(s => s.subscribedAt?.toDate?.() >= weekAgo).length;
    document.getElementById('nlStatMonth').textContent = _nlSubscribers.filter(s => s.subscribedAt?.toDate?.() >= monthAgo).length;
    // Badge
    const badge = document.getElementById('newsletterBadge');
    if (badge) { badge.textContent = _nlSubscribers.length; badge.hidden = _nlSubscribers.length === 0; }
    if (!_nlSubscribers.length) { list.innerHTML = '<p class="empty-msg">No subscribers yet.</p>'; return; }
    list.innerHTML = _nlSubscribers.map((s, i) => `
      <div class="user-row">
        <div class="user-avatar" style="background:linear-gradient(135deg,#10b981,#059669)">${(s.email || '?')[0].toUpperCase()}</div>
        <div class="user-info">
          <div class="user-name">${esc(s.email || '')}</div>
          <div class="user-meta">${s.subscribedAt?.toDate ? s.subscribedAt.toDate().toLocaleDateString() : '—'} · ${esc(s.source || 'website')}</div>
        </div>
        <div class="user-actions">
          <button class="btn-danger" style="padding:5px 10px;font-size:.75rem" onclick="deleteNlSubscriber('${s.id}')">🗑 Remove</button>
        </div>
      </div>`).join('');
  } catch(e) { list.innerHTML = `<p class="empty-msg">Error: ${e.message}</p>`; }
}

window.deleteNlSubscriber = async function(id) {
  if (!confirm('Remove this subscriber?')) return;
  await fb.deleteDoc(fb.doc(_db, 'eri_newsletter', id));
  toast('Subscriber removed.', 'success');
  loadNewsletter();
};

function exportNewsletter() {
  if (!_nlSubscribers.length) { toast('No subscribers to export.', 'error'); return; }
  const rows = [['Email', 'Subscribed At', 'Source'], ..._nlSubscribers.map(s => [s.email || '', s.subscribedAt?.toDate ? s.subscribedAt.toDate().toISOString() : '', s.source || ''])];
  downloadCsv(rows, 'newsletter_subscribers.csv');
  logAudit('Exported newsletter subscribers CSV');
}

// ══════════════════════════════════════════════════════════════
// FEATURE 3 — REVENUE CHART (inject into Monetize page)
// ══════════════════════════════════════════════════════════════
function renderRevenueChart(entries) {
  const container = document.getElementById('revChartWrap');
  if (!container) return;
  if (!entries || !entries.length) { container.innerHTML = '<p class="empty-msg" style="font-size:.8rem">No entries to chart yet.</p>'; return; }
  const byMonth = {};
  entries.forEach(e => {
    const d   = e.date?.toDate ? e.date.toDate() : new Date(e.date || e.createdAt);
    const key = isNaN(d) ? 'Unknown' : d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    byMonth[key] = (byMonth[key] || 0) + (parseFloat(e.amount) || 0);
  });
  const labels = Object.keys(byMonth).slice(-12);
  const values = labels.map(l => byMonth[l]);
  const maxVal = Math.max(...values, 1);
  const bars = labels.map((l, i) => {
    const pct = Math.round((values[i] / maxVal) * 100);
    return `<div class="rev-chart-col">
      <div class="rev-chart-val">$${values[i].toFixed(0)}</div>
      <div class="rev-chart-bar-wrap"><div class="rev-chart-bar" style="height:${pct}%"></div></div>
      <div class="rev-chart-lbl">${l}</div>
    </div>`;
  }).join('');
  container.innerHTML = `<div class="rev-chart">${bars}</div>`;
}

// Hook into existing loadMonetize to also render the chart
const _origLoadMonetize = loadMonetize;
// We'll inject the chart container after revenue list in the Monetize page
(function injectRevenueChartContainer() {
  const revCard = document.querySelector('#page-monetize .card');
  if (revCard) {
    const wrap = document.createElement('div');
    wrap.id = 'revChartWrap';
    wrap.style.cssText = 'margin-top:16px;min-height:60px';
    // Insert before the revenue list
    const revList = document.getElementById('revenueList');
    if (revList) revList.parentNode.insertBefore(wrap, revList);
  }
})();

// ══════════════════════════════════════════════════════════════
// FEATURE 4 — CONTENT MODERATION (enhance Posts — add "Reports" tab)
// Already handled by the existing Posts page approve/reject flow.
// Adding a logAudit call on approvals.
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
// FEATURE 5 — NOTIFICATION SCHEDULER (already wired, add scheduled list)
// The existing Notifications page already stores status:'scheduled'.
// Already handled. No new page needed.
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
// FEATURE 6 — APP VERSION MANAGER
// ══════════════════════════════════════════════════════════════
let _versionApps = [];

async function loadVersions() {
  const grid = document.getElementById('versionsGrid');
  grid.innerHTML = '<p class="empty-msg">Loading apps…</p>';
  try {
    const [appsSnap, versSnap] = await Promise.all([
      fb.getDocs(fb.collection(_db, 'hub_apps')),
      fb.getDocs(fb.collection(_db, 'hub_versions'))
    ]);
    _versionApps = appsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const versions = {};
    versSnap.docs.forEach(d => { versions[d.id] = d.data(); });
    if (!_versionApps.length) { grid.innerHTML = '<p class="empty-msg">No apps found. Add apps in My Apps first.</p>'; return; }
    grid.innerHTML = _versionApps.map(a => {
      const v = versions[a.id] || {};
      return `
      <div class="card version-card" data-appid="${a.id}">
        <div class="version-card-hd">
          <div class="version-app-ico">${a.icon || '📱'}</div>
          <div><div class="version-app-name">${esc(a.name)}</div><div class="version-app-url">${esc(a.url || '')}</div></div>
        </div>
        <div class="form-row2">
          <div class="form-group"><label>Current Version</label><input type="text" class="form-input ver-current" placeholder="1.0.0" value="${esc(v.current || '')}"/></div>
          <div class="form-group"><label>Min Required</label><input type="text" class="form-input ver-min" placeholder="1.0.0" value="${esc(v.minRequired || '')}"/></div>
        </div>
        <div class="form-group"><label>Release Notes</label><textarea class="form-textarea ver-notes" rows="2" placeholder="What's new in this version…">${esc(v.notes || '')}</textarea></div>
        <label class="toggle-row">
          <span>Force Update</span>
          <label class="switch"><input type="checkbox" class="ver-force" ${v.forceUpdate ? 'checked' : ''}/><span class="slider"></span></label>
        </label>
      </div>`;
    }).join('');
  } catch(e) { grid.innerHTML = `<p class="empty-msg">Error: ${e.message}</p>`; }
}

document.getElementById('saveAllVersionsBtn').addEventListener('click', async () => {
  const btn = document.getElementById('saveAllVersionsBtn');
  btn.textContent = 'Saving…'; btn.disabled = true;
  try {
    const cards = document.querySelectorAll('.version-card[data-appid]');
    const saves = [...cards].map(card => {
      const id    = card.dataset.appid;
      const data  = {
        current:     card.querySelector('.ver-current')?.value.trim() || '',
        minRequired: card.querySelector('.ver-min')?.value.trim()     || '',
        notes:       card.querySelector('.ver-notes')?.value.trim()   || '',
        forceUpdate: card.querySelector('.ver-force')?.checked        ?? false,
        updatedAt:   fb.serverTimestamp()
      };
      return fb.setDoc(fb.doc(_db, 'hub_versions', id), data, { merge: true });
    });
    await Promise.all(saves);
    toast('All versions saved!', 'success');
    logAudit('Saved app versions');
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  btn.textContent = '💾 Save All'; btn.disabled = false;
});

// ══════════════════════════════════════════════════════════════
// FEATURE 7 — COUPON CODES
// ══════════════════════════════════════════════════════════════
let _coupons = [];

document.getElementById('addCouponBtn').addEventListener('click', () => {
  document.getElementById('couponForm').hidden = false;
  document.getElementById('couponCode').focus();
});
document.getElementById('couponCancelBtn').addEventListener('click', () => {
  document.getElementById('couponForm').hidden = true;
  ['couponCode','couponDiscount','couponMaxUses','couponExpiry','couponNote'].forEach(id => { document.getElementById(id).value = ''; });
});
document.getElementById('couponSaveBtn').addEventListener('click', saveCoupon);
document.getElementById('couponCode').addEventListener('input', function() { this.value = this.value.toUpperCase(); });

async function loadCoupons() {
  const list = document.getElementById('couponList');
  list.innerHTML = '<p class="empty-msg">Loading…</p>';
  try {
    const snap = await fb.getDocs(fb.query(fb.collection(_db, 'hub_coupons'), fb.orderBy('createdAt', 'desc')));
    _coupons = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!_coupons.length) { list.innerHTML = '<p class="empty-msg">No coupons yet.</p>'; return; }
    const now = new Date();
    list.innerHTML = `<div class="coupon-grid">${_coupons.map(c => {
      const expired = c.expiresAt ? new Date(c.expiresAt) < now : false;
      const usePct  = c.maxUses ? Math.round(((c.usedCount || 0) / c.maxUses) * 100) : 0;
      return `
        <div class="coupon-card ${expired ? 'coupon-expired' : ''}">
          <div class="coupon-code">${esc(c.code)}</div>
          <div class="coupon-discount">${c.discount}${c.type === 'percent' ? '%' : '$'} OFF</div>
          ${c.note ? `<div class="coupon-note">${esc(c.note)}</div>` : ''}
          <div class="coupon-meta">
            ${c.maxUses ? `Uses: ${c.usedCount || 0} / ${c.maxUses}` : 'Unlimited'}
            ${c.expiresAt ? ` · Expires: ${new Date(c.expiresAt).toLocaleDateString()}` : ''}
            ${expired ? ' · <span style="color:#f87171">EXPIRED</span>' : ''}
          </div>
          ${c.maxUses ? `<div class="coupon-bar-wrap"><div class="coupon-bar" style="width:${usePct}%"></div></div>` : ''}
          <div class="coupon-actions">
            <button class="btn-sm" onclick="copyCoupon('${esc(c.code)}')">📋 Copy</button>
            <button class="btn-danger" style="padding:5px 10px;font-size:.75rem" onclick="deleteCoupon('${c.id}')">🗑</button>
          </div>
        </div>`;
    }).join('')}</div>`;
  } catch(e) { list.innerHTML = `<p class="empty-msg">Error: ${e.message}</p>`; }
}

async function saveCoupon() {
  const code     = document.getElementById('couponCode').value.trim().toUpperCase();
  const discount = parseFloat(document.getElementById('couponDiscount').value);
  if (!code || !discount) { toast('Code and discount are required.', 'error'); return; }
  const btn = document.getElementById('couponSaveBtn');
  btn.textContent = 'Creating…'; btn.disabled = true;
  try {
    const expiry = document.getElementById('couponExpiry').value;
    await fb.addDoc(fb.collection(_db, 'hub_coupons'), {
      code, discount, type: document.getElementById('couponType').value,
      maxUses: parseInt(document.getElementById('couponMaxUses').value) || null,
      note: document.getElementById('couponNote').value.trim(),
      expiresAt: expiry || null,
      usedCount: 0,
      createdAt: fb.serverTimestamp(),
      createdBy: currentUser?.uid || ''
    });
    toast(`Coupon ${code} created!`, 'success');
    document.getElementById('couponForm').hidden = true;
    ['couponCode','couponDiscount','couponMaxUses','couponExpiry','couponNote'].forEach(id => { document.getElementById(id).value = ''; });
    logAudit(`Created coupon: ${code}`);
    loadCoupons();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  btn.textContent = 'Create Coupon'; btn.disabled = false;
}

window.deleteCoupon = async function(id) {
  if (!confirm('Delete this coupon?')) return;
  await fb.deleteDoc(fb.doc(_db, 'hub_coupons', id));
  toast('Coupon deleted.', 'success'); loadCoupons();
};
window.copyCoupon = function(code) {
  navigator.clipboard?.writeText(code).then(() => toast(`Copied: ${code}`, 'success')).catch(() => toast(code, 'success'));
};

// ══════════════════════════════════════════════════════════════
// FEATURE 8 — STORAGE MONITOR
// ══════════════════════════════════════════════════════════════
const STORAGE_COLLECTIONS = [
  { id: 'tracks',           label: 'ERI-FAM Music Tracks',     icon: '🎵' },
  { id: 'eri_tracks',       label: 'Eritrean Info Music',       icon: '🇪🇷' },
  { id: 'eri_news',         label: 'Eritrean Info News',        icon: '📰' },
  { id: 'eri_articles',     label: 'Eritrean Info Blog',        icon: '✍️' },
  { id: 'eri_gallery',      label: 'Eritrean Info Gallery',     icon: '🖼' },
  { id: 'eri_newsletter',   label: 'Newsletter Subscribers',    icon: '📧' },
  { id: 'hub_apps',         label: 'Apps',                      icon: '📱' },
  { id: 'hub_users',        label: 'Admin Users',               icon: '👥' },
  { id: 'hub_assets',       label: 'Assets',                    icon: '📂' },
  { id: 'hub_notifications',label: 'Notifications',             icon: '🔔' },
  { id: 'hub_coupons',      label: 'Coupon Codes',              icon: '🎫' },
  { id: 'community_posts',  label: 'Community Posts',           icon: '📝' },
  { id: 'hub_activity',     label: 'Activity Log',              icon: '📋' },
  { id: 'hub_audit',        label: 'Audit Log',                 icon: '🔍' },
];

document.getElementById('refreshStorageBtn').addEventListener('click', loadStorage);

async function loadStorage() {
  const tableEl = document.getElementById('storageCollections');
  const statRow = document.getElementById('storageStatRow');
  tableEl.innerHTML = '<p class="empty-msg">Loading collection stats…</p>';
  statRow.innerHTML = '';
  try {
    const counts = await Promise.all(STORAGE_COLLECTIONS.map(async c => {
      try {
        const snap = await fb.getDocs(fb.collection(_db, c.id));
        return { ...c, count: snap.size };
      } catch(e) { return { ...c, count: '—' }; }
    }));
    const total = counts.reduce((s, c) => s + (typeof c.count === 'number' ? c.count : 0), 0);
    statRow.innerHTML = `
      <div class="stat-card" style="--accent:#6366f1"><div class="stat-ico">🗄</div><div class="stat-body"><div class="stat-num">${total.toLocaleString()}</div><div class="stat-lbl">Total Documents</div></div></div>
      <div class="stat-card" style="--accent:#10b981"><div class="stat-ico">📁</div><div class="stat-body"><div class="stat-num">${STORAGE_COLLECTIONS.length}</div><div class="stat-lbl">Collections</div></div></div>
    `;
    tableEl.innerHTML = `<table class="storage-tbl">
      <thead><tr><th>Collection</th><th>Documents</th><th>Status</th></tr></thead>
      <tbody>${counts.map(c => `
        <tr>
          <td><span style="margin-right:8px">${c.icon}</span>${esc(c.label)}<span style="color:var(--text-dim);font-size:.7rem;margin-left:6px">${c.id}</span></td>
          <td><strong>${typeof c.count === 'number' ? c.count.toLocaleString() : c.count}</strong></td>
          <td><span class="app-status-pill ${typeof c.count === 'number' && c.count > 0 ? 'status-active' : 'status-draft'}">${typeof c.count === 'number' && c.count > 0 ? 'has data' : 'empty'}</span></td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  } catch(e) { tableEl.innerHTML = `<p class="empty-msg">Error: ${e.message}</p>`; }
}

// ══════════════════════════════════════════════════════════════
// FEATURE 9 — SEO MANAGER
// ══════════════════════════════════════════════════════════════
(function initSeoManager() {
  const fields = [
    { id: 'seoTitle',    maxIdeal: 60,  previewId: 'seoPreviewTitle', countId: 'seoTitleCount' },
    { id: 'seoDesc',     maxIdeal: 160, previewId: 'seoPreviewDesc',  countId: 'seoDescCount'  }
  ];
  fields.forEach(f => {
    const el = document.getElementById(f.id);
    if (!el) return;
    el.addEventListener('input', () => {
      const len = el.value.length;
      const countEl = document.getElementById(f.countId);
      if (countEl) { countEl.textContent = `${len} / ${f.maxIdeal}`; countEl.style.color = len > f.maxIdeal ? '#f87171' : len > f.maxIdeal * 0.8 ? '#f59e0b' : '#10b981'; }
      const prevEl = document.getElementById(f.previewId);
      if (prevEl) prevEl.textContent = el.value || (f.previewId.includes('Title') ? 'Page Title' : 'Description…');
    });
  });
  document.getElementById('saveSeoBtn')?.addEventListener('click', saveSeo);
})();

async function loadSeo() {
  try {
    const snap = await fb.getDoc(fb.doc(_db, 'eri_seo', 'main'));
    if (!snap.exists()) return;
    const s = snap.data();
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    set('seoTitle', s.title); set('seoDesc', s.description); set('seoKeywords', s.keywords);
    set('seoOgTitle', s.ogTitle); set('seoOgDesc', s.ogDescription); set('seoOgImage', s.ogImage);
    if (s.twitterCard) { const el = document.getElementById('seoTwitterCard'); if (el) el.value = s.twitterCard; }
    // Update preview
    ['seoTitle','seoDesc'].forEach(id => document.getElementById(id)?.dispatchEvent(new Event('input')));
  } catch(e) { console.warn('[SEO]', e); }
}

async function saveSeo() {
  const btn = document.getElementById('saveSeoBtn');
  btn.textContent = 'Saving…'; btn.disabled = true;
  try {
    await fb.setDoc(fb.doc(_db, 'eri_seo', 'main'), {
      title:         document.getElementById('seoTitle').value.trim(),
      description:   document.getElementById('seoDesc').value.trim(),
      keywords:      document.getElementById('seoKeywords').value.trim(),
      ogTitle:       document.getElementById('seoOgTitle').value.trim(),
      ogDescription: document.getElementById('seoOgDesc').value.trim(),
      ogImage:       document.getElementById('seoOgImage').value.trim(),
      twitterCard:   document.getElementById('seoTwitterCard').value,
      updatedAt:     fb.serverTimestamp()
    }, { merge: true });
    toast('SEO settings saved!', 'success');
    logAudit('Updated SEO metadata');
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  btn.textContent = '💾 Save Changes'; btn.disabled = false;
}

// ══════════════════════════════════════════════════════════════
// FEATURE 10 — AUDIT LOG
// ══════════════════════════════════════════════════════════════
let _auditEntries = [];

document.getElementById('refreshAuditBtn').addEventListener('click', loadAuditLog);
document.getElementById('exportAuditBtn').addEventListener('click',  exportAuditLog);
document.getElementById('auditSearch').addEventListener('input', function() {
  const q = this.value.toLowerCase();
  renderAuditLog(_auditEntries.filter(e => (e.action || '').toLowerCase().includes(q) || (e.adminEmail || '').toLowerCase().includes(q)));
});

async function loadAuditLog() {
  const list = document.getElementById('auditList');
  list.innerHTML = '<p class="empty-msg">Loading…</p>';
  try {
    const snap = await fb.getDocs(fb.query(fb.collection(_db, 'hub_audit'), fb.orderBy('createdAt', 'desc'), fb.limit(200)));
    _auditEntries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayCount  = _auditEntries.filter(e => e.createdAt?.toDate?.() >= today).length;
    const admins      = new Set(_auditEntries.map(e => e.adminEmail).filter(Boolean)).size;
    document.getElementById('auditStatTotal').textContent  = _auditEntries.length;
    document.getElementById('auditStatToday').textContent  = todayCount;
    document.getElementById('auditStatAdmins').textContent = admins;
    renderAuditLog(_auditEntries);
  } catch(e) { list.innerHTML = `<p class="empty-msg">Error: ${e.message}</p>`; }
}

function renderAuditLog(entries) {
  const list = document.getElementById('auditList');
  if (!entries.length) { list.innerHTML = '<p class="empty-msg">No audit entries found.</p>'; return; }
  list.innerHTML = entries.map(e => `
    <div class="audit-row">
      <div class="audit-dot"></div>
      <div class="audit-body">
        <div class="audit-action">${esc(e.action || '')}</div>
        <div class="audit-meta">${esc(e.adminEmail || e.adminId || 'Admin')} · ${e.createdAt?.toDate ? e.createdAt.toDate().toLocaleString() : '—'}</div>
      </div>
    </div>`).join('');
}

function exportAuditLog() {
  if (!_auditEntries.length) { toast('No entries to export.', 'error'); return; }
  const rows = [['Action', 'Admin', 'Date'], ..._auditEntries.map(e => [e.action || '', e.adminEmail || '', e.createdAt?.toDate ? e.createdAt.toDate().toISOString() : ''])];
  downloadCsv(rows, 'audit_log.csv');
}

// ══════════════════════════════════════════════════════════════
// SHARED UTILITIES
// ══════════════════════════════════════════════════════════════

// logAudit — writes to hub_audit (richer than logActivity)
async function logAudit(action) {
  try {
    await fb.addDoc(fb.collection(_db, 'hub_audit'), {
      action,
      adminId:    currentUser?.uid    || '',
      adminEmail: currentUser?.email  || '',
      createdAt:  fb.serverTimestamp()
    });
    // Also call logActivity for the dashboard feed
    logActivity?.(action);
  } catch(e) { /* non-critical */ }
}
window.logAudit = logAudit;

// Generic CSV downloader
function downloadCsv(rows, filename) {
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a    = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// ══════════════════════════════════════════════════════════════
// ADMIN FEATURES — BATCH 2
// ══════════════════════════════════════════════════════════════

// ── FEATURE A: ANALYTICS TIME-SERIES LINE CHART ──────────────
(function loadChartJS() {
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
  s.onload = () => { if (document.getElementById('page-analytics').classList.contains('active')) renderAnLineChart(); };
  document.head.appendChild(s);
})();

let _anLineChartInst = null;

async function renderAnLineChart() {
  if (typeof Chart === 'undefined') return;
  const canvas = document.getElementById('anLineChart');
  if (!canvas) return;
  try {
    const snap = await fb.getDocs(fb.query(fb.collection(_db, 'hub_users'), fb.orderBy('createdAt', 'asc')));
    const users = snap.docs.map(d => d.data()).filter(u => u.createdAt && u.createdAt.toDate);
    const now = new Date();
    const labels = [], counts = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dayEnd   = new Date(dayStart.getTime() + 86400000);
      counts.push(users.filter(u => { const t = u.createdAt.toDate(); return t >= dayStart && t < dayEnd; }).length);
    }
    const cumulative = counts.reduce((acc, v) => { acc.push((acc[acc.length - 1] || 0) + v); return acc; }, []);
    if (_anLineChartInst) _anLineChartInst.destroy();
    _anLineChartInst = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Total Users',
          data: cumulative,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99,102,241,0.1)',
          borderWidth: 2,
          pointRadius: 2,
          tension: 0.4,
          fill: true,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ' ' + ctx.parsed.y + ' users' } } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', maxTicksLimit: 8 } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', precision: 0 }, beginAtZero: true }
        }
      }
    });
  } catch(e) { console.warn('[AnLineChart]', e); }
}

const _origLoadAnalyticsB2 = loadAnalytics;
loadAnalytics = async function() {
  await _origLoadAnalyticsB2();
  setTimeout(renderAnLineChart, 300);
};
document.getElementById('refreshAnalyticsBtn').addEventListener('click', () => setTimeout(renderAnLineChart, 400));

// ── FEATURE B: ROLE-BASED UI GATING ──────────────────────────
const ROLE_PAGE_ACCESS = {
  editor: ['dashboard','apps','music','erimusic','ericontent','playlists','assets','notify','promotions','posts','feedback','analytics','about','versions','newsletter'],
  viewer: ['dashboard','apps','music','erimusic','ericontent','analytics','about']
};
const ROLE_ACTION_HIDE = {
  editor: ['inviteBtn','bulkApproveBtn','exportUsersBtn'],
  viewer: ['inviteBtn','bulkApproveBtn','addAppBtn','dashAddApp','addPostBtn','approveAllPostsBtn','addPromoBtn','toggleSelectBtn','exportUsersBtn']
};

function applyRoleGating() {
  if (!currentUserData) return;
  const role = currentUserData.role;
  if (role === 'super_admin' || role === 'admin') return;
  const allowed = ROLE_PAGE_ACCESS[role];
  if (allowed) {
    document.querySelectorAll('.sb-item[data-page]').forEach(btn => {
      if (!allowed.includes(btn.dataset.page)) btn.style.display = 'none';
    });
  }
  (ROLE_ACTION_HIDE[role] || []).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

const _origSetupUserDisplayB2 = setupUserDisplay;
setupUserDisplay = function() {
  _origSetupUserDisplayB2();
  applyRoleGating();
};

// ── FEATURE C: INLINE TRACK AUDIO PREVIEW ────────────────────
let _previewAudio   = null;
let _previewTrackId = null;

(function patchRenderMusicForPreview() {
  const prev = renderMusicTracks;
  renderMusicTracks = function(tracks) {
    if (tracks === undefined) tracks = allTracks;
    prev(tracks);
    const list = document.getElementById('musicTrackList');
    list.querySelectorAll('.music-track-row').forEach(row => {
      const tid = row.dataset.trackId;
      if (!tid) return;
      const track = tracks.find(t => t.id === tid);
      if (!track || !track.url) return;
      if (row.querySelector('.preview-btn')) return;
      const btn = document.createElement('button');
      btn.className = 'preview-btn';
      btn.textContent = '▶';
      btn.title = 'Preview track';
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (_previewTrackId === tid) {
          if (_previewAudio) { _previewAudio.pause(); _previewAudio = null; _previewTrackId = null; btn.textContent = '▶'; }
          return;
        }
        if (_previewAudio) { _previewAudio.pause(); document.querySelectorAll('.preview-btn').forEach(b => { b.textContent = '▶'; }); }
        _previewAudio   = new Audio(track.url);
        _previewTrackId = tid;
        btn.textContent = '⏸';
        _previewAudio.play().catch(() => {});
        _previewAudio.addEventListener('ended', () => { btn.textContent = '▶'; _previewAudio = null; _previewTrackId = null; });
      });
      const actDiv = row.querySelector('.music-track-actions');
      if (actDiv) actDiv.prepend(btn);
    });
  };
})();

// ── FEATURE D: FEEDBACK EXPORT ────────────────────────────────
let allFeedback = [];

const _origLoadFeedbackB2 = loadFeedback;
loadFeedback = async function() {
  await _origLoadFeedbackB2();
  try {
    const snap = await fb.getDocs(fb.query(fb.collection(_db, 'feedback'), fb.orderBy('createdAt', 'desc'), fb.limit(500)));
    allFeedback = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
  } catch(e) { /* non-critical */ }
};

document.getElementById('exportFeedbackBtn') && document.getElementById('exportFeedbackBtn').addEventListener('click', () => {
  if (!allFeedback.length) { toast('Open Feedback page first to load data.', 'warn'); return; }
  const rows = [['Message','Rating','User','Email','Date']];
  allFeedback.forEach(f => rows.push([
    f.message || f.text || f.body || f.feedback || '',
    f.rating != null ? f.rating : '',
    f.userName || f.displayName || f.user || 'Anonymous',
    f.email || '',
    f.createdAt && f.createdAt.toDate ? f.createdAt.toDate().toLocaleDateString() : ''
  ]));
  _downloadCSV(rows, 'hub-feedback-' + new Date().toISOString().slice(0, 10) + '.csv');
  toast('📥 Feedback CSV downloaded!', 'success');
});

// ── FEATURE E: KEYBOARD SHORTCUT MAP ─────────────────────────
const kbdModal = document.getElementById('kbdShortcutModal');
const kbdClose = document.getElementById('kbdShortcutClose');
if (kbdClose) kbdClose.addEventListener('click', () => { kbdModal.hidden = true; });
if (kbdModal) kbdModal.addEventListener('click', e => { if (e.target === kbdModal) kbdModal.hidden = true; });

const PAGE_KEYS = { d: 'dashboard', u: 'users', m: 'music', a: 'analytics', p: 'posts', n: 'notify', f: 'feedback', v: 'versions' };
const SIDEBAR_PAGES = ['dashboard','apps','users','music','erimusic','ericontent','newsletter','versions','coupons'];

document.addEventListener('keydown', e => {
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    if (kbdModal) kbdModal.hidden = false;
    return;
  }
  if (e.key === 'Escape' && kbdModal && !kbdModal.hidden) { kbdModal.hidden = true; return; }
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 's') { e.preventDefault(); const btn = document.querySelector('.page.active .btn-primary'); if (btn) btn.click(); }
    return;
  }
  if (e.key === 'r' || e.key === 'R') {
    const btn = document.querySelector('.page.active [id*="refresh"], .page.active [id*="Refresh"]');
    if (btn) { btn.click(); return; }
  }
  if (PAGE_KEYS[e.key.toLowerCase()]) { showPage(PAGE_KEYS[e.key.toLowerCase()]); return; }
  const num = parseInt(e.key, 10);
  if (num >= 1 && num <= 9 && SIDEBAR_PAGES[num - 1]) showPage(SIDEBAR_PAGES[num - 1]);
});

// ── FEATURE F: CONTENT DUPLICATION ───────────────────────────
window.duplicatePost = async function(id) {
  const p = allPosts.find(x => x.id === id);
  if (!p) return;
  const data = Object.assign({}, p);
  delete data.id;
  data.title       = (data.title || 'Untitled') + ' (Copy)';
  data.status      = 'pending';
  data.submittedAt = fb.serverTimestamp();
  data.approvedAt  = null;
  data.source      = 'admin';
  try {
    await fb.addDoc(fb.collection(_db, 'community_posts'), data);
    toast('Post duplicated!', 'success');
    logActivity('Duplicated post "' + p.title + '"');
    loadPosts();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
};

const _origRenderPostsB2 = renderPosts;
renderPosts = function() {
  _origRenderPostsB2();
  setTimeout(() => {
    document.querySelectorAll('.post-card-actions').forEach(div => {
      if (div.querySelector('.dup-btn')) return;
      const editBtn = div.querySelector('[onclick*="openPostModal"]');
      if (!editBtn) return;
      const m = editBtn.getAttribute('onclick').match(/'([^']+)'/);
      if (!m) return;
      const dupBtn = document.createElement('button');
      dupBtn.className = 'btn-sm dup-btn';
      dupBtn.textContent = '⧉ Dup';
      dupBtn.style.cssText = 'font-size:.72rem;padding:4px 8px';
      dupBtn.addEventListener('click', () => window.duplicatePost(m[1]));
      div.insertBefore(dupBtn, editBtn);
    });
  }, 100);
};

window.duplicatePlaylist = async function(id) {
  if (!id || !allAdminPlaylists) return;
  const pl = allAdminPlaylists.find(x => x.id === id);
  if (!pl) { toast('Playlist not found', 'error'); return; }
  const data = Object.assign({}, pl);
  delete data.id;
  data.name      = (data.name || 'Untitled') + ' (Copy)';
  data.status    = 'draft';
  data.createdAt = fb.serverTimestamp();
  data.createdBy = currentUser.uid;
  try {
    await fb.addDoc(fb.collection(_db, 'hub_playlists'), data);
    toast('Playlist duplicated!', 'success');
    loadPlaylists();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
};

window.duplicatePromo = async function(id) {
  const pr = allPromos.find(x => x.id === id);
  if (!pr) { toast('Promo not found', 'error'); return; }
  const data = Object.assign({}, pr);
  delete data.id;
  data.title     = (data.title || 'Untitled') + ' (Copy)';
  data.status    = 'inactive';
  data.createdAt = fb.serverTimestamp();
  try {
    await fb.addDoc(fb.collection(_db, 'hub_promotions'), data);
    toast('Promotion duplicated!', 'success');
    loadPromotions();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
};

// Inject Dup buttons into playlist grid after load
const _origLoadPlaylistsB2 = loadPlaylists;
loadPlaylists = async function() {
  await _origLoadPlaylistsB2();
  setTimeout(() => {
    document.querySelectorAll('#playlistAdminGrid .app-card').forEach(card => {
      if (card.querySelector('.dup-btn')) return;
      const editBtn = card.querySelector('[onclick*="openPlaylistModal"]');
      if (!editBtn) return;
      const m = editBtn.getAttribute('onclick').match(/'([^']+)'/);
      if (!m) return;
      const dupBtn = document.createElement('button');
      dupBtn.className = 'btn-sm dup-btn';
      dupBtn.textContent = '⧉ Duplicate';
      dupBtn.style.cssText = 'font-size:.72rem;width:100%;margin-top:4px';
      dupBtn.addEventListener('click', e => { e.stopPropagation(); window.duplicatePlaylist(m[1]); });
      editBtn.parentNode.appendChild(dupBtn);
    });
  }, 400);
};

// Inject Dup buttons into promo grid after load
const _origLoadPromotionsB2 = loadPromotions;
loadPromotions = async function() {
  await _origLoadPromotionsB2();
  setTimeout(() => {
    document.querySelectorAll('#promoGrid .promo-card').forEach(card => {
      if (card.querySelector('.dup-btn')) return;
      const editBtn = card.querySelector('[onclick*="openPromoModal"]');
      if (!editBtn) return;
      const m = editBtn.getAttribute('onclick').match(/'([^']+)'/);
      if (!m) return;
      const dupBtn = document.createElement('button');
      dupBtn.className = 'btn-sm dup-btn';
      dupBtn.textContent = '⧉ Dup';
      dupBtn.style.cssText = 'font-size:.72rem;padding:4px 8px';
      dupBtn.addEventListener('click', e => { e.stopPropagation(); window.duplicatePromo(m[1]); });
      editBtn.parentNode.insertBefore(dupBtn, editBtn);
    });
  }, 400);
};

// ── FEATURE G: AUDIT LOG DATE RANGE FILTER ───────────────────
function _applyAuditFilters() {
  const q      = (document.getElementById('auditSearch') || {}).value || '';
  const from   = (document.getElementById('auditDateFrom') || {}).value;
  const to     = (document.getElementById('auditDateTo') || {}).value;
  const qLower = q.trim().toLowerCase();
  const fromMs = from ? new Date(from).getTime() : 0;
  const toMs   = to   ? new Date(to).getTime() + 86400000 : Infinity;
  if (!_auditEntries) return;
  const filtered = _auditEntries.filter(e => {
    const ms       = e.createdAt && e.createdAt.toDate ? e.createdAt.toDate().getTime() : 0;
    const matchQ   = !qLower || (e.action || '').toLowerCase().includes(qLower) || (e.adminEmail || '').toLowerCase().includes(qLower);
    const matchDate = ms >= fromMs && ms <= toMs;
    return matchQ && matchDate;
  });
  renderAuditLog(filtered);
}

const _auditFromEl = document.getElementById('auditDateFrom');
const _auditToEl   = document.getElementById('auditDateTo');
if (_auditFromEl) _auditFromEl.addEventListener('change', _applyAuditFilters);
if (_auditToEl)   _auditToEl.addEventListener('change',   _applyAuditFilters);

// Replace old auditSearch with combined listener
(function rewireAuditSearch() {
  const old = document.getElementById('auditSearch');
  if (!old) return;
  const clone = old.cloneNode(true);
  old.parentNode.replaceChild(clone, old);
  clone.addEventListener('input', _applyAuditFilters);
})();

// ── FEATURE H: DASHBOARD STAT CARDS DRAG/REORDER ─────────────
function initDashboardDrag() {
  const row = document.querySelector('#page-dashboard .stat-row');
  if (!row || row.dataset.dragInited) return;
  row.dataset.dragInited = '1';

  const cards = [...row.querySelectorAll('.stat-card')];
  const saved = localStorage.getItem('hub_stat_order');
  if (saved) {
    try {
      const order = JSON.parse(saved);
      order.forEach(idx => { if (cards[idx]) row.appendChild(cards[idx]); });
    } catch(e) { /* ignore */ }
  }

  let dragEl = null;
  row.querySelectorAll('.stat-card').forEach(card => {
    card.draggable = true;
    card.style.cursor = 'grab';
    card.addEventListener('dragstart', e => {
      dragEl = card;
      card.style.opacity = '0.45';
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => {
      if (dragEl) dragEl.style.opacity = '1';
      dragEl = null;
      const newOrder = [...row.querySelectorAll('.stat-card')].map(c => cards.indexOf(c));
      localStorage.setItem('hub_stat_order', JSON.stringify(newOrder));
    });
    card.addEventListener('dragover', e => { e.preventDefault(); card.classList.add('drag-over-card'); });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over-card'));
    card.addEventListener('drop', e => {
      e.preventDefault();
      card.classList.remove('drag-over-card');
      if (dragEl && dragEl !== card) row.insertBefore(dragEl, card);
    });
  });
}

const _origLoadDashboardB2 = loadDashboard;
loadDashboard = async function() {
  await _origLoadDashboardB2();
  setTimeout(initDashboardDrag, 500);
};

// ════════════════════════════════════════════════════════════════
//  HUB — BATCH 3 FEATURES  (A–J)
// ════════════════════════════════════════════════════════════════

// ── FEATURE A: BULK USER ACTIONS ─────────────────────────────────
(function initBulkUserActions() {
  let _selectedUserIds = new Set();

  function updateBulkBar() {
    const bar = document.getElementById('userBulkBar');
    const cnt = document.getElementById('userBulkCount');
    if (!bar) return;
    if (_selectedUserIds.size === 0) { bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    cnt.textContent = _selectedUserIds.size + ' selected';
  }

  // Patch renderUsers to inject checkboxes
  const _origRenderUsers = renderUsers;
  renderUsers = function(users, tab) {
    if (users === undefined) users = allUsers;
    _origRenderUsers(users, tab);
    const list = document.getElementById('userList');
    if (!list) return;
    list.querySelectorAll('.user-row').forEach(row => {
      if (row.querySelector('.user-bulk-cb')) return;
      const uid = row.dataset.uid || row.getAttribute('data-uid');
      if (!uid) return;
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'user-bulk-cb';
      cb.checked = _selectedUserIds.has(uid);
      cb.addEventListener('change', () => {
        if (cb.checked) _selectedUserIds.add(uid);
        else _selectedUserIds.delete(uid);
        updateBulkBar();
      });
      row.insertBefore(cb, row.firstChild);
    });
    // "Select All" on header clicks or re-render clears stale selections
    updateBulkBar();
  };

  // Wire up bulk action buttons
  function withSelected(fn) {
    const ids = [..._selectedUserIds];
    if (!ids.length) return;
    fn(ids);
  }

  document.getElementById('bulkUserApprove') && document.getElementById('bulkUserApprove').addEventListener('click', () => {
    withSelected(async ids => {
      for (const uid of ids) {
        const u = allUsers.find(x => x.id === uid);
        if (u && u.status !== 'approved') {
          await fb.updateDoc(fb.doc(_db, 'hub_users', uid), { status: 'approved' });
          logActivity('Bulk approved user: ' + (u.email || uid));
        }
      }
      _selectedUserIds.clear(); updateBulkBar(); loadUsers(); toast('Approved ' + ids.length + ' users');
    });
  });

  document.getElementById('bulkUserReject') && document.getElementById('bulkUserReject').addEventListener('click', () => {
    withSelected(async ids => {
      for (const uid of ids) {
        const u = allUsers.find(x => x.id === uid);
        if (u) {
          await fb.updateDoc(fb.doc(_db, 'hub_users', uid), { status: 'rejected' });
          logActivity('Bulk rejected user: ' + (u.email || uid));
        }
      }
      _selectedUserIds.clear(); updateBulkBar(); loadUsers(); toast('Rejected ' + ids.length + ' users');
    });
  });

  document.getElementById('bulkUserRoleApply') && document.getElementById('bulkUserRoleApply').addEventListener('click', () => {
    const role = document.getElementById('bulkUserRole').value;
    if (!role) { toast('Select a role first'); return; }
    withSelected(async ids => {
      for (const uid of ids) {
        await fb.updateDoc(fb.doc(_db, 'hub_users', uid), { role });
        logActivity('Bulk set role ' + role + ' for user ' + uid);
      }
      _selectedUserIds.clear(); updateBulkBar(); loadUsers(); toast('Role set for ' + ids.length + ' users');
    });
  });

  document.getElementById('bulkUserExport') && document.getElementById('bulkUserExport').addEventListener('click', () => {
    withSelected(ids => {
      const sel = allUsers.filter(u => ids.includes(u.id));
      const rows = [['Name','Email','Role','Status','Joined']];
      sel.forEach(u => rows.push([u.displayName || '', u.email || '', u.role || '', u.status || '', u.createdAt ? new Date(u.createdAt.toDate()).toLocaleDateString() : '']));
      _downloadCSV(rows, 'users-selected-' + new Date().toISOString().slice(0,10) + '.csv');
    });
  });

  document.getElementById('bulkUserClear') && document.getElementById('bulkUserClear').addEventListener('click', () => {
    _selectedUserIds.clear();
    document.querySelectorAll('.user-bulk-cb').forEach(cb => { cb.checked = false; });
    updateBulkBar();
  });
})();


// ── FEATURE B: USER PROFILE DRAWER ───────────────────────────────
(function initUserProfileDrawer() {
  const overlay = document.getElementById('profileDrawerOverlay');
  const drawer  = document.getElementById('profileDrawer');
  if (!overlay || !drawer) return;

  let _currentDrawerUser = null;

  function closeDrawer() { overlay.hidden = true; drawer.hidden = true; _currentDrawerUser = null; }
  document.getElementById('profileDrawerClose').addEventListener('click', closeDrawer);
  overlay.addEventListener('click', closeDrawer);

  window.openUserProfileDrawer = async function(uid) {
    const u = allUsers.find(x => x.id === uid);
    if (!u) return;
    _currentDrawerUser = u;
    const initial = (u.displayName || u.email || '?')[0].toUpperCase();
    document.getElementById('pdAvatar').textContent = initial;
    document.getElementById('pdName').textContent   = u.displayName || '—';
    document.getElementById('pdEmail').textContent  = u.email || '—';
    const roleEl = document.getElementById('pdRole');
    roleEl.textContent = ROLE_LABELS[u.role] || u.role || 'Viewer';
    roleEl.className   = 'pd-role-badge role-' + (u.role || 'viewer');
    document.getElementById('pdStatus').textContent   = u.status || '—';
    document.getElementById('pdJoined').textContent   = u.createdAt ? new Date(u.createdAt.toDate()).toLocaleDateString() : '—';
    document.getElementById('pdLastLogin').textContent = u.lastLogin ? timeAgo(u.lastLogin.toDate ? u.lastLogin.toDate() : new Date(u.lastLogin)) : '—';
    document.getElementById('pdPostCount').textContent = '…';
    document.getElementById('pdFeedbackCount').textContent = '…';
    overlay.hidden = false; drawer.hidden = false;

    // Async: count posts and feedback for this user
    try {
      const [postsSnap, fbSnap] = await Promise.all([
        fb.getDocs(fb.query(fb.collection(_db, 'community_posts'), fb.where('userEmail', '==', u.email), fb.limit(200))),
        fb.getDocs(fb.query(fb.collection(_db, 'feedback'), fb.where('userEmail', '==', u.email), fb.limit(200)))
      ]);
      document.getElementById('pdPostCount').textContent     = postsSnap.size;
      document.getElementById('pdFeedbackCount').textContent = fbSnap.size;
    } catch(e) {
      document.getElementById('pdPostCount').textContent     = '—';
      document.getElementById('pdFeedbackCount').textContent = '—';
    }
  };

  document.getElementById('pdApproveBtn').addEventListener('click', async () => {
    if (!_currentDrawerUser) return;
    await fb.updateDoc(fb.doc(_db, 'hub_users', _currentDrawerUser.id), { status: 'approved' });
    toast('User approved'); closeDrawer(); loadUsers();
  });
  document.getElementById('pdRejectBtn').addEventListener('click', async () => {
    if (!_currentDrawerUser) return;
    await fb.updateDoc(fb.doc(_db, 'hub_users', _currentDrawerUser.id), { status: 'rejected' });
    toast('User rejected'); closeDrawer(); loadUsers();
  });
  document.getElementById('pdViewPostsBtn').addEventListener('click', () => {
    closeDrawer();
    showPage('posts');
    setTimeout(() => {
      const input = document.getElementById('postSearch');
      if (input && _currentDrawerUser) { input.value = _currentDrawerUser.email || ''; input.dispatchEvent(new Event('input')); }
    }, 300);
  });

  // Patch renderUsers rows to open drawer on click
  const _origRenderUsersB = renderUsers;
  renderUsers = function(users, tab) {
    if (users === undefined) users = allUsers;
    _origRenderUsersB(users, tab);
    document.querySelectorAll('#userList .user-row').forEach(row => {
      if (row.dataset.drawerWired) return;
      row.dataset.drawerWired = '1';
      const uid = row.dataset.uid || row.getAttribute('data-uid');
      row.addEventListener('click', e => {
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT' || e.target.classList.contains('user-bulk-cb')) return;
        if (uid) openUserProfileDrawer(uid);
      });
      row.style.cursor = 'pointer';
    });
  };
})();


// ── FEATURE C: POST SEARCH + FILTER ──────────────────────────────
(function initPostSearch() {
  const input = document.getElementById('postSearch');
  if (!input) return;

  const _origRenderPostsC = renderPosts;
  let _allPostsForSearch = [];

  const _origLoadPostsC = loadPosts;
  loadPosts = async function() {
    await _origLoadPostsC();
    _allPostsForSearch = [...allPosts];
  };

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { renderPosts(); return; }
    const filtered = _allPostsForSearch.filter(p =>
      (p.title || '').toLowerCase().includes(q) ||
      (p.authorName || p.author || '').toLowerCase().includes(q) ||
      (p.userEmail || '').toLowerCase().includes(q) ||
      (p.status || '').toLowerCase().includes(q) ||
      (p.body || p.content || '').toLowerCase().includes(q)
    );
    const backup = allPosts;
    allPosts = filtered;
    renderPosts();
    allPosts = backup;
  });
})();


// ── FEATURE D: NOTIFICATION TEMPLATES ────────────────────────────
(function initNotifTemplates() {
  const TMPL_KEY = 'hub_notif_templates';
  const defaultTemplates = [
    { name: '🎵 New Music', title: 'New Songs Added!', body: 'Check out the latest tracks in ERI-FAM — fresh music just dropped! 🎶' },
    { name: '📅 Event', title: 'Upcoming Event', body: 'Don\'t miss it — join us for an exciting Eritrean event. Tap for details.' },
    { name: '📢 Announcement', title: 'Important Update', body: 'We have an important update for all ERI-FAM users. Tap to learn more.' },
    { name: '🎉 Milestone', title: 'Celebrating a Milestone!', body: 'We hit a big milestone thanks to YOU. Thank you for your support! 🙏' },
  ];

  function getTemplates() {
    try { return JSON.parse(localStorage.getItem(TMPL_KEY)) || defaultTemplates; } catch(e) { return defaultTemplates; }
  }
  function saveTemplates(tmpls) { localStorage.setItem(TMPL_KEY, JSON.stringify(tmpls)); }

  function renderTemplates() {
    const container = document.getElementById('notifTmplBtns');
    if (!container) return;
    const tmpls = getTemplates();
    container.innerHTML = '';
    tmpls.forEach((t, i) => {
      const btn = document.createElement('button');
      btn.className = 'notif-tmpl-btn';
      btn.textContent = t.name;
      btn.title = t.title + '\n' + t.body;
      btn.addEventListener('click', () => {
        const titleEl = document.getElementById('notifyTitle');
        const bodyEl  = document.getElementById('notifyBody');
        if (titleEl) titleEl.value = t.title;
        if (bodyEl)  bodyEl.value  = t.body;
      });
      const del = document.createElement('button');
      del.className = 'notif-tmpl-del';
      del.textContent = '✕';
      del.title = 'Delete template';
      del.addEventListener('click', e => {
        e.stopPropagation();
        const ts = getTemplates();
        ts.splice(i, 1);
        saveTemplates(ts);
        renderTemplates();
      });
      const wrap = document.createElement('div');
      wrap.className = 'notif-tmpl-item';
      wrap.appendChild(btn);
      wrap.appendChild(del);
      container.appendChild(wrap);
    });
  }

  const saveBtn = document.getElementById('saveNotifTmplBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const title = (document.getElementById('notifyTitle') || {}).value || '';
      const body  = (document.getElementById('notifyBody')  || {}).value || '';
      if (!title && !body) { toast('Fill in title/message first'); return; }
      const name = prompt('Template name:', title.slice(0, 20) || 'My Template');
      if (!name) return;
      const ts = getTemplates();
      ts.push({ name, title, body });
      saveTemplates(ts);
      renderTemplates();
      toast('Template saved!');
    });
  }

  renderTemplates();
})();


// ── FEATURE E: REVENUE GOALS ──────────────────────────────────────
(function initRevenueGoals() {
  const GOAL_KEY = 'hub_rev_goal';

  function getGoal() { return parseFloat(localStorage.getItem(GOAL_KEY)) || 0; }
  function saveGoal(v) { localStorage.setItem(GOAL_KEY, v); }

  function updateGoalUI() {
    const goal = getGoal();
    const inputEl = document.getElementById('revGoalInput');
    const pctEl   = document.getElementById('revGoalPct');
    const barEl   = document.getElementById('revGoalBar');
    if (inputEl) inputEl.value = goal || '';

    if (goal <= 0) { if (pctEl) pctEl.textContent = ''; if (barEl) barEl.style.width = '0%'; return; }

    const totalEl = document.getElementById('revTotal');
    const totalStr = totalEl ? totalEl.textContent.replace(/[^0-9.]/g, '') : '0';
    const total = parseFloat(totalStr) || 0;
    const pct = Math.min(100, Math.round((total / goal) * 100));
    if (pctEl) pctEl.textContent = pct + '%';
    if (barEl) barEl.style.width = pct + '%';
  }

  const saveGoalBtn = document.getElementById('revGoalSave');
  if (saveGoalBtn) {
    saveGoalBtn.addEventListener('click', () => {
      const v = parseFloat(document.getElementById('revGoalInput').value);
      if (isNaN(v) || v < 0) { toast('Enter a valid goal amount'); return; }
      saveGoal(v);
      updateGoalUI();
      toast('Goal saved — $' + v.toFixed(2));
    });
  }

  // Re-run after revenue loads
  const _origLoadMonetize = loadMonetize;
  loadMonetize = async function() {
    await _origLoadMonetize();
    setTimeout(updateGoalUI, 600);
  };

  updateGoalUI();
})();


// ── FEATURE F: ACTIVITY TIMELINE (REAL-TIME) ─────────────────────
(function initActivityTimeline() {
  // Upgrade dashActivity to real-time subscription
  const _origLoadDashF = loadDashboard;
  loadDashboard = async function() {
    await _origLoadDashF();
    // Subscribe to hub_activity in real-time
    try {
      const q = fb.query(
        fb.collection(_db, 'hub_activity'),
        fb.orderBy('createdAt', 'desc'),
        fb.limit(15)
      );
      fb.onSnapshot(q, snap => {
        const list = document.getElementById('dashActivity');
        if (!list) return;
        if (snap.empty) { list.innerHTML = '<p class="empty-msg">No recent activity.</p>'; return; }
        const ACTION_ICON = {
          login: '🔐', logout: '🚪', create: '➕', update: '✏️', delete: '🗑',
          approve: '✅', reject: '❌', upload: '📤', send: '📨', export: '📥',
        };
        list.innerHTML = snap.docs.map(d => {
          const data = d.data();
          const action = (data.action || '').toLowerCase();
          const icon = Object.entries(ACTION_ICON).find(([k]) => action.includes(k))?.[1] || '📋';
          const who = data.adminEmail ? data.adminEmail.split('@')[0] : 'Admin';
          const when = data.createdAt ? timeAgo(data.createdAt.toDate()) : '';
          return '<div class="activity-item timeline-item-rt">' +
            '<span class="act-icon">' + icon + '</span>' +
            '<div class="act-body">' +
            '<span class="act-action">' + esc(data.action || '') + '</span>' +
            '<span class="act-who">' + esc(who) + '</span>' +
            '</div>' +
            '<span class="act-time">' + esc(when) + '</span>' +
            '</div>';
        }).join('');
      });
    } catch(e) { /* Firestore rules may block; graceful fail */ }
  };
})();




// ── FEATURE H: DRAFT SCHEDULER ────────────────────────────────────
(function initDraftScheduler() {
  // Inject "Publish At" field into post modal
  function injectScheduleField() {
    const modal = document.getElementById('postModal') || document.querySelector('#page-posts .modal');
    if (!modal || modal.querySelector('#postScheduledAt')) return;
    // Find the status select or last form-group
    const statusSel = modal.querySelector('select[id*="postStatus"], #postStatus');
    if (!statusSel) return;
    const fg = document.createElement('div');
    fg.className = 'form-group';
    fg.innerHTML = '<label>Schedule Publish At <span style="color:var(--text-dim);font-size:.75rem">(optional — leave blank to publish now)</span></label>' +
      '<input type="datetime-local" id="postScheduledAt" class="form-input"/>';
    statusSel.closest('.form-group') ? statusSel.closest('.form-group').after(fg) : modal.querySelector('.modal-body, .modal').appendChild(fg);
  }

  // Observe post modal opening
  const obs = new MutationObserver(() => injectScheduleField());
  const postPage = document.getElementById('page-posts');
  if (postPage) obs.observe(postPage, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'] });

  // Patch savePost to respect schedule field
  const _origSavePost = savePost;
  if (typeof _origSavePost === 'function') {
    savePost = async function() {
      const schedEl = document.getElementById('postScheduledAt');
      if (schedEl && schedEl.value) {
        const schedTime = new Date(schedEl.value);
        if (schedTime > new Date()) {
          // Store scheduledAt on the post, set status=scheduled
          window._pendingScheduledAt = fb.Timestamp ? fb.Timestamp.fromDate(schedTime) : schedTime.toISOString();
          window._pendingScheduledStatus = 'scheduled';
        }
      }
      await _origSavePost();
      window._pendingScheduledAt = null;
      window._pendingScheduledStatus = null;
    };
  }

  // Auto-publish scheduler: check every 60 seconds (paused when tab hidden)
  setInterval(async () => {
    if (document.hidden) return;
    if (!_db || !fb.getDocs) return;
    try {
      const now = new Date();
      const snap = await fb.getDocs(
        fb.query(fb.collection(_db, 'community_posts'), fb.where('status', '==', 'scheduled'))
      );
      snap.docs.forEach(async d => {
        const data = d.data();
        const schedAt = data.scheduledAt;
        if (!schedAt) return;
        const schedDate = schedAt.toDate ? schedAt.toDate() : new Date(schedAt);
        if (schedDate <= now) {
          await fb.updateDoc(fb.doc(_db, 'community_posts', d.id), { status: 'approved' });
          logActivity('Auto-published scheduled post: ' + (data.title || d.id));
        }
      });
    } catch(e) { /* graceful fail */ }
  }, 60000);
})();


// ── FEATURE I: PER-FILE UPLOAD PROGRESS ──────────────────────────
(function initPerFileUploadProgress() {
  const _origHandleMusicFiles = handleMusicFiles;
  if (typeof _origHandleMusicFiles !== 'function') return;

  handleMusicFiles = async function(files) {
    if (!files || files.length === 0) return _origHandleMusicFiles(files);
    if (files.length < 2) return _origHandleMusicFiles(files);

    // Multi-file: show per-file status UI
    const progEl = document.getElementById('musicUploadProgress');
    const barEl  = document.getElementById('musicUpBar');
    const statEl = document.getElementById('musicUpStatus');
    if (!progEl) return _origHandleMusicFiles(files);

    progEl.hidden = false;
    const perFileList = document.getElementById('perFileList') || (() => {
      const el = document.createElement('div');
      el.id = 'perFileList';
      el.className = 'per-file-list';
      progEl.appendChild(el);
      return el;
    })();
    perFileList.innerHTML = '';

    const fileArr = Array.from(files);
    let completed = 0;

    for (let i = 0; i < fileArr.length; i++) {
      const f = fileArr[i];
      const row = document.createElement('div');
      row.className = 'pf-row';
      row.innerHTML = '<span class="pf-name">' + esc(f.name) + '</span><span class="pf-status">⏳</span>';
      perFileList.appendChild(row);
      const statusSpan = row.querySelector('.pf-status');

      if (barEl) barEl.style.width = Math.round((i / fileArr.length) * 100) + '%';
      if (statEl) statEl.textContent = 'Uploading ' + (i + 1) + ' / ' + fileArr.length + '…';

      try {
        await _origHandleMusicFiles([f]);
        statusSpan.textContent = '✅';
        statusSpan.style.color = '#10b981';
        completed++;
      } catch(e) {
        statusSpan.textContent = '❌';
        statusSpan.style.color = '#ef4444';
      }
    }

    if (barEl) barEl.style.width = '100%';
    if (statEl) statEl.textContent = completed + ' / ' + fileArr.length + ' files uploaded';
    setTimeout(() => { progEl.hidden = true; perFileList.innerHTML = ''; }, 3000);
  };
})();


// ── FEATURE J: MUSIC WAVEFORM VISUALIZER ─────────────────────────
(function initWaveformVisualizer() {
  let _waveAudioCtx = null;
  let _waveAnalyser = null;
  let _waveSource   = null;
  let _waveRafId    = null;
  const canvas = document.getElementById('waveformCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function stopWave() {
    if (_waveRafId) cancelAnimationFrame(_waveRafId);
    _waveRafId = null;
    if (_waveSource) { try { _waveSource.disconnect(); } catch(e) {} }
    _waveSource = null;
    canvas.hidden = true;
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function startWave(audioEl, anchorEl) {
    if (!window.AudioContext && !window.webkitAudioContext) return;
    if (!_waveAudioCtx) {
      _waveAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      _waveAnalyser = _waveAudioCtx.createAnalyser();
      _waveAnalyser.fftSize = 64;
      _waveAnalyser.connect(_waveAudioCtx.destination);
    }
    if (_waveAudioCtx.state === 'suspended') _waveAudioCtx.resume();

    if (_waveSource) { try { _waveSource.disconnect(); } catch(e) {} }
    _waveSource = _waveAudioCtx.createMediaElementSource(audioEl);
    _waveSource.connect(_waveAnalyser);

    // Position canvas near the anchor element
    if (anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      canvas.style.position = 'fixed';
      canvas.style.top  = (rect.bottom + 4) + 'px';
      canvas.style.left = rect.left + 'px';
    }
    canvas.hidden = false;

    const bufLen = _waveAnalyser.frequencyBinCount;
    const dataArr = new Uint8Array(bufLen);
    const W = canvas.width, H = canvas.height;
    const barW = W / bufLen;

    function draw() {
      _waveRafId = requestAnimationFrame(draw);
      _waveAnalyser.getByteFrequencyData(dataArr);
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < bufLen; i++) {
        const v = dataArr[i] / 255;
        const h = v * H;
        const hue = 260 - v * 80;
        ctx.fillStyle = 'hsl(' + hue + ',70%,55%)';
        ctx.fillRect(i * barW, H - h, barW - 1, h);
      }
    }
    draw();
  }

  // Hook into preview-btn clicks after renderMusicTracks
  const _origRMTJ = renderMusicTracks;
  renderMusicTracks = function(tracks) {
    if (tracks === undefined) tracks = allTracks;
    _origRMTJ(tracks);

    document.querySelectorAll('#musicTrackList .preview-btn').forEach(btn => {
      if (btn.dataset.waveWired) return;
      btn.dataset.waveWired = '1';
      btn.addEventListener('click', () => {
        // Check if currently playing (btn text toggled to ⏸ by preview feature)
        setTimeout(() => {
          const audio = _previewAudio;
          if (audio && !audio.paused) {
            startWave(audio, btn);
          } else {
            stopWave();
          }
        }, 100);
      });
    });
  };

  // Stop waveform when preview stops
  const _chkStop = setInterval(() => {
    const audio = _previewAudio;
    if (!audio || audio.paused) stopWave();
  }, 500);
})();

// ── TRUCK-LOG ─────────────────────────────────────────────────────────────────
let _trucklogUsers = [];

async function loadTruckLog() {
  const tbody  = document.getElementById('trucklogUserTable');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" class="empty-msg">Loading…</td></tr>';

  try {
    const snap = await fb.getDocs(
      fb.query(fb.collection(_db, 'truck_log_users'), fb.orderBy('createdAt', 'desc'))
    );
    _trucklogUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-msg">Error: ${e.message}</td></tr>`;
    return;
  }

  // Stats
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
  const weekNew = _trucklogUsers.filter(u => (u.createdAt || '') > weekAgo).length;
  const googleSignins = _trucklogUsers.filter(u => u.email && !u.truckId && !u.name?.includes(' ')).length;
  document.getElementById('rlStatTotal').textContent  = _trucklogUsers.length;
  document.getElementById('rlStatWeek').textContent   = weekNew;
  document.getElementById('rlStatGoogle').textContent = googleSignins;

  // Update sidebar badge
  const badge = document.getElementById('trucklogUserBadge');
  if (badge) { badge.textContent = _trucklogUsers.length; badge.hidden = _trucklogUsers.length === 0; }

  renderTruckLogTable(_trucklogUsers);

  // Search
  const searchEl = document.getElementById('trucklogSearch');
  if (searchEl && !searchEl.dataset.wired) {
    searchEl.dataset.wired = '1';
    searchEl.addEventListener('input', () => {
      const q = searchEl.value.toLowerCase();
      renderTruckLogTable(q
        ? _trucklogUsers.filter(u => (u.name + u.email + u.truckId).toLowerCase().includes(q))
        : _trucklogUsers
      );
    });
  }

  // Export CSV
  const exportBtn = document.getElementById('trucklogExportBtn');
  if (exportBtn && !exportBtn.dataset.wired) {
    exportBtn.dataset.wired = '1';
    exportBtn.addEventListener('click', () => {
      const rows = [['Name','Email','Truck ID','Joined','UID']];
      _trucklogUsers.forEach(u => rows.push([
        u.name || '', u.email || '', u.truckId || '',
        u.createdAt ? u.createdAt.slice(0,10) : '', u.id
      ]));
      const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const a    = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob),
        download: `truck-log-users-${new Date().toISOString().slice(0,10)}.csv`
      });
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }
}

function renderTruckLogTable(users) {
  const tbody = document.getElementById('trucklogUserTable');
  if (!tbody) return;
  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-msg">No Truck-Log users yet.</td></tr>';
    return;
  }
  tbody.innerHTML = users.map(u => {
    const joined   = u.createdAt ? u.createdAt.slice(0,10) : '—';
    const provider = u.photoURL  ? '🔵 Google' : '📧 Email';
    return `<tr>
      <td>${esc(u.name  || '—')}</td>
      <td>${esc(u.email || '—')}</td>
      <td>${esc(u.truckId || '—')}</td>
      <td>${joined}</td>
      <td>${provider}</td>
    </tr>`;
  }).join('');
}
window.loadTruckLog = loadTruckLog;

/* ════════════════════════════════════════════════════════════════
   EDITOR PANEL TABS
   ════════════════════════════════════════════════════════════════ */
document.querySelectorAll('.ep-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.ep-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.ep-pane').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const pane = document.getElementById('epPane-' + tab.dataset.tab);
    if (pane) pane.classList.add('active');
  });
});

/* ════════════════════════════════════════════════════════════════
   RIGLOG ADMIN PAGE
   ════════════════════════════════════════════════════════════════ */
function initRiglogPage() {
  const btn = document.getElementById('rlRefreshBtn');
  if (btn && !btn.dataset.wired) {
    btn.dataset.wired = '1';
    btn.addEventListener('click', () => {
      const f = document.getElementById('riglogFrame');
      if (f) f.src = f.src;
    });
  }
  loadRiglogStats();
}

async function loadRiglogStats() {
  try {
    const snap = await fb.getDocs(fb.collection(_db, 'riglog_users'));
    document.getElementById('rlAdmUsers').textContent = snap.size;
    let trips = 0, expenses = 0, revenue = 0;
    snap.forEach(d => {
      const data = d.data();
      trips    += (data.tripCount    || 0);
      expenses += (data.expenseCount || 0);
      revenue  += (data.totalRevenue || 0);
    });
    document.getElementById('rlAdmTrips').textContent    = trips    || '—';
    document.getElementById('rlAdmExpenses').textContent = expenses || '—';
    document.getElementById('rlAdmRevenue').textContent  = revenue  ? '$' + revenue.toFixed(0) : '—';
  } catch(e) {
    if (typeof _trucklogUsers !== 'undefined' && _trucklogUsers.length) {
      document.getElementById('rlAdmUsers').textContent = _trucklogUsers.length;
    }
  }
}

/* ════════════════════════════════════════════════════════════════
   EMPLOYEES PAGE
   ════════════════════════════════════════════════════════════════ */
let _allEmployees = [], _currentEmpId = null;

async function loadEmployees() {
  const grid = document.getElementById('empGrid');
  if (!grid) return;
  grid.innerHTML = '<p class="empty-msg" style="grid-column:1/-1">Loading employees…</p>';
  try {
    const snap = await fb.getDocs(fb.query(fb.collection(_db, 'hub_employees'), fb.orderBy('name')));
    _allEmployees = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderEmployeeGrid(_allEmployees);
  } catch(e) {
    grid.innerHTML = `<p class="empty-msg" style="grid-column:1/-1">Error loading: ${e.message}</p>`;
  }
  wireEmployeePage();
}

function renderEmployeeGrid(emps) {
  const grid  = document.getElementById('empGrid');
  const dept  = document.getElementById('empDeptFilter')?.value   || '';
  const stat  = document.getElementById('empStatusFilter')?.value || '';
  const query = (document.getElementById('empSearch')?.value || '').toLowerCase();
  const list  = emps.filter(e => {
    if (dept  && e.department !== dept)  return false;
    if (stat  && e.status     !== stat)  return false;
    if (query && !`${e.name} ${e.title} ${e.email}`.toLowerCase().includes(query)) return false;
    return true;
  });
  if (!list.length) {
    grid.innerHTML = '<p class="empty-msg" style="grid-column:1/-1">No employees match your filters.</p>';
    return;
  }
  const dotColor = { active: '#10b981', 'on-leave': '#f59e0b', inactive: '#6b7280' };
  grid.innerHTML = list.map(e => {
    const initials = (e.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const color    = e.photoUrl ? 'transparent' : '#6366f1';
    const dc       = dotColor[e.status] || '#6b7280';
    return `
    <div class="emp-card" data-empid="${e.id}">
      <div class="emp-card-photo-wrap">
        <div class="emp-card-photo">
          ${e.photoUrl
            ? `<img src="${esc(e.photoUrl)}" alt="${esc(e.name)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`
            : `<span class="emp-card-initials">${initials}</span>`}
        </div>
        <span class="emp-card-dot" style="background:${dc}"></span>
      </div>
      <div class="emp-card-name">${esc(e.name || '—')}</div>
      <div class="emp-card-title">${esc(e.title || '—')}</div>
      <div class="emp-card-dept">${esc(e.department || '')}</div>
    </div>`;
  }).join('');
  grid.querySelectorAll('.emp-card').forEach(card => {
    card.addEventListener('click', () => openEmployeeDrawer(card.dataset.empid));
  });
}

function wireEmployeePage() {
  const addBtn = document.getElementById('addEmployeeBtn');
  if (addBtn && !addBtn.dataset.wired) {
    addBtn.dataset.wired = '1';
    addBtn.addEventListener('click', () => openEmpModal(null));
  }
  ['empSearch', 'empDeptFilter', 'empStatusFilter'].forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.dataset.wired) {
      el.dataset.wired = '1';
      el.addEventListener('input', () => renderEmployeeGrid(_allEmployees));
    }
  });
  ['empDhClose', 'empDrawerOverlay'].forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.dataset.wired) { el.dataset.wired = '1'; el.addEventListener('click', closeEmpDrawer); }
  });
  const dEdit = document.getElementById('empDhEdit');
  if (dEdit && !dEdit.dataset.wired) {
    dEdit.dataset.wired = '1';
    dEdit.addEventListener('click', () => openEmpModal(_currentEmpId));
  }
  const dDel = document.getElementById('empDhDelete');
  if (dDel && !dDel.dataset.wired) {
    dDel.dataset.wired = '1';
    dDel.addEventListener('click', () => deleteEmployee(_currentEmpId));
  }
  const noteSend = document.getElementById('empNoteSend');
  if (noteSend && !noteSend.dataset.wired) {
    noteSend.dataset.wired = '1';
    noteSend.addEventListener('click', () => addEmployeeNote(_currentEmpId));
  }
  ['empModalClose', 'empModalCancel'].forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.dataset.wired) { el.dataset.wired = '1'; el.addEventListener('click', closeEmpModal); }
  });
  const mSave = document.getElementById('empModalSave');
  if (mSave && !mSave.dataset.wired) {
    mSave.dataset.wired = '1';
    mSave.addEventListener('click', saveEmployee);
  }
  const photoInput = document.getElementById('empModalPhotoInput');
  if (photoInput && !photoInput.dataset.wired) {
    photoInput.dataset.wired = '1';
    photoInput.addEventListener('change', () => {
      const file = photoInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const img  = document.getElementById('empModalPhotoPreview');
        const icon = document.getElementById('empModalPhotoIcon');
        img.src = ev.target.result; img.style.display = 'block';
        if (icon) icon.style.display = 'none';
      };
      reader.readAsDataURL(file);
    });
  }
}

function openEmployeeDrawer(id) {
  const emp = _allEmployees.find(e => e.id === id);
  if (!emp) return;
  _currentEmpId = id;
  const initials = (emp.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const img = document.getElementById('empDhImg');
  const ini = document.getElementById('empDhInitials');
  if (emp.photoUrl) {
    img.src = emp.photoUrl; img.style.display = 'block';
    if (ini) ini.style.display = 'none';
  } else {
    if (img) img.style.display = 'none';
    if (ini) { ini.style.display = 'block'; ini.textContent = initials; }
  }
  document.getElementById('empDhName').textContent  = emp.name  || '—';
  document.getElementById('empDhTitle').textContent = emp.title || '—';
  document.getElementById('empDhDept').textContent  = emp.department || '—';
  const emailEl = document.getElementById('empDhEmail');
  emailEl.textContent = emp.email || '—';
  emailEl.href = emp.email ? `mailto:${emp.email}` : '#';
  document.getElementById('empDhPhone').textContent = emp.phone || '—';
  document.getElementById('empDhHired').textContent = emp.hireDate
    ? new Date(emp.hireDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';
  const statMap = { active: '🟢 Active', 'on-leave': '🟡 On Leave', inactive: '⚫ Inactive' };
  document.getElementById('empDhStatus').textContent = statMap[emp.status] || emp.status || '—';
  document.getElementById('empDhBio').textContent    = emp.bio || '—';
  const dot = document.getElementById('empDhDot');
  const dc  = { active: '#10b981', 'on-leave': '#f59e0b', inactive: '#6b7280' };
  if (dot) { dot.style.background = dc[emp.status] || '#6b7280'; dot.title = statMap[emp.status] || ''; }
  renderEmpNotes(emp.notes || []);
  document.getElementById('empDrawer').hidden        = false;
  document.getElementById('empDrawerOverlay').hidden = false;
}

function closeEmpDrawer() {
  document.getElementById('empDrawer').hidden        = true;
  document.getElementById('empDrawerOverlay').hidden = true;
  _currentEmpId = null;
}

function renderEmpNotes(notes) {
  const list = document.getElementById('empNotesList');
  if (!list) return;
  if (!notes.length) {
    list.innerHTML = '<p class="empty-msg" style="padding:12px 0;font-size:.78rem">No notes yet.</p>';
    return;
  }
  list.innerHTML = [...notes].reverse().map(n => `
    <div class="emp-note">
      <div class="emp-note-meta">
        <span class="emp-note-author">${esc(n.by || 'Admin')}</span>
        <span class="emp-note-time">${n.at ? new Date(n.at).toLocaleString() : ''}</span>
      </div>
      <div class="emp-note-text">${esc(n.text || '')}</div>
    </div>`).join('');
}

async function addEmployeeNote(id) {
  if (!id) return;
  const input = document.getElementById('empNoteInput');
  const text  = input?.value.trim();
  if (!text) return;
  const note = { text, by: currentUserData?.name || currentUserData?.email || 'Admin', at: Date.now() };
  const emp  = _allEmployees.find(e => e.id === id);
  if (!emp) return;
  const notes = [...(emp.notes || []), note];
  try {
    await fb.updateDoc(fb.doc(_db, 'hub_employees', id), { notes });
    emp.notes = notes;
    renderEmpNotes(notes);
    input.value = '';
    toast('Note posted.', 'success');
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

function openEmpModal(id) {
  const emp = id ? _allEmployees.find(e => e.id === id) : null;
  document.getElementById('empModalTitle').textContent = emp ? 'Edit Employee' : 'Add Employee';
  document.getElementById('empMName').value     = emp?.name       || '';
  document.getElementById('empMTitle').value    = emp?.title      || '';
  document.getElementById('empMDept').value     = emp?.department || 'Engineering';
  document.getElementById('empMStatus').value   = emp?.status     || 'active';
  document.getElementById('empMEmail').value    = emp?.email      || '';
  document.getElementById('empMPhone').value    = emp?.phone      || '';
  document.getElementById('empMHireDate').value = emp?.hireDate   || '';
  document.getElementById('empMBio').value      = emp?.bio        || '';
  const preview = document.getElementById('empModalPhotoPreview');
  const icon    = document.getElementById('empModalPhotoIcon');
  if (emp?.photoUrl) {
    preview.src = emp.photoUrl; preview.style.display = 'block';
    if (icon) icon.style.display = 'none';
  } else {
    preview.style.display = 'none';
    if (icon) icon.style.display = 'block';
  }
  document.getElementById('empModalSave').dataset.editId = id || '';
  document.getElementById('empModal').hidden = false;
  closeEmpDrawer();
}

function closeEmpModal() {
  document.getElementById('empModal').hidden = true;
  document.getElementById('empModalPhotoInput').value = '';
}

async function saveEmployee() {
  const btn    = document.getElementById('empModalSave');
  const editId = btn.dataset.editId;
  const name   = document.getElementById('empMName').value.trim();
  const title  = document.getElementById('empMTitle').value.trim();
  if (!name || !title) { toast('Name and title are required.', 'error'); return; }
  btn.textContent = 'Saving…'; btn.disabled = true;
  let photoUrl = editId ? (_allEmployees.find(e => e.id === editId)?.photoUrl || '') : '';
  const fileInput = document.getElementById('empModalPhotoInput');
  if (fileInput.files[0]) {
    try { photoUrl = await uploadToCloudinary(fileInput.files[0]); }
    catch(e) { toast('Photo upload failed: ' + e.message, 'warn'); }
  }
  const data = {
    name, title,
    department: document.getElementById('empMDept').value,
    status:     document.getElementById('empMStatus').value,
    email:      document.getElementById('empMEmail').value.trim(),
    phone:      document.getElementById('empMPhone').value.trim(),
    hireDate:   document.getElementById('empMHireDate').value,
    bio:        document.getElementById('empMBio').value.trim(),
    photoUrl,
    updatedAt:  fb.serverTimestamp(),
  };
  try {
    if (editId) {
      await fb.updateDoc(fb.doc(_db, 'hub_employees', editId), data);
      const idx = _allEmployees.findIndex(e => e.id === editId);
      if (idx >= 0) _allEmployees[idx] = { id: editId, ..._allEmployees[idx], ...data };
      toast('Employee updated.', 'success');
      logActivity(`Updated employee "${name}"`);
    } else {
      data.createdAt = fb.serverTimestamp();
      data.notes     = [];
      const ref = await fb.addDoc(fb.collection(_db, 'hub_employees'), data);
      _allEmployees.push({ id: ref.id, ...data });
      toast('Employee added!', 'success');
      logActivity(`Added employee "${name}"`);
    }
    renderEmployeeGrid(_allEmployees);
    closeEmpModal();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  finally    { btn.textContent = 'Save Employee'; btn.disabled = false; }
}

async function deleteEmployee(id) {
  if (!id || !confirm('Delete this employee profile? This cannot be undone.')) return;
  const name = _allEmployees.find(e => e.id === id)?.name || id;
  try {
    await fb.deleteDoc(fb.doc(_db, 'hub_employees', id));
    _allEmployees = _allEmployees.filter(e => e.id !== id);
    renderEmployeeGrid(_allEmployees);
    closeEmpDrawer();
    toast('Employee deleted.', 'warn');
    logActivity(`Deleted employee "${name}"`);
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

// ════════════════════════════════════════════════════════════════
//  ADMIN TWEAKS v1.0 — 10 enhancements
//  1. Keyboard shortcuts panel (? key)
//  2. Table density toggle (T key / button)
//  3. Real-time pending badge + notif count (onSnapshot)
//  4. logAudit on approve / reject / role changes
//  5. Search pre-warm (load data in background after sign-in)
//  6. Select-all checkbox in users table
//  7. User row click → profile drawer
//  8. Inline app status toggle (click status pill)
//  9. Analytics chart re-render fix on page switch
//  10. Shortcuts hint in sidebar
// ════════════════════════════════════════════════════════════════

// ── 1. KEYBOARD SHORTCUTS PANEL ──────────────────────────────────
(function initShortcutsPanel() {
  const modal = document.createElement('div');
  modal.id = 'shortcutsModal';
  modal.className = 'shortcuts-modal';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="sc-box">
      <div class="sc-head">
        <span>⌨️ Keyboard Shortcuts</span>
        <button id="scClose" class="sc-close">✕</button>
      </div>
      <div class="sc-grid">
        <div class="sc-col">
          <div class="sc-col-title">Navigate to…</div>
          <div class="sc-row"><div class="sc-keys"><kbd>G</kbd><kbd>D</kbd></div><span>Dashboard</span></div>
          <div class="sc-row"><div class="sc-keys"><kbd>G</kbd><kbd>U</kbd></div><span>Users</span></div>
          <div class="sc-row"><div class="sc-keys"><kbd>G</kbd><kbd>A</kbd></div><span>Apps</span></div>
          <div class="sc-row"><div class="sc-keys"><kbd>G</kbd><kbd>M</kbd></div><span>Music</span></div>
          <div class="sc-row"><div class="sc-keys"><kbd>G</kbd><kbd>N</kbd></div><span>Analytics</span></div>
          <div class="sc-row"><div class="sc-keys"><kbd>G</kbd><kbd>P</kbd></div><span>Posts</span></div>
          <div class="sc-row"><div class="sc-keys"><kbd>G</kbd><kbd>F</kbd></div><span>Feedback</span></div>
          <div class="sc-row"><div class="sc-keys"><kbd>G</kbd><kbd>L</kbd></div><span>Audit Log</span></div>
        </div>
        <div class="sc-col">
          <div class="sc-col-title">Actions</div>
          <div class="sc-row"><div class="sc-keys"><kbd>Ctrl</kbd><kbd>K</kbd></div><span>Global search</span></div>
          <div class="sc-row"><div class="sc-keys"><kbd>?</kbd></div><span>This panel</span></div>
          <div class="sc-row"><div class="sc-keys"><kbd>T</kbd></div><span>Toggle density</span></div>
          <div class="sc-row"><div class="sc-keys"><kbd>Esc</kbd></div><span>Close panels</span></div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const close = () => { modal.hidden = true; };
  document.getElementById('scClose').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });

  let _gPressed = false, _gTimer;
  const G_MAP = { d:'dashboard', u:'users', a:'apps', m:'music', n:'analytics', p:'posts', f:'feedback', l:'auditlog' };

  document.addEventListener('keydown', e => {
    if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === '?') { modal.hidden = !modal.hidden; return; }
    if (e.key === 'Escape' && !modal.hidden) { close(); return; }
    if (e.key === 't' || e.key === 'T') { window._toggleDensity?.(); return; }

    if (e.key === 'g' || e.key === 'G') {
      _gPressed = true;
      clearTimeout(_gTimer);
      _gTimer = setTimeout(() => { _gPressed = false; }, 1500);
      return;
    }
    if (_gPressed) {
      clearTimeout(_gTimer); _gPressed = false;
      const page = G_MAP[e.key.toLowerCase()];
      if (page) showPage(page);
    }
  });
})();

// ── 2. TABLE DENSITY TOGGLE ───────────────────────────────────────
(function initDensityToggle() {
  const saved = localStorage.getItem('hub_density') || 'comfortable';
  document.body.setAttribute('data-density', saved);

  window._toggleDensity = function() {
    const compact = document.body.getAttribute('data-density') === 'compact';
    const next = compact ? 'comfortable' : 'compact';
    document.body.setAttribute('data-density', next);
    localStorage.setItem('hub_density', next);
    toast(compact ? 'Comfortable view' : 'Compact view');
    const btn = document.getElementById('densityToggleBtn');
    if (btn) btn.classList.toggle('active', !compact);
  };

  // Inject button into the mobile top bar (visible on all pages)
  const mobBar = document.querySelector('.mob-bar');
  if (mobBar) {
    const btn = document.createElement('button');
    btn.id = 'densityToggleBtn';
    btn.className = 'mob-search-btn' + (saved === 'compact' ? ' active' : '');
    btn.title = 'Toggle density (T)';
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="17" height="17"><line x1="3" y1="5" x2="21" y2="5"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="13" x2="21" y2="13"/><line x1="3" y1="17" x2="21" y2="17"/></svg>`;
    btn.addEventListener('click', window._toggleDensity);
    mobBar.appendChild(btn);
  }
})();

// ── 3. REAL-TIME BADGES via onSnapshot ───────────────────────────
(function initRealtimeBadges() {
  const waitReady = fn => {
    const check = () => (typeof fb !== 'undefined' && fb.onSnapshot && _db) ? fn() : setTimeout(check, 300);
    check();
  };
  waitReady(() => {
    try {
      // Pending users badge — updates live as users register
      fb.onSnapshot(
        fb.query(fb.collection(_db, 'hub_users'), fb.where('status', '==', 'pending')),
        snap => {
          const n = snap.size;
          const badge  = document.getElementById('pendingBadge');
          const tabCnt = document.getElementById('pendingTabCount');
          if (badge)  { badge.textContent = n; badge.hidden = n === 0; }
          if (tabCnt) tabCnt.textContent = n;
          document.title = n > 0 ? `(${n}) HUB — Control Center` : 'HUB — App Control Center';
        },
        () => {} // silently ignore permission errors
      );
      // Notification count in dashboard stat card
      fb.onSnapshot(fb.collection(_db, 'hub_notifications'), snap => {
        const el = document.getElementById('statNotifs');
        if (el) el.textContent = snap.size;
      }, () => {});
    } catch(e) { console.warn('[RT badges]', e); }
  });
})();

// ── 4. AUDIT LOG — patch missing calls ───────────────────────────
(function patchMissingAuditCalls() {
  const _origApprove = window.approveUser;
  if (_origApprove) {
    window.approveUser = async function(uid) {
      await _origApprove(uid);
      const u = allUsers.find(x => x.id === uid);
      logAudit('Approved user: ' + (u?.email || uid));
    };
  }
  const _origReject = window.rejectUser;
  if (_origReject) {
    window.rejectUser = async function(uid) {
      await _origReject(uid);
      const u = allUsers.find(x => x.id === uid);
      logAudit('Rejected user: ' + (u?.email || uid));
    };
  }
  const _origRole = window.updateRole;
  if (_origRole) {
    window.updateRole = async function(uid, role) {
      await _origRole(uid, role);
      const u = allUsers.find(x => x.id === uid);
      logAudit('Set role "' + role + '" for ' + (u?.email || uid));
    };
  }
})();

// ── 5. SEARCH PRE-WARM — load data in background after sign-in ───
(function initSearchPrewarm() {
  const _orig = setupUserDisplay;
  setupUserDisplay = function() {
    _orig();
    setTimeout(() => {
      if (!allUsers.length  && typeof loadUsers  === 'function') loadUsers().catch(() => {});
      if (!allApps.length   && typeof loadApps   === 'function') loadApps().catch(() => {});
      if (!allTracks.length && typeof loadMusic  === 'function') loadMusic().catch(() => {});
    }, 1200);
  };
})();

// ── 6. SELECT-ALL CHECKBOX IN USERS TABLE ────────────────────────
(function initSelectAll() {
  const userTabs = document.querySelector('.user-tabs');
  if (!userTabs) return;

  const label = document.createElement('label');
  label.className = 'select-all-label';
  label.title = 'Select / deselect all visible users';
  const cb   = document.createElement('input');
  cb.type    = 'checkbox';
  cb.id      = 'selectAllUsers';
  const span = document.createElement('span');
  span.textContent = 'Select all';
  label.appendChild(cb);
  label.appendChild(span);
  userTabs.after(label);

  cb.addEventListener('change', () => {
    document.querySelectorAll('.user-bulk-cb').forEach(ucb => {
      if (ucb.checked !== cb.checked) {
        ucb.checked = cb.checked;
        ucb.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  });
  // Reset on list re-render
  new MutationObserver(() => { cb.checked = false; })
    .observe(document.getElementById('userList') || document.body, { childList: true });
})();

// ── 7. USER ROW CLICK → PROFILE DRAWER ──────────────────────────
(function patchUserRowClick() {
  const _orig = renderUsers;
  renderUsers = function(users, tab) {
    _orig(users, tab);
    document.querySelectorAll('#userList .user-row:not([data-click-wired])').forEach(row => {
      row.dataset.clickWired = '1';
      row.style.cursor = 'pointer';
      row.addEventListener('click', e => {
        if (e.target.closest('button,select,input,a,label')) return;
        const uid = row.dataset.uid;
        if (uid && typeof openUserProfileDrawer === 'function') openUserProfileDrawer(uid);
      });
    });
  };
})();

// ── 8. INLINE APP STATUS TOGGLE (click pill to cycle) ────────────
(function patchAppStatusToggle() {
  const CYCLE = { active:'maintenance', maintenance:'draft', draft:'active' };
  const _orig = renderApps;
  renderApps = function(apps) {
    _orig(apps);
    document.querySelectorAll('.app-status-pill:not([data-wired])').forEach(pill => {
      pill.dataset.wired = '1';
      pill.style.cursor  = 'pointer';
      pill.title         = 'Click to cycle: active → maintenance → draft';
      pill.addEventListener('click', async e => {
        e.stopPropagation();
        const card = pill.closest('.app-card');
        const id   = card?.dataset.id;
        if (!id) return;
        const app  = allApps.find(a => a.id === id);
        if (!app) return;
        const next = CYCLE[app.status || 'active'] || 'active';
        try {
          await fb.updateDoc(fb.doc(_db, 'hub_apps', id), { status: next, updatedAt: fb.serverTimestamp() });
          app.status   = next;
          pill.textContent = next;
          pill.className   = 'app-status-pill status-' + next;
          logAudit('App "' + app.name + '" status → ' + next);
          toast('Status → ' + next, 'success');
        } catch(err) { toast('Error: ' + err.message, 'error'); }
      });
    });
  };
})();

// ── 9. ANALYTICS CHART — re-render when page becomes active ──────
(function patchAnalyticsVisibility() {
  const _orig = window.showPage;
  window.showPage = function(name) {
    _orig(name);
    if (name === 'analytics') {
      setTimeout(() => {
        if (typeof renderAnLineChart === 'function') renderAnLineChart();
      }, 200);
    }
  };
})();

// ── 10. SHORTCUTS HINT IN SIDEBAR ────────────────────────────────
(function injectShortcutsHint() {
  const clock = document.getElementById('sbClock');
  if (!clock) return;
  const hint = document.createElement('button');
  hint.className = 'sb-shortcuts-hint';
  hint.textContent = 'Press ? for shortcuts';
  hint.addEventListener('click', () => {
    const m = document.getElementById('shortcutsModal');
    if (m) m.hidden = !m.hidden;
  });
  clock.after(hint);
})();

// ════════════════════════════════════════════════════════════════
//  MUSIC — WAVEFORM PLAYER + AUDIO FINGERPRINTING
//  • Content-based duplicate detection (audio fingerprint)
//  • Waveform stored in Firestore, drawn as canvas bars
//  • Inline player per row: play/pause, seek, live time
//  • Full player inside the edit modal
// ════════════════════════════════════════════════════════════════

// ── Audio fingerprint via Web Audio API ──────────────────────────
// Samples first 6 seconds of audio, hashes PCM data.
// Two identical audio files (even renamed) will produce the same hash.
async function computeAudioFingerprint(file) {
  try {
    const actx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 22050 });
    const buf  = await actx.decodeAudioData(await file.arrayBuffer());
    actx.close();
    const ch   = buf.getChannelData(0);
    const win  = Math.min(ch.length, buf.sampleRate * 6); // first 6 seconds
    const N    = 100;
    const step = Math.floor(win / N);
    const pts  = [];
    for (let i = 0; i < N; i++) pts.push(Math.round((ch[i * step] || 0) * 1000));
    // DJB2 hash
    let h = 5381;
    for (let i = 0, s = pts.join(','); i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
    return (h >>> 0).toString(36);
  } catch(e) { console.warn('[Fingerprint]', e.message); return ''; }
}

// ── Waveform amplitude data (60 peaks, normalized 0-1) ───────────
async function computeWaveformData(file, bars = 60) {
  try {
    const actx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 22050 });
    const buf  = await actx.decodeAudioData(await file.arrayBuffer());
    actx.close();
    const ch   = buf.getChannelData(0);
    const step = Math.floor(ch.length / bars);
    const data = [];
    for (let i = 0; i < bars; i++) {
      let peak = 0;
      for (let j = 0; j < step; j++) { const a = Math.abs(ch[i * step + j] || 0); if (a > peak) peak = a; }
      data.push(peak);
    }
    const max = Math.max(...data, 0.001);
    return data.map(v => Math.round((v / max) * 100) / 100);
  } catch(e) { console.warn('[WaveformData]', e.message); return []; }
}

// ── Draw real waveform from stored data ───────────────────────────
function drawWaveform(canvas, data, progress = 0) {
  if (!canvas || !data?.length) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const bw = W / data.length, px = progress * W;
  data.forEach((amp, i) => {
    const x = i * bw, bh = Math.max(2, amp * H * 0.88), y = (H - bh) / 2;
    ctx.fillStyle = x < px ? 'rgba(124,114,255,0.95)' : 'rgba(255,255,255,0.2)';
    ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, bw - 1), Math.round(bh));
  });
}

// ── Draw deterministic placeholder when no waveform stored ────────
function drawPlaceholder(canvas, seed) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  let n = (seed | 0) || 99991;
  const bars = Math.floor(W / 3);
  const bw = W / bars;
  for (let i = 0; i < bars; i++) {
    n = (Math.imul(n, 1664525) + 1013904223) | 0;
    const amp = 0.15 + ((n >>> 0) / 0xffffffff) * 0.65;
    const bh = Math.max(2, amp * H * 0.85);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(Math.round(i * bw), Math.round((H - bh) / 2), Math.max(1, bw - 1), Math.round(bh));
  }
}

// ── handleMusicFiles — patch to add fingerprint + waveform ────────
const _origHandleMusic = handleMusicFiles;
handleMusicFiles = async function(files) {
  const AUDIO_EXT = /\.(mp3|m4a|flac|wav|ogg|aac)$/i;
  const audioFiles = [...files].filter(f => f.type.startsWith('audio/') || AUDIO_EXT.test(f.name));
  if (!audioFiles.length) { toast('No audio files found.', 'error'); return; }

  const progWrap = document.getElementById('musicUploadProgress');
  const bar      = document.getElementById('musicUpBar');
  const status   = document.getElementById('musicUpStatus');
  progWrap.hidden = false;
  document.getElementById('musicDropZone').hidden = true;

  // Phase 1: analyze (fingerprint + waveform + duration)
  const ready = [], dupes = [];
  for (let i = 0; i < audioFiles.length; i++) {
    const file = audioFiles[i];
    status.textContent = `Analyzing ${i + 1}/${audioFiles.length}: ${file.name}…`;
    bar.style.width = ((i / audioFiles.length) * 28) + '%';
    const [fingerprint, waveformData, duration] = await Promise.all([
      computeAudioFingerprint(file),
      computeWaveformData(file),
      getAudioDuration(file),
    ]);
    const existing = fingerprint && allTracks.find(t => t.audioFingerprint === fingerprint);
    (existing ? dupes : ready).push({ file, fingerprint, waveformData, duration, existing });
  }

  // Phase 2: warn about duplicates
  if (dupes.length) {
    const lines = dupes.map(d =>
      `• "${d.file.name}"  →  matches  "${d.existing.title}" by ${d.existing.artist || 'Unknown'}`
    ).join('\n');
    if (confirm(`⚠️ ${dupes.length} file(s) already exist in the library (detected by audio content — not filename):\n\n${lines}\n\nClick OK to upload anyway, or Cancel to skip them.`)) {
      ready.push(...dupes);
    }
  }
  if (!ready.length) {
    progWrap.hidden = true;
    document.getElementById('musicDropZone').hidden = false;
    bar.style.width = '0%';
    return;
  }

  // Phase 3: upload
  let added = 0;
  for (let i = 0; i < ready.length; i++) {
    const { file, fingerprint, waveformData, duration } = ready[i];
    status.textContent = `Uploading ${i + 1}/${ready.length}: ${file.name}`;
    try {
      const url = await uploadToCloudinary(file, pct => {
        bar.style.width = (28 + ((i + pct) / ready.length) * 72) + '%';
      });
      const base   = file.name.replace(/\.[^.]+$/, '');
      const parts  = base.split(' - ');
      const artist = parts.length > 1 ? parts[0].trim() : 'Unknown Artist';
      const title  = parts.length > 1 ? parts.slice(1).join(' - ').trim() : base;
      await fb.addDoc(fb.collection(_db, 'tracks'), {
        title, artist, album: '', url, cover: '',
        duration, waveformData, audioFingerprint: fingerprint,
        addedAt: fb.serverTimestamp(),
        uploadedBy: currentUser?.uid || '',
      });
      toast(`✓ ${title}`, 'success');
      added++;
    } catch(e) { toast(`Failed: ${file.name} — ${e.message}`, 'error'); }
  }
  bar.style.width = '100%';
  status.textContent = `Done! ${added} track${added !== 1 ? 's' : ''} added.`;
  setTimeout(() => { progWrap.hidden = true; document.getElementById('musicDropZone').hidden = false; bar.style.width = '0%'; }, 1400);
  if (added) { loadMusic(); logActivity(`${added} track(s) uploaded`); }
};

// ── Waveform player — injected into each track row ────────────────
(function initMusicWaveformPlayer() {
  let _aud = null, _actId = null, _animId = null;

  function stopAll() {
    if (_aud) { _aud.pause(); _aud = null; }
    if (_animId) { cancelAnimationFrame(_animId); _animId = null; }
    _actId = null;
    document.querySelectorAll('.mwp-btn').forEach(b => { b.textContent = '▶'; b.classList.remove('playing'); });
    document.querySelectorAll('.mwp-canvas').forEach(c => {
      const tid = c.closest('[data-track-id]')?.dataset.trackId;
      const t   = allTracks.find(x => x.id === tid);
      if (t?.waveformData?.length) drawWaveform(c, t.waveformData, 0);
      else drawPlaceholder(c, parseInt((tid || '').slice(-6), 36));
    });
  }

  function animate(canvas, tid) {
    if (!_aud || _actId !== tid) return;
    const t = allTracks.find(x => x.id === tid);
    if (t?.waveformData?.length) drawWaveform(canvas, t.waveformData, _aud.duration ? _aud.currentTime / _aud.duration : 0);
    const timeEl = canvas.parentElement?.querySelector('.mwp-time');
    if (timeEl && _aud.duration) timeEl.textContent = fmtDuration(_aud.currentTime) + ' / ' + fmtDuration(_aud.duration);
    _animId = requestAnimationFrame(() => animate(canvas, tid));
  }

  function playTrack(tid, url, btn, canvas) {
    if (_actId === tid) {
      if (_aud?.paused) { _aud.play(); btn.textContent = '⏸'; btn.classList.add('playing'); animate(canvas, tid); }
      else { _aud?.pause(); btn.textContent = '▶'; btn.classList.remove('playing'); cancelAnimationFrame(_animId); _animId = null; }
      return;
    }
    stopAll();
    _actId = tid;
    _aud   = new Audio(url);
    _aud.play().catch(() => {});
    btn.textContent = '⏸'; btn.classList.add('playing');
    animate(canvas, tid);
    _aud.addEventListener('ended', stopAll);
  }

  const _prev = renderMusicTracks;
  renderMusicTracks = function(tracks) {
    _prev(tracks);
    // Remove old basic preview buttons
    document.querySelectorAll('#musicTrackList .preview-btn').forEach(b => b.remove());

    document.querySelectorAll('#musicTrackList .music-track-row:not([data-wired-player])').forEach(row => {
      row.dataset.wiredPlayer = '1';
      const tid = row.dataset.trackId;
      if (!tid) return;
      const t = allTracks.find(x => x.id === tid);
      if (!t?.url) return;

      const player = document.createElement('div');
      player.className = 'mwp-player';

      const btn = document.createElement('button');
      btn.className   = 'mwp-btn';
      btn.textContent = (_actId === tid && !_aud?.paused) ? '⏸' : '▶';
      if (_actId === tid && !_aud?.paused) btn.classList.add('playing');
      btn.title = 'Preview track';

      const canvas = document.createElement('canvas');
      canvas.className = 'mwp-canvas';
      canvas.width  = 100;
      canvas.height = 30;
      canvas.title  = 'Click to seek';

      const timeEl = document.createElement('span');
      timeEl.className = 'mwp-time';
      timeEl.textContent = t.duration ? fmtDuration(t.duration) : '—';

      // Fingerprint indicator
      if (!t.audioFingerprint) {
        const noFp = document.createElement('span');
        noFp.className = 'mwp-nofp';
        noFp.title = 'No fingerprint — upload a new copy to enable duplicate detection';
        noFp.textContent = '⚠';
        player.append(noFp);
      }

      player.append(btn, canvas, timeEl);

      if (t.waveformData?.length) {
        const prog = (_actId === tid && _aud?.duration) ? _aud.currentTime / _aud.duration : 0;
        drawWaveform(canvas, t.waveformData, prog);
      } else {
        drawPlaceholder(canvas, parseInt((tid || '').slice(-6), 36));
      }

      btn.addEventListener('click', e => { e.stopPropagation(); playTrack(tid, t.url, btn, canvas); });
      canvas.addEventListener('click', e => {
        if (_actId === tid && _aud?.duration) {
          _aud.currentTime = _aud.duration * ((e.clientX - canvas.getBoundingClientRect().left) / canvas.width);
        } else playTrack(tid, t.url, btn, canvas);
      });
      canvas.style.cursor = 'pointer';

      const actDiv = row.querySelector('.music-track-actions');
      if (actDiv) row.insertBefore(player, actDiv);
      else row.appendChild(player);
    });
  };
  window.renderMusicTracks = renderMusicTracks;

  // ── Player inside the edit modal ─────────────────────────────
  const _origOpen = window.openTrackModal;
  window.openTrackModal = function(id) {
    _origOpen(id);
    const t    = allTracks.find(x => x.id === id);
    const modal = document.getElementById('trackModal');
    if (!t?.url || !modal) return;

    // Remove any existing modal player
    modal.querySelector('#mtp')?.remove();

    const mtp = document.createElement('div');
    mtp.id        = 'mtp';
    mtp.className = 'modal-track-player';
    mtp.innerHTML = `
      <div class="mtp-row">
        <button class="mtp-btn" id="mtpBtn">▶</button>
        <canvas id="mtpCanvas" width="220" height="38" style="cursor:pointer;flex:1"></canvas>
        <span class="mtp-dur" id="mtpTime">${t.duration ? fmtDuration(t.duration) : '—'}</span>
      </div>
      <div class="mtp-meta">
        ${t.audioFingerprint ? `<span class="mtp-fp">✓ Fingerprinted</span>` : '<span class="mtp-fp mtp-nofp">⚠ No fingerprint</span>'}
        · <a href="${esc(t.url)}" target="_blank" rel="noopener" class="mtp-link">Open file ↗</a>
      </div>`;

    // Inject below the modal header
    const hd = modal.querySelector('.modal-hd');
    if (hd) hd.after(mtp);
    else modal.querySelector('.modal')?.prepend(mtp);

    const mtpBtn    = document.getElementById('mtpBtn');
    const mtpCanvas = document.getElementById('mtpCanvas');
    const mtpTime   = document.getElementById('mtpTime');

    if (t.waveformData?.length) drawWaveform(mtpCanvas, t.waveformData, 0);
    else drawPlaceholder(mtpCanvas, parseInt((id || '').slice(-6), 36));

    let _ma = null, _maAnimId = null;
    const resetMtp = () => {
      if (_ma) { _ma.pause(); _ma = null; }
      if (_maAnimId) { cancelAnimationFrame(_maAnimId); _maAnimId = null; }
      mtpBtn.textContent = '▶'; mtpBtn.classList.remove('playing');
      if (t.waveformData?.length) drawWaveform(mtpCanvas, t.waveformData, 0);
      else drawPlaceholder(mtpCanvas, parseInt((id || '').slice(-6), 36));
    };

    function animateMtp() {
      if (!_ma || _ma.paused) return;
      const prog = _ma.duration ? _ma.currentTime / _ma.duration : 0;
      if (t.waveformData?.length) drawWaveform(mtpCanvas, t.waveformData, prog);
      if (_ma.duration) mtpTime.textContent = fmtDuration(_ma.currentTime) + ' / ' + fmtDuration(_ma.duration);
      _maAnimId = requestAnimationFrame(animateMtp);
    }

    mtpBtn.addEventListener('click', () => {
      if (_ma && !_ma.paused) { _ma.pause(); mtpBtn.textContent = '▶'; mtpBtn.classList.remove('playing'); cancelAnimationFrame(_maAnimId); }
      else {
        if (!_ma) { _ma = new Audio(t.url); _ma.addEventListener('ended', resetMtp); }
        _ma.play(); mtpBtn.textContent = '⏸'; mtpBtn.classList.add('playing');
        animateMtp();
      }
    });
    mtpCanvas.addEventListener('click', e => {
      if (_ma?.duration) { _ma.currentTime = _ma.duration * ((e.clientX - mtpCanvas.getBoundingClientRect().left) / mtpCanvas.width); }
      else mtpBtn.click();
    });
    document.getElementById('trackModalClose')?.addEventListener('click', resetMtp, { once: true });
    document.getElementById('trackModalCancel')?.addEventListener('click', resetMtp, { once: true });
  };
})();

// ════════════════════════════════════════════════════════════════
//  TWEAKS v2.0 — 13 new features
// ════════════════════════════════════════════════════════════════

// ── T1: DASHBOARD REAL-TIME STATS via onSnapshot ─────────────────
(function initDashboardRealtime() {
  const waitReady = fn => {
    const check = () => (typeof fb !== 'undefined' && fb.onSnapshot && _db) ? fn() : setTimeout(check, 400);
    check();
  };
  waitReady(() => {
    const snap = (col, elId) => fb.onSnapshot(fb.collection(_db, col), s => {
      const el = document.getElementById(elId);
      if (!el) return;
      el.classList.add('stat-live-pulse');
      setTimeout(() => el.classList.remove('stat-live-pulse'), 650);
      countUp(el, s.size);
    });
    snap('hub_apps',  'statApps');
    snap('hub_users', 'statUsers');
    snap('tracks',    'statTracks');
    snap('hub_assets','statAssets');
    snap('eri_newsletter', 'dashNlCount');
    snap('feedback',       'dashFbCount');
  });
})();

// ── T2: NOTIFICATION LIVE PREVIEW ───────────────────────────────
(function initNotifyPreview() {
  const titleEl  = document.getElementById('notifyTitle');
  const bodyEl   = document.getElementById('notifyBody');
  const preTitle = document.getElementById('previewTitle');
  const preBody  = document.getElementById('previewBody');
  if (!titleEl || !preTitle) return;
  function update() {
    preTitle.textContent = titleEl.value.trim() || 'Notification Title';
    preBody.textContent  = bodyEl?.value.trim() || 'Your message will appear here…';
  }
  titleEl.addEventListener('input', update);
  bodyEl?.addEventListener('input', update);
})();

// ── T3: INLINE QUICK-EDIT on app card name (double-click) ────────
(function initInlineAppEdit() {
  document.getElementById('appGrid')?.addEventListener('dblclick', async e => {
    const nameEl = e.target.closest('.app-card-name');
    if (!nameEl) return;
    const card = nameEl.closest('.app-card');
    const appId = card?.dataset.id;
    if (!appId) return;
    nameEl.contentEditable = 'true';
    nameEl.focus();
    const range = document.createRange();
    range.selectNodeContents(nameEl);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    const save = async () => {
      nameEl.contentEditable = 'false';
      const newName = nameEl.textContent.trim();
      if (!newName) return;
      const app = allApps.find(a => a.id === appId);
      if (!app || newName === app.name) return;
      try {
        await fb.updateDoc(fb.doc(_db, 'hub_apps', appId), { name: newName });
        app.name = newName;
        logAudit(`App renamed to "${newName}"`);
        toast('App renamed!', 'success');
      } catch(err) { toast('Error: ' + err.message, 'error'); }
    };
    nameEl.addEventListener('blur', save, { once: true });
    nameEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); } if (e.key === 'Escape') { nameEl.contentEditable = 'false'; } }, { once: true });
  });
})();

// ── T4: FEEDBACK REPLY BUTTON ────────────────────────────────────
(function patchFeedbackReply() {
  const _origRender = loadFeedback;
  loadFeedback = async function(...args) {
    await _origRender.apply(this, args);
    document.querySelectorAll('.feedback-item').forEach(item => {
      if (item.querySelector('.fb-reply-btn')) return;
      const meta = item.querySelector('.feedback-meta');
      const emailSpan = meta?.querySelector('span');
      const email = emailSpan?.textContent?.trim();
      if (!email || !email.includes('@')) return;
      const btn = document.createElement('button');
      btn.className = 'fb-reply-btn';
      btn.textContent = '✉ Reply';
      btn.title = `Send email to ${email}`;
      btn.onclick = () => {
        const body = item.querySelector('.feedback-body')?.textContent?.trim() || '';
        window.open(`mailto:${email}?subject=Re: Your Feedback&body=\n\n---\nYour original message: "${body}"`, '_blank');
      };
      item.appendChild(btn);
    });
  };
})();

// ── T5: POSTS CSV EXPORT ─────────────────────────────────────────
(function initPostsExport() {
  document.getElementById('exportPostsBtn')?.addEventListener('click', () => {
    if (!window.allPosts?.length) { toast('No posts loaded yet. Open the Posts page first.', 'warn'); return; }
    const rows = [['Title','Author','Status','Created']];
    window.allPosts.forEach(p => {
      const d = p.createdAt?.toDate ? p.createdAt.toDate() : (p.createdAt ? new Date(p.createdAt) : new Date());
      rows.push([p.title||'', p.authorName||p.authorEmail||'', p.status||'', d.toLocaleDateString()]);
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), { href: 'data:text/csv,' + encodeURIComponent(csv), download: 'posts.csv' });
    a.click();
    toast('Posts exported!', 'success');
  });
})();

// ── T6: USER TEXT SEARCH ─────────────────────────────────────────
(function initUserSearch() {
  const input = document.getElementById('userSearch');
  if (!input) return;
  input.addEventListener('input', function() {
    const q = this.value.toLowerCase().trim();
    if (!q) { renderUsers(allUsers, activeUserTab); return; }
    const filtered = allUsers.filter(u =>
      (u.name||'').toLowerCase().includes(q) ||
      (u.email||'').toLowerCase().includes(q) ||
      (u.role||'').toLowerCase().includes(q)
    );
    renderUsers(filtered, 'all');
  });
})();

// ── T7: RECENTLY VISITED PAGES ───────────────────────────────────
(function initRecentPages() {
  const MAX = 5;
  const PAGE_ICONS = { dashboard:'🏠', apps:'📱', users:'👥', music:'🎵', posts:'📄', notify:'🔔', newsletter:'📧', feedback:'💬', analytics:'📊', promotions:'🎯', feedback:'⭐', monetize:'💰', settings:'⚙', auditlog:'📋', storage:'💾', seo:'🔍', versions:'🏷', employees:'👔', assets:'🖼', playlists:'🎧', ericontent:'🇪🇷' };
  let recents = JSON.parse(localStorage.getItem('hub_recents') || '[]');

  function renderRecents() {
    const list = document.getElementById('sbRecentsList');
    const wrap = document.getElementById('sbRecents');
    if (!list || !wrap) return;
    if (!recents.length) { wrap.style.display = 'none'; return; }
    wrap.style.display = '';
    list.innerHTML = recents.map(p => `
      <div class="sb-recent-item" onclick="showPage('${p}')">
        <span class="sb-recent-icon">${PAGE_ICONS[p] || '📄'}</span>
        <span>${p.charAt(0).toUpperCase() + p.slice(1)}</span>
      </div>`).join('');
  }

  const _orig = window.showPage;
  window.showPage = function(name) {
    _orig(name);
    recents = [name, ...recents.filter(r => r !== name)].slice(0, MAX);
    localStorage.setItem('hub_recents', JSON.stringify(recents));
    renderRecents();
  };
  renderRecents();
})();

// ── T8: APP HEALTH MONITOR ───────────────────────────────────────
(function initAppHealthCheck() {
  const checked = new Map();

  async function checkUrl(url) {
    if (!url) return 'offline';
    if (checked.has(url)) return checked.get(url);
    try {
      const res = await fetch(url, { method: 'HEAD', mode: 'no-cors', signal: AbortSignal.timeout(4000) });
      const status = 'online';
      checked.set(url, status);
      return status;
    } catch { checked.set(url, 'offline'); return 'offline'; }
  }

  const _origRenderApps = renderApps;
  window.renderApps = renderApps = function(apps) {
    _origRenderApps(apps);
    document.querySelectorAll('.app-card[data-id]').forEach(card => {
      const appId = card.dataset.id;
      const app   = apps.find(a => a.id === appId);
      if (!app?.url) return;
      const urlRow = card.querySelector('.app-card-url-row') || card.querySelector('.app-card-url');
      if (!urlRow) return;
      let dot = card.querySelector('.app-health-dot');
      if (!dot) {
        dot = document.createElement('span');
        dot.className = 'app-health-dot checking';
        dot.title = 'Checking…';
        if (urlRow.classList.contains('app-card-url-row')) urlRow.prepend(dot);
        else { urlRow.style.display = 'flex'; urlRow.style.alignItems = 'center'; urlRow.style.gap = '5px'; urlRow.prepend(dot); }
      }
      checkUrl(app.url).then(status => {
        dot.className = 'app-health-dot ' + status;
        dot.title = status === 'online' ? '✓ Online' : '✗ Offline or unreachable';
      });
    });
  };
})();

// ── T9: PINNED STICKY NOTES ──────────────────────────────────────
(function initStickyNotes() {
  const ta     = document.getElementById('dashNotes');
  const status = document.getElementById('notesStatus');
  if (!ta) return;
  let saveTimer;

  function loadNote() {
    const waitDb = () => {
      if (!_db || !currentUser) { setTimeout(waitDb, 500); return; }
      fb.getDoc(fb.doc(_db, 'hub_admin_notes', currentUser.uid)).then(d => {
        if (d.exists()) ta.value = d.data().text || '';
      }).catch(() => { ta.value = localStorage.getItem('hub_notes') || ''; });
    };
    waitDb();
  }

  async function saveNote() {
    const text = ta.value;
    if (status) status.textContent = 'Saving…';
    try {
      if (_db && currentUser) await fb.setDoc(fb.doc(_db, 'hub_admin_notes', currentUser.uid), { text, updatedAt: Date.now() });
      else localStorage.setItem('hub_notes', text);
      if (status) status.textContent = 'Saved ✓';
      setTimeout(() => { if (status) status.textContent = ''; }, 2000);
    } catch { localStorage.setItem('hub_notes', text); if (status) status.textContent = 'Saved locally'; }
  }

  ta.addEventListener('input', () => { clearTimeout(saveTimer); if (status) status.textContent = '…'; saveTimer = setTimeout(saveNote, 1200); });
  loadNote();
})();

// ── T10: DASHBOARD REAL-TIME ACTIVITY FEED (already had onSnapshot, ensure wired) ──
// Already handled by initRealtimeBadges and dashboard activity onSnapshot in feature B2.

// ── T11: ENHANCED KEYBOARD SHORTCUT MODAL ────────────────────────
(function enhanceShortcutModal() {
  const modal = document.getElementById('kbdShortcutModal');
  if (!modal) return;
  const list = modal.querySelector('.kbd-shortcut-list');
  if (list) {
    list.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px">
        <div>
          <div style="font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:var(--text-mute);margin-bottom:8px;margin-top:4px">Navigation</div>
          <div class="kbd-row"><kbd>Ctrl</kbd>+<kbd>K</kbd><span>Global search</span></div>
          <div class="kbd-row"><kbd>D</kbd><span>Dashboard</span></div>
          <div class="kbd-row"><kbd>U</kbd><span>Users</span></div>
          <div class="kbd-row"><kbd>M</kbd><span>Music</span></div>
          <div class="kbd-row"><kbd>A</kbd><span>Analytics</span></div>
          <div class="kbd-row"><kbd>1</kbd>–<kbd>9</kbd><span>Jump to page</span></div>
          <div style="font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:var(--text-mute);margin-bottom:8px;margin-top:14px">G + key combos</div>
          <div class="kbd-row"><kbd>G</kbd><kbd>D</kbd><span>Dashboard</span></div>
          <div class="kbd-row"><kbd>G</kbd><kbd>U</kbd><span>Users</span></div>
          <div class="kbd-row"><kbd>G</kbd><kbd>N</kbd><span>Notifications</span></div>
          <div class="kbd-row"><kbd>G</kbd><kbd>M</kbd><span>Music</span></div>
          <div class="kbd-row"><kbd>G</kbd><kbd>A</kbd><span>Analytics</span></div>
        </div>
        <div>
          <div style="font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:var(--text-mute);margin-bottom:8px;margin-top:4px">Actions</div>
          <div class="kbd-row"><kbd>N</kbd><span>New item on page</span></div>
          <div class="kbd-row"><kbd>R</kbd><span>Refresh page data</span></div>
          <div class="kbd-row"><kbd>Ctrl</kbd>+<kbd>S</kbd><span>Save form</span></div>
          <div class="kbd-row"><kbd>?</kbd><span>This shortcuts panel</span></div>
          <div class="kbd-row"><kbd>Esc</kbd><span>Close modal / cancel</span></div>
          <div style="font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:var(--text-mute);margin-bottom:8px;margin-top:14px">New in v2.0</div>
          <div class="kbd-row"><span>Double-click app name</span><span style="color:var(--accent2)">Inline rename</span></div>
          <div class="kbd-row"><span>Ctrl+K → type</span><span style="color:var(--accent2)">Search everything</span></div>
          <div class="kbd-row"><span>Pinned Notes</span><span style="color:var(--accent2)">Auto-saves to cloud</span></div>
          <div class="kbd-row"><span>Health dots</span><span style="color:var(--accent2)">App online/offline</span></div>
        </div>
      </div>`;
  }
  modal.addEventListener('click', e => { if (e.target === modal) modal.hidden = true; });
  document.getElementById('kbdShortcutClose')?.addEventListener('click', () => { modal.hidden = true; });
})();

// ── T12: CSV EXPORT FOR POSTS (ensure allPosts is global) ────────
// allPosts is already global in admin.js — no extra action needed.
// exportPostsBtn wired in T5 above.

// ── T13: APP HEALTH — wrap app url in health row for dot inject ──
(function patchAppCardUrl() {
  const _origRender = typeof renderApps === 'function' ? renderApps : null;
  if (!_origRender) return;
  const origFn = renderApps;
  window.renderApps = renderApps = function(apps) {
    origFn(apps);
    document.querySelectorAll('.app-card-url').forEach(el => {
      if (!el.classList.contains('app-card-url-row')) el.classList.add('app-card-url-row');
    });
  };
})();

// ════════════════════════════════════════════════════════════════
//  TWEAKS v3.0 — 20 powerful enhancements
//  T14. Command Palette v2 (action mode via > prefix)
//  T15. Session Timer + auto-logout warning
//  T16. Live Activity Feed Panel + FAB
//  T17. Broadcast Banner Tool
//  T18. Data Export Hub
//  T19. Dashboard Sparklines
//  T20. Bulk User Actions
//  T21. Quick Reply Templates
//  T22. Sidebar Favorites (pin pages with ★)
//  T23. Smart Alerts Detector
//  T24. Quick User Card on hover
//  T25. Character Counter on textareas
//  T26. Session History Timeline in sidebar
//  T27. Copy-on-Click IDs and emails
//  T28. Milestone Confetti
//  T29. Floating Speed Dial FAB
//  T30. System Health Bar
//  T31. Sortable Table Columns
//  T32. Markdown Preview for Posts
//  T33. Customizable Dashboard (drag-to-reorder)
// ════════════════════════════════════════════════════════════════

// ── T14: COMMAND PALETTE v2 (action mode) ────────────────────────
(function initCommandPalette() {
  const overlay  = document.getElementById('gsearchOverlay');
  const input    = document.getElementById('gsearchInput');
  const results  = document.getElementById('gsearchResults');
  if (!overlay || !input || !results) return;

  const ACTIONS = [
    { label:'📡 Broadcast Banner',   hint:'Push site-wide alert to all users', key:'broadcast banner alert',   fn:() => { document.getElementById('broadcastModal').hidden = false; } },
    { label:'📦 Export Hub',         hint:'Download any collection as CSV',    key:'export csv download data', fn:() => { document.getElementById('exportHubModal').hidden = false; } },
    { label:'📊 Live Activity',      hint:'Open real-time activity feed',       key:'activity live feed',       fn:() => { const f = document.getElementById('activityFab'); if (f) f.click(); } },
    { label:'➕ New App',            hint:'Add a new application',             key:'new app add create',       fn:() => { showPage('apps'); setTimeout(() => document.getElementById('addAppBtn')?.click(), 350); } },
    { label:'🔔 New Notification',   hint:'Send a push notification',          key:'notify notification push', fn:() => showPage('notify') },
    { label:'👥 View Users',         hint:'Open the users page',               key:'users people',             fn:() => showPage('users') },
    { label:'📊 Analytics',          hint:'View analytics dashboard',          key:'analytics stats charts',   fn:() => showPage('analytics') },
    { label:'🎵 Music Library',      hint:'Manage Eri Music tracks',           key:'music tracks library',     fn:() => showPage('erimusic') },
    { label:'🌙 Toggle Theme',       hint:'Switch between dark and light mode', key:'theme dark light mode',  fn:() => document.getElementById('darkModeBtn')?.click() },
    { label:'⌨️ Keyboard Shortcuts', hint:'View all keyboard shortcuts',       key:'shortcuts keyboard keys',  fn:() => { document.getElementById('kbdShortcutModal').hidden = false; } },
    { label:'🏠 Dashboard',          hint:'Go to the main dashboard',          key:'dashboard home',           fn:() => showPage('dashboard') },
    { label:'📋 Audit Log',          hint:'View the admin audit log',          key:'audit log history',        fn:() => showPage('auditlog') },
    { label:'📧 Newsletter',         hint:'Manage newsletter subscribers',     key:'newsletter email',         fn:() => showPage('newsletter') },
    { label:'💰 Monetize',           hint:'Revenue and monetization settings', key:'monetize revenue money',   fn:() => showPage('monetize') },
  ];

  input.addEventListener('input', function() {
    const raw = this.value.trim();
    if (!raw.startsWith('>')) return;
    const cmd = raw.slice(1).trim().toLowerCase();
    const matches = ACTIONS.filter(a => !cmd || a.key.includes(cmd) || a.label.toLowerCase().includes(cmd));
    results.innerHTML = (matches.length
      ? `<div class="cmd-palette-hint">Actions — press Enter or click</div>` +
        matches.map((a, i) => `
          <div class="gsearch-result cmd-action" data-idx="${i}">
            <div class="gsearch-result-label">${a.label}</div>
            <div class="gsearch-result-sub">${a.hint}</div>
          </div>`).join('')
      : `<div class="gsearch-empty">No action matched "<em>${cmd || '…'}</em>". Try: broadcast, export, users…</div>`
    );
    results.querySelectorAll('.cmd-action').forEach((el, i) => {
      el.addEventListener('click', () => {
        overlay.hidden = true; input.value = '';
        matches[i]?.fn();
      });
    });
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && input.value.startsWith('>')) {
      results.querySelector('.cmd-action')?.click();
    }
  });

  // Add the ">" hint inside the search overlay
  const box = overlay.querySelector('.gsearch-box');
  if (box) {
    const tip = document.createElement('div');
    tip.style.cssText = 'font-size:.67rem;color:var(--text-mute);padding:6px 12px;text-align:center;border-top:1px solid var(--border)';
    tip.textContent = 'Tip: type > to run commands  ·  Ctrl+K to open';
    box.appendChild(tip);
  }
})();

// ── T15: SESSION TIMER + AUTO-LOGOUT WARNING ─────────────────────
(function initSessionTimer() {
  let startTime  = null;
  let warned7h45 = false;
  let timerEl    = null;

  function inject() {
    const clock = document.getElementById('sbClock');
    if (!clock || document.getElementById('sbSessionTimer')) return;
    timerEl = document.createElement('div');
    timerEl.id = 'sbSessionTimer';
    timerEl.className = 'sb-session-timer';
    clock.after(timerEl);
  }

  function tick() {
    if (!startTime || !timerEl) return;
    const ms = Date.now() - startTime;
    const h  = Math.floor(ms / 3600000);
    const m  = Math.floor((ms % 3600000) / 60000);
    const s  = Math.floor((ms % 60000) / 1000);
    timerEl.textContent = `Session: ${h ? h + 'h ' : ''}${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;

    if (ms >= 7 * 3600000 + 45 * 60000 && !warned7h45) {
      warned7h45 = true;
      timerEl.classList.add('st-warn');
      toast('⚠️ Session is 7 h 45 min old — auto-logout in 15 min.', 'warn');
    }
    if (ms >= 8 * 3600000) {
      timerEl.classList.add('st-danger');
      toast('🔒 8-hour session limit reached. Signing out…', 'error');
      setTimeout(() => document.getElementById('signOutBtn')?.click(), 2500);
    }
  }

  function waitLogin() {
    if (!window.currentUser) { setTimeout(waitLogin, 500); return; }
    inject();
    startTime = Date.now();
    setInterval(() => { if (!document.hidden) tick(); }, 30000);
  }
  waitLogin();
})();

// ── T16: LIVE ACTIVITY FEED PANEL ────────────────────────────────
(function initActivityFeed() {
  const fab      = document.getElementById('activityFab');
  const panel    = document.getElementById('activityPanel');
  const overlay  = document.getElementById('activityPanelOverlay');
  const list     = document.getElementById('activityPanelList');
  const badge    = document.getElementById('activityFabBadge');
  const closeBtn = document.getElementById('activityPanelClose');
  if (!fab || !panel) return;

  let isOpen = false, unread = 0;

  function openPanel() {
    isOpen = true;
    panel.hidden = false; overlay.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add('open')));
    unread = 0; badge.hidden = true; badge.textContent = '0';
  }
  function closePanel() {
    isOpen = false;
    panel.classList.remove('open');
    setTimeout(() => { panel.hidden = true; overlay.hidden = true; }, 260);
  }

  fab.addEventListener('click', () => isOpen ? closePanel() : openPanel());
  overlay.addEventListener('click', closePanel);
  closeBtn?.addEventListener('click', closePanel);

  const ICONS = { login:'🔑', logout:'🚪', approve:'✅', reject:'❌', ban:'🚫', update:'✏️', delete:'🗑️', create:'➕', export:'📦', notify:'🔔', error:'⚠️', broadcast:'📡' };

  function timeAgo(date) {
    const s = Math.floor((Date.now() - date) / 1000);
    if (s < 60)    return 'just now';
    if (s < 3600)  return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  }

  function renderActivity(items) {
    if (!list) return;
    if (!items.length) {
      list.innerHTML = '<div class="activity-empty">No activity recorded yet</div>';
      return;
    }
    list.innerHTML = items.map(item => {
      const icon = ICONS[item.type] || '📋';
      const msg  = item.message || item.action || 'Activity event';
      const ts   = item.timestamp?.toDate ? item.timestamp.toDate() : new Date(item.timestamp || 0);
      return `<div class="activity-item">
        <div class="activity-item-icon">${icon}</div>
        <div class="activity-item-body">
          <div class="activity-item-text">${msg}</div>
          <div class="activity-item-time">${timeAgo(ts)}</div>
        </div>
      </div>`;
    }).join('');
  }

  function waitDb() {
    if (!window._db || !window.fb) { setTimeout(waitDb, 500); return; }
    try {
      fb.onSnapshot(fb.collection(_db, 'hub_activity'), snap => {
        const items = [];
        snap.forEach(d => items.push({ id: d.id, ...d.data() }));
        items.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        renderActivity(items.slice(0, 50));
        if (!isOpen) {
          unread = Math.min(unread + 1, 99);
          badge.textContent = unread > 9 ? '9+' : String(unread);
          badge.hidden = false;
        }
      });
    } catch (e) {
      list.innerHTML = '<div class="activity-empty">Activity feed unavailable</div>';
    }
  }

  // Show fab once admin shell is visible
  function waitHub() {
    const hub = document.getElementById('hubMain');
    if (!hub) { setTimeout(waitHub, 500); return; }
    const obs = new MutationObserver(() => {
      if (getComputedStyle(hub).display !== 'none') { fab.hidden = false; obs.disconnect(); }
    });
    obs.observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });
    if (getComputedStyle(hub).display !== 'none') { fab.hidden = false; obs.disconnect(); }
  }
  waitHub();
  waitDb();
})();

// ── T17: BROADCAST BANNER TOOL ───────────────────────────────────
(function initBroadcastTool() {
  const modal    = document.getElementById('broadcastModal');
  const closeBtn = document.getElementById('broadcastClose');
  const cancel   = document.getElementById('broadcastCancel');
  const sendBtn  = document.getElementById('broadcastSend');
  const clearBtn = document.getElementById('broadcastClear');
  const msgEl    = document.getElementById('broadcastMsg');
  const titleEl  = document.getElementById('broadcastTitle');
  const durEl    = document.getElementById('broadcastDur');
  const countEl  = document.getElementById('broadcastCharCount');
  const bpTitle  = document.getElementById('bpTitle');
  const bpMsg    = document.getElementById('bpMsg');
  if (!modal) return;

  const open  = () => { modal.hidden = false; };
  const close = () => { modal.hidden = true; };
  window._openBroadcastModal = open;

  closeBtn?.addEventListener('click', close);
  cancel?.addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });

  function updatePreview() {
    if (bpTitle) bpTitle.textContent = titleEl?.value.trim() || 'Banner Title';
    if (bpMsg)   bpMsg.textContent   = msgEl?.value.trim()   || 'Your message here';
    const len = msgEl?.value.length || 0;
    if (countEl) {
      countEl.textContent = `${len} / 200`;
      countEl.className = 'char-count' + (len >= 200 ? ' ch-limit' : len >= 160 ? ' ch-warn' : '');
    }
  }
  msgEl?.addEventListener('input', updatePreview);
  titleEl?.addEventListener('input', updatePreview);

  sendBtn?.addEventListener('click', async () => {
    const title   = titleEl?.value.trim();
    const message = msgEl?.value.trim();
    if (!title || !message) { toast('Title and message are both required.', 'warn'); return; }
    const dur      = parseInt(durEl?.value || '86400');
    const payload  = { title, message, createdAt: Date.now(), expiresAt: dur > 0 ? Date.now() + dur * 1000 : 0, createdBy: window.currentUser?.email || 'admin' };
    try {
      if (window._db && window.fb) {
        await fb.setDoc(fb.doc(_db, 'hub_broadcast', 'active'), payload);
        window.logAudit?.('Broadcast: "' + title + '"');
      }
      toast('📡 Banner broadcast to all users!', 'success');
      close();
    } catch (e) { toast('Error: ' + e.message, 'error'); }
  });

  clearBtn?.addEventListener('click', async () => {
    try {
      if (window._db && window.fb) {
        await fb.setDoc(fb.doc(_db, 'hub_broadcast', 'active'), { cleared: true, clearedAt: Date.now() });
      }
      toast('Banner cleared.', 'success'); close();
    } catch (e) { toast('Error: ' + e.message, 'error'); }
  });
})();

// ── T18: DATA EXPORT HUB ─────────────────────────────────────────
(function initExportHub() {
  const modal    = document.getElementById('exportHubModal');
  const closeBtn = document.getElementById('exportHubClose');
  if (!modal) return;
  window._openExportHub = () => { modal.hidden = false; };
  closeBtn?.addEventListener('click', () => { modal.hidden = true; });
  modal.addEventListener('click', e => { if (e.target === modal) modal.hidden = true; });

  function toCSV(rows) {
    return rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  }
  function download(csv, name) {
    const a = Object.assign(document.createElement('a'), {
      href: 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿' + csv),
      download: name
    });
    a.click();
  }

  async function fetchCol(col) {
    if (!window._db || !window.fb) throw new Error('DB not ready');
    return new Promise((resolve, reject) => {
      const unsub = fb.onSnapshot(fb.collection(_db, col), snap => {
        unsub();
        const docs = [];
        snap.forEach(d => docs.push({ id: d.id, ...d.data() }));
        resolve(docs);
      }, reject);
    });
  }

  document.getElementById('ehExportUsers')?.addEventListener('click', async () => {
    try {
      const docs = window.allUsers?.length ? window.allUsers : await fetchCol('hub_users');
      const rows = [['Name','Email','Role','Status','Created']];
      docs.forEach(u => {
        const d = u.createdAt?.toDate ? u.createdAt.toDate() : new Date(u.createdAt || 0);
        rows.push([u.name||'', u.email||'', u.role||'', u.status||'', d.toLocaleDateString()]);
      });
      download(toCSV(rows), 'hub_users.csv');
      toast(`Exported ${docs.length} users`, 'success');
    } catch (e) { toast('Error: ' + e.message, 'error'); }
  });

  document.getElementById('ehExportPosts')?.addEventListener('click', () => {
    if (!window.allPosts?.length) { toast('Open the Posts page first to load data.', 'warn'); return; }
    const rows = [['Title','Author','Status','Created']];
    window.allPosts.forEach(p => {
      const d = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt || 0);
      rows.push([p.title||'', p.authorName||p.authorEmail||'', p.status||'', d.toLocaleDateString()]);
    });
    download(toCSV(rows), 'hub_posts.csv');
    toast(`Exported ${window.allPosts.length} posts`, 'success');
  });

  document.getElementById('ehExportTracks')?.addEventListener('click', async () => {
    try {
      const docs = await fetchCol('tracks');
      const rows = [['Title','Artist','Duration','Plays','ID']];
      docs.forEach(t => rows.push([t.title||'', t.artist||'', t.duration||'', t.plays||0, t.id]));
      download(toCSV(rows), 'hub_tracks.csv');
      toast(`Exported ${docs.length} tracks`, 'success');
    } catch (e) { toast('Error: ' + e.message, 'error'); }
  });

  document.getElementById('ehExportFeedback')?.addEventListener('click', async () => {
    try {
      const docs = await fetchCol('feedback');
      const rows = [['From','Message','Rating','Created']];
      docs.forEach(f => {
        const d = f.createdAt?.toDate ? f.createdAt.toDate() : new Date(f.createdAt || 0);
        rows.push([f.email||'', f.body||f.message||'', f.rating||'', d.toLocaleDateString()]);
      });
      download(toCSV(rows), 'hub_feedback.csv');
      toast(`Exported ${docs.length} feedback entries`, 'success');
    } catch (e) { toast('Error: ' + e.message, 'error'); }
  });

  document.getElementById('ehExportActivity')?.addEventListener('click', async () => {
    try {
      const docs = await fetchCol('hub_activity');
      const rows = [['Action','User','Type','Timestamp']];
      docs.forEach(a => {
        const d = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
        rows.push([a.message||a.action||'', a.user||a.by||'', a.type||'', d.toLocaleString()]);
      });
      download(toCSV(rows), 'hub_activity.csv');
      toast(`Exported ${docs.length} activity entries`, 'success');
    } catch (e) { toast('Error: ' + e.message, 'error'); }
  });

  document.getElementById('ehExportApps')?.addEventListener('click', async () => {
    try {
      const docs = window.allApps?.length ? window.allApps : await fetchCol('hub_apps');
      const rows = [['Name','URL','Status','Category']];
      docs.forEach(a => rows.push([a.name||'', a.url||'', a.status||'', a.category||'']));
      download(toCSV(rows), 'hub_apps.csv');
      toast(`Exported ${docs.length} apps`, 'success');
    } catch (e) { toast('Error: ' + e.message, 'error'); }
  });
})();

// ── T19: DASHBOARD SPARKLINES ─────────────────────────────────────
(function initSparklines() {
  const STATS = ['statApps', 'statUsers', 'statTracks', 'statAssets'];

  function drawSpark(container) {
    if (container.querySelector('.spark-wrap')) return;
    const n      = parseInt(container.querySelector('[id^=stat]')?.textContent) || 20;
    const points = Array.from({ length: 7 }, (_, i) => {
      const base = Math.max(1, n - Math.floor(n * (0.3 * (6 - i) / 6)));
      return base + Math.floor(Math.random() * Math.max(1, base * 0.1));
    });
    const max = Math.max(...points), min = Math.min(...points);
    const W = 72, H = 22;
    const pts = points.map((v, i) => {
      const x = (i / (points.length - 1)) * W;
      const y = H - ((v - min) / (max - min + .01)) * H;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    const wrap = document.createElement('div');
    wrap.className = 'spark-wrap';
    wrap.innerHTML = `<svg class="spark-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <polyline class="spark-line" points="${pts}"/>
    </svg>`;
    container.appendChild(wrap);
  }

  function inject() {
    document.querySelectorAll('.cat-top').forEach(top => {
      if (!top.querySelector('.spark-wrap')) drawSpark(top);
    });
  }

  setTimeout(inject, 1800);
  document.addEventListener('pageChanged', e => {
    if (e?.detail === 'dashboard') setTimeout(inject, 400);
  });
})();

// ── T20: BULK USER ACTIONS ────────────────────────────────────────
(function initBulkUserActions() {
  const hub = document.getElementById('hubMain');
  if (!hub) return;

  const bar = document.createElement('div');
  bar.id = 'bulkActionBar';
  bar.className = 'bulk-action-bar';
  bar.innerHTML = `
    <span class="bulk-action-count" id="bulkCount">0 selected</span>
    <button class="bulk-btn bulk-btn-approve" id="bulkApprove">✅ Approve</button>
    <button class="bulk-btn bulk-btn-ban"     id="bulkBan">🚫 Ban</button>
    <button class="bulk-btn bulk-btn-export"  id="bulkExport">📥 Export</button>
    <button class="bulk-btn-clear" id="bulkClear" title="Clear selection">✕</button>`;
  hub.appendChild(bar);

  let selected = new Set();

  function updateBar() {
    const n = selected.size;
    document.getElementById('bulkCount').textContent = `${n} selected`;
    bar.classList.toggle('visible', n > 0);
  }

  function clearSel() {
    selected.clear();
    document.querySelectorAll('.user-row-cb').forEach(cb => { cb.checked = false; });
    updateBar();
  }

  document.getElementById('bulkClear')?.addEventListener('click', clearSel);

  document.getElementById('bulkApprove')?.addEventListener('click', async () => {
    if (!selected.size || !window._db) return;
    let done = 0;
    for (const id of selected) {
      try {
        const u = (window.allUsers || []).find(x => (x.id || x.uid) === id);
        await fb.updateDoc(fb.doc(_db, 'hub_users', id), { status: 'approved', role: u?.role || 'viewer' });
        done++;
      } catch {}
    }
    toast(`✅ Approved ${done} user${done !== 1 ? 's' : ''}`, 'success');
    window.logAudit?.(`Bulk approved ${done} users`);
    clearSel(); typeof loadUsers === 'function' && loadUsers();
  });

  document.getElementById('bulkBan')?.addEventListener('click', async () => {
    if (!selected.size) return;
    if (!confirm(`Ban ${selected.size} selected user${selected.size !== 1 ? 's' : ''}?`)) return;
    let done = 0;
    for (const id of selected) {
      try { await fb.updateDoc(fb.doc(_db, 'hub_users', id), { status: 'banned' }); done++; } catch {}
    }
    toast(`🚫 Banned ${done} user${done !== 1 ? 's' : ''}`, 'warn');
    window.logAudit?.(`Bulk banned ${done} users`);
    clearSel(); typeof loadUsers === 'function' && loadUsers();
  });

  document.getElementById('bulkExport')?.addEventListener('click', () => {
    const users = (window.allUsers || []).filter(u => selected.has(u.id || u.uid));
    if (!users.length) return;
    const rows = [['Name','Email','Role','Status']];
    users.forEach(u => rows.push([u.name||'', u.email||'', u.role||'', u.status||'']));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), { href: 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿' + csv), download: 'selected_users.csv' });
    a.click();
    toast(`Exported ${users.length} users`, 'success');
  });

  // Inject checkboxes whenever user table is rendered
  const _origRender = window.renderUsers;
  if (typeof _origRender === 'function') {
    window.renderUsers = function(...args) {
      _origRender.apply(this, args);
      setTimeout(() => {
        document.querySelectorAll('#userTable tbody tr, #userTableBody tr').forEach(row => {
          if (row.querySelector('.user-cb-cell')) return;
          const id = row.dataset.id || row.dataset.uid;
          if (!id) return;
          const td = document.createElement('td');
          td.className = 'user-cb-cell';
          const cb = Object.assign(document.createElement('input'), { type:'checkbox', className:'user-row-cb' });
          cb.checked = selected.has(id);
          cb.addEventListener('change', () => {
            if (cb.checked) selected.add(id); else selected.delete(id);
            updateBar();
          });
          td.appendChild(cb);
          row.prepend(td);
        });
      }, 80);
    };
  }
})();

// ── T21: QUICK REPLY TEMPLATES ────────────────────────────────────
(function initReplyTemplates() {
  const TPLS_KEY = 'hub_reply_tpls_v1';
  const DEFAULTS = [
    'Thank you for your feedback! We really appreciate you sharing your thoughts with us.',
    "Hi! We've received your message and our team is looking into it. We'll get back to you soon.",
    "Thanks for reporting this issue. We've logged it and will address it in our next update.",
    'We appreciate your kind words! Feedback like yours motivates us to keep improving.',
    "Sorry to hear about your experience. Please email us directly and we'll resolve this right away.",
  ];
  const tpls = JSON.parse(localStorage.getItem(TPLS_KEY) || 'null') || DEFAULTS;

  function inject() {
    document.querySelectorAll('.fb-reply-btn').forEach(btn => {
      const parent = btn.parentElement;
      if (parent?.querySelector('.fb-templates-wrap')) return;
      const wrap   = document.createElement('span');
      wrap.className = 'fb-templates-wrap';
      const tplBtn = document.createElement('button');
      tplBtn.className = 'fb-templates-btn';
      tplBtn.textContent = '📝 Templates';
      wrap.appendChild(tplBtn);
      btn.after(wrap);

      tplBtn.addEventListener('click', e => {
        e.stopPropagation();
        document.querySelectorAll('.fb-templates-dropdown').forEach(d => d.remove());
        const rect = tplBtn.getBoundingClientRect();
        const dd   = document.createElement('div');
        dd.className = 'fb-templates-dropdown';
        dd.style.cssText = `top:${rect.bottom + 4 + window.scrollY}px;left:${rect.left}px`;
        tpls.forEach(t => {
          const item = document.createElement('div');
          item.className = 'fb-tpl-item';
          item.title = t;
          item.textContent = t.length > 65 ? t.slice(0, 65) + '…' : t;
          item.addEventListener('click', () => {
            const fbItem = btn.closest('.feedback-item');
            const email  = fbItem?.querySelector('.feedback-meta span')?.textContent?.trim();
            if (email) window.open(`mailto:${email}?subject=Re:%20Your%20Feedback&body=${encodeURIComponent('\n\n---\n' + t)}`, '_blank');
            dd.remove();
          });
          dd.appendChild(item);
        });
        document.body.appendChild(dd);
        setTimeout(() => document.addEventListener('click', () => dd.remove(), { once: true }), 0);
      });
    });
  }

  const _orig = window.loadFeedback;
  if (typeof _orig === 'function') {
    window.loadFeedback = async function(...args) {
      await _orig.apply(this, args);
      setTimeout(inject, 250);
    };
  }
})();

// ── T22: SIDEBAR FAVORITES ────────────────────────────────────────
(function initSidebarFavorites() {
  const FAV_KEY = 'hub_sb_favs_v1';
  let favs = JSON.parse(localStorage.getItem(FAV_KEY) || '[]');

  const LABEL_MAP = { dashboard:'Dashboard', analytics:'Analytics', apps:'App Manager', ericontent:'Eri Content', assets:'Assets', users:'Users', employees:'Employees', erimusic:'Eri Music', playlists:'Playlists', posts:'Posts', feedback:'Feedback', notify:'Notifications', newsletter:'Newsletter', promotions:'Promotions', monetize:'Monetize', coupons:'Coupons', riglog:'RigLog', 'truck-log':'Truck Log', auditlog:'Audit Log', settings:'Settings' };

  function save() { localStorage.setItem(FAV_KEY, JSON.stringify(favs)); }

  function renderFavGroup() {
    document.getElementById('sbFavsGroup')?.remove();
    if (!favs.length) return;
    const nav = document.querySelector('.sb-nav');
    if (!nav) return;

    const group = document.createElement('div');
    group.id = 'sbFavsGroup';
    group.className = 'sb-cat-group sb-favorites-group';
    group.innerHTML = '<div class="sb-favorites-label">★ Favorites</div>';
    favs.forEach(page => {
      const btn = document.createElement('button');
      btn.className = 'sb-item';
      btn.dataset.page = page;
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg><span>${LABEL_MAP[page] || page}</span>`;
      btn.addEventListener('click', () => showPage(page));
      group.appendChild(btn);
    });
    nav.prepend(group);
  }

  function addStars() {
    document.querySelectorAll('.sb-nav .sb-item[data-page]').forEach(btn => {
      if (btn.closest('#sbFavsGroup') || btn.querySelector('.sb-star')) return;
      const page = btn.dataset.page;
      const star = document.createElement('button');
      star.className = 'sb-star' + (favs.includes(page) ? ' starred' : '');
      star.title = favs.includes(page) ? 'Remove from favorites' : 'Add to favorites';
      star.textContent = '★';
      star.addEventListener('click', e => {
        e.stopPropagation();
        if (favs.includes(page)) favs = favs.filter(f => f !== page);
        else if (favs.length < 8) favs = [...favs, page];
        save();
        star.className = 'sb-star' + (favs.includes(page) ? ' starred' : '');
        star.title = favs.includes(page) ? 'Remove from favorites' : 'Add to favorites';
        renderFavGroup();
      });
      btn.appendChild(star);
    });
  }

  setTimeout(() => { addStars(); renderFavGroup(); }, 700);
})();

// ── T23: SMART ALERTS DETECTOR ───────────────────────────────────
(function initSmartAlerts() {
  const banner    = document.getElementById('smartAlertBanner');
  const textEl    = document.getElementById('smartAlertText');
  const iconEl    = document.getElementById('smartAlertIcon');
  const actionEl  = document.getElementById('smartAlertAction');
  const dismissEl = document.getElementById('smartAlertDismiss');
  if (!banner) return;

  dismissEl?.addEventListener('click', () => { banner.hidden = true; });

  function show(msg, type, icon, actionLabel, actionFn) {
    if (iconEl)  iconEl.textContent  = icon || '⚠️';
    if (textEl)  textEl.textContent  = msg;
    banner.className = 'smart-alert-banner' + (type === 'danger' ? ' danger' : type === 'info' ? ' info' : '');
    if (actionLabel && actionEl) {
      actionEl.textContent = actionLabel;
      actionEl.hidden = false;
      actionEl.onclick = () => { banner.hidden = true; actionFn?.(); };
    } else if (actionEl) { actionEl.hidden = true; }
    banner.hidden = false;
  }

  const shown = new Set();

  function waitDb() {
    if (!window._db || !window.fb) { setTimeout(waitDb, 800); return; }
    try {
      fb.onSnapshot(fb.collection(_db, 'hub_users'), snap => {
        let pending = 0;
        snap.forEach(d => { if (d.data().status === 'pending') pending++; });
        const key = 'pending_' + Math.floor(pending / 3);
        if (pending >= 5 && !shown.has(key)) {
          shown.add(key);
          show(`🚨 ${pending} users awaiting approval`, 'danger', '🚨', 'View Users', () => showPage('users'));
        }
      });
    } catch {}

    try {
      fb.onSnapshot(fb.collection(_db, 'feedback'), snap => {
        let unread = 0;
        snap.forEach(d => { if (!d.data().read) unread++; });
        const key = 'fb_' + Math.floor(unread / 5);
        if (unread >= 10 && !shown.has(key)) {
          shown.add(key);
          show(`💬 ${unread} unread feedback messages`, 'warn', '💬', 'View Feedback', () => showPage('feedback'));
        }
      });
    } catch {}
  }

  setTimeout(waitDb, 3000);
})();

// ── T24: QUICK USER CARD HOVER ───────────────────────────────────
(function initQuickUserCard() {
  let card = null, timer = null;

  function remove() { card?.remove(); card = null; clearTimeout(timer); }

  function show(user, x, y) {
    remove();
    const d = user.createdAt?.toDate ? user.createdAt.toDate() : new Date(user.createdAt || 0);
    const initials = ((user.name || user.email || '?').trim().split(' ').map(w => w[0]).join('').slice(0, 2)).toUpperCase();
    card = document.createElement('div');
    card.className = 'quick-user-card';
    card.style.left = Math.min(x + 14, window.innerWidth - 240) + 'px';
    card.style.top  = Math.max(y - 90, 10) + 'px';
    card.innerHTML = `
      <div class="quc-avatar">${initials}</div>
      <div class="quc-name">${user.name || '—'}</div>
      <div class="quc-email">${user.email || '—'}</div>
      <div class="quc-role">${user.role || 'viewer'}</div>
      <div class="quc-joined">Joined: ${user.createdAt ? d.toLocaleDateString() : '—'}</div>`;
    document.body.appendChild(card);
  }

  function setup(container) {
    if (container.dataset.qucWired) return;
    container.dataset.qucWired = '1';
    container.addEventListener('mouseover', e => {
      const row = e.target.closest('tr[data-id],tr[data-uid]');
      if (!row) return;
      const id   = row.dataset.id || row.dataset.uid;
      const user = (window.allUsers || []).find(u => (u.id || u.uid) === id);
      if (!user) return;
      clearTimeout(timer);
      timer = setTimeout(() => show(user, e.clientX, e.clientY), 320);
    });
    container.addEventListener('mouseleave', remove);
  }

  new MutationObserver(() => {
    document.querySelectorAll('#userTableBody, #userTable tbody').forEach(setup);
  }).observe(document.getElementById('hubMain') || document.body, { childList: true, subtree: true });
})();

// ── T25: CHARACTER COUNTER ON TEXTAREAS ──────────────────────────
(function initCharCounters() {
  const ID_LIMITS = { notifyTitle:80, notifyBody:300, broadcastMsg:200, broadcastTitle:80, dashNotes:2000 };

  function attach(ta) {
    if (ta.dataset.ccWired) return;
    ta.dataset.ccWired = '1';
    const max = ID_LIMITS[ta.id] || (parseInt(ta.maxLength) > 0 ? parseInt(ta.maxLength) : 0);
    const counter = document.createElement('div');
    counter.className = 'textarea-counter';
    ta.after(counter);
    function update() {
      const len = ta.value.length;
      counter.textContent = max ? `${len} / ${max}` : `${len}`;
      counter.className = 'textarea-counter' + (!max ? '' : len >= max ? ' over' : len >= max * .8 ? ' warn' : '');
    }
    ta.addEventListener('input', update);
    update();
  }

  function scan() {
    document.querySelectorAll('textarea:not([data-cc-wired])').forEach(attach);
  }

  setTimeout(scan, 900);
  new MutationObserver(scan).observe(document.getElementById('hubMain') || document.body, { childList: true, subtree: true });
})();

// ── T26: SESSION HISTORY TIMELINE ────────────────────────────────
(function initSessionHistory() {
  const LABELS = { dashboard:'Dashboard', apps:'App Manager', users:'Users', erimusic:'Eri Music', music:'Music', posts:'Posts', notify:'Notifications', analytics:'Analytics', feedback:'Feedback', employees:'Employees', auditlog:'Audit Log', newsletter:'Newsletter', playlists:'Playlists', ericontent:'Eri Content', assets:'Assets', monetize:'Monetize', coupons:'Coupons', riglog:'RigLog' };
  const hist   = [];

  const _orig = window.showPage;
  window.showPage = function(name) {
    _orig.apply(this, arguments);
    hist.push({ page: name, time: new Date() });
    render();
  };

  function render() {
    const el = document.getElementById('sbHistList');
    if (!el) return;
    el.innerHTML = hist.slice(-6).reverse().map(h => {
      const t = h.time.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
      return `<div class="sb-hist-item" onclick="showPage('${h.page}')">
        <span>🕐</span><span>${LABELS[h.page] || h.page}</span>
        <span class="sb-hist-time">${t}</span>
      </div>`;
    }).join('');
  }

  function inject() {
    if (document.getElementById('sbHistList')) return;
    const sbUser = document.querySelector('.sb-user');
    if (!sbUser) { setTimeout(inject, 600); return; }
    const wrap = document.createElement('div');
    wrap.className = 'sb-history-wrap';
    wrap.innerHTML = `<div class="sb-history-label">This Session</div><div id="sbHistList"></div>`;
    sbUser.before(wrap);
    render();
  }
  setTimeout(inject, 800);
})();

// ── T27: COPY-ON-CLICK IDs AND EMAILS ────────────────────────────
(function initCopyOnClick() {
  async function copyText(text, el) {
    try { await navigator.clipboard.writeText(text); } catch { return; }
    const rect = el.getBoundingClientRect();
    const tip  = document.createElement('div');
    tip.className = 'copy-flash';
    tip.textContent = 'Copied!';
    tip.style.cssText = `left:${rect.left}px;top:${rect.top - 30 + window.scrollY}px`;
    document.body.appendChild(tip);
    setTimeout(() => tip.remove(), 1100);
  }

  function wire(cell, text) {
    if (cell.dataset.cpWired) return;
    cell.dataset.cpWired = '1';
    cell.classList.add('copy-id-cell');
    cell.title = 'Click to copy';
    cell.addEventListener('click', e => { e.stopPropagation(); copyText(text, cell); });
  }

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const UID_RE   = /^[a-zA-Z0-9]{20,}$/;

  function scan() {
    document.querySelectorAll('#userTable td, #userTableBody td').forEach(td => {
      const t = td.textContent.trim();
      if (EMAIL_RE.test(t) || UID_RE.test(t)) wire(td, t);
    });
  }

  new MutationObserver(scan).observe(document.getElementById('hubMain') || document.body, { childList: true, subtree: true });
  setTimeout(scan, 1200);
})();

// ── T28: MILESTONE CONFETTI ───────────────────────────────────────
(function initMilestoneConfetti() {
  const MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 5000];
  let lastMilestone = parseInt(localStorage.getItem('hub_milestone') || '0');

  function burst() {
    const canvas = Object.assign(document.createElement('canvas'), { id:'confettiCanvas' });
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const particles = Array.from({ length: 100 }, () => ({
      x: window.innerWidth / 2 + (Math.random() - .5) * 200,
      y: window.innerHeight / 3,
      vx: (Math.random() - .5) * 9,
      vy: Math.random() * -9 - 3,
      color: `hsl(${Math.floor(Math.random() * 360)},90%,55%)`,
      w: Math.random() * 10 + 5,
      h: Math.random() * 6 + 3,
      rot: Math.random() * 360,
      rspd: (Math.random() - .5) * 12,
      alpha: 1,
    }));

    let raf;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += .3; p.rot += p.rspd; p.alpha -= .013;
        if (p.alpha <= 0) return; alive = true;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot * Math.PI / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (alive) raf = requestAnimationFrame(draw); else canvas.remove();
    }
    raf = requestAnimationFrame(draw);
    setTimeout(() => { cancelAnimationFrame(raf); canvas.remove(); }, 4500);
  }

  const statEl = document.getElementById('statUsers');
  if (!statEl) return;
  new MutationObserver(() => {
    const n = parseInt((statEl.textContent || '').replace(/\D/g, ''));
    if (!n) return;
    const hit = MILESTONES.find(m => m > lastMilestone && n >= m);
    if (hit) {
      lastMilestone = hit;
      localStorage.setItem('hub_milestone', String(hit));
      burst();
      toast(`🎉 Milestone: ${hit} users reached!`, 'success');
    }
  }).observe(statEl, { childList: true, characterData: true, subtree: true });
})();

// ── T29: FLOATING SPEED DIAL FAB ─────────────────────────────────
(function initSpeedDial() {
  const dial = document.getElementById('speedDial');
  const main = document.getElementById('speedDialMain');
  if (!dial || !main) return;

  let open = false;
  function toggle()  { open = !open; dial.classList.toggle('open', open); main.textContent = open ? '×' : '+'; }
  function closeDial() { if (!open) return; open = false; dial.classList.remove('open'); main.textContent = '+'; }

  main.addEventListener('click', e => { e.stopPropagation(); toggle(); });
  document.addEventListener('click', closeDial);

  document.getElementById('sdBroadcast')?.addEventListener('click', () => { closeDial(); document.getElementById('broadcastModal').hidden = false; });
  document.getElementById('sdExportHub')?.addEventListener('click', () => { closeDial(); document.getElementById('exportHubModal').hidden = false; });
  document.getElementById('sdActivity')?.addEventListener('click', () => { closeDial(); document.getElementById('activityFab')?.click(); });
  document.getElementById('sdNewApp')?.addEventListener('click', () => { closeDial(); showPage('apps'); setTimeout(() => document.getElementById('addAppBtn')?.click(), 350); });

  // Show after login
  function waitHub() {
    const hub = document.getElementById('hubMain');
    if (!hub) { setTimeout(waitHub, 500); return; }
    const obs = new MutationObserver(() => {
      if (getComputedStyle(hub).display !== 'none') { dial.hidden = false; obs.disconnect(); }
    });
    obs.observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });
    if (getComputedStyle(hub).display !== 'none') { dial.hidden = false; obs.disconnect(); }
  }
  waitHub();
})();

// ── T30: SYSTEM HEALTH BAR ───────────────────────────────────────
(function initSystemHealthBar() {
  const bar    = document.getElementById('sysHealthBar');
  const dot    = document.getElementById('shDbDot');
  const label  = document.getElementById('shDbLabel');
  const syncEl = document.getElementById('shSyncTime');
  const ctEl   = document.getElementById('shUserCount');
  if (!bar) return;

  function setStatus(state) {
    dot.className = 'sh-dot sh-' + state;
    if (state === 'green')  label.textContent = 'DB Connected';
    if (state === 'yellow') label.textContent = 'Connecting…';
    if (state === 'red')    label.textContent = 'DB Error';
  }

  function waitHub() {
    const hub = document.getElementById('hubMain');
    if (!hub) { setTimeout(waitHub, 500); return; }
    const obs = new MutationObserver(() => {
      if (getComputedStyle(hub).display !== 'none') { bar.hidden = false; obs.disconnect(); }
    });
    obs.observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });
    if (getComputedStyle(hub).display !== 'none') { bar.hidden = false; obs.disconnect(); }
  }
  waitHub();

  function waitDb() {
    if (!window._db || !window.fb) { setStatus('yellow'); setTimeout(waitDb, 600); return; }
    setStatus('green');
    syncEl.textContent = 'Sync: ' + new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    try {
      fb.onSnapshot(fb.collection(_db, 'hub_users'), snap => {
        setStatus('green');
        syncEl.textContent = 'Sync: ' + new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
        if (ctEl) ctEl.textContent = snap.size + ' users';
      });
    } catch { setStatus('red'); }
  }
  waitDb();
})();

// ── T31: SORTABLE TABLE COLUMNS ──────────────────────────────────
(function initSortableColumns() {
  function wire(table) {
    if (!table || table.dataset.sortWired) return;
    table.dataset.sortWired = '1';
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    table.querySelectorAll('thead th').forEach((th, colIdx) => {
      th.classList.add('sortable-th');
      let asc = true;
      const ind = document.createElement('span');
      ind.className = 'sort-indicator';
      th.appendChild(ind);
      th.addEventListener('click', () => {
        table.querySelectorAll('.sort-indicator').forEach(i => { i.textContent = ''; });
        ind.textContent = asc ? '↑' : '↓';
        const rows = [...tbody.querySelectorAll('tr')];
        rows.sort((a, b) => {
          const av = a.cells[colIdx]?.textContent?.trim() || '';
          const bv = b.cells[colIdx]?.textContent?.trim() || '';
          const an = parseFloat(av.replace(/[,$%\s]/g, ''));
          const bn = parseFloat(bv.replace(/[,$%\s]/g, ''));
          if (!isNaN(an) && !isNaN(bn)) return (an - bn) * (asc ? 1 : -1);
          return av.localeCompare(bv) * (asc ? 1 : -1);
        });
        rows.forEach(r => tbody.appendChild(r));
        asc = !asc;
      });
    });
  }

  new MutationObserver(() => {
    document.querySelectorAll('table.admin-table, #userTable, #appTable').forEach(wire);
  }).observe(document.getElementById('hubMain') || document.body, { childList: true, subtree: true });
})();

// ── T32: MARKDOWN PREVIEW FOR POSTS ──────────────────────────────
(function initMarkdownPreview() {
  function md(text) {
    return ('<p>' + text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/^### (.+)$/gm, '</p><h3>$1</h3><p>')
      .replace(/^## (.+)$/gm,  '</p><h2>$1</h2><p>')
      .replace(/^# (.+)$/gm,   '</p><h1>$1</h1><p>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,     '<em>$1</em>')
      .replace(/`(.+?)`/g,       '<code>$1</code>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>')
      .replace(/^[-*] (.+)$/gm,  '<li>$1</li>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>') + '</p>');
  }

  function inject(ta) {
    if (ta.dataset.mdWired) return;
    ta.dataset.mdWired = '1';
    const tabs = document.createElement('div');
    tabs.className = 'md-tabs';
    tabs.innerHTML = `<button class="md-tab active" data-t="write">Write</button><button class="md-tab" data-t="preview">Preview ✦</button>`;
    ta.before(tabs);
    const preview = document.createElement('div');
    preview.className = 'md-preview';
    preview.style.display = 'none';
    ta.after(preview);

    tabs.querySelectorAll('.md-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.querySelectorAll('.md-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        if (tab.dataset.t === 'preview') {
          preview.innerHTML = md(ta.value || '*Nothing to preview yet.*');
          preview.style.display = '';
          ta.style.display = 'none';
        } else {
          preview.style.display = 'none';
          ta.style.display = '';
          ta.focus();
        }
      });
    });
  }

  function scan() {
    document.querySelectorAll('#page-posts textarea, #postModal textarea').forEach(ta => {
      if ((ta.rows || 3) >= 3) inject(ta);
    });
  }

  new MutationObserver(scan).observe(document.getElementById('hubMain') || document.body, { childList: true, subtree: true });
  setTimeout(scan, 1000);
})();

// ── T33: DRAG-TO-REORDER DASHBOARD CARDS ─────────────────────────
(function initDashDrag() {
  const ORDER_KEY = 'hub_dash_order_v1';
  const grid = document.querySelector('.cat-grid');
  if (!grid) return;

  const cards = [...grid.querySelectorAll('.cat-card-wrap')];
  cards.forEach((el, i) => {
    el.dataset.dashId = el.querySelector('.cat-name')?.textContent?.trim().replace(/\s+/g,'_') || String(i);
  });

  function saveOrder() {
    const order = [...grid.querySelectorAll('.cat-card-wrap')].map(el => el.dataset.dashId);
    localStorage.setItem(ORDER_KEY, JSON.stringify(order));
  }

  function restoreOrder() {
    const saved = JSON.parse(localStorage.getItem(ORDER_KEY) || 'null');
    if (!saved) return;
    saved.forEach(id => {
      const el = grid.querySelector(`[data-dash-id="${id}"]`);
      if (el) grid.appendChild(el);
    });
  }
  restoreOrder();

  let dragSrc = null;

  grid.querySelectorAll('.cat-card-wrap').forEach(el => {
    el.draggable = true;
    el.addEventListener('dragstart', e => {
      dragSrc = el;
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      grid.querySelectorAll('.cat-card-wrap').forEach(c => c.classList.remove('drag-over'));
      saveOrder();
    });
    el.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      grid.querySelectorAll('.cat-card-wrap').forEach(c => c.classList.remove('drag-over'));
      el.classList.add('drag-over');
    });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop', e => {
      e.preventDefault();
      el.classList.remove('drag-over');
      if (dragSrc && dragSrc !== el) {
        const all = [...grid.querySelectorAll('.cat-card-wrap')];
        if (all.indexOf(dragSrc) < all.indexOf(el)) el.after(dragSrc);
        else el.before(dragSrc);
      }
    });
  });
})();
