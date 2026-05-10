/* ================================================================
   ERITREAN INFO — Enhanced Features v1.0
   1.  Firebase Auth (Google Sign-in)
   2.  Bookmarks & Favorites
   3.  Live News Feed (RSS)
   4.  Push Notifications
   5.  Blog Comments
   6.  Tigrinya Learning Path / Streak
   7.  Shareable Cards (Canvas + Web Share)
   8.  Deep Link Routing
   9.  Offline Content Expansion (see sw.js)
   10. Community Events Board (Firestore)
================================================================ */
'use strict';

// ── Shared Firebase singleton ─────────────────────────────────────────────────
const FB_VER = '10.12.2';
let _db = null, _auth = null, _authUser = null, _fbMods = null;

async function getFirebase() {
  if (_db && _auth) return { db: _db, auth: _auth, ..._fbMods };
  const [appMod, fsMod, auMod] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-firestore.js`),
    import(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-auth.js`),
  ]);
  const app = appMod.getApps().length ? appMod.getApps()[0] : appMod.initializeApp(FIREBASE_CONFIG);
  _db    = fsMod.getFirestore(app);
  _auth  = auMod.getAuth(app);
  _fbMods = { ...appMod, ...fsMod, ...auMod };
  return { db: _db, auth: _auth, ..._fbMods };
}

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function showToast(msg, type='info') {
  const t = document.createElement('div');
  t.className = `feat-toast feat-toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3200);
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. FIREBASE AUTH — Google Sign-in
// ══════════════════════════════════════════════════════════════════════════════
const AUTH_KEY = 'eri_auth_user';

function injectAuthButton() {
  const navRight = document.querySelector('.nav-right');
  if (!navRight || document.getElementById('authNavBtn')) return;

  const btn = document.createElement('button');
  btn.id = 'authNavBtn';
  btn.className = 'auth-nav-btn';
  btn.title = 'Sign in to save bookmarks';
  btn.innerHTML = `<span class="auth-nav-icon">👤</span>`;
  navRight.insertBefore(btn, navRight.children[1]);

  const panel = document.createElement('div');
  panel.id = 'authPanel';
  panel.className = 'auth-panel';
  panel.innerHTML = `
    <div class="ap-inner">
      <div class="ap-logo">🇪🇷</div>
      <div id="apGuestView">
        <p class="ap-title">Sign In</p>
        <p class="ap-sub">Save bookmarks & sync across devices</p>
        <button class="ap-google-btn" id="apGoogleBtn">
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Continue with Google
        </button>
        <p class="ap-note">Or use the app without an account — bookmarks save locally.</p>
      </div>
      <div id="apUserView" hidden>
        <div class="ap-avatar" id="apAvatar">?</div>
        <p class="ap-user-name" id="apUserName">—</p>
        <p class="ap-user-email" id="apUserEmail">—</p>
        <button class="ap-bm-link" id="apBmLink">🔖 My Bookmarks (<span id="apBmCount">0</span>)</button>
        <button class="ap-signout" id="apSignOut">Sign out</button>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  btn.addEventListener('click', e => {
    e.stopPropagation();
    panel.classList.toggle('open');
  });
  document.addEventListener('click', e => {
    if (!panel.contains(e.target) && e.target !== btn) panel.classList.remove('open');
  });

  document.getElementById('apGoogleBtn').addEventListener('click', doGoogleSignIn);
  document.getElementById('apSignOut').addEventListener('click', doSignOut);
  document.getElementById('apBmLink').addEventListener('click', () => { panel.classList.remove('open'); openBookmarksPanel(); });
}

async function doGoogleSignIn() {
  try {
    const { auth, GoogleAuthProvider, signInWithPopup } = await getFirebase();
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch(e) {
    if (e.code !== 'auth/popup-closed-by-user') showToast('Sign-in failed: ' + e.message, 'error');
  }
}

async function doSignOut() {
  try {
    const { auth, signOut } = await getFirebase();
    await signOut(auth);
    document.getElementById('authPanel')?.classList.remove('open');
    showToast('Signed out', 'info');
  } catch(e) { console.warn('Sign out error:', e); }
}

function updateAuthUI(user) {
  _authUser = user;
  const btn       = document.getElementById('authNavBtn');
  const guestView = document.getElementById('apGuestView');
  const userView  = document.getElementById('apUserView');
  if (!btn) return;
  if (user) {
    btn.innerHTML = user.photoURL
      ? `<img src="${user.photoURL}" class="auth-nav-avatar" alt="You"/>`
      : `<span class="auth-nav-icon auth-nav-signed">${(user.displayName||'U')[0].toUpperCase()}</span>`;
    guestView.hidden = true;
    userView.hidden  = false;
    document.getElementById('apAvatar').textContent = (user.displayName||'U')[0].toUpperCase();
    document.getElementById('apUserName').textContent  = user.displayName || 'User';
    document.getElementById('apUserEmail').textContent = user.email || '';
    syncBookmarksFromCloud();
  } else {
    btn.innerHTML = `<span class="auth-nav-icon">👤</span>`;
    guestView.hidden = false;
    userView.hidden  = true;
  }
  updateBookmarkCount();
}

(async function initAuth() {
  try {
    const { auth, onAuthStateChanged } = await getFirebase();
    onAuthStateChanged(auth, updateAuthUI);
  } catch(e) { console.warn('[Auth]', e); }
})();

// ══════════════════════════════════════════════════════════════════════════════
// 2. BOOKMARKS & FAVORITES
// ══════════════════════════════════════════════════════════════════════════════
const BM_KEY = 'eri_bookmarks';

function getBookmarks() {
  try { return JSON.parse(localStorage.getItem(BM_KEY) || '[]'); } catch { return []; }
}
function saveBookmarks(bms) {
  localStorage.setItem(BM_KEY, JSON.stringify(bms));
  updateBookmarkCount();
  if (_authUser) pushBookmarksToCloud(bms);
}
function isBookmarked(id) { return getBookmarks().some(b => b.id === id); }

function toggleBookmark(id, title, type, extra={}) {
  const bms = getBookmarks();
  const idx = bms.findIndex(b => b.id === id);
  if (idx >= 0) {
    bms.splice(idx, 1);
    saveBookmarks(bms);
    showToast('Bookmark removed', 'info');
    updateBmBtn(id, false);
  } else {
    bms.unshift({ id, title, type, ...extra, savedAt: Date.now() });
    saveBookmarks(bms);
    showToast('Bookmarked! ✓', 'success');
    updateBmBtn(id, true);
  }
}

function updateBmBtn(id, active) {
  document.querySelectorAll(`.bm-btn[data-bm="${id}"]`).forEach(b => {
    b.classList.toggle('active', active);
    b.title = active ? 'Remove bookmark' : 'Bookmark this';
  });
}

function updateBookmarkCount() {
  const count = getBookmarks().length;
  const el = document.getElementById('apBmCount');
  if (el) el.textContent = count;
  const dot = document.getElementById('bmDot');
  if (dot) dot.style.display = count > 0 ? 'block' : 'none';
}

function injectBookmarkButtons() {
  // Proverbs
  document.querySelectorAll('.proverb-card, .proverb-item').forEach((card, i) => {
    const id    = `proverb-${i}`;
    const title = card.querySelector('h3, .prov-tigrinya, .prov-text')?.textContent?.trim().slice(0,60) || `Proverb ${i+1}`;
    if (card.querySelector('.bm-btn')) return;
    const btn = makeBmBtn(id, title, 'proverb');
    card.style.position = 'relative';
    card.appendChild(btn);
  });
  // Recipe cards
  document.querySelectorAll('.recipe-card').forEach((card, i) => {
    const id    = `recipe-${i}`;
    const title = card.querySelector('h3, .recipe-name')?.textContent?.trim().slice(0,60) || `Recipe ${i+1}`;
    if (card.querySelector('.bm-btn')) return;
    const btn = makeBmBtn(id, title, 'recipe', { emoji: '🍽️' });
    card.style.position = 'relative';
    card.appendChild(btn);
  });
  // Famous people
  document.querySelectorAll('.famous-card, .person-card').forEach((card, i) => {
    const id    = `person-${i}`;
    const title = card.querySelector('h3, .famous-name')?.textContent?.trim().slice(0,60) || `Person ${i+1}`;
    if (card.querySelector('.bm-btn')) return;
    const btn = makeBmBtn(id, title, 'person', { emoji: '⭐' });
    card.style.position = 'relative';
    card.appendChild(btn);
  });
  // Blog posts
  document.querySelectorAll('.blog-card, .article-card').forEach((card, i) => {
    const id    = `blog-${i}`;
    const title = card.querySelector('h3, h2, .blog-title')?.textContent?.trim().slice(0,60) || `Article ${i+1}`;
    if (card.querySelector('.bm-btn')) return;
    const btn = makeBmBtn(id, title, 'article', { emoji: '📖' });
    card.style.position = 'relative';
    card.appendChild(btn);
  });
  // Update active states
  getBookmarks().forEach(b => updateBmBtn(b.id, true));
}

function makeBmBtn(id, title, type, extra={}) {
  const btn = document.createElement('button');
  btn.className = 'bm-btn';
  btn.dataset.bm = id;
  btn.title = 'Bookmark this';
  btn.innerHTML = '🔖';
  btn.addEventListener('click', e => { e.stopPropagation(); toggleBookmark(id, title, type, extra); });
  if (isBookmarked(id)) btn.classList.add('active');
  return btn;
}

function openBookmarksPanel() {
  let panel = document.getElementById('bmPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'bmPanel';
    panel.className = 'bm-panel';
    panel.innerHTML = `
      <div class="bmp-inner">
        <div class="bmp-head">
          <span>🔖 My Bookmarks</span>
          <button id="bmpClose">✕</button>
        </div>
        <div id="bmpList" class="bmp-list"></div>
      </div>`;
    document.body.appendChild(panel);
    document.getElementById('bmpClose').addEventListener('click', () => panel.classList.remove('open'));
    panel.addEventListener('click', e => { if (e.target === panel) panel.classList.remove('open'); });
  }
  const list = document.getElementById('bmpList');
  const bms  = getBookmarks();
  if (!bms.length) {
    list.innerHTML = '<p class="bmp-empty">No bookmarks yet.<br>Tap 🔖 on any recipe, proverb, or article.</p>';
  } else {
    list.innerHTML = bms.map((b, i) => `
      <div class="bmp-item">
        <span class="bmp-emoji">${b.emoji || (b.type==='recipe'?'🍽️':b.type==='proverb'?'💬':b.type==='person'?'⭐':'📖')}</span>
        <div class="bmp-info">
          <p class="bmp-title">${esc(b.title)}</p>
          <p class="bmp-type">${esc(b.type)}</p>
        </div>
        <button class="bmp-remove" data-bmp-idx="${i}">✕</button>
      </div>`).join('');
    list.querySelectorAll('.bmp-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const b = bms[+btn.dataset.bmpIdx];
        if (b) { toggleBookmark(b.id, b.title, b.type); openBookmarksPanel(); }
      });
    });
  }
  panel.classList.add('open');
}
window.renderBookmarkPanel = openBookmarksPanel;
window.toggleBookmark = toggleBookmark;

async function pushBookmarksToCloud(bms) {
  try {
    if (!_authUser) return;
    const { db, doc, setDoc } = await getFirebase();
    await setDoc(doc(db, 'eri_bookmarks', _authUser.uid), { bookmarks: bms, updatedAt: new Date().toISOString() });
  } catch(e) { console.warn('[Bookmarks] cloud push failed:', e.message); }
}

async function syncBookmarksFromCloud() {
  try {
    if (!_authUser) return;
    const { db, doc, getDoc } = await getFirebase();
    const snap = await getDoc(doc(db, 'eri_bookmarks', _authUser.uid));
    if (snap.exists()) {
      const cloud = snap.data().bookmarks || [];
      const local = getBookmarks();
      const merged = [...local];
      cloud.forEach(cb => { if (!merged.find(lb => lb.id === cb.id)) merged.push(cb); });
      merged.sort((a,b) => (b.savedAt||0) - (a.savedAt||0));
      localStorage.setItem(BM_KEY, JSON.stringify(merged));
      getBookmarks().forEach(b => updateBmBtn(b.id, true));
      updateBookmarkCount();
    }
  } catch(e) { console.warn('[Bookmarks] cloud sync failed:', e.message); }
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. LIVE NEWS FEED (RSS)
// ══════════════════════════════════════════════════════════════════════════════
async function loadLiveNewsFeed() {
  const grid = document.getElementById('newsGrid');
  if (!grid) return;

  // Wait a moment — existing script.js may have already loaded Firestore news
  await new Promise(r => setTimeout(r, 1800));
  if (grid.querySelector('.news-card')) return; // already loaded by admin news

  grid.innerHTML = '<div class="news-loading-bar"><div></div></div>';

  const FEEDS = [
    { name: 'BBC Tigrinya', url: 'https://feeds.bbci.co.uk/tigrinya/rss.xml', flag: '🇬🇧' },
    { name: 'VOA Tigrinya', url: 'https://www.voanews.com/api/zgkqqiqreuqt',  flag: '🇺🇸' },
  ];

  const PROXY = 'https://api.rss2json.com/v1/api.json?rss_url=';

  for (const feed of FEEDS) {
    try {
      const res  = await fetch(PROXY + encodeURIComponent(feed.url), { signal: AbortSignal.timeout(6000) });
      const data = await res.json();
      if (!data.items?.length) continue;

      grid.innerHTML = `<div class="news-source-label">${feed.flag} Live from ${feed.name}</div>` +
        data.items.slice(0, 6).map(item => {
          const date = item.pubDate ? new Date(item.pubDate).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : '';
          const desc = (item.description||'').replace(/<[^>]+>/g,'').slice(0,160);
          return `
          <div class="news-card">
            ${item.thumbnail ? `<div class="news-img-wrap"><img src="${esc(item.thumbnail)}" alt="${esc(item.title)}" loading="lazy" onerror="this.parentElement.remove()"/></div>` : ''}
            <div class="news-body">
              <span class="news-tag">${feed.name}</span>
              <h3 class="news-title">${esc(item.title||'')}</h3>
              <p class="news-excerpt">${esc(desc)}${desc.length===160?'…':''}</p>
              <div class="news-meta">${date ? `<span class="news-date">📅 ${date}</span>` : ''}</div>
              <a href="${esc(item.link||'#')}" target="_blank" rel="noopener" class="news-read-more">Read more →</a>
            </div>
          </div>`;
        }).join('');
      return;
    } catch(e) { console.warn(`[News] ${feed.name} failed:`, e.message); }
  }
  // Static fallback
  grid.innerHTML = `
    <div class="news-card"><div class="news-body">
      <span class="news-tag">Eritrea</span>
      <h3 class="news-title">Eritrea celebrates National Day — May 24th</h3>
      <p class="news-excerpt">The State of Eritrea marks its independence from Ethiopia in 1993, with celebrations held across the country and in the diaspora worldwide.</p>
      <a href="https://en.wikipedia.org/wiki/Eritrean_Independence_Day" target="_blank" rel="noopener" class="news-read-more">Learn more →</a>
    </div></div>
    <div class="news-card"><div class="news-body">
      <span class="news-tag">Culture</span>
      <h3 class="news-title">Asmara's Modernist architecture — a UNESCO World Heritage Site</h3>
      <p class="news-excerpt">Asmara, the capital of Eritrea, is renowned for its remarkable collection of Modernist buildings from the Italian colonial era, recognised by UNESCO in 2017.</p>
      <a href="https://en.wikipedia.org/wiki/Asmara" target="_blank" rel="noopener" class="news-read-more">Learn more →</a>
    </div></div>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. PUSH NOTIFICATIONS — Web Notification API
// ══════════════════════════════════════════════════════════════════════════════
function injectNotificationBtn() {
  const navRight = document.querySelector('.nav-right');
  if (!navRight || document.getElementById('notifBtn')) return;
  const btn = document.createElement('button');
  btn.id = 'notifBtn';
  btn.className = 'notif-nav-btn';
  btn.title = 'Enable daily Tigrinya word notification';
  btn.innerHTML = '🔔';
  navRight.insertBefore(btn, navRight.children[0]);
  updateNotifBtn();
  btn.addEventListener('click', handleNotifClick);
}

function updateNotifBtn() {
  const btn = document.getElementById('notifBtn');
  if (!btn) return;
  const perm = Notification.permission;
  btn.innerHTML = perm === 'granted' ? '🔔' : '🔕';
  btn.classList.toggle('active', perm === 'granted');
  btn.title = perm === 'granted' ? 'Notifications on — click to test' : 'Enable daily notifications';
}

async function handleNotifClick() {
  if (!('Notification' in window)) { showToast('Notifications not supported in this browser', 'error'); return; }
  if (Notification.permission === 'granted') {
    sendDailyWordNotification();
  } else {
    const perm = await Notification.requestPermission();
    updateNotifBtn();
    if (perm === 'granted') {
      showToast('Notifications enabled! You\'ll get a daily Tigrinya word 🇪🇷', 'success');
      localStorage.setItem('eri_notif', '1');
      scheduleDailyNotification();
      sendDailyWordNotification();
    } else {
      showToast('Notifications blocked. Enable them in browser settings.', 'info');
    }
  }
}

const TIGRINYA_WORDS = [
  { word: 'ሰላም',    roman: 'Selam',      meaning: 'Peace / Hello' },
  { word: 'ሃገር',    roman: 'Hager',      meaning: 'Country / Nation' },
  { word: 'ፍቕሪ',    roman: "Fiqri",      meaning: 'Love' },
  { word: 'ቤተሰብ',  roman: 'Beteseb',    meaning: 'Family' },
  { word: 'ጽቡቕ',   roman: 'Tsibuk',     meaning: 'Good / Beautiful' },
  { word: 'ማይ',    roman: 'May',         meaning: 'Water' },
  { word: 'ኣብ',    roman: 'Ab',          meaning: 'In / At' },
  { word: 'ድሕሪ',   roman: 'Dihri',      meaning: 'After / Behind' },
  { word: 'ሓቂ',    roman: 'Haki',        meaning: 'Truth' },
  { word: 'ተስፋ',   roman: 'Tesfa',      meaning: 'Hope' },
  { word: 'ሓርነት',  roman: 'Harnet',     meaning: 'Freedom / Liberation' },
  { word: 'ደቂ',    roman: 'Deki',        meaning: 'Children / Sons of' },
  { word: 'ብርሃን',  roman: 'Birhan',     meaning: 'Light' },
  { word: 'ኤርትራ', roman: 'Eritrea',    meaning: 'Red Land (from Red Sea)' },
  { word: 'ዓወት',   roman: "Awet",       meaning: 'Victory' },
];

function getTodayWord() {
  const idx = (Math.floor(Date.now() / 86400000)) % TIGRINYA_WORDS.length;
  return TIGRINYA_WORDS[idx];
}

function sendDailyWordNotification() {
  if (Notification.permission !== 'granted') return;
  const w = getTodayWord();
  new Notification('ትግርኛ — Tigrinya Word of the Day 🇪🇷', {
    body: `${w.word} (${w.roman}) — "${w.meaning}"`,
    icon: './icons/icon.svg',
    badge: './icons/icon.svg',
    tag: 'eri-daily-word',
  });
}

function scheduleDailyNotification() {
  if (!localStorage.getItem('eri_notif')) return;
  const now  = new Date();
  const next = new Date(); next.setHours(9, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  const ms = next - now;
  setTimeout(() => {
    sendDailyWordNotification();
    scheduleDailyNotification();
  }, Math.min(ms, 2147483647));
}

if (localStorage.getItem('eri_notif') && Notification.permission === 'granted') scheduleDailyNotification();

// ══════════════════════════════════════════════════════════════════════════════
// 5. BLOG COMMENTS (Firestore)
// ══════════════════════════════════════════════════════════════════════════════
function injectCommentsSection() {
  const blog = document.getElementById('blog');
  if (!blog || document.getElementById('blogComments')) return;
  const wrap = document.createElement('div');
  wrap.id = 'blogComments';
  wrap.className = 'blog-comments-wrap';
  wrap.innerHTML = `
    <div class="container">
      <div class="bc-header">💬 Community Discussion</div>
      <div class="bc-form">
        <input  id="bcName"    class="bc-input"    placeholder="Your name (optional)" maxlength="50"/>
        <textarea id="bcText" class="bc-textarea"  placeholder="Share a thought, memory, or question about Eritrea…" rows="3" maxlength="500"></textarea>
        <div class="bc-form-row">
          <span id="bcCharCount" class="bc-char">0/500</span>
          <button id="bcSubmit" class="bc-submit">Post Comment</button>
        </div>
      </div>
      <div id="bcList" class="bc-list"><p class="bc-loading">Loading comments…</p></div>
    </div>`;
  blog.after(wrap);

  document.getElementById('bcText').addEventListener('input', e => {
    document.getElementById('bcCharCount').textContent = e.target.value.length + '/500';
  });
  document.getElementById('bcSubmit').addEventListener('click', submitComment);
  loadComments();
}

async function loadComments() {
  const list = document.getElementById('bcList');
  if (!list) return;
  try {
    const { db, collection, query, orderBy, limit, getDocs } = await getFirebase();
    const q    = query(collection(db, 'eri_comments'), orderBy('createdAt','desc'), limit(20));
    const snap = await getDocs(q);
    if (snap.empty) { list.innerHTML = '<p class="bc-empty">Be the first to comment!</p>'; return; }
    list.innerHTML = '';
    snap.forEach(d => {
      const c = d.data();
      const date = c.createdAt?.toDate ? c.createdAt.toDate().toLocaleDateString('en-GB',{day:'numeric',month:'short'}) : '';
      list.insertAdjacentHTML('beforeend', `
        <div class="bc-comment">
          <div class="bc-avatar">${(c.name||'A')[0].toUpperCase()}</div>
          <div class="bc-comment-body">
            <div class="bc-comment-meta"><strong>${esc(c.name||'Anonymous')}</strong>${date?`<span>${date}</span>`:''}</div>
            <p>${esc(c.text)}</p>
          </div>
        </div>`);
    });
  } catch(e) {
    list.innerHTML = '<p class="bc-empty">Comments unavailable right now.</p>';
    console.warn('[Comments]', e);
  }
}

async function submitComment() {
  const nameEl = document.getElementById('bcName');
  const textEl = document.getElementById('bcText');
  const btn    = document.getElementById('bcSubmit');
  const text   = textEl.value.trim();
  if (!text) { showToast('Please write something first', 'info'); return; }
  btn.textContent = 'Posting…'; btn.disabled = true;
  try {
    const { db, collection, addDoc, serverTimestamp } = await getFirebase();
    await addDoc(collection(db, 'eri_comments'), {
      name:      (nameEl.value.trim() || 'Anonymous').slice(0,50),
      text:      text.slice(0,500),
      uid:       _authUser?.uid || null,
      createdAt: serverTimestamp(),
    });
    textEl.value = ''; nameEl.value = '';
    document.getElementById('bcCharCount').textContent = '0/500';
    showToast('Comment posted! ✓', 'success');
    loadComments();
  } catch(e) {
    showToast('Failed to post comment', 'error');
  }
  btn.textContent = 'Post Comment'; btn.disabled = false;
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. TIGRINYA LEARNING PATH / STREAK
// ══════════════════════════════════════════════════════════════════════════════
function getStreak() {
  const data = JSON.parse(localStorage.getItem('eri_streak') || '{"days":0,"lastDate":"","totalWords":0,"quizzes":0}');
  const today = new Date().toISOString().slice(0,10);
  const yest  = new Date(Date.now()-86400000).toISOString().slice(0,10);
  if (data.lastDate === today)  return data;
  if (data.lastDate === yest)   { data.days += 1; }
  else if (data.lastDate !== today) { data.days = 1; }
  data.lastDate = today;
  localStorage.setItem('eri_streak', JSON.stringify(data));
  return data;
}

function injectLearningWidget() {
  if (document.getElementById('learnWidget')) return;
  const w = document.createElement('div');
  w.id = 'learnWidget';
  w.className = 'learn-widget';
  const s = getStreak();
  w.innerHTML = `
    <div class="lw-header" id="lwHeader">
      <span class="lw-flame">🔥</span>
      <div class="lw-info">
        <p class="lw-streak">${s.days} day streak</p>
        <p class="lw-sub">Learning journey</p>
      </div>
      <button class="lw-toggle" id="lwToggle">▲</button>
    </div>
    <div class="lw-body" id="lwBody">
      <div class="lw-stat-row">
        <div class="lw-stat"><div class="lw-stat-val" id="lwDays">${s.days}</div><div class="lw-stat-label">Day streak</div></div>
        <div class="lw-stat"><div class="lw-stat-val" id="lwWords">${s.totalWords||0}</div><div class="lw-stat-label">Words learned</div></div>
        <div class="lw-stat"><div class="lw-stat-val" id="lwQuizzes">${s.quizzes||0}</div><div class="lw-stat-label">Quizzes done</div></div>
      </div>
      <div class="lw-progress-bar"><div class="lw-progress-fill" style="width:${Math.min((s.days/30)*100,100)}%"></div></div>
      <p class="lw-goal">${s.days >= 30 ? '🎉 30-day goal reached!' : `${30-s.days} days to 30-day goal`}</p>
      <div class="lw-quick-links">
        <a href="#fidel"   class="lw-link">🔤 Alphabet</a>
        <a href="#lessons" class="lw-link">📖 Lessons</a>
        <a href="#quiz"    class="lw-link">🏆 Quiz</a>
        <a href="#proverbs"class="lw-link">💬 Proverbs</a>
      </div>
    </div>`;
  document.body.appendChild(w);
  document.getElementById('lwToggle').addEventListener('click', () => {
    const body = document.getElementById('lwBody');
    const tog  = document.getElementById('lwToggle');
    const open = !body.classList.contains('closed');
    body.classList.toggle('closed', open);
    tog.textContent = open ? '▼' : '▲';
  });
}

function recordWordLearned() {
  const data = JSON.parse(localStorage.getItem('eri_streak') || '{"days":0,"lastDate":"","totalWords":0,"quizzes":0}');
  data.totalWords = (data.totalWords || 0) + 1;
  localStorage.setItem('eri_streak', JSON.stringify(data));
  const el = document.getElementById('lwWords');
  if (el) el.textContent = data.totalWords;
}
window.recordWordLearned = recordWordLearned;

function recordQuizDone() {
  const data = JSON.parse(localStorage.getItem('eri_streak') || '{"days":0,"lastDate":"","totalWords":0,"quizzes":0}');
  data.quizzes = (data.quizzes || 0) + 1;
  localStorage.setItem('eri_streak', JSON.stringify(data));
  const el = document.getElementById('lwQuizzes');
  if (el) el.textContent = data.quizzes;
}
window.recordQuizDone = recordQuizDone;

// ══════════════════════════════════════════════════════════════════════════════
// 7. SHAREABLE CARDS (Canvas + Web Share)
// ══════════════════════════════════════════════════════════════════════════════
function injectShareButtons() {
  // Add share button to each proverb card
  document.querySelectorAll('.proverb-card, .proverb-item').forEach((card, i) => {
    if (card.querySelector('.share-btn')) return;
    const tigrinya = card.querySelector('.prov-tigrinya, h3, .prov-text')?.textContent?.trim() || '';
    const meaning  = card.querySelector('.prov-meaning, p, .prov-english')?.textContent?.trim() || '';
    const btn = document.createElement('button');
    btn.className = 'share-btn';
    btn.innerHTML = '↗ Share';
    btn.addEventListener('click', e => {
      e.stopPropagation();
      shareProverb(tigrinya, meaning);
    });
    card.appendChild(btn);
  });

  // Word of day share button
  const wodWidget = document.getElementById('wordOfDayWidget');
  if (wodWidget && !wodWidget.querySelector('.share-btn')) {
    const btn = document.createElement('button');
    btn.className = 'share-btn wod-share';
    btn.innerHTML = '↗ Share';
    btn.addEventListener('click', () => {
      const word    = document.getElementById('wodWord')?.textContent || '';
      const roman   = document.getElementById('wodRoman')?.textContent || '';
      const meaning = document.getElementById('wodMeaning')?.textContent || '';
      shareProverb(word + (roman ? ` (${roman})` : ''), meaning);
    });
    wodWidget.appendChild(btn);
  }
}

async function shareProverb(title, subtitle) {
  const text = `${title}\n${subtitle}\n\n🇪🇷 eritreaninfo.com`;
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Eritrean Wisdom 🇪🇷', text, url: 'https://eritreaninfo.com' });
      return;
    } catch(e) { if (e.name === 'AbortError') return; }
  }
  // Fallback: generate canvas image and download
  generateShareCard(title, subtitle);
}

function generateShareCard(title, subtitle) {
  const canvas = document.createElement('canvas');
  canvas.width  = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');

  // Background gradient (Eritrean flag inspired)
  const grad = ctx.createLinearGradient(0, 0, 1080, 1080);
  grad.addColorStop(0, '#004d26');
  grad.addColorStop(0.5, '#003a1e');
  grad.addColorStop(1, '#001a0d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1080, 1080);

  // Decorative stripes (top)
  ctx.fillStyle = '#007A3D'; ctx.fillRect(0, 0, 1080, 12);
  ctx.fillStyle = '#4189DD'; ctx.fillRect(0, 12, 1080, 12);
  ctx.fillStyle = '#CE1126'; ctx.fillRect(0, 24, 1080, 12);

  // Decorative stripes (bottom)
  ctx.fillStyle = '#CE1126'; ctx.fillRect(0, 1044, 1080, 12);
  ctx.fillStyle = '#4189DD'; ctx.fillRect(0, 1056, 1080, 12);
  ctx.fillStyle = '#007A3D'; ctx.fillRect(0, 1068, 1080, 12);

  // Flag emoji (top center)
  ctx.font = '120px serif';
  ctx.textAlign = 'center';
  ctx.fillText('🇪🇷', 540, 200);

  // Decorative quotes
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.font = 'bold 240px serif';
  ctx.fillText('"', 60, 380);
  ctx.fillText('"', 960, 820);

  // Main text
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  const lines = wrapText(ctx, title, 900, '700 52px Montserrat, sans-serif');
  ctx.font = '700 52px sans-serif';
  let y = 440;
  lines.forEach(l => { ctx.fillText(l, 540, y); y += 68; });

  // Subtitle
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '400 38px sans-serif';
  const subLines = wrapText(ctx, subtitle, 860, '400 38px sans-serif');
  y += 20;
  subLines.forEach(l => { ctx.fillText(l, 540, y); y += 52; });

  // Branding
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '600 28px sans-serif';
  ctx.fillText('eritreaninfo.com', 540, 1010);

  const link = document.createElement('a');
  link.download = 'eritrea-wisdom.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
  showToast('Card saved! Share it on social media 🇪🇷', 'success');
}

function wrapText(ctx, text, maxWidth, font) {
  ctx.font = font;
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  words.forEach(w => {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && cur) { lines.push(cur); cur = w; }
    else cur = test;
  });
  if (cur) lines.push(cur);
  return lines;
}

// ══════════════════════════════════════════════════════════════════════════════
// 8. DEEP LINK ROUTING — Enhanced hash navigation
// ══════════════════════════════════════════════════════════════════════════════
function handleDeepLink() {
  const hash = window.location.hash.slice(1);
  if (!hash) return;
  // Standard section link — the browser handles it. We just close the nav menu.
  document.getElementById('navDropdown')?.classList.remove('open');
  document.getElementById('navToggle')?.classList.remove('active');
  // Delay to let the page render first
  setTimeout(() => {
    const el = document.getElementById(hash);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 300);
}

window.addEventListener('hashchange', handleDeepLink);
window.addEventListener('DOMContentLoaded', () => setTimeout(handleDeepLink, 400));

// Make every nav link update the URL hash (already done by <a href="#...">)
// Enhance: share current section button
function addSectionShareLinks() {
  document.querySelectorAll('section[id]').forEach(sec => {
    const header = sec.querySelector('.section-header');
    if (!header || header.querySelector('.section-share-link')) return;
    const link = document.createElement('button');
    link.className = 'section-share-link';
    link.title = 'Copy link to this section';
    link.innerHTML = '🔗';
    link.addEventListener('click', () => {
      const url = `${location.origin}${location.pathname}#${sec.id}`;
      navigator.clipboard.writeText(url).then(() => showToast('Link copied! ✓', 'success')).catch(() => {
        prompt('Copy this link:', url);
      });
    });
    header.appendChild(link);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 10. COMMUNITY EVENTS BOARD (Firestore)
// ══════════════════════════════════════════════════════════════════════════════
async function initEventsBoard() {
  const esmSubmit = document.getElementById('esmSubmit');
  const esmClose  = document.getElementById('esmClose');
  const addBtn    = document.getElementById('eventsAddBtn');
  const modal     = document.getElementById('eventSubmitModal');
  const grid      = document.getElementById('eventsGrid');
  if (!esmSubmit || !grid) return;

  // Open / close modal
  addBtn?.addEventListener('click', () => modal?.removeAttribute('hidden'));
  esmClose?.addEventListener('click', () => modal?.setAttribute('hidden', ''));

  // Load approved events
  await loadEvents(grid);

  // Country filter
  document.getElementById('eventsCountryFilter')?.addEventListener('change', async e => {
    await loadEvents(grid, e.target.value);
  });

  // Submit
  esmSubmit.addEventListener('click', async () => {
    const name     = document.getElementById('esmName')?.value.trim();
    const date     = document.getElementById('esmDate')?.value;
    const location = document.getElementById('esmLocation')?.value.trim();
    const desc     = document.getElementById('esmDesc')?.value.trim();
    const link     = document.getElementById('esmLink')?.value.trim();
    if (!name || !date || !location) { showToast('Please fill in name, date, and location', 'info'); return; }
    esmSubmit.textContent = 'Submitting…'; esmSubmit.disabled = true;
    try {
      const { db, collection, addDoc, serverTimestamp } = await getFirebase();
      await addDoc(collection(db, 'eri_events'), {
        name, date, location, desc: desc||'', link: link||'',
        status: 'pending',
        uid: _authUser?.uid || null,
        submittedAt: serverTimestamp(),
      });
      modal?.setAttribute('hidden', '');
      ['esmName','esmDate','esmLocation','esmDesc','esmLink'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
      });
      showToast('Event submitted for review! ✓', 'success');
    } catch(e) {
      showToast('Submission failed: ' + e.message, 'error');
    }
    esmSubmit.textContent = 'Submit for Review'; esmSubmit.disabled = false;
  });
}

async function loadEvents(grid, countryFilter='') {
  if (!grid) return;
  grid.innerHTML = '<p style="padding:16px;color:rgba(255,255,255,0.4)">Loading events…</p>';
  try {
    const { db, collection, query, where, orderBy, getDocs } = await getFirebase();
    const today = new Date().toISOString().slice(0,10);
    let q = query(
      collection(db, 'eri_events'),
      where('status', '==', 'approved'),
      orderBy('date', 'asc')
    );
    const snap = await getDocs(q);
    let events = [];
    snap.forEach(d => { const data = d.data(); if (data.date >= today) events.push(data); });
    if (countryFilter) events = events.filter(e => e.location?.toLowerCase().includes(countryFilter));
    if (!events.length) {
      grid.innerHTML = '<p style="padding:16px;color:rgba(255,255,255,0.4)">No upcoming events. Submit one above!</p>';
      return;
    }
    grid.innerHTML = events.map(e => `
      <div class="event-card">
        <div class="event-date-badge">${formatEventDate(e.date)}</div>
        <div class="event-body">
          <h3 class="event-name">${esc(e.name)}</h3>
          <p class="event-location">📍 ${esc(e.location)}</p>
          ${e.desc ? `<p class="event-desc">${esc(e.desc)}</p>` : ''}
          ${e.link ? `<a href="${esc(e.link)}" class="event-link" target="_blank" rel="noopener">More info →</a>` : ''}
        </div>
      </div>`).join('');
  } catch(err) {
    grid.innerHTML = '<p style="padding:16px;color:rgba(255,255,255,0.4)">Events unavailable right now.</p>';
    console.warn('[Events]', err);
  }
}

function formatEventDate(dateStr) {
  if (!dateStr) return '?';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
}

// ══════════════════════════════════════════════════════════════════════════════
// INIT — Run all features on DOMContentLoaded
// ══════════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  injectAuthButton();
  injectNotificationBtn();
  injectLearningWidget();

  // Inject bookmark + share buttons after a short delay to allow cards to render
  setTimeout(() => {
    injectBookmarkButtons();
    injectShareButtons();
    addSectionShareLinks();
    injectCommentsSection();
  }, 800);

  initEventsBoard();
  updateBookmarkCount();

  // ── Sections v1.0 ──
  initPoetryCorner();
  initFactGenerator();
  initDiasporaMapSection();
  initCountryCompare();
  initCookingVideos();
  initDirectory();

  // ── Tweaks v2.0 ──
  initReadingProgressBar();
  initWordOfDay();
  initReadingMode();
  initInPageSearch();
  initOfflineBadges();
  initLessonsStreakBanner();
  initQuizLeaderboard();
  initRelatedSections();
  initPrayerLocate();
  initEventsICS();
  initVisitorCounter();
  setTimeout(initShareOnFacts, 1200);

  // ── Power Upgrade ──
  initNewsTicker();
  initDiasporaClocks();
  initCityWeather();
  initEriTodayCard();
  initLiveRates();
  initCountrySpotlight();
  initAutoRefresh();
  setTimeout(() => {
    initEnhancedNewsTabs();
    initCopyButtons();
    initExploreScore();
  }, 900);
});

// ══════════════════════════════════════════════════════════════════════════════
// TWEAKS v2.0 — 13 new features
// ══════════════════════════════════════════════════════════════════════════════

// ── T1: READING PROGRESS BAR ─────────────────────────────────────────────────
function initReadingProgressBar() {
  const bar = document.getElementById('readingProgress');
  if (!bar) return;
  window.addEventListener('scroll', () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%';
  }, { passive: true });
}

// ── T2: WORD OF THE DAY ──────────────────────────────────────────────────────
function initWordOfDay() {
  const WORDS = [
    { ti: 'ሰላም', en: 'Peace / Hello', ex: '"ሰላም ኣለዉ?" — How are you?' },
    { ti: 'ፍቕሪ', en: 'Love', ex: '"ፍቕሪ ይወስን" — Love conquers' },
    { ti: 'ሓርነት', en: 'Freedom', ex: 'ሓርነት ኤርትራ — Freedom of Eritrea' },
    { ti: 'ትምህርቲ', en: 'Education', ex: '"ትምህርቲ ብርሃን" — Education is light' },
    { ti: 'ሃገር', en: 'Country/Nation', ex: '"ሃገርና ኤርትራ" — Our nation Eritrea' },
    { ti: 'ሓቂ', en: 'Truth', ex: '"ሓቂ ትዕወት" — Truth prevails' },
    { ti: 'ደስታ', en: 'Joy/Happiness', ex: '"ደስታ ኣምጽእ" — Bring joy' },
    { ti: 'ብርሃን', en: 'Light', ex: '"ብርሃን ናይ ዓለም" — Light of the world' },
    { ti: 'ሰብ', en: 'Person/Human', ex: '"ሰብ ሓው ሰብ" — People are siblings' },
    { ti: 'ዕዮ', en: 'Work', ex: '"ዕዮ ክብሪ" — Work is dignity' },
    { ti: 'ኣደ', en: 'Mother', ex: '"ኣደ ፍቕሪ" — A mother\'s love' },
    { ti: 'ሃልሃልታ', en: 'Flame/Passion', ex: 'ሃልሃልታ ልቢ — Flame of the heart' },
    { ti: 'ዓወት', en: 'Victory', ex: '"ዓወት ንሓፋሽ" — Victory to the masses' },
    { ti: 'ጽቡቕ', en: 'Good/Beautiful', ex: '"ጽቡቕ ዕዮ" — Good work' },
    { ti: 'ምሕረት', en: 'Mercy/Forgiveness', ex: '"ምሕረት ዓቢ ምትእምማን" — Mercy builds trust' },
    { ti: 'ተስፋ', en: 'Hope', ex: '"ተስፋ ይቕጽል" — Hope continues' },
    { ti: 'ክብሪ', en: 'Honor/Dignity', ex: '"ክብሪ ሰብኣይ" — A man\'s honor' },
    { ti: 'ጽምዋ', en: 'Loneliness/Solitude', ex: '"ጽምዋ ሓጺን" — Solitude is iron' },
    { ti: 'ሙዚቃ', en: 'Music', ex: '"ሙዚቃ ናይ ዓለም" — Music of the world' },
    { ti: 'ደልሃመት', en: 'Darkness', ex: '"ድሕሪ ደልሃመት ብርሃን" — After darkness, light' },
    { ti: 'ጀሚርካ', en: 'Beginning/Started', ex: '"ጀሚርካ ፈሊ" — Start and finish' },
    { ti: 'ቤት', en: 'Home/House', ex: '"ቤት ቀዳምነት" — Home is priority' },
    { ti: 'ጸሎት', en: 'Prayer', ex: '"ጸሎት ሓይሊ" — Prayer is strength' },
    { ti: 'ዕርቂ', en: 'Reconciliation', ex: '"ዕርቂ ቅዱስ" — Reconciliation is sacred' },
    { ti: 'ምዕባለ', en: 'Development', ex: '"ምዕባለ ህዝቢ" — People\'s development' },
    { ti: 'ኪዳን', en: 'Covenant/Promise', ex: '"ኪዳን ኤርትራ" — Eritrea\'s covenant' },
    { ti: 'ሕሉፍ', en: 'Past/Former', ex: '"ሕሉፍ ተምሂርና" — We learn from the past' },
    { ti: 'ዕድሜ', en: 'Age/Lifespan', ex: '"ዕድሜ ጸጋ" — Age is a blessing' },
  ];
  const today = Math.floor(Date.now() / 86400000);
  const dismissed = localStorage.getItem('wod_dismissed');
  if (dismissed === String(today)) return;
  const w = WORDS[today % WORDS.length];
  const bar = document.getElementById('wodBar');
  if (!bar) return;
  document.getElementById('wodTi').textContent = w.ti;
  document.getElementById('wodEn').textContent = w.en;
  document.getElementById('wodEx').textContent = w.ex;
  bar.hidden = false;
  document.getElementById('wodClose').onclick = () => {
    bar.hidden = true;
    localStorage.setItem('wod_dismissed', String(today));
  };
}

// ── T3 (reading bar already in T1) / T9: READING MODE ───────────────────────
function initReadingMode() {
  const btn = document.getElementById('readingModeBtn');
  if (!btn) return;
  const active = localStorage.getItem('eri_reading_mode') === '1';
  if (active) { document.body.classList.add('reading-mode'); btn.classList.add('active'); }
  btn.addEventListener('click', () => {
    const on = document.body.classList.toggle('reading-mode');
    btn.classList.toggle('active', on);
    localStorage.setItem('eri_reading_mode', on ? '1' : '0');
  });
}

// ── T4: BOOKMARK QUICK-VIEW (panel already exists, wire nav button) ───────────
// The bmPanel is already wired via injectBookmarkButtons() — exposed via window
// The auth button area already has a bookmarks trigger in features.js

// ── T5: STREAK & XP BANNER ON LESSONS PAGE ───────────────────────────────────
function initLessonsStreakBanner() {
  const section = document.getElementById('lessons');
  if (!section) return;
  const s = getStreak();
  const banner = document.createElement('div');
  banner.className = 'lessons-streak-banner';
  banner.innerHTML = `
    <div class="lsb-flame">🔥</div>
    <div class="lsb-info">
      <p class="lsb-streak">${s.days} day streak</p>
      <p class="lsb-sub">${s.totalWords} words learned · ${s.quizzes} quizzes done</p>
    </div>
    <div class="lsb-xp">
      <div class="lsb-xp-num">${(s.totalWords * 10) + (s.quizzes * 25)}</div>
      <div class="lsb-xp-lbl">XP</div>
    </div>`;
  const progressWrap = section.querySelector('.lessons-progress-bar-wrap');
  if (progressWrap) progressWrap.before(banner);
  else section.querySelector('.container').prepend(banner);
}

// ── T6: SHARE AS IMAGE on Facts ───────────────────────────────────────────────
function initShareOnFacts() {
  const shareBtn = document.getElementById('fgShare');
  const textEl   = document.getElementById('fgText');
  if (!shareBtn || !textEl) return;
  shareBtn.addEventListener('click', () => {
    const text = textEl.textContent.trim();
    if (!text) return;
    if (typeof generateShareCard === 'function') generateShareCard('Did You Know?', text);
    else if (typeof shareProverb === 'function') shareProverb('🇪🇷 Did You Know?', text);
    else { navigator.clipboard?.writeText(text + '\n\n🇪🇷 eritreaninfo.com'); }
  });
}

// ── T7: QUIZ LEADERBOARD ─────────────────────────────────────────────────────
function initQuizLeaderboard() {
  const lbEl = document.getElementById('quizLeaderboard');
  if (!lbEl) return;

  async function saveScore(score, total) {
    if (!_authUser) return;
    try {
      const { db, collection, addDoc, serverTimestamp } = await _getFirestore();
      await addDoc(collection(db, 'eri_quiz_scores'), {
        uid: _authUser.uid,
        name: _authUser.displayName || _authUser.email?.split('@')[0] || 'Anonymous',
        score, total,
        pct: Math.round((score / total) * 100),
        at: serverTimestamp()
      });
    } catch(e) { console.warn('[Quiz] score save:', e); }
  }

  async function loadLeaderboard() {
    lbEl.style.display = 'block';
    lbEl.innerHTML = '<div class="quiz-leaderboard"><p class="qlb-title">🏆 Top Scores</p><p style="opacity:.4;font-size:.8rem">Loading…</p></div>';
    try {
      const { db, collection, query, orderBy, limit, getDocs } = await _getFirestore();
      const snap = await getDocs(query(collection(db, 'eri_quiz_scores'), orderBy('pct','desc'), orderBy('at','desc'), limit(10)));
      const rows = snap.docs.map((d,i) => {
        const data = d.data();
        const isMe = _authUser && data.uid === _authUser.uid;
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
        return `<div class="qlb-row${isMe?' me':''}"><span class="qlb-rank">${medal}</span><span class="qlb-name">${esc(data.name)}</span><span class="qlb-score">${data.score}/${data.total} (${data.pct}%)</span></div>`;
      });
      lbEl.innerHTML = `<div class="quiz-leaderboard"><p class="qlb-title">🏆 Top Scores</p>${rows.join('') || '<p style="opacity:.4;font-size:.8rem">No scores yet.</p>'}</div>`;
    } catch(e) { lbEl.innerHTML = ''; }
  }

  // Patch quiz result to save score + show leaderboard
  const retryBtn = document.getElementById('quizRetryBtn');
  const resultEl = document.getElementById('quizResult');
  if (retryBtn && resultEl) {
    const obs = new MutationObserver(() => {
      if (!resultEl.hidden) {
        const scoreEl = document.getElementById('quizFinalScore');
        if (scoreEl) {
          const match = scoreEl.textContent.match(/(\d+)\s*\/\s*(\d+)/);
          if (match) { saveScore(parseInt(match[1]), parseInt(match[2])); loadLeaderboard(); }
        }
      }
    });
    obs.observe(resultEl, { attributes: true, attributeFilter: ['hidden'] });
  }
}

// Helper: lazy-load Firestore modules
async function _getFirestore() {
  const VER = '10.12.2';
  const base = `https://www.gstatic.com/firebasejs/${VER}/firebase-firestore.js`;
  const m = await import(base);
  const app = (await import(`https://www.gstatic.com/firebasejs/${VER}/firebase-app.js`)).getApps()[0];
  const db = m.getFirestore(app);
  return { db, ...m };
}

// ── T8: RELATED SECTIONS ─────────────────────────────────────────────────────
function initRelatedSections() {
  const MAP = {
    'recipes':    [{ href:'#cooking-videos', label:'🎬 Cooking Videos' }, { href:'#culture', label:'🎭 Culture' }, { href:'#artists', label:'🎵 Artists' }],
    'history':    [{ href:'#overview', label:'🏛️ Overview' }, { href:'#geography', label:'🗺️ Geography' }, { href:'#government', label:'⚖️ Government' }],
    'culture':    [{ href:'#recipes', label:'🍽️ Recipes' }, { href:'#music', label:'🎵 Music' }, { href:'#proverbs', label:'💬 Proverbs' }, { href:'#holidays', label:'🗓️ Holidays' }],
    'proverbs':   [{ href:'#poetry', label:'📝 Poetry' }, { href:'#lessons', label:'📖 Lessons' }, { href:'#facts', label:'🌟 Facts' }],
    'poetry':     [{ href:'#proverbs', label:'💬 Proverbs' }, { href:'#blog', label:'📖 Blog' }, { href:'#artists', label:'🎵 Artists' }],
    'facts':      [{ href:'#quiz', label:'🏆 Quiz' }, { href:'#history', label:'📜 History' }, { href:'#diaspora-map', label:'🌍 Diaspora' }],
    'lessons':    [{ href:'#fidel', label:'🔤 Alphabet' }, { href:'#proverbs', label:'💬 Proverbs' }, { href:'#quiz', label:'🏆 Quiz' }],
    'tourism':    [{ href:'#gallery', label:'📸 Gallery' }, { href:'#regions', label:'🗾 Regions' }, { href:'#compare', label:'📊 Compare' }],
    'quiz':       [{ href:'#facts', label:'🌟 Facts' }, { href:'#history', label:'📜 History' }, { href:'#lessons', label:'📖 Lessons' }],
    'geography':  [{ href:'#diaspora-map', label:'🌍 Diaspora' }, { href:'#regions', label:'🗾 Regions' }, { href:'#compare', label:'📊 Compare' }],
    'economy':    [{ href:'#government', label:'⚖️ Government' }, { href:'#compare', label:'📊 Compare' }, { href:'#people', label:'👥 People' }],
  };
  Object.entries(MAP).forEach(([id, links]) => {
    const section = document.getElementById(id);
    if (!section) return;
    const container = section.querySelector('.container');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'related-sections';
    div.innerHTML = `<div class="related-title">You might also like</div><div class="related-links">${links.map(l=>`<a href="${l.href}" class="related-link">${l.label}</a>`).join('')}</div>`;
    container.appendChild(div);
  });
}

// ── T10: PRAYER TIMES AUTO-DETECT LOCATION ───────────────────────────────────
function initPrayerLocate() {
  const btn = document.getElementById('prayerLocateBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (!navigator.geolocation) { alert('Geolocation not supported by your browser.'); return; }
    btn.textContent = '📍 Locating…';
    btn.classList.add('loading');
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      const date  = new Date();
      const url   = `https://api.aladhan.com/v1/timings/${Math.floor(date/1000)}?latitude=${lat}&longitude=${lng}&method=2`;
      try {
        const res  = await fetch(url);
        const data = await res.json();
        const t    = data.data.timings;
        const grid = document.getElementById('prayerGrid');
        if (!grid) return;
        const prayers = [
          { name:'Fajr', icon:'🌙', time: t.Fajr },
          { name:'Dhuhr', icon:'☀️', time: t.Dhuhr },
          { name:'Asr', icon:'🌤️', time: t.Asr },
          { name:'Maghrib', icon:'🌅', time: t.Maghrib },
          { name:'Isha', icon:'🌙', time: t.Isha }
        ];
        grid.innerHTML = prayers.map(p => `
          <div class="prayer-card">
            <div class="prayer-icon">${p.icon}</div>
            <div class="prayer-name">${p.name}</div>
            <div class="prayer-time">${p.time}</div>
          </div>`).join('');
        const hijriEl = document.getElementById('prayerHijri');
        if (hijriEl) hijriEl.textContent = `${data.data.date.hijri.date} — ${data.data.date.hijri.month.en} ${data.data.date.hijri.year} AH`;
        document.querySelectorAll('.pct').forEach(b => b.classList.remove('active'));
        btn.textContent = '📍 My Location ✓';
        btn.classList.add('active');
      } catch { btn.textContent = '📍 My Location'; }
      btn.classList.remove('loading');
    }, () => { btn.textContent = '📍 My Location'; btn.classList.remove('loading'); alert('Could not get location. Please allow location access.'); });
  });
}

// ── T11: IN-PAGE SEARCH ───────────────────────────────────────────────────────
function initInPageSearch() {
  const overlay = document.getElementById('inPageSearchOverlay');
  const input   = document.getElementById('ipsInput');
  const countEl = document.getElementById('ipsCount');
  const prevBtn = document.getElementById('ipsPrev');
  const nextBtn = document.getElementById('ipsNext');
  const closeBtn = document.getElementById('ipsClose');
  const openBtn  = document.getElementById('inPageSearchBtn');
  if (!overlay || !input) return;

  let highlights = [], current = 0;

  function clearHighlights() {
    document.querySelectorAll('.ips-highlight').forEach(el => {
      el.replaceWith(document.createTextNode(el.textContent));
    });
    highlights = []; current = 0;
  }

  function doSearch(q) {
    clearHighlights();
    if (!q.trim()) { countEl.textContent = ''; return; }
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: n => {
        const p = n.parentElement;
        if (!p || ['SCRIPT','STYLE','INPUT','TEXTAREA'].includes(p.tagName)) return NodeFilter.FILTER_REJECT;
        if (p.closest('.ips-overlay, #navbar, .learn-widget, .bm-panel, .auth-panel')) return NodeFilter.FILTER_REJECT;
        return n.textContent.toLowerCase().includes(q.toLowerCase()) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi');
    nodes.forEach(node => {
      const parts = node.textContent.split(re);
      if (parts.length < 2) return;
      const frag = document.createDocumentFragment();
      parts.forEach((p, i) => {
        if (i % 2 === 1) { const span = document.createElement('mark'); span.className = 'ips-highlight'; span.textContent = p; frag.appendChild(span); highlights.push(span); }
        else frag.appendChild(document.createTextNode(p));
      });
      node.parentNode.replaceChild(frag, node);
    });
    countEl.textContent = highlights.length ? `${current + 1}/${highlights.length}` : '0';
    if (highlights.length) { highlights[0].classList.add('current'); highlights[0].scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }

  function navigate(dir) {
    if (!highlights.length) return;
    highlights[current].classList.remove('current');
    current = (current + dir + highlights.length) % highlights.length;
    highlights[current].classList.add('current');
    highlights[current].scrollIntoView({ behavior: 'smooth', block: 'center' });
    countEl.textContent = `${current + 1}/${highlights.length}`;
  }

  function open() { overlay.hidden = false; input.focus(); input.select(); }
  function close() { overlay.hidden = true; clearHighlights(); countEl.textContent = ''; input.value = ''; }

  openBtn?.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);
  prevBtn?.addEventListener('click', () => navigate(-1));
  nextBtn?.addEventListener('click', () => navigate(1));
  input.addEventListener('input', () => doSearch(input.value));
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') navigate(e.shiftKey ? -1 : 1);
    if (e.key === 'Escape') close();
  });
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); open(); }
    if (e.key === 'Escape' && !overlay.hidden) close();
  });
}

// ── T12: CULTURAL CALENDAR .ICS DOWNLOAD ─────────────────────────────────────
function initEventsICS() {
  const btn = document.getElementById('eventsIcsBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    btn.textContent = '⏳ Generating…';
    let events = [];
    try {
      const { db, collection, getDocs, query, orderBy } = await _getFirestore();
      const snap = await getDocs(query(collection(db, 'eri_events'), orderBy('date','asc')));
      events = snap.docs.map(d => d.data()).filter(e => e.date && e.name && e.status !== 'rejected');
    } catch { /* use empty */ }

    if (!events.length) { btn.textContent = '📅 Download Calendar'; alert('No events found to download.'); return; }

    const esc = s => (s || '').replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n');
    const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//EritreanInfo//Events//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
    events.forEach(ev => {
      const d = ev.date.replace(/-/g, '');
      lines.push('BEGIN:VEVENT', `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${d}`, `SUMMARY:${esc(ev.name)}`, `DESCRIPTION:${esc(ev.description || '')}`, `LOCATION:${esc(ev.location || '')}`, `STATUS:CONFIRMED`, 'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'eritrean-events.ics' });
    a.click(); URL.revokeObjectURL(a.href);
    btn.textContent = '📅 Download Calendar';
  });
}

// ── T13: VISITOR COUNTER / LIVE PRESENCE ─────────────────────────────────────
function initVisitorCounter() {
  const SECTIONS = ['history', 'quiz', 'recipes', 'proverbs', 'lessons', 'culture', 'facts'];
  const TTL = 5 * 60 * 1000; // 5 min presence window
  const sessionId = Math.random().toString(36).slice(2);

  async function registerPresence(sectionId) {
    try {
      const { db, doc, setDoc, collection, getDocs, query, where, serverTimestamp, Timestamp } = await _getFirestore();
      const ref = doc(collection(db, 'eri_presence'), `${sectionId}_${sessionId}`);
      await setDoc(ref, { section: sectionId, at: serverTimestamp(), ttl: Date.now() + TTL });
      const cutoff = Timestamp.fromMillis(Date.now() - TTL);
      const snap   = await getDocs(query(collection(db, 'eri_presence'), where('section','==',sectionId)));
      const live   = snap.docs.filter(d => { const data = d.data(); return data.at?.toMillis ? data.at.toMillis() > Date.now() - TTL : true; }).length;
      injectVisitorCount(sectionId, live);
    } catch { /* silent */ }
  }

  function injectVisitorCount(sectionId, count) {
    const section = document.getElementById(sectionId);
    if (!section || count < 2) return;
    let el = section.querySelector('.visitor-counter');
    if (!el) {
      el = document.createElement('div');
      el.className = 'visitor-counter';
      section.querySelector('.section-header p')?.after(el) || section.querySelector('.section-header')?.appendChild(el);
    }
    el.innerHTML = `<span class="visitor-dot"></span> ${count} people reading this now`;
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { registerPresence(e.target.id); observer.unobserve(e.target); } });
  }, { threshold: 0.3 });

  SECTIONS.forEach(id => { const s = document.getElementById(id); if (s) observer.observe(s); });
}

// ── T1b: OFFLINE SECTION BADGES ──────────────────────────────────────────────
async function initOfflineBadges() {
  if (!('caches' in window)) return;
  try {
    const cache = await caches.open('eritrean-info-v10');
    const keys  = await cache.keys();
    const urls  = new Set(keys.map(r => r.url));
    // Mark the main sections that are part of the SPA cache (index.html covers all)
    if (urls.size > 3) {
      ['overview','history','culture','proverbs','facts','lessons','fidel'].forEach(id => {
        const hdr = document.getElementById(id)?.querySelector('.section-header h2');
        if (hdr && !hdr.querySelector('.offline-ready-badge')) {
          const badge = document.createElement('span');
          badge.className = 'offline-ready-badge';
          badge.textContent = '✓ Offline';
          hdr.appendChild(badge);
        }
      });
    }
  } catch { /* silent */ }
}

// ══════════════════════════════════════════════════════════════════════════════
// POWER UPGRADE — Daily Live Updates, World Info, Enhanced Features
// ══════════════════════════════════════════════════════════════════════════════

// P1: LIVE SCROLLING NEWS TICKER
function initNewsTicker() {
  const ticker = document.getElementById('newsTicker');
  const track  = document.getElementById('tickerTrack');
  const pauseBtn = document.getElementById('tickerPause');
  if (!ticker || !track) return;

  const PROXY = 'https://api.allorigins.win/get?url=';
  const FEEDS = [
    { url: 'https://feeds.bbci.co.uk/tigrinya/rss.xml',    label: 'BBC Tigrinya' },
    { url: 'https://feeds.bbci.co.uk/news/africa/rss.xml', label: 'BBC Africa' },
  ];

  const FALLBACK = [
    'Eritrea gained independence on May 24, 1993 after a 30-year liberation struggle',
    'Asmara is a UNESCO World Heritage city known for its remarkable Art Deco architecture',
    'Eritrea has 9 ethnic groups speaking 9 different languages',
    'The Eritrean highlands have a pleasant climate year-round — averaging 16°C in Asmara',
    "Eritrea's cyclists are among the best in Africa and the world",
    'The Dahlak Archipelago in the Red Sea is home to stunning marine biodiversity',
    'Eritrea has one of the longest coastlines on the Red Sea — over 1,200 km',
    "Tigrinya is written in the ancient Ge'ez script, one of the oldest alphabets still in use",
    "The Nakfa — Eritrea's currency — is named after the town that held firm during the liberation war",
    'Eritrea was the first country in Africa to gain independence via a UN-supervised referendum',
  ];

  async function loadTicker() {
    const items = [];
    for (const feed of FEEDS) {
      try {
        const r = await fetch(PROXY + encodeURIComponent(feed.url), { signal: AbortSignal.timeout(6000) });
        if (!r.ok) continue;
        const { contents } = await r.json();
        const xml = new DOMParser().parseFromString(contents, 'text/xml');
        xml.querySelectorAll('item').forEach(item => {
          const title = item.querySelector('title')?.textContent?.trim();
          if (title && title.length > 5) items.push(`[${feed.label}] ${title}`);
        });
      } catch { /* network unavailable */ }
    }

    const headlines = items.length ? items : FALLBACK;
    const content = headlines.slice(0, 16).map(h =>
      `<span class="ticker-item">${esc(h)}</span><span class="ticker-sep">◆</span>`
    ).join('');
    // Duplicate for seamless infinite scroll
    track.innerHTML = content + content;
    track.style.animationDuration = `${headlines.length * 5}s`;
    ticker.hidden = false;
  }

  loadTicker();
  setInterval(loadTicker, 30 * 60 * 1000);

  pauseBtn?.addEventListener('click', function() {
    const paused = track.style.animationPlayState === 'paused';
    track.style.animationPlayState = paused ? 'running' : 'paused';
    this.textContent = paused ? '⏸' : '▶';
  });
}

// P2: DIASPORA WORLD CLOCKS — live ticking every second
function initDiasporaClocks() {
  const grid = document.getElementById('clocksGrid');
  if (!grid) return;

  const CITIES = [
    { name: 'Asmara',   tz: 'Africa/Asmara',      flag: '🇪🇷' },
    { name: 'DC',       tz: 'America/New_York',    flag: '🇺🇸' },
    { name: 'London',   tz: 'Europe/London',       flag: '🇬🇧' },
    { name: 'Frankfurt',tz: 'Europe/Berlin',       flag: '🇩🇪' },
    { name: 'Dubai',    tz: 'Asia/Dubai',          flag: '🇦🇪' },
    { name: 'Melbourne',tz: 'Australia/Melbourne', flag: '🇦🇺' },
    { name: 'Toronto',  tz: 'America/Toronto',     flag: '🇨🇦' },
    { name: 'Stockholm',tz: 'Europe/Stockholm',    flag: '🇸🇪' },
  ];

  grid.innerHTML = CITIES.map((c, i) => `
    <div class="clock-city">
      <span class="clock-flag">${c.flag}</span>
      <span class="clock-time" id="clk${i}">--:--</span>
      <span class="clock-name">${c.name}</span>
    </div>
  `).join('');

  function tick() {
    const now = new Date();
    CITIES.forEach((c, i) => {
      const el = document.getElementById(`clk${i}`);
      if (el) el.textContent = now.toLocaleTimeString('en-US', {
        timeZone: c.tz, hour: '2-digit', minute: '2-digit', hour12: false
      });
    });
  }
  tick();
  setInterval(tick, 1000);
}

// P3: MULTI-CITY ERITREA WEATHER — Open-Meteo (free, no API key)
async function initCityWeather() {
  const WMO = {
    0:'☀️', 1:'🌤️', 2:'⛅', 3:'☁️',
    45:'🌫️', 48:'🌫️', 51:'🌦️', 53:'🌦️', 55:'🌦️',
    61:'🌧️', 63:'🌧️', 65:'🌧️', 71:'🌨️', 73:'🌨️', 75:'🌨️',
    80:'🌦️', 81:'🌦️', 82:'🌦️', 95:'⛈️', 96:'⛈️', 99:'⛈️',
  };
  const CITIES = [
    { id: 'asmara',    lat: 15.338, lon: 38.931 },
    { id: 'massawa',   lat: 15.609, lon: 39.453 },
    { id: 'keren',     lat: 15.779, lon: 38.460 },
    { id: 'mendefera', lat: 14.886, lon: 38.822 },
    { id: 'barentu',   lat: 15.113, lon: 37.588 },
  ];

  async function loadWeather() {
    for (const city of CITIES) {
      try {
        const r = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current_weather=true`,
          { signal: AbortSignal.timeout(8000) }
        );
        if (!r.ok) continue;
        const { current_weather: cw } = await r.json();
        const el = document.getElementById(`cws-${city.id}`);
        if (el) {
          el.querySelector('.cws-temp').textContent = `${Math.round(cw.temperature)}°`;
          el.querySelector('.cws-icon').textContent  = WMO[cw.weathercode] || '🌡️';
        }
      } catch {}
    }
    const upd = document.getElementById('cwsUpdate');
    if (upd) upd.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  loadWeather();
  setInterval(loadWeather, 60 * 60 * 1000);
}

// P4: ERI TODAY DAILY CARD
function initEriTodayCard() {
  const now = new Date();
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 864e5);

  const PROVERBS = [
    { ti: 'ሓደ ዕፅዋ ኣኽሊ ኣይገብርን', en: 'One tree does not make a forest.' },
    { ti: 'ዝኸዶ ዘይፈልጥ ዝመጾ ኣይፈልጥን', en: 'He who does not know where he\'s going does not know where he came from.' },
    { ti: 'ሰብ ብሰብ ይነብር', en: 'People live through people.' },
    { ti: 'ፍቕሪ ኣሕዋት ካብ ወርቂ ይሓይሽ', en: 'The love of siblings is worth more than gold.' },
    { ti: 'ዝነበረ ናብ ዝነበሮ ይምለስ', en: 'What was returns to where it was.' },
    { ti: 'ሓቂ ዘዘልለ ሕጂ ምቅላዕ ዘለዎ', en: 'Truth that was suppressed must one day be revealed.' },
    { ti: 'ጸሎት ዘይብሉ ፍቕሪ የልቦን', en: 'Without patience, there is no love.' },
    { ti: 'ብዝሓሰብካሉ ምስ ዘምጻእካሉ ይፍለ', en: 'Plan before you act.' },
    { ti: 'ሓደ ዝቐጸሎ ሰብ ሓደ ዝሓዞ ሰብ ይህሉ', en: 'For every person who chases, there is a person who waits.' },
    { ti: 'ዋናኡ ዘይፈልጦ ብሃሊ ናብ ዋናኡ ይምለስ', en: 'Lost property always finds its rightful owner.' },
    { ti: 'ናብ ዝኸደ ዓዲ ቛንቛኡ ተዛረብ', en: 'Speak the language of the land you are in.' },
    { ti: 'ተዛሪቡ ዘይፈልጥ ሰብ ሓቁ ዘይፈልጥ', en: 'He who cannot speak his mind does not know his own truth.' },
    { ti: 'ልቢ ዝሃበካ ሰብ ዘድልዮ ሰብ', en: 'He who gives you his heart needs you in return.' },
    { ti: 'ዘሕዘነካ ዘሐጎሰካ ኢዩ', en: 'What once made you cry may one day make you smile.' },
  ];

  const OTD = [
    { m:5,  d:24, e:'Eritrea declared independence — May 24, 1993 🎉' },
    { m:9,  d:1,  e:'The Eritrean armed struggle for independence began (1961)' },
    { m:6,  d:20, e:'Martyrs\' Day — honoring heroes who gave their lives for freedom' },
    { m:1,  d:7,  e:'Eritrean Orthodox Christmas (Lidat) celebrated across the highlands' },
    { m:5,  d:20, e:'EPLF forces liberated Massawa, securing Eritrea\'s Red Sea port (1990)' },
    { m:7,  d:1,  e:'The Nakfa currency was introduced as Eritrea\'s national currency (1997)' },
    { m:11, d:12, e:'UNESCO inscribed Asmara as a World Heritage City (2017)' },
    { m:4,  d:12, e:'Eritrean women joined liberation forces in large numbers (1973)' },
  ];

  const HOLIDAYS = [
    { name: 'Independence Day', m:5, d:24 },
    { name: 'Martyrs\' Day',    m:6, d:20 },
    { name: 'Revolution Day',   m:9, d:1  },
    { name: 'Orthodox Christmas', m:1, d:7 },
    { name: 'New Year',         m:1, d:1  },
  ];

  const GEEZ_MONTHS = ['Meskerem','Tikimt','Hidar','Tahsas','Tir','Yekatit','Megabit','Miazia','Ginbot','Senie','Hamle','Nehase','Pagume'];
  const MOON_PHASES = ['🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘'];

  function moonPhase(d) {
    const newMoon = new Date(1970, 0, 7, 20, 35, 0);
    const phase = ((d - newMoon) % 2551443000) / 2551443000;
    return MOON_PHASES[Math.round(Math.abs(phase) * 8) % 8];
  }

  function daysUntil(m, d) {
    const t = new Date(now.getFullYear(), m - 1, d);
    if (t <= now) t.setFullYear(now.getFullYear() + 1);
    return Math.ceil((t - now) / 864e5);
  }

  const today = { m: now.getMonth() + 1, d: now.getDate() };
  const prov  = PROVERBS[dayOfYear % PROVERBS.length];
  const otd   = OTD.find(e => e.m === today.m && e.d === today.d);
  const next  = HOLIDAYS.map(h => ({ ...h, days: daysUntil(h.m, h.d) })).sort((a,b) => a.days - b.days)[0];
  const geezMonth = GEEZ_MONTHS[(now.getMonth() + 4) % 13];
  const etYear    = now.getFullYear() - (now.getMonth() < 8 ? 8 : 7);
  const moon = moonPhase(now);

  const ldDateTag = document.getElementById('ldDateTag');
  if (ldDateTag) ldDateTag.textContent = now.toLocaleDateString('en-US', { month:'long', day:'numeric' });

  const etcMoon = document.getElementById('etcMoon');
  if (etcMoon) etcMoon.textContent = moon;

  const etcDateBox = document.getElementById('etcDateBox');
  if (etcDateBox) etcDateBox.innerHTML = `<span class="etc-geez-month">${geezMonth}</span><span class="etc-geez-year">ዓ.ም ${etYear}</span>`;

  const etcProverb = document.getElementById('etcProverb');
  if (etcProverb) etcProverb.innerHTML = `<div class="etc-prov-ti">${esc(prov.ti)}</div><div class="etc-prov-en">"${esc(prov.en)}"</div>`;

  const etcOtd = document.getElementById('etcOtd');
  if (etcOtd && otd) etcOtd.innerHTML = `📅 <strong>On This Day:</strong> ${esc(otd.e)}`;
  else if (etcOtd) etcOtd.innerHTML = `📖 <strong>Did you know?</strong> Eritrea has 9 ethnic groups across its territory`;

  const etcCountdown = document.getElementById('etcCountdown');
  if (etcCountdown && next) etcCountdown.innerHTML = `
    <div class="etc-hol-days">${next.days}</div>
    <div class="etc-hol-info">
      <div class="etc-hol-label">days until</div>
      <div class="etc-hol-name">${esc(next.name)}</div>
    </div>
  `;
}

// P5: ENHANCED NEWS TABS — tabbed news from multiple RSS feeds
function initEnhancedNewsTabs() {
  const tabsRow = document.getElementById('newsTabsRow');
  if (!tabsRow) return;

  // Multiple CORS proxies — allorigins.win first (no rate limits), rss2json second, corsproxy fallback
  const PROXIES = [
    url => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    url => `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`,
    url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  ];
  const FEEDS = {
    eritrea: 'https://news.google.com/rss/search?q=eritrea&hl=en-US&gl=US&ceid=US:en',
    africa:  'https://feeds.bbci.co.uk/news/africa/rss.xml',
    world:   'https://feeds.bbci.co.uk/news/world/rss.xml',
    sports:  'https://feeds.bbci.co.uk/sport/rss.xml',
    tech:    'https://feeds.bbci.co.uk/news/technology/rss.xml',
  };
  const TAGS = { eritrea:'🇪🇷 Eritrea News', africa:'🌍 BBC Africa', world:'🌐 BBC World', sports:'⚽ BBC Sport', tech:'💻 BBC Tech' };

  const FALLBACK_NEWS = {
    eritrea: [
      { title:'Eritrea marks 32nd Independence Day — May 24th', link:'https://en.wikipedia.org/wiki/Eritrean_Independence_Day', desc:'Eritreans worldwide celebrate the anniversary of independence from Ethiopia in 1993, marked by events across the diaspora.', pub:'', img:'' },
      { title:'Asmara: UNESCO World Heritage City', link:'https://en.wikipedia.org/wiki/Asmara', desc:'Asmara\'s Italian Modernist architecture continues to attract global attention since its 2017 UNESCO listing.', pub:'', img:'' },
      { title:'Eritrean cyclists dominate African racing circuit', link:'https://en.wikipedia.org/wiki/Cycling_in_Eritrea', desc:'Eritrea produces world-class cyclists including Biniam Girmay, the first Black African to win a Grand Tour stage.', pub:'', img:'' },
      { title:'Tigrinya language: one of the oldest written African languages', link:'https://en.wikipedia.org/wiki/Tigrinya_language', desc:'Written in the ancient Ge\'ez script, Tigrinya is spoken by over 7 million people across Eritrea and Ethiopia.', pub:'', img:'' },
      { title:'Dahlak Archipelago — Red Sea diving destination', link:'https://en.wikipedia.org/wiki/Dahlak_Archipelago', desc:'The 200+ islands of the Dahlak Archipelago offer pristine coral reefs and rich marine biodiversity.', pub:'', img:'' },
      { title:'Eritrea\'s coffee ceremony: a cultural tradition', link:'https://en.wikipedia.org/wiki/Coffee_in_Eritrea', desc:'The Eritrean coffee ceremony, known as \'bunna\', is a central social ritual symbolizing friendship and community.', pub:'', img:'' },
    ],
    africa: [
      { title:'African Union summit focuses on regional peace', link:'https://au.int', desc:'African leaders gather to discuss ongoing conflicts and economic development across the continent.', pub:'', img:'' },
      { title:'East Africa economic integration accelerates', link:'https://en.wikipedia.org/wiki/East_African_Community', desc:'The East African Community continues to expand trade agreements and infrastructure development.', pub:'', img:'' },
      { title:'Horn of Africa development update', link:'https://en.wikipedia.org/wiki/Horn_of_Africa', desc:'Infrastructure and economic projects advance across Djibouti, Eritrea, Ethiopia, and Somalia.', pub:'', img:'' },
    ],
    world: [
      { title:'Global diaspora communities thriving in 2025', link:'https://en.wikipedia.org/wiki/African_diaspora', desc:'African diaspora communities worldwide continue to grow, contributing billions in remittances to home countries.', pub:'', img:'' },
      { title:'Red Sea trade routes remain strategically vital', link:'https://en.wikipedia.org/wiki/Red_Sea', desc:'The Red Sea corridor handles 12% of global trade, making Eritrea\'s coastline strategically significant.', pub:'', img:'' },
    ],
    sports: [
      { title:'Biniam Girmay continues to make cycling history', link:'https://en.wikipedia.org/wiki/Biniam_Girmay', desc:'The Eritrean sprinter became the first Black African to win a Grand Tour stage, inspiring a generation of cyclists.', pub:'', img:'' },
      { title:'Ghirmay Ghebreslassie: marathon world champion', link:'https://en.wikipedia.org/wiki/Ghirmay_Ghebreslassie', desc:'The Rio 2016 Olympic marathon gold medalist remains one of East Africa\'s greatest long-distance runners.', pub:'', img:'' },
      { title:'Eritrean football federation growing the sport nationally', link:'https://en.wikipedia.org/wiki/Eritrea_national_football_team', desc:'Football continues to grow in popularity across Eritrea with youth development programs expanding.', pub:'', img:'' },
    ],
    tech: [
      { title:'African tech innovation hubs expanding in East Africa', link:'https://en.wikipedia.org/wiki/Silicon_Savannah', desc:'East African tech hubs continue to grow with mobile payment solutions and agricultural technology leading growth.', pub:'', img:'' },
      { title:'Mobile connectivity reaches remote communities', link:'https://en.wikipedia.org/wiki/Internet_in_Africa', desc:'Expanded mobile infrastructure is connecting previously isolated communities across the Horn of Africa.', pub:'', img:'' },
    ],
  };

  const cache = {};

  function parseRss2Json(data) {
    if (!data.items?.length) return [];
    return data.items.slice(0, 9).map(item => ({
      title: item.title || '',
      link:  item.link || '#',
      desc:  (item.description || item.content || '').replace(/<[^>]*>/g,'').trim().slice(0, 110),
      pub:   item.pubDate || '',
      img:   item.thumbnail || item.enclosure?.link || '',
    }));
  }

  function parseAllOrigins(data) {
    const xml = new DOMParser().parseFromString(data.contents || '', 'text/xml');
    return [...xml.querySelectorAll('item')].slice(0, 9).map(item => ({
      title: item.querySelector('title')?.textContent?.trim() || '',
      link:  item.querySelector('link')?.textContent?.trim() || '#',
      desc:  (item.querySelector('description')?.textContent || '').replace(/<[^>]*>/g,'').trim().slice(0, 110),
      pub:   item.querySelector('pubDate')?.textContent || '',
      img:   item.querySelector('enclosure')?.getAttribute('url') || '',
    }));
  }

  function parseDirect(text) {
    const xml = new DOMParser().parseFromString(text, 'text/xml');
    return [...xml.querySelectorAll('item')].slice(0, 9).map(item => ({
      title: item.querySelector('title')?.textContent?.trim() || '',
      link:  item.querySelector('link')?.textContent?.trim() || '#',
      desc:  (item.querySelector('description')?.textContent || '').replace(/<[^>]*>/g,'').trim().slice(0, 110),
      pub:   item.querySelector('pubDate')?.textContent || '',
      img:   item.querySelector('enclosure')?.getAttribute('url') || '',
    }));
  }

  async function loadFeed(key) {
    if (cache[key] && Date.now() - cache[key].ts < 18e5) return cache[key].items;
    const feedUrl = FEEDS[key];
    for (let i = 0; i < PROXIES.length; i++) {
      try {
        const proxyUrl = PROXIES[i](feedUrl);
        const r = await fetch(proxyUrl, { signal: AbortSignal.timeout(7000) });
        if (!r.ok) continue;
        let items = [];
        if (i === 2) {
          // corsproxy.io returns raw XML text
          const text = await r.text();
          items = parseDirect(text);
        } else {
          const data = await r.json().catch(() => null);
          if (!data) continue;
          if (i === 0 && data.contents) items = parseAllOrigins(data);
          else if (i === 1 && data.items) items = parseRss2Json(data);
        }
        if (items.length) { cache[key] = { items, ts: Date.now() }; return items; }
      } catch { /* try next proxy */ }
    }
    return FALLBACK_NEWS[key] || [];
  }

  function renderNews(items, key) {
    const grid = document.getElementById('newsGrid');
    if (!grid) return;
    if (!items.length) {
      grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--text-muted)">Checking news sources…</p>`;
      return;
    }
    grid.innerHTML = items.map(it => `
      <a class="news-card" href="${esc(it.link || '#')}" target="_blank" rel="noopener noreferrer">
        ${it.img ? `<div class="news-img-wrap"><img src="${esc(it.img)}" alt="" loading="lazy" onerror="this.parentElement.style.display='none'"/></div>` : ''}
        <div class="news-body">
          <span class="news-tag">${TAGS[key] || key}</span>
          <h3 class="news-title">${esc(it.title)}</h3>
          ${it.desc ? `<p class="news-excerpt">${esc(it.desc)}…</p>` : ''}
          ${it.pub ? `<div class="news-meta"><span class="news-date">🕐 ${new Date(it.pub).toLocaleDateString()}</span></div>` : ''}
          <span class="news-read-more">Read full article →</span>
        </div>
      </a>
    `).join('');
  }

  async function switchTab(key) {
    tabsRow.querySelectorAll('.news-tab').forEach(t => t.classList.toggle('active', t.dataset.feed === key));
    // Show fallback/cached content immediately so the section is never blank
    renderNews(cache[key] ? cache[key].items : (FALLBACK_NEWS[key] || []), key);
    // Fetch live RSS in background; update only if still on same tab and we got results
    loadFeed(key).then(items => {
      const still = tabsRow.querySelector('.news-tab.active')?.dataset.feed === key;
      if (still && items.length) renderNews(items, key);
    });
  }

  tabsRow.querySelectorAll('.news-tab').forEach(btn =>
    btn.addEventListener('click', () => switchTab(btn.dataset.feed))
  );
  switchTab('eritrea');
}

// P6: COPY BUTTONS on proverbs, facts, fact generator
function initCopyButtons() {
  function addCopy(card, getText) {
    if (card.querySelector('.copy-btn')) return;
    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.title = 'Copy to clipboard';
    btn.innerHTML = '📋';
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(getText());
        btn.innerHTML = '✅';
        setTimeout(() => { btn.innerHTML = '📋'; }, 2000);
      } catch { btn.innerHTML = '❌'; setTimeout(() => { btn.innerHTML = '📋'; }, 2000); }
    });
    card.style.position = 'relative';
    card.appendChild(btn);
  }

  document.querySelectorAll('.proverb-card, .proverb-item').forEach(c =>
    addCopy(c, () => c.textContent.trim().replace(/\s+/g,' '))
  );
  document.querySelectorAll('.fact-card').forEach(c =>
    addCopy(c, () => c.textContent.trim().replace(/\s+/g,' '))
  );

  // Also wire copy to the fact generator
  const fgText = document.getElementById('fgText');
  if (fgText) {
    const copyFact = document.createElement('button');
    copyFact.className = 'copy-btn';
    copyFact.style.cssText = 'position:static;opacity:1;margin-top:8px;';
    copyFact.innerHTML = '📋 Copy fact';
    copyFact.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(fgText.textContent);
        copyFact.innerHTML = '✅ Copied!';
        setTimeout(() => { copyFact.innerHTML = '📋 Copy fact'; }, 2000);
      } catch {}
    });
    document.querySelector('.fg-actions')?.appendChild(copyFact);
  }
}

// P7: EXPLORE SCORE — track visited sections with SVG ring
function initExploreScore() {
  const widget = document.getElementById('exploreScore');
  const fill   = document.getElementById('esFill');
  const pctEl  = document.getElementById('esPct');
  if (!widget || !fill || !pctEl) return;

  const SECTION_IDS = ['overview','history','geography','people','culture','economy','government',
    'languages','gallery','tourism','blog','quiz','fidel','lessons','proverbs','poetry','facts',
    'recipes','artists','regions','news','diaspora-map','compare'];
  const KEY = 'eri_visited_v2';
  let visited = new Set(JSON.parse(localStorage.getItem(KEY) || '[]'));

  const CIRCUMFERENCE = 2 * Math.PI * 15.9; // r=15.9

  function updateScore() {
    const pct = Math.round((visited.size / SECTION_IDS.length) * 100);
    const dash = (pct / 100) * CIRCUMFERENCE;
    fill.setAttribute('stroke-dasharray', `${dash} ${CIRCUMFERENCE}`);
    pctEl.textContent = `${pct}%`;
    widget.title = `${pct}% explored — ${visited.size}/${SECTION_IDS.length} sections visited!`;
  }

  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        visited.add(e.target.id);
        localStorage.setItem(KEY, JSON.stringify([...visited]));
        updateScore();
      }
    });
  }, { threshold: 0.25 });

  SECTION_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) obs.observe(el);
  });

  widget.addEventListener('click', () => {
    const remaining = SECTION_IDS.filter(id => !visited.has(id));
    if (remaining.length) {
      document.getElementById(remaining[0])?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  updateScore();
}

// P8: LIVE ERN EXCHANGE RATES
async function initLiveRates() {
  const el = document.getElementById('liveRatesWidget');
  if (!el) return;

  // Official ERN peg: 1 USD ≈ 15.075 ERN
  const USD_TO_ERN = 15.075;
  const CURRENCIES = [
    { code:'USD', flag:'🇺🇸', name:'US Dollar',     usdRate:1      },
    { code:'EUR', flag:'🇪🇺', name:'Euro',          usdRate:0.93   },
    { code:'GBP', flag:'🇬🇧', name:'British Pound', usdRate:0.79   },
    { code:'SAR', flag:'🇸🇦', name:'Saudi Riyal',   usdRate:3.75   },
    { code:'ETB', flag:'🇪🇹', name:'Ethiopian Birr',usdRate:125.0  },
    { code:'AED', flag:'🇦🇪', name:'UAE Dirham',    usdRate:3.67   },
    { code:'SEK', flag:'🇸🇪', name:'Swedish Krona', usdRate:10.6   },
    { code:'CAD', flag:'🇨🇦', name:'Canadian $',    usdRate:1.36   },
  ];

  function render(rates) {
    el.innerHTML = rates.map(c => {
      const ernPer1 = (c.usdRate * USD_TO_ERN).toFixed(2);
      return `<div class="lr-row">
        <span class="lr-flag">${c.flag}</span>
        <span class="lr-cur">${c.code}</span>
        <span class="lr-eq">1 ${c.code} = ${ernPer1} ERN</span>
      </div>`;
    }).join('');
  }

  render(CURRENCIES);

  // Try to get live rates
  try {
    const r = await fetch('https://api.frankfurter.app/latest?from=USD', { signal: AbortSignal.timeout(6000) });
    if (r.ok) {
      const { rates } = await r.json();
      const updated = CURRENCIES.map(c => ({
        ...c, usdRate: c.code === 'USD' ? 1 : (rates[c.code] || c.usdRate)
      }));
      render(updated);
    }
  } catch {}
}

// P9: COUNTRY SPOTLIGHT — daily rotating world country
function initCountrySpotlight() {
  const el = document.getElementById('countrySpotlight');
  if (!el) return;

  const COUNTRIES = [
    { name:'Ethiopia',     flag:'🇪🇹', pop:'126M', capital:'Addis Ababa', area:'1,104,300 km²', lang:'Amharic', note:'Eritrea\'s southern neighbor — shares deep cultural and historical roots.' },
    { name:'Sudan',        flag:'🇸🇩', pop:'45M',  capital:'Khartoum',   area:'1,886,068 km²', lang:'Arabic',  note:'Northern neighbor with ancient Nubian civilizations along the Nile.' },
    { name:'Djibouti',     flag:'🇩🇯', pop:'1.1M', capital:'Djibouti City',area:'23,200 km²',  lang:'French/Arabic', note:'Shares the strategic Red Sea corridor with Eritrea.' },
    { name:'Yemen',        flag:'🇾🇪', pop:'34M',  capital:'Sanaa',      area:'527,968 km²',   lang:'Arabic',  note:'Across the Red Sea — centuries of trade ties with Eritrea.' },
    { name:'Saudi Arabia', flag:'🇸🇦', pop:'35M',  capital:'Riyadh',     area:'2,149,690 km²', lang:'Arabic',  note:'Home to a large Eritrean diaspora community.' },
    { name:'Germany',      flag:'🇩🇪', pop:'84M',  capital:'Berlin',     area:'357,114 km²',   lang:'German',  note:'One of Europe\'s largest Eritrean diaspora populations.' },
    { name:'Sweden',       flag:'🇸🇪', pop:'10M',  capital:'Stockholm',  area:'450,295 km²',   lang:'Swedish', note:'Has welcomed tens of thousands of Eritrean refugees and immigrants.' },
    { name:'USA',          flag:'🇺🇸', pop:'331M', capital:'Washington', area:'9,833,517 km²', lang:'English', note:'Home to the largest Eritrean diaspora outside Africa.' },
    { name:'Italy',        flag:'🇮🇹', pop:'60M',  capital:'Rome',       area:'301,340 km²',   lang:'Italian', note:'Former colonial power — Italian Art Deco still graces Asmara today.' },
    { name:'Egypt',        flag:'🇪🇬', pop:'104M', capital:'Cairo',      area:'1,001,450 km²', lang:'Arabic',  note:'Ancient civilization connected to the Red Sea and Horn of Africa.' },
    { name:'Kenya',        flag:'🇰🇪', pop:'55M',  capital:'Nairobi',    area:'580,367 km²',   lang:'Swahili/English', note:'East Africa\'s economic hub and Eritrea\'s regional neighbor.' },
    { name:'Nigeria',      flag:'🇳🇬', pop:'220M', capital:'Abuja',      area:'923,768 km²',   lang:'English', note:'Africa\'s most populous nation and largest economy.' },
    { name:'South Africa', flag:'🇿🇦', pop:'60M',  capital:'Pretoria',   area:'1,219,090 km²', lang:'11 official', note:'Africa\'s most industrialized economy and global icon of liberation.' },
    { name:'Morocco',      flag:'🇲🇦', pop:'37M',  capital:'Rabat',      area:'446,550 km²',   lang:'Arabic/Berber', note:'Gateway between Africa and Europe on the Atlantic coast.' },
    { name:'Ghana',        flag:'🇬🇭', pop:'33M',  capital:'Accra',      area:'238,533 km²',   lang:'English', note:'Pan-African symbol — first sub-Saharan nation to gain independence.' },
    { name:'Japan',        flag:'🇯🇵', pop:'125M', capital:'Tokyo',      area:'377,975 km²',   lang:'Japanese', note:'Technological powerhouse and one of the world\'s great cultures.' },
    { name:'Canada',       flag:'🇨🇦', pop:'38M',  capital:'Ottawa',     area:'9,984,670 km²', lang:'English/French', note:'Home to a growing Eritrean diaspora community.' },
    { name:'Australia',    flag:'🇦🇺', pop:'26M',  capital:'Canberra',   area:'7,692,024 km²', lang:'English', note:'Continent-nation with a vibrant Eritrean community in Melbourne.' },
    { name:'India',        flag:'🇮🇳', pop:'1.4B', capital:'New Delhi',  area:'3,287,263 km²', lang:'Hindi+21', note:'World\'s most populous democracy and fastest-growing major economy.' },
    { name:'Brazil',       flag:'🇧🇷', pop:'215M', capital:'Brasília',   area:'8,515,767 km²', lang:'Portuguese', note:'South America\'s giant — world\'s largest tropical rainforest.' },
    { name:'China',        flag:'🇨🇳', pop:'1.4B', capital:'Beijing',    area:'9,596,960 km²', lang:'Mandarin', note:'World\'s second-largest economy with 5,000 years of civilization.' },
    { name:'France',       flag:'🇫🇷', pop:'68M',  capital:'Paris',      area:'551,695 km²',   lang:'French', note:'Cultural capital of Europe — home to the Louvre and Eiffel Tower.' },
    { name:'Netherlands',  flag:'🇳🇱', pop:'17M',  capital:'Amsterdam',  area:'41,543 km²',    lang:'Dutch', note:'Eritrea has a significant diaspora community in the Netherlands.' },
    { name:'Norway',       flag:'🇳🇴', pop:'5M',   capital:'Oslo',       area:'385,207 km²',   lang:'Norwegian', note:'One of the world\'s highest quality-of-life nations.' },
    { name:'Israel',       flag:'🇮🇱', pop:'9M',   capital:'Jerusalem',  area:'22,072 km²',    lang:'Hebrew/Arabic', note:'Middle Eastern nation with historical ties to the Horn of Africa.' },
    { name:'Tanzania',     flag:'🇹🇿', pop:'63M',  capital:'Dodoma',     area:'945,087 km²',   lang:'Swahili/English', note:'Home of Mount Kilimanjaro and the Serengeti.' },
    { name:'Uganda',       flag:'🇺🇬', pop:'48M',  capital:'Kampala',    area:'241,550 km²',   lang:'English/Swahili', note:'The Pearl of Africa — source of the White Nile.' },
    { name:'Libya',        flag:'🇱🇾', pop:'7M',   capital:'Tripoli',    area:'1,759,541 km²', lang:'Arabic', note:'Northern African nation on the Mediterranean coast.' },
    { name:'Qatar',        flag:'🇶🇦', pop:'3M',   capital:'Doha',       area:'11,586 km²',    lang:'Arabic', note:'Wealthy Gulf state — hosted 2022 FIFA World Cup.' },
    { name:'Turkey',       flag:'🇹🇷', pop:'85M',  capital:'Ankara',     area:'783,356 km²',   lang:'Turkish', note:'Bridge between Europe and Asia with a rich Ottoman heritage.' },
  ];

  const now = new Date();
  const dayIdx = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 864e5);
  const c = COUNTRIES[dayIdx % COUNTRIES.length];

  el.innerHTML = `
    <div class="cs-flag-big">${c.flag}</div>
    <div class="cs-name">${c.name}</div>
    <div class="cs-facts-row">
      <span class="cs-fact">🏛️ ${c.capital}</span>
      <span class="cs-fact">👥 ${c.pop}</span>
      <span class="cs-fact">📐 ${c.area}</span>
      <span class="cs-fact">🗣️ ${c.lang}</span>
    </div>
    <div class="cs-note">${esc(c.note)}</div>
    <div class="cs-vs-row">
      <div class="cs-vs-item"><span class="cs-vs-val">🇪🇷 3.5M</span><span class="cs-vs-lbl">Eritrea pop.</span></div>
      <span class="cs-vs-sep">vs</span>
      <div class="cs-vs-item"><span class="cs-vs-val">${c.flag} ${c.pop}</span><span class="cs-vs-lbl">${c.name} pop.</span></div>
    </div>
  `;
}

// P10: AUTO-REFRESH — hourly refresh when tab becomes visible again
function initAutoRefresh() {
  let lastRefresh = Date.now();

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() - lastRefresh > 60 * 60 * 1000) {
      lastRefresh = Date.now();
      showToast('🔄 Refreshing live data…', 'info');
      Promise.all([
        initCityWeather(),
        initLiveRates(),
      ]);
      initEriTodayCard();
      document.querySelector('.news-tab.active')?.click();
    }
  });
}

/* ════════════════════════════════════════════════════════════════════════
   TWEAKS v3.0 — 30 Power Features (T14–T43)
   Each is an IIFE. All run on DOMContentLoaded via the loader at bottom.
════════════════════════════════════════════════════════════════════════ */

// ── T14: FLOATING TABLE OF CONTENTS ──────────────────────────────────────
(function T14_TOC() {
  const SECTIONS = [
    {id:'hero',emoji:'🏠',label:'Home'},{id:'live-dashboard',emoji:'📡',label:'Live Dashboard'},
    {id:'overview',emoji:'🏛️',label:'Overview'},{id:'history',emoji:'📜',label:'History'},
    {id:'geography',emoji:'🗺️',label:'Geography'},{id:'people',emoji:'👥',label:'People'},
    {id:'culture',emoji:'🎭',label:'Culture'},{id:'economy',emoji:'💰',label:'Economy'},
    {id:'government',emoji:'⚖️',label:'Government'},{id:'famous',emoji:'⭐',label:'Famous People'},
    {id:'gallery',emoji:'📸',label:'Gallery'},{id:'translator',emoji:'🌐',label:'Translator'},
    {id:'tourism',emoji:'✈️',label:'Tourism'},{id:'regions',emoji:'🗾',label:'Regions'},
    {id:'recipes',emoji:'🍽️',label:'Recipes'},{id:'artists',emoji:'🎵',label:'Artists'},
    {id:'quiz',emoji:'🏆',label:'Quiz'},{id:'fidel',emoji:'🔤',label:'Alphabet (Fidel)'},
    {id:'lessons',emoji:'📖',label:'Lessons'},{id:'proverbs',emoji:'💬',label:'Proverbs'},
    {id:'poetry',emoji:'📝',label:'Poetry'},{id:'facts',emoji:'🌟',label:'Facts'},
    {id:'community',emoji:'🤝',label:'Community'},{id:'news',emoji:'📰',label:'News'},
    {id:'holidays',emoji:'🗓️',label:'Holidays'},{id:'compare',emoji:'📊',label:'Compare Countries'},
    {id:'events',emoji:'📅',label:'Events'},{id:'diaspora-map',emoji:'🌍',label:'Diaspora Map'},
  ];

  function init() {
    const fab = document.getElementById('tocFab');
    const panel = document.getElementById('tocPanel');
    if (!fab || !panel) return;

    panel.innerHTML = `<div class="toc-header"><span>📋 Jump to Section</span><button class="toc-close" id="tocClose">✕</button></div>
      <ul class="toc-list">${SECTIONS.map(s => `<li><a href="#${s.id}" class="toc-link" data-target="${s.id}">${s.emoji} ${s.label}</a></li>`).join('')}</ul>`;

    document.getElementById('tocClose').onclick = () => { panel.classList.remove('open'); panel.hidden = true; };

    panel.querySelectorAll('.toc-link').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        const el = document.getElementById(a.dataset.target);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (window.innerWidth < 768) { panel.classList.remove('open'); setTimeout(() => panel.hidden = true, 280); }
      });
    });

    fab.hidden = false;
    fab.onclick = () => {
      const open = panel.classList.contains('open');
      if (open) { panel.classList.remove('open'); setTimeout(() => panel.hidden = true, 280); }
      else { panel.hidden = false; requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add('open'))); }
    };

    window.addEventListener('scroll', () => {
      let cur = '';
      SECTIONS.forEach(s => { const el = document.getElementById(s.id); if (el && el.getBoundingClientRect().top < 200) cur = s.id; });
      panel.querySelectorAll('.toc-link').forEach(a => a.classList.toggle('active', a.dataset.target === cur));
    }, { passive: true });

    document.addEventListener('keydown', e => { if (e.altKey && e.key === 't') { e.preventDefault(); fab.click(); } });
  }

  document.addEventListener('DOMContentLoaded', init);
})();

// ── T15: TEXT-TO-SPEECH READER ───────────────────────────────────────────
(function T15_TTS() {
  if (!('speechSynthesis' in window)) return;
  let currentBtn = null, utterance = null;

  function injectButtons() {
    document.querySelectorAll('section[id]').forEach(sec => {
      if (sec.querySelector('.tts-btn')) return;
      const h = sec.querySelector('h1,h2,h3');
      if (!h) return;
      const btn = document.createElement('button');
      btn.className = 'tts-btn';
      btn.innerHTML = '🔊 Listen';
      btn.title = 'Read this section aloud';
      btn.addEventListener('click', () => {
        if (currentBtn === btn && speechSynthesis.speaking) {
          speechSynthesis.cancel(); btn.innerHTML = '🔊 Listen'; btn.classList.remove('speaking'); currentBtn = null; return;
        }
        if (speechSynthesis.speaking) speechSynthesis.cancel();
        const text = Array.from(sec.querySelectorAll('p,li,blockquote')).map(el => el.textContent.trim()).filter(Boolean).slice(0, 20).join('. ');
        if (!text) return;
        utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.92; utterance.pitch = 1;
        utterance.onend = () => { btn.innerHTML = '🔊 Listen'; btn.classList.remove('speaking'); currentBtn = null; };
        utterance.onerror = () => { btn.innerHTML = '🔊 Listen'; btn.classList.remove('speaking'); currentBtn = null; };
        speechSynthesis.speak(utterance);
        btn.innerHTML = '⏹ Stop'; btn.classList.add('speaking'); currentBtn = btn;
      });
      h.insertAdjacentElement('afterend', btn);
    });
  }

  document.addEventListener('DOMContentLoaded', () => setTimeout(injectButtons, 1200));
  new MutationObserver(injectButtons).observe(document.body, { childList: true, subtree: true });
})();

// ── T16: READING TIME ESTIMATOR ──────────────────────────────────────────
(function T16_ReadingTime() {
  function inject() {
    document.querySelectorAll('section[id]').forEach(sec => {
      if (sec.querySelector('.read-time-badge')) return;
      const h = sec.querySelector('h1,h2,h3');
      if (!h) return;
      const words = sec.textContent.trim().split(/\s+/).length;
      const mins = Math.max(1, Math.round(words / 200));
      const badge = document.createElement('span');
      badge.className = 'read-time-badge';
      badge.textContent = `📖 ${mins} min read`;
      h.insertAdjacentElement('afterend', badge);
    });
  }
  document.addEventListener('DOMContentLoaded', () => setTimeout(inject, 800));
})();

// ── T17: CUSTOM THEME PALETTES ───────────────────────────────────────────
(function T17_Themes() {
  const THEMES = {
    forest:'#007A3D', ocean:'#0284c7', sunset:'#ea580c',
    royal:'#7c3aed', earth:'#92400e', fire:'#dc2626',
  };
  const DARK_BG = { forest:'#0a1f14', ocean:'#0c1a2e', sunset:'#1c0d00',
    royal:'#130924', earth:'#1a0e06', fire:'#1c0505' };
  const LS_KEY = 'eri_theme';

  function applyTheme(name) {
    const color = THEMES[name] || THEMES.forest;
    document.documentElement.style.setProperty('--green', color);
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) document.documentElement.style.setProperty('--bg', DARK_BG[name] || '#0f172a');
    document.querySelectorAll('.tp-swatch').forEach(b => b.classList.toggle('active', b.dataset.theme === name));
    localStorage.setItem(LS_KEY, name);
  }

  function init() {
    const picker = document.getElementById('themePicker');
    const closeBtn = document.getElementById('themePickerClose');
    if (!picker) return;

    const saved = localStorage.getItem(LS_KEY) || 'forest';
    applyTheme(saved);

    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'themeToggle'; toggleBtn.title = 'Change theme'; toggleBtn.textContent = '🎨';
    toggleBtn.style.cssText = 'position:fixed;bottom:264px;right:18px;z-index:201;width:36px;height:36px;background:var(--bg,#fff);border:1px solid var(--border,#e0e0e0);border-radius:50%;cursor:pointer;font-size:.95rem;box-shadow:0 2px 8px rgba(0,0,0,.1);';
    document.body.appendChild(toggleBtn);
    toggleBtn.addEventListener('click', () => { picker.hidden = !picker.hidden; });
    if (closeBtn) closeBtn.addEventListener('click', () => { picker.hidden = true; });

    picker.querySelectorAll('.tp-swatch').forEach(btn => {
      btn.addEventListener('click', () => applyTheme(btn.dataset.theme));
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();


// ── T19: PRINT MODE ──────────────────────────────────────────────────────
(function T19_Print() {
  function init() {
    const navRight = document.querySelector('.nav-right');
    if (!navRight) return;
    const btn = document.createElement('button');
    btn.className = 'nav-print-btn'; btn.title = 'Print page (Alt+P)'; btn.textContent = '🖨';
    btn.addEventListener('click', () => window.print());
    navRight.prepend(btn);
    document.addEventListener('keydown', e => { if (e.altKey && e.key === 'p') { e.preventDefault(); window.print(); } });
  }
  document.addEventListener('DOMContentLoaded', init);
})();

// ── T20: FONT SIZE ACCESSIBILITY ─────────────────────────────────────────
(function T20_FontSize() {
  const SIZES = ['14px','16px','19px'];
  const LABELS = ['A−','A','A+'];
  const LS_KEY = 'eri_fontsize';

  function apply(idx) {
    document.documentElement.style.fontSize = SIZES[idx];
    document.querySelectorAll('.nav-font-btn').forEach((b, i) => b.classList.toggle('active', i === idx));
    localStorage.setItem(LS_KEY, idx);
  }

  function init() {
    const navRight = document.querySelector('.nav-right');
    if (!navRight) return;
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:3px;align-items:center;';
    LABELS.forEach((lbl, i) => {
      const btn = document.createElement('button');
      btn.className = 'nav-font-btn'; btn.textContent = lbl;
      btn.addEventListener('click', () => apply(i));
      wrap.appendChild(btn);
    });
    navRight.prepend(wrap);
    apply(parseInt(localStorage.getItem(LS_KEY) || '1'));
  }

  document.addEventListener('DOMContentLoaded', init);
})();

// ── T21: SECTION STAR RATINGS ────────────────────────────────────────────
(function T21_StarRatings() {
  const LS_KEY = 'eri_ratings';
  function getRatings() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; } }
  function saveRatings(r) { localStorage.setItem(LS_KEY, JSON.stringify(r)); }

  function injectRating(sec) {
    if (sec.querySelector('.section-rating')) return;
    const id = sec.id;
    const ratings = getRatings();
    const myRating = ratings[id] || 0;
    const wrap = document.createElement('div');
    wrap.className = 'section-rating';
    wrap.innerHTML = `<span style="font-size:.78rem;color:var(--text-muted,#888)">Rate this section:</span>
      <div class="star-rating">${[1,2,3,4,5].map(n => `<button class="star-btn${n<=myRating?' lit':''}" data-v="${n}" aria-label="${n} star">★</button>`).join('')}</div>
      <span class="star-avg" id="sa-${id}"></span>`;
    sec.appendChild(wrap);

    const btns = wrap.querySelectorAll('.star-btn');
    btns.forEach(btn => {
      btn.addEventListener('mouseenter', () => btns.forEach(b => b.classList.toggle('lit', +b.dataset.v <= +btn.dataset.v)));
      btn.addEventListener('mouseleave', () => { const r = getRatings()[id]||0; btns.forEach(b => b.classList.toggle('lit', +b.dataset.v <= r)); });
      btn.addEventListener('click', () => {
        const v = +btn.dataset.v;
        const r = getRatings(); r[id] = v; saveRatings(r);
        btns.forEach(b => b.classList.toggle('lit', +b.dataset.v <= v));
        showToast(`⭐ Rated ${v}/5 for ${id.replace(/-/g,' ')}`, 'info');
        checkAchievement('rater');
      });
    });
  }

  function inject() {
    document.querySelectorAll('section[id]').forEach(sec => { if (sec.id !== 'hero') injectRating(sec); });
  }

  document.addEventListener('DOMContentLoaded', () => setTimeout(inject, 1400));
})();

// ── T22: KEYBOARD SHORTCUTS MODAL ────────────────────────────────────────
(function T22_Shortcuts() {
  function init() {
    const modal = document.getElementById('shortcutsModal');
    const closeBtn = document.getElementById('shortcutsClose');
    if (!modal) return;
    closeBtn.onclick = () => modal.hidden = true;
    modal.addEventListener('click', e => { if (e.target === modal) modal.hidden = true; });
    document.addEventListener('keydown', e => {
      if (e.key === '?' && !e.ctrlKey && !e.altKey && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) {
        modal.hidden = !modal.hidden;
      }
      if (e.key === 'Escape') modal.hidden = true;
    });
  }
  document.addEventListener('DOMContentLoaded', init);
})();

// ── T23: SPOTLIGHT SEARCH ────────────────────────────────────────────────
(function T23_Spotlight() {
  const SECTIONS = [
    {id:'overview',emoji:'🏛️',label:'Overview',hint:'History, geography, capital'},{id:'history',emoji:'📜',label:'History',hint:'1890–present timeline'},
    {id:'geography',emoji:'🗺️',label:'Geography',hint:'Mountains, coast, climate'},{id:'people',emoji:'👥',label:'People',hint:'9 ethnic groups, languages'},
    {id:'culture',emoji:'🎭',label:'Culture',hint:'Music, food, traditions'},{id:'economy',emoji:'💰',label:'Economy',hint:'GDP, trade, Nakfa currency'},
    {id:'government',emoji:'⚖️',label:'Government',hint:'Political system, PFDJ'},{id:'famous',emoji:'⭐',label:'Famous People',hint:'Athletes, artists, leaders'},
    {id:'gallery',emoji:'📸',label:'Gallery',hint:'Photos of Eritrea'},{id:'translator',emoji:'🌐',label:'Translator',hint:'Tigrinya ↔ English AI'},
    {id:'tourism',emoji:'✈️',label:'Tourism',hint:'Places to visit'},{id:'regions',emoji:'🗾',label:'Regions',hint:'6 administrative zones'},
    {id:'recipes',emoji:'🍽️',label:'Recipes',hint:'Injera, Zigni, Ful'},{id:'artists',emoji:'🎵',label:'Artists',hint:'Tigrinya & Eritrean music'},
    {id:'quiz',emoji:'🏆',label:'Quiz',hint:'Test your Eritrea knowledge'},{id:'fidel',emoji:'🔤',label:'Alphabet',hint:'Ge\'ez Fidel script'},
    {id:'lessons',emoji:'📖',label:'Lessons',hint:'Learn Tigrinya phrases'},{id:'proverbs',emoji:'💬',label:'Proverbs',hint:'Eritrean wisdom & sayings'},
    {id:'poetry',emoji:'📝',label:'Poetry',hint:'Eritrean literary tradition'},{id:'facts',emoji:'🌟',label:'Facts',hint:'Amazing Eritrean facts'},
    {id:'community',emoji:'🤝',label:'Community',hint:'Posts & discussions'},{id:'news',emoji:'📰',label:'News',hint:'Latest from Eritrea'},
    {id:'holidays',emoji:'🗓️',label:'Holidays',hint:'National & cultural days'},{id:'compare',emoji:'📊',label:'Compare',hint:'Eritrea vs world countries'},
    {id:'events',emoji:'📅',label:'Events',hint:'Community events calendar'},{id:'live-dashboard',emoji:'📡',label:'Live Dashboard',hint:'Clocks, weather, exchange rates'},
    {id:'diaspora-map',emoji:'🌍',label:'Diaspora Map',hint:'Eritreans around the world'},{id:'__about__',emoji:'ℹ️',label:'About Us',hint:'About this platform — opens new page'},
  ];

  let activeIdx = 0;

  function open() {
    const overlay = document.getElementById('spotlightOverlay');
    const input = document.getElementById('spotlightInput');
    if (!overlay) return;
    overlay.hidden = false;
    input.value = '';
    render('');
    setTimeout(() => input.focus(), 50);
    checkAchievement('searcher');
  }
  function close() { const o = document.getElementById('spotlightOverlay'); if (o) o.hidden = true; }

  function render(q) {
    const list = document.getElementById('spotlightResults');
    if (!list) return;
    const matches = q ? SECTIONS.filter(s => s.label.toLowerCase().includes(q.toLowerCase()) || s.hint.toLowerCase().includes(q.toLowerCase())) : SECTIONS;
    activeIdx = 0;
    list.innerHTML = matches.map((s, i) => `<li data-id="${s.id}" class="${i===0?'sp-active':''}"><span class="sp-emoji">${s.emoji}</span><div><div class="sp-title">${s.label}</div><div class="sp-hint">${s.hint}</div></div></li>`).join('');
    list.querySelectorAll('li').forEach((li, i) => {
      li.addEventListener('mouseenter', () => { activeIdx = i; updateActive(); });
      li.addEventListener('click', () => jumpTo(li.dataset.id));
    });
  }

  function updateActive() {
    document.querySelectorAll('#spotlightResults li').forEach((li, i) => li.classList.toggle('sp-active', i === activeIdx));
    const active = document.querySelector('#spotlightResults li.sp-active');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  function jumpTo(id) {
    if (id === '__about__') { close(); window.location.href = 'about.html'; return; }
    const el = document.getElementById(id);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); close(); }
  }

  function init() {
    const overlay = document.getElementById('spotlightOverlay');
    const input = document.getElementById('spotlightInput');
    if (!overlay || !input) return;

    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    input.addEventListener('input', () => render(input.value.trim()));
    input.addEventListener('keydown', e => {
      const items = document.querySelectorAll('#spotlightResults li');
      if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx = Math.min(activeIdx+1, items.length-1); updateActive(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = Math.max(activeIdx-1, 0); updateActive(); }
      else if (e.key === 'Enter') { if (items[activeIdx]) jumpTo(items[activeIdx].dataset.id); }
      else if (e.key === 'Escape') close();
    });
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); open(); }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();

// ── T24: TIGRINYA FLASHCARDS ─────────────────────────────────────────────
(function T24_Flashcards() {
  const CARDS = [
    {ti:'ሰላም',en:'Peace / Hello',ex:'ሰላም ኣለኩም — Hello (to group)'},{ti:'ፍቕሪ',en:'Love',ex:'ፍቕሪ ዓቢ ሓይሊ — Love is a great power'},
    {ti:'ሃገር',en:'Country / Nation',ex:'ሃገርና ኤርትራ — Our country Eritrea'},{ti:'ሓርነት',en:'Freedom',ex:'ሓርነት ዓወት — Freedom is victory'},
    {ti:'ትምህርቲ',en:'Education',ex:'ትምህርቲ ብርሃን — Education is light'},{ti:'ቤት',en:'Home / House',ex:'ቤትካ ጽቡቕ — Your home is nice'},
    {ti:'ኣደ',en:'Mother',ex:'ኣደ ፍቕሪ — A mother\'s love'},{ti:'ዓወት',en:'Victory',ex:'ዓወት ንሓፋሽ — Victory to the masses'},
    {ti:'ብርሃን',en:'Light',ex:'ብርሃን ናብ ዓለም — Light unto the world'},{ti:'ደስታ',en:'Joy / Happiness',ex:'ደስታ ኣምጽእ — Bring joy'},
    {ti:'ጸሎት',en:'Prayer',ex:'ጸሎት ሓይሊ — Prayer is strength'},{ti:'ምሕረት',en:'Mercy / Forgiveness',ex:'ምሕረት ዓቢ — Mercy is great'},
    {ti:'ተስፋ',en:'Hope',ex:'ተስፋ ይቕጽል — Hope continues'},{ti:'ክብሪ',en:'Honor / Dignity',ex:'ክብሪ ሰብ — Human dignity'},
    {ti:'ሓቂ',en:'Truth',ex:'ሓቂ ትዕወት — Truth prevails'},{ti:'ምዕባለ',en:'Development / Progress',ex:'ምዕባለ ህዝቢ — People\'s development'},
    {ti:'ሙዚቃ',en:'Music',ex:'ሙዚቃ ሕይወት — Music is life'},{ti:'ዕርቂ',en:'Reconciliation / Peace',ex:'ዕርቂ ቅዱስ — Reconciliation is sacred'},
    {ti:'ኪዳን',en:'Covenant / Promise',ex:'ኪዳን ኤርትራ — Eritrea\'s covenant'},{ti:'ጽቡቕ',en:'Good / Beautiful',ex:'ጽቡቕ ዕዮ — Good work'},
  ];

  let deck = [], flipped = false, mastered = 0;

  function openModal() {
    const modal = document.getElementById('flashcardModal');
    if (!modal) return;
    deck = [...CARDS].sort(() => Math.random() - .5);
    mastered = 0; flipped = false;
    modal.hidden = false;
    render();
    checkAchievement('linguist');
  }

  function render() {
    if (!deck.length) {
      document.getElementById('fcFront').textContent = '🎉 All done!';
      document.getElementById('fcBack').textContent = `${mastered}/${CARDS.length} mastered`;
      document.getElementById('fcInner').classList.remove('flipped');
      return;
    }
    const card = deck[0]; flipped = false;
    document.getElementById('fcFront').textContent = card.ti;
    document.getElementById('fcBack').textContent = `${card.en} — ${card.ex}`;
    document.getElementById('fcInner').classList.remove('flipped');
    document.getElementById('fcProgress').style.width = `${(mastered/CARDS.length)*100}%`;
    document.getElementById('fcDone').textContent = CARDS.length - deck.length;
    document.getElementById('fcLeft').textContent = deck.length;
    document.getElementById('fcPct').textContent = Math.round((mastered/CARDS.length)*100);
  }

  function flip() { flipped = !flipped; document.getElementById('fcInner').classList.toggle('flipped', flipped); }

  function init() {
    const modal = document.getElementById('flashcardModal');
    const closeBtn = document.getElementById('flashcardClose');
    if (!modal) return;
    closeBtn.onclick = () => modal.hidden = true;
    modal.addEventListener('click', e => { if (e.target === modal) modal.hidden = true; });
    document.getElementById('fcCard').addEventListener('click', flip);
    document.getElementById('fcFlip').addEventListener('click', flip);
    document.getElementById('fcRight').addEventListener('click', () => { mastered++; deck.shift(); render(); });
    document.getElementById('fcWrong').addEventListener('click', () => { const c = deck.shift(); deck.push(c); render(); });

    // Add flashcard button to lessons section
    const lessons = document.getElementById('lessons');
    if (lessons) {
      const btn = document.createElement('button');
      btn.className = 'btn-secondary'; btn.textContent = '🃏 Flashcard Mode';
      btn.style.margin = '12px 0';
      btn.addEventListener('click', openModal);
      const h = lessons.querySelector('h1,h2,h3');
      if (h) h.insertAdjacentElement('afterend', btn);
    }
  }

  document.addEventListener('DOMContentLoaded', () => setTimeout(init, 800));
})();

// ── T25: ACHIEVEMENT BADGES ───────────────────────────────────────────────
const BADGES_DEF = [
  {id:'explorer', icon:'🌍', name:'Explorer',     desc:'Visited 5+ sections'},
  {id:'scholar',  icon:'🎓', name:'Scholar',      desc:'Completed the quiz'},
  {id:'linguist', icon:'🗣️', name:'Linguist',     desc:'Used flashcards or translator'},
  {id:'foodie',   icon:'🍽️', name:'Foodie',       desc:'Visited the recipes section'},
  {id:'searcher', icon:'🔍', name:'Searcher',     desc:'Used Spotlight search'},
  {id:'rater',    icon:'⭐', name:'Critic',       desc:'Rated a section'},
  {id:'sharer',   icon:'📤', name:'Ambassador',   desc:'Shared an Eritrea card'},
  {id:'reader',   icon:'📚', name:'Deep Reader',  desc:'Spent 5+ min reading'},
  {id:'quizmaster',icon:'🏆',name:'Quiz Master',  desc:'Scored 8+ on the quiz'},
  {id:'nightowl', icon:'🌙', name:'Night Owl',    desc:'Used the site after midnight'},
];

const LS_BADGES = 'eri_badges_v1';
function getEarnedBadges() { try { return JSON.parse(localStorage.getItem(LS_BADGES) || '[]'); } catch { return []; } }
function checkAchievement(id) {
  const earned = getEarnedBadges();
  if (earned.includes(id)) return;
  earned.push(id);
  localStorage.setItem(LS_BADGES, JSON.stringify(earned));
  const def = BADGES_DEF.find(b => b.id === id);
  if (def) showToast(`🏅 Badge unlocked: ${def.icon} ${def.name} — ${def.desc}`, 'info');
  refreshBadgeDrawer();
}

(function T25_Badges() {
  function refreshBadgeDrawer() {
    const list = document.getElementById('badgeList');
    if (!list) return;
    const earned = getEarnedBadges();
    list.innerHTML = BADGES_DEF.map(b => `<div class="badge-item${earned.includes(b.id)?' earned':''}" title="${b.desc}">
      <span class="badge-icon">${b.icon}</span><span class="badge-name">${b.name}</span></div>`).join('');
  }
  window.refreshBadgeDrawer = refreshBadgeDrawer;

  function init() {
    const btn = document.getElementById('badgeDrawerBtn');
    const drawer = document.getElementById('badgeDrawer');
    const closeBtn = document.getElementById('badgeDrawerClose');
    if (!btn) return;
    btn.hidden = false;
    refreshBadgeDrawer();
    btn.addEventListener('click', () => { refreshBadgeDrawer(); drawer.hidden = !drawer.hidden; });
    if (closeBtn) closeBtn.addEventListener('click', () => drawer.hidden = true);

    // Track reading time
    setTimeout(() => checkAchievement('reader'), 5 * 60 * 1000);
    if (new Date().getHours() >= 0 && new Date().getHours() < 5) checkAchievement('nightowl');

    // Track section visits
    const visitedSections = new Set();
    document.addEventListener('scroll', () => {
      document.querySelectorAll('section[id]').forEach(sec => {
        if (sec.getBoundingClientRect().top < window.innerHeight * .6) visitedSections.add(sec.id);
      });
      if (visitedSections.size >= 5) checkAchievement('explorer');
      if (visitedSections.has('recipes')) checkAchievement('foodie');
    }, { passive: true });

    // Quiz score check
    const quizResult = document.getElementById('quizResult');
    if (quizResult) {
      new MutationObserver(() => {
        if (!quizResult.hidden) {
          checkAchievement('scholar');
          const score = document.getElementById('quizFinalScore');
          if (score && parseInt(score.textContent) >= 8) checkAchievement('quizmaster');
        }
      }).observe(quizResult, { attributes: true });
    }
  }

  document.addEventListener('DOMContentLoaded', () => setTimeout(init, 900));
})();

// ── T26: CANVAS SHARE CARDS ──────────────────────────────────────────────
(function T26_ShareCards() {
  function drawCard(title, emoji, facts) {
    const canvas = document.getElementById('shareCanvas');
    const ctx = canvas.getContext('2d');
    const W = 800, H = 420;
    ctx.clearRect(0, 0, W, H);

    // Background
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#004d27'); grad.addColorStop(1, '#003d7a');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

    // Stripe accent
    ctx.fillStyle = '#4BD08B'; ctx.fillRect(0, 0, 8, H);
    ctx.fillStyle = '#0076CE'; ctx.fillRect(8, 0, 8, H);
    ctx.fillStyle = '#CE1126'; ctx.fillRect(16, 0, 8, H);

    // Title
    ctx.fillStyle = '#fff'; ctx.font = 'bold 36px Montserrat,sans-serif';
    ctx.fillText(emoji + ' ' + title, 40, 70);

    // Underline
    ctx.strokeStyle = '#4BD08B'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(40, 82); ctx.lineTo(Math.min(40 + title.length * 22, 760), 82); ctx.stroke();

    // Facts
    ctx.font = '18px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.9)';
    facts.slice(0, 6).forEach((f, i) => ctx.fillText('• ' + f, 40, 128 + i * 38));

    // Branding
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.font = '15px sans-serif';
    ctx.fillText('eritreaninfo.com  🇪🇷', W - 240, H - 18);
  }

  function openFor(sectionId) {
    const sec = document.getElementById(sectionId);
    const modal = document.getElementById('shareCardModal');
    if (!sec || !modal) return;
    const h = sec.querySelector('h1,h2,h3');
    const title = h ? h.textContent.trim() : sectionId;
    const emoji = sec.querySelector('.section-badge')?.textContent?.slice(0, 2) || '🇪🇷';
    const facts = Array.from(sec.querySelectorAll('p,li')).map(el => el.textContent.trim()).filter(t => t.length > 20 && t.length < 80).slice(0, 6);
    drawCard(title, emoji, facts);
    modal.hidden = false;
    checkAchievement('sharer');
  }
  window._openShareCard = openFor;

  function injectShareBtns() {
    document.querySelectorAll('section[id]').forEach(sec => {
      if (sec.id === 'hero' || sec.querySelector('.section-share-btn')) return;
      const btn = document.createElement('button');
      btn.className = 'tts-btn section-share-btn'; btn.innerHTML = '📤 Share Card';
      btn.addEventListener('click', () => openFor(sec.id));
      const h = sec.querySelector('h1,h2,h3');
      if (h) h.insertAdjacentElement('afterend', btn);
    });
  }

  function init() {
    const modal = document.getElementById('shareCardModal');
    const closeBtn = document.getElementById('shareCardClose');
    const dlBtn = document.getElementById('shareCardDownload');
    const nativeBtn = document.getElementById('shareCardNative');
    if (!modal) return;

    closeBtn.onclick = () => modal.hidden = true;
    modal.addEventListener('click', e => { if (e.target === modal) modal.hidden = true; });

    dlBtn.addEventListener('click', () => {
      const canvas = document.getElementById('shareCanvas');
      const a = document.createElement('a');
      a.download = 'eritrean-info-card.png'; a.href = canvas.toDataURL('image/png'); a.click();
    });
    nativeBtn.addEventListener('click', async () => {
      const canvas = document.getElementById('shareCanvas');
      if (navigator.share && navigator.canShare) {
        try {
          canvas.toBlob(async blob => {
            const file = new File([blob], 'eritrea.png', { type: 'image/png' });
            if (navigator.canShare({ files: [file] })) {
              await navigator.share({ files: [file], title: 'Eritrean Info', text: 'Learn about Eritrea!' });
            } else { await navigator.share({ title: 'Eritrean Info', url: location.href }); }
          });
        } catch {}
      } else { showToast('Sharing not supported on this browser', 'info'); }
    });

    setTimeout(injectShareBtns, 1600);
  }

  document.addEventListener('DOMContentLoaded', init);
})();

// ── T27: RECIPE SERVING ADJUSTER ─────────────────────────────────────────
(function T27_RecipeAdjuster() {
  const INGREDIENT_RE = /(\d+(?:\.\d+)?)\s*(cup|tbsp|tsp|g|kg|ml|l|oz|lb|piece|clove|bunch|slice|handful)s?/gi;

  function inject(recipeEl) {
    if (recipeEl.querySelector('.recipe-adjuster')) return;
    let servings = 4;
    const adjuster = document.createElement('div');
    adjuster.className = 'recipe-adjuster';
    adjuster.innerHTML = `<span>Servings:</span><button class="ra-minus">−</button><span class="ra-count">${servings}</span><button class="ra-plus">+</button>`;
    recipeEl.insertAdjacentElement('afterbegin', adjuster);

    const texts = [];
    recipeEl.querySelectorAll('li, .ingredient').forEach(el => {
      const orig = el.textContent;
      texts.push({ el, orig });
    });

    function update() {
      adjuster.querySelector('.ra-count').textContent = servings;
      texts.forEach(({ el, orig }) => {
        el.textContent = orig.replace(INGREDIENT_RE, (_, num, unit) => {
          const scaled = (parseFloat(num) * servings / 4).toFixed(num.includes('.') ? 1 : 0);
          return `${scaled} ${unit}`;
        });
      });
    }

    adjuster.querySelector('.ra-minus').addEventListener('click', () => { if (servings > 1) { servings--; update(); } });
    adjuster.querySelector('.ra-plus').addEventListener('click', () => { if (servings < 20) { servings++; update(); } });
  }

  function init() {
    const recipeSec = document.getElementById('recipes');
    if (!recipeSec) return;
    recipeSec.querySelectorAll('.recipe-card, .recipe, [class*="recipe"]').forEach(inject);
    if (recipeSec.querySelectorAll('.recipe-card, .recipe, [class*="recipe"]').length === 0) inject(recipeSec);
    checkAchievement('foodie');
  }

  document.addEventListener('DOMContentLoaded', () => setTimeout(init, 1200));
})();

// ── T28: SPEED QUIZ CHALLENGE ────────────────────────────────────────────
(function T28_SpeedQuiz() {
  const QS = typeof QUIZ_QS !== 'undefined' ? QUIZ_QS : [
    {q:'Capital of Eritrea?',opts:['Massawa','Keren','Asmara','Assab'],ans:2,fact:'Asmara'},
    {q:'Independence year?',opts:['1991','1993','1995','1998'],ans:1,fact:'1993'},
    {q:'Main language?',opts:['Arabic','Amharic','Tigrinya','Afar'],ans:2,fact:'Tigrinya'},
    {q:'Eritrean currency?',opts:['Birr','Nakfa','Dollar','Pound'],ans:1,fact:'Nakfa'},
  ];

  let timerInterval, timeLeft, score, combo, shuffledQ, qi, answered;

  function start() {
    shuffledQ = [...QS].sort(() => Math.random() - .5);
    qi = 0; score = 0; combo = 0; timeLeft = 60; answered = false;
    document.getElementById('sqStartBtn').hidden = true;
    document.getElementById('sqResult').hidden = true;
    document.getElementById('sqHeader').style.display = 'flex';
    tick();
    timerInterval = setInterval(tick, 1000);
    showQ();
  }

  function tick() {
    const timerEl = document.getElementById('sqTimer');
    timerEl.textContent = timeLeft;
    timerEl.className = 'sq-timer' + (timeLeft <= 10 ? ' danger' : timeLeft <= 20 ? ' warning' : '');
    if (timeLeft <= 0) { clearInterval(timerInterval); showFinalResult(); return; }
    timeLeft--;
  }

  function showQ() {
    if (qi >= shuffledQ.length) { clearInterval(timerInterval); showFinalResult(); return; }
    const q = shuffledQ[qi]; answered = false;
    document.getElementById('sqQuestion').textContent = q.q;
    document.getElementById('sqOptions').innerHTML = q.opts.map((o, i) => `<button class="sq-opt" data-i="${i}">${o}</button>`).join('');
    document.querySelectorAll('.sq-opt').forEach(btn => btn.addEventListener('click', function() {
      if (answered) return; answered = true;
      const correct = +this.dataset.i === q.ans;
      this.classList.add(correct ? 'correct' : 'wrong');
      if (!correct) { document.querySelectorAll('.sq-opt')[q.ans].classList.add('correct'); combo = 0; }
      else { combo++; score += 10 + (combo > 1 ? (combo - 1) * 5 : 0); }
      document.getElementById('sqScore').textContent = score;
      document.getElementById('sqCombo').textContent = combo > 1 ? `×${combo} combo!` : '';
      setTimeout(() => { qi++; showQ(); }, 700);
    }));
  }

  function showFinalResult() {
    document.getElementById('sqQuestion').textContent = '';
    document.getElementById('sqOptions').innerHTML = '';
    const res = document.getElementById('sqResult');
    res.hidden = false;
    res.innerHTML = `<div style="font-size:2rem">🏆</div><div style="font-weight:800;font-size:1.2rem">${score} points</div>
      <div style="color:var(--text-muted,#888);margin:6px 0">${qi} questions answered in 60 seconds</div>
      <button class="btn-primary" onclick="document.querySelector('#sqStartBtn').hidden=false;document.getElementById('sqResult').hidden=true;" style="margin-top:12px">Play Again</button>`;
    if (score >= 100) checkAchievement('quizmaster');
  }

  function init() {
    const modal = document.getElementById('speedQuizModal');
    const closeBtn = document.getElementById('speedQuizClose');
    const startBtn = document.getElementById('sqStartBtn');
    if (!modal) return;
    document.getElementById('sqHeader').style.display = 'none';
    closeBtn.onclick = () => { clearInterval(timerInterval); modal.hidden = true; };
    modal.addEventListener('click', e => { if (e.target === modal) { clearInterval(timerInterval); modal.hidden = true; } });
    startBtn.addEventListener('click', start);

    // Add button in quiz section
    const quizSec = document.getElementById('quiz');
    if (quizSec) {
      const btn = document.createElement('button');
      btn.className = 'btn-secondary'; btn.textContent = '⚡ Speed Challenge (60s)';
      btn.style.marginTop = '12px';
      btn.addEventListener('click', () => modal.hidden = false);
      const h = quizSec.querySelector('h1,h2,h3');
      if (h) h.insertAdjacentElement('afterend', btn);
    }
  }

  document.addEventListener('DOMContentLoaded', () => setTimeout(init, 800));
})();


// ── T30: AUTO DARK MODE SCHEDULER ────────────────────────────────────────
(function T30_AutoDark() {
  function shouldBeDark() { const h = new Date().getHours(); return h >= 21 || h < 6; }

  function applyAuto() {
    const isDark = document.documentElement.classList.contains('dark');
    const want = shouldBeDark() || window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (want && !isDark) { document.documentElement.classList.add('dark'); localStorage.setItem('eri_dark', '1'); }
  }

  function init() {
    if (!sessionStorage.getItem('eri_dark_override')) {
      applyAuto();
      const toggle = document.getElementById('darkToggle');
      if (toggle && shouldBeDark() && !toggle.querySelector('.dark-auto-badge')) {
        const badge = document.createElement('span');
        badge.className = 'dark-auto-badge'; badge.textContent = 'AUTO';
        toggle.appendChild(badge);
      }
    }
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (!sessionStorage.getItem('eri_dark_override')) applyAuto();
    });
    const toggle = document.getElementById('darkToggle');
    if (toggle) toggle.addEventListener('click', () => sessionStorage.setItem('eri_dark_override', '1'), { once: true });
  }

  document.addEventListener('DOMContentLoaded', init);
})();

// ── T31: AMBIENT SOUNDS (WEB AUDIO API) ──────────────────────────────────
(function T31_Ambient() {
  let ctx = null, sources = [], gainNode = null, playing = null;

  const PRESETS = {
    rain: (ac, gn) => {
      const buf = ac.createBuffer(1, ac.sampleRate * 3, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
      const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
      const filter = ac.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 600;
      src.connect(filter); filter.connect(gn); src.start(); return [src];
    },
    drone: (ac, gn) => {
      return [55, 110, 165, 220].map(f => {
        const osc = ac.createOscillator(); osc.type = 'sine'; osc.frequency.value = f;
        const g2 = ac.createGain(); g2.gain.value = 0.06;
        osc.connect(g2); g2.connect(gn); osc.start(); return osc;
      });
    },
    nature: (ac, gn) => {
      const buf = ac.createBuffer(1, ac.sampleRate * 4, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.15;
      const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
      const filter = ac.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1200;
      src.connect(filter); filter.connect(gn); src.start(); return [src];
    },
  };

  function stop() { sources.forEach(s => { try { s.stop ? s.stop() : s.disconnect(); } catch {} }); sources = []; playing = null; }

  function play(preset) {
    if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); gainNode = ctx.createGain(); gainNode.gain.value = 0.4; gainNode.connect(ctx.destination); }
    if (ctx.state === 'suspended') ctx.resume();
    stop();
    if (!PRESETS[preset]) { updateBtn(null); return; }
    sources = PRESETS[preset](ctx, gainNode) || [];
    playing = preset; updateBtn(preset);
  }

  function updateBtn(preset) {
    const btn = document.getElementById('ambientToggleBtn');
    if (!btn) return;
    const labels = { rain:'🌧 Rain', drone:'🎶 Drone', nature:'🌿 Nature' };
    btn.classList.toggle('playing', !!preset);
    btn.querySelector('.ambient-label').textContent = (preset && labels[preset]) || '🎵 Ambient';
  }

  function init() {
    const navRight = document.querySelector('.nav-right');
    if (!navRight) return;
    const btn = document.createElement('button');
    btn.id = 'ambientToggleBtn'; btn.className = 'ambient-btn'; btn.title = 'Ambient sounds (Alt+S)';
    btn.innerHTML = '<span class="ambient-label">🎵 Ambient</span>';
    const menu = document.createElement('div');
    menu.className = 'ambient-menu';
    menu.innerHTML = `<button class="ambient-opt active" data-p="">🔇 Off</button>
      <button class="ambient-opt" data-p="rain">🌧 Rain</button>
      <button class="ambient-opt" data-p="drone">🎶 Meditation Drone</button>
      <button class="ambient-opt" data-p="nature">🌿 Nature</button>`;
    btn.appendChild(menu);
    btn.addEventListener('click', e => {
      if (e.target.classList.contains('ambient-opt')) {
        play(e.target.dataset.p);
        menu.querySelectorAll('.ambient-opt').forEach(o => o.classList.toggle('active', o.dataset.p === e.target.dataset.p));
        btn.classList.remove('open');
      } else { btn.classList.toggle('open'); }
    });
    document.addEventListener('click', e => { if (!btn.contains(e.target)) btn.classList.remove('open'); });
    document.addEventListener('keydown', e => { if (e.altKey && e.key === 's') { e.preventDefault(); btn.classList.toggle('open'); } });
    navRight.prepend(btn);
  }

  document.addEventListener('DOMContentLoaded', init);
})();

// ── T32: TEXT ANNOTATIONS ────────────────────────────────────────────────
(function T32_Annotations() {
  const LS_KEY = 'eri_annotations';
  let pendingRange = null, pendingText = '';

  function getAnnotations() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; } }
  function saveAnnotations(a) { localStorage.setItem(LS_KEY, JSON.stringify(a)); }

  function showPopup(x, y) {
    const popup = document.getElementById('annotPopup');
    if (!popup) return;
    popup.style.left = Math.min(x, window.innerWidth - 280) + 'px';
    popup.style.top = (y + window.scrollY - 10) + 'px';
    popup.hidden = false;
    document.getElementById('annotInput').value = '';
    setTimeout(() => document.getElementById('annotInput').focus(), 50);
  }

  function renderPanel() {
    const list = document.getElementById('annotPanelList');
    if (!list) return;
    const annotations = getAnnotations();
    if (!annotations.length) { list.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:.8rem">Select text on any section and add a note!</div>'; return; }
    list.innerHTML = annotations.map((a, i) => `<div class="annot-entry">
      <button class="annot-entry-del" data-i="${i}">✕</button>
      <div class="annot-entry-quote">"${esc(a.text)}"</div>
      <div class="annot-entry-text">${esc(a.note)}</div>
    </div>`).join('');
    list.querySelectorAll('.annot-entry-del').forEach(btn => {
      btn.addEventListener('click', () => { const a = getAnnotations(); a.splice(+btn.dataset.i, 1); saveAnnotations(a); renderPanel(); });
    });
  }

  function init() {
    const popup = document.getElementById('annotPopup');
    const panelBtn = document.getElementById('annotPanelBtn');
    const panel = document.getElementById('annotPanel');
    if (!popup) return;
    panelBtn.hidden = false;
    panelBtn.addEventListener('click', () => { renderPanel(); panel.hidden = !panel.hidden; });
    document.getElementById('annotPanelClose').addEventListener('click', () => panel.hidden = true);

    document.addEventListener('mouseup', e => {
      if (popup.contains(e.target) || panel.contains(e.target)) return;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.toString().trim().length < 5) { popup.hidden = true; return; }
      pendingText = sel.toString().trim().slice(0, 100);
      pendingRange = sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
      showPopup(e.clientX, e.clientY);
    });

    document.getElementById('annotSave').addEventListener('click', () => {
      const note = document.getElementById('annotInput').value.trim();
      if (!note) return;
      const annotations = getAnnotations();
      annotations.unshift({ text: pendingText, note, time: Date.now() });
      saveAnnotations(annotations);
      if (pendingRange) {
        try { const mark = document.createElement('mark'); mark.className = 'annot-mark'; mark.title = note; pendingRange.surroundContents(mark); } catch {}
      }
      popup.hidden = true;
      showToast('📝 Annotation saved', 'info');
    });
    document.getElementById('annotCancel').addEventListener('click', () => { popup.hidden = true; window.getSelection()?.removeAllRanges(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { popup.hidden = true; panel.hidden = true; } });
  }

  document.addEventListener('DOMContentLoaded', () => setTimeout(init, 800));
})();

// ── T33: PER-SECTION OFFLINE SAVE ────────────────────────────────────────
(function T33_OfflineSave() {
  const CACHE_NAME = 'eritrean-offline-sections-v1';

  async function isSaved(id) {
    if (!('caches' in window)) return false;
    try { const cache = await caches.open(CACHE_NAME); const keys = await cache.keys(); return keys.some(k => k.url.includes('?section=' + id)); } catch { return false; }
  }

  async function saveSec(id, html) {
    if (!('caches' in window)) return;
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(new Request(location.origin + location.pathname + '?section=' + id), new Response(html, { headers: { 'Content-Type': 'text/html' } }));
    } catch {}
  }

  function injectBtn(sec) {
    if (sec.querySelector('.offline-save-btn')) return;
    const id = sec.id;
    const btn = document.createElement('button');
    btn.className = 'offline-save-btn'; btn.innerHTML = '💾 Save Offline';
    btn.addEventListener('click', async () => {
      btn.textContent = '⏳ Saving…'; btn.disabled = true;
      await saveSec(id, `<h2>${id}</h2>${sec.innerHTML}`);
      btn.innerHTML = '✓ Saved'; btn.classList.add('saved');
      showToast(`✓ "${id}" saved for offline`, 'info');
    });
    isSaved(id).then(s => { if (s) { btn.innerHTML = '✓ Saved'; btn.classList.add('saved'); btn.disabled = true; } });
    const h = sec.querySelector('h1,h2,h3');
    if (h) h.insertAdjacentElement('afterend', btn);
  }

  function init() {
    if (!('caches' in window)) return;
    document.querySelectorAll('section[id]').forEach(sec => { if (sec.id !== 'hero') injectBtn(sec); });
  }

  document.addEventListener('DOMContentLoaded', () => setTimeout(init, 1800));
})();

// ── T34: DICTIONARY POPUP ON SELECTION ───────────────────────────────────
(function T34_Dictionary() {
  let lookupTimeout = null;

  async function lookupWord(word, x, y) {
    const popup = document.getElementById('dictPopup');
    const bodyEl = document.getElementById('dictBody');
    if (!popup || !bodyEl) return;
    document.getElementById('dictWord').textContent = word;
    bodyEl.innerHTML = 'Looking up…';
    popup.style.left = Math.min(x, window.innerWidth - 300) + 'px';
    popup.style.top = (y + window.scrollY + 12) + 'px';
    popup.hidden = false;

    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error('not found');
      const data = await res.json();
      const entry = data[0];
      const phonetic = entry.phonetic || '';
      const meanings = (entry.meanings || []).slice(0, 2).map(m => `<div class="dict-def-item"><span class="dict-def-part">${m.partOfSpeech}</span>: ${(m.definitions[0]||{}).definition||''}</div>`).join('');
      bodyEl.innerHTML = `${phonetic ? `<div class="dict-phonetic">${phonetic}</div>` : ''}${meanings || 'No definition available.'}`;
    } catch { bodyEl.innerHTML = 'No definition found.'; }
  }

  function init() {
    const popup = document.getElementById('dictPopup');
    const closeBtn = document.getElementById('dictClose');
    if (!popup) return;
    closeBtn.addEventListener('click', () => popup.hidden = true);

    document.addEventListener('mouseup', e => {
      if (popup.contains(e.target)) return;
      clearTimeout(lookupTimeout);
      const sel = window.getSelection();
      const word = sel ? sel.toString().trim() : '';
      if (word.length < 3 || word.length > 25 || word.includes(' ') || word.includes('\n')) { popup.hidden = true; return; }
      lookupTimeout = setTimeout(() => lookupWord(word, e.clientX, e.clientY), 800);
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { popup.hidden = true; clearTimeout(lookupTimeout); } });
  }

  document.addEventListener('DOMContentLoaded', init);
})();

// ── T35: JOURNEY MAP ─────────────────────────────────────────────────────
(function T35_JourneyMap() {
  const SECTIONS = [
    {id:'overview',emoji:'🏛️',label:'Overview'},{id:'history',emoji:'📜',label:'History'},
    {id:'geography',emoji:'🗺️',label:'Geography'},{id:'people',emoji:'👥',label:'People'},
    {id:'culture',emoji:'🎭',label:'Culture'},{id:'economy',emoji:'💰',label:'Economy'},
    {id:'government',emoji:'⚖️',label:'Government'},{id:'famous',emoji:'⭐',label:'Famous'},
    {id:'gallery',emoji:'📸',label:'Gallery'},{id:'translator',emoji:'🌐',label:'Translator'},
    {id:'tourism',emoji:'✈️',label:'Tourism'},{id:'regions',emoji:'🗾',label:'Regions'},
    {id:'recipes',emoji:'🍽️',label:'Recipes'},{id:'artists',emoji:'🎵',label:'Artists'},
    {id:'quiz',emoji:'🏆',label:'Quiz'},{id:'fidel',emoji:'🔤',label:'Fidel'},
    {id:'lessons',emoji:'📖',label:'Lessons'},{id:'proverbs',emoji:'💬',label:'Proverbs'},
    {id:'poetry',emoji:'📝',label:'Poetry'},{id:'facts',emoji:'🌟',label:'Facts'},
    {id:'community',emoji:'🤝',label:'Community'},{id:'news',emoji:'📰',label:'News'},
    {id:'holidays',emoji:'🗓️',label:'Holidays'},{id:'compare',emoji:'📊',label:'Compare'},
    {id:'events',emoji:'📅',label:'Events'},{id:'diaspora-map',emoji:'🌍',label:'Diaspora'},
  ];
  const LS_KEY = 'eri_visited_v1';
  function getVisited() { try { return new Set(JSON.parse(localStorage.getItem(LS_KEY) || '[]')); } catch { return new Set(); } }
  function saveVisited(v) { localStorage.setItem(LS_KEY, JSON.stringify([...v])); }

  function renderJourney() {
    const grid = document.getElementById('journeyGrid');
    if (!grid) return;
    const visited = getVisited();
    const pct = Math.round((visited.size / SECTIONS.length) * 100);
    grid.innerHTML = `<div style="grid-column:1/-1;margin-bottom:12px;font-weight:700;color:var(--green,#007A3D)">${pct}% explored — ${visited.size}/${SECTIONS.length} sections</div>` +
      SECTIONS.map(s => `<div class="journey-item${visited.has(s.id)?' visited':''}">
        <span class="ji-check">${visited.has(s.id)?'✓':'○'}</span>
        <span>${s.emoji} ${s.label}</span></div>`).join('');
  }

  function init() {
    const modal = document.getElementById('journeyModal');
    const closeBtn = document.getElementById('journeyClose');
    const exportBtn = document.getElementById('journeyExport');
    if (!modal) return;

    closeBtn.onclick = () => modal.hidden = true;
    modal.addEventListener('click', e => { if (e.target === modal) modal.hidden = true; });
    exportBtn.addEventListener('click', () => {
      const data = JSON.stringify({ visited: [...getVisited()], total: SECTIONS.length, date: new Date().toISOString() }, null, 2);
      const a = document.createElement('a');
      a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(data);
      a.download = 'my-eritrea-journey.json'; a.click();
    });

    const exploreWidget = document.getElementById('exploreScore');
    if (exploreWidget) exploreWidget.addEventListener('click', () => { renderJourney(); modal.hidden = false; });

    const visited = getVisited();
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { visited.add(e.target.id); saveVisited(visited); } });
    }, { threshold: 0.3 });
    SECTIONS.forEach(s => { const el = document.getElementById(s.id); if (el) io.observe(el); });
  }

  document.addEventListener('DOMContentLoaded', () => setTimeout(init, 700));
})();

// ── T36: ERITREAN HISTORY INTERACTIVE TIMELINE ───────────────────────────
(function T36_Timeline() {
  const EVENTS = [
    {year:'~800 BC',title:'Adulis Trade Port',desc:'Eritrea\'s coast becomes integral to Adulis — one of the busiest ancient ports connecting Rome, India, and sub-Saharan Africa.'},
    {year:'100–940 AD',title:'Aksumite Empire',desc:'Eritrea forms the heartland of the powerful Aksumite Empire, one of the four great powers of the ancient world alongside Persia, Rome, and China.'},
    {year:'1557',title:'Ottoman Occupation',desc:'The Ottomans seize Massawa and coastal areas, beginning centuries of outside control over Eritrea\'s strategic Red Sea coast.'},
    {year:'1890',title:'Italian Colony',desc:'Italy formally establishes the Colony of Eritrea on January 1, 1890, naming it after the Roman name for the Red Sea: Mare Erythraeum.'},
    {year:'1941',title:'British Administration',desc:'British forces defeat Italy in East Africa. Britain administers Eritrea for a decade while the UN deliberates its political future.'},
    {year:'1952',title:'Federation with Ethiopia',desc:'The UN federates Eritrea with Ethiopia. Eritrea retains parliament, but Ethiopia gradually erodes its autonomy, annexing it in 1962.'},
    {year:'1961',title:'Armed Struggle Begins',desc:'Hamid Idris Awate fires the first shots of the liberation struggle on September 1, 1961. The ELF begins guerrilla warfare.'},
    {year:'1970',title:'EPLF Founded',desc:'The Eritrean People\'s Liberation Front is founded, later becoming the dominant liberation movement with its discipline and social programs.'},
    {year:'1978',title:'Strategic Withdrawal',desc:'Facing a Soviet-backed offensive, the EPLF retreats to the Nakfa Mountains — the stronghold that was never taken in 13 years of siege.'},
    {year:'1991',title:'Liberation of Asmara',desc:'On May 24, 1991, EPLF forces liberate Asmara. After 30 years of struggle, Eritrea is finally free.'},
    {year:'1993',title:'Independence Referendum',desc:'99.83% of Eritreans vote for independence. Eritrea officially becomes a nation on May 24, 1993 — Africa\'s newest country.'},
    {year:'1997',title:'Nakfa Currency',desc:'Eritrea introduces the Nakfa, named after the mountain town that symbolized resistance during the liberation war.'},
    {year:'1998–2000',title:'Border War with Ethiopia',desc:'A border dispute erupts into full-scale war. The Algiers Agreement ends the conflict in December 2000.'},
    {year:'2017',title:'UNESCO World Heritage',desc:'Asmara\'s extraordinary Italian Modernist architecture earns UNESCO World Heritage status.'},
    {year:'2018',title:'Peace with Ethiopia',desc:'In a historic breakthrough, Eritrea and Ethiopia sign a peace declaration, ending 20 years of no-peace-no-war.'},
  ];

  function init() {
    const historySec = document.getElementById('history');
    if (!historySec || historySec.querySelector('.eri-timeline')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = `<h3 style="margin-top:32px;margin-bottom:4px;color:var(--green,#007A3D)">📜 Timeline of Eritrean History</h3>
      <p style="font-size:.8rem;color:var(--text-muted,#888);margin-bottom:16px">Click any event to expand</p>
      <div class="eri-timeline">${EVENTS.map(e => `<div class="tl-item">
        <div class="tl-dot"></div>
        <div class="tl-content"><div class="tl-year">${e.year}</div><div class="tl-title">${e.title}</div><div class="tl-desc">${e.desc}</div></div>
      </div>`).join('')}</div>`;
    historySec.appendChild(wrap);
    historySec.querySelectorAll('.tl-content').forEach(el => el.addEventListener('click', () => el.classList.toggle('open')));
  }

  document.addEventListener('DOMContentLoaded', () => setTimeout(init, 1000));
})();

// ── T37: QUICK LANGUAGE CYCLE ────────────────────────────────────────────
(function T37_LangCycle() {
  const LANGS = [{lang:'en',label:'EN'},{lang:'ti',label:'TI'},{lang:'ar',label:'AR'},{lang:'it',label:'IT'},{lang:'fr',label:'FR'},{lang:'de',label:'DE'}];
  let idx = 0;
  document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('keydown', e => {
      if (e.altKey && e.key === 'l') {
        e.preventDefault();
        idx = (idx + 1) % LANGS.length;
        const { lang, label } = LANGS[idx];
        const btn = document.querySelector(`.lang-opt[data-lang="${lang}"]`);
        if (btn) { btn.click(); showToast(`🌐 Language: ${label}`, 'info'); }
      }
      if (e.altKey && e.key === 'd') { e.preventDefault(); document.getElementById('darkToggle')?.click(); }
      if (e.altKey && e.key === 'r') { e.preventDefault(); document.getElementById('readingModeBtn')?.click(); }
    });
  });
})();

// ── T38: GALLERY LIGHTBOX UPGRADE ────────────────────────────────────────
(function T38_GalleryLightbox() {
  let images = [], curIdx = 0, startX = 0;
  function open(idx) { const lb = document.getElementById('galleryLb'); if (!lb) return; curIdx = idx; lb.hidden = false; render(); }
  function closeLb() { const lb = document.getElementById('galleryLb'); if (lb) lb.hidden = true; }
  function render() {
    const img = images[curIdx]; if (!img) return;
    document.getElementById('glbImg').src = img.src;
    document.getElementById('glbImg').alt = img.alt || '';
    document.getElementById('glbCaption').textContent = img.alt || img.title || '';
    document.getElementById('glbCounter').textContent = `${curIdx + 1} / ${images.length}`;
    document.getElementById('glbPrev').style.display = images.length > 1 ? 'flex' : 'none';
    document.getElementById('glbNext').style.display = images.length > 1 ? 'flex' : 'none';
  }
  function prev() { curIdx = (curIdx - 1 + images.length) % images.length; render(); }
  function next() { curIdx = (curIdx + 1) % images.length; render(); }

  function init() {
    const lb = document.getElementById('galleryLb');
    if (!lb) return;
    document.getElementById('glbClose').addEventListener('click', closeLb);
    document.getElementById('glbPrev').addEventListener('click', prev);
    document.getElementById('glbNext').addEventListener('click', next);
    lb.addEventListener('click', e => { if (e.target === lb) closeLb(); });
    document.addEventListener('keydown', e => {
      if (lb.hidden) return;
      if (e.key === 'ArrowLeft') prev(); else if (e.key === 'ArrowRight') next(); else if (e.key === 'Escape') closeLb();
    });
    lb.addEventListener('touchstart', e => { startX = e.changedTouches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', e => { const dx = e.changedTouches[0].clientX - startX; if (Math.abs(dx) > 50) { dx > 0 ? prev() : next(); } });

    function wireImages() {
      const imgs = Array.from(document.querySelectorAll('#gallery img, .gallery-item img'));
      if (!imgs.length) return;
      images = imgs;
      imgs.forEach((img, i) => {
        if (!img.dataset.lbWired) { img.style.cursor = 'zoom-in'; img.addEventListener('click', () => open(i)); img.dataset.lbWired = '1'; }
      });
    }
    setTimeout(wireImages, 1400);
    new MutationObserver(wireImages).observe(document.body, { childList: true, subtree: true });
  }

  document.addEventListener('DOMContentLoaded', init);
})();

// ── T39: QUICK CURRENCY CONVERTER ────────────────────────────────────────
(function T39_QuickConverter() {
  const RATES = { USD:15, EUR:16.2, GBP:18.9, SAR:4, AED:4.08, SEK:1.38, CAD:11.1 };

  function calc() {
    const amt = parseFloat(document.getElementById('qcAmt')?.value || 0);
    const cur = document.getElementById('qcCur')?.value || 'USD';
    const ern = (amt * (RATES[cur] || 15)).toFixed(2);
    const el = document.getElementById('qcResult');
    if (el) el.textContent = `= ${Number(ern).toLocaleString()} ERN`;
  }

  function init() {
    const widget = document.getElementById('quickConverter');
    if (!widget) return;
    fetch('https://api.frankfurter.app/latest?from=USD&to=ERN')
      .then(r => r.json()).then(d => { if (d.rates && d.rates.ERN) RATES.USD = d.rates.ERN; calc(); }).catch(() => {});
    document.getElementById('qcAmt').addEventListener('input', calc);
    document.getElementById('qcCur').addEventListener('change', calc);
    calc();
    const economySec = document.getElementById('economy');
    if (economySec) {
      const io = new IntersectionObserver(entries => entries.forEach(e => { widget.hidden = !e.isIntersecting; }), { threshold: 0.05 });
      io.observe(economySec);
    } else { widget.hidden = false; }
  }

  document.addEventListener('DOMContentLoaded', () => setTimeout(init, 800));
})();

// ── T40: EXPORT LEARNING KIT ─────────────────────────────────────────────
(function T40_ExportKit() {
  function collectData() {
    const get = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; } };
    return {
      exportDate: new Date().toISOString(),
      sectionsVisited: get('eri_visited_v1', []),
      badges: get('eri_badges_v1', []),
      sectionRatings: get('eri_ratings', {}),
      annotations: get('eri_annotations', []).map(a => ({ text: a.text, note: a.note })),
      recentTranslations: get('eri_trans_hist', []).map(t => ({ from: t.src, to: t.tgt })),
      learningStreak: get('eri_streak', {}),
    };
  }

  function init() {
    const navRight = document.querySelector('.nav-right');
    if (!navRight) return;
    const btn = document.createElement('button');
    btn.className = 'nav-print-btn'; btn.title = 'Download my learning kit'; btn.textContent = '📥 Kit';
    btn.addEventListener('click', () => {
      const data = JSON.stringify(collectData(), null, 2);
      const a = document.createElement('a');
      a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(data);
      a.download = `eritrean-info-kit-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      showToast('📥 Learning kit downloaded!', 'info');
    });
    navRight.prepend(btn);
  }

  document.addEventListener('DOMContentLoaded', init);
})();

// ── T40b: IMPORT LEARNING KIT ────────────────────────────────────────────
(function T40b_ImportKit() {
  function restoreData(kit) {
    const set = (key, val) => localStorage.setItem(key, JSON.stringify(val));

    if (Array.isArray(kit.sectionsVisited)) {
      set('eri_visited_v1', kit.sectionsVisited);
      set('eri_visited_v2', kit.sectionsVisited);
    }
    if (Array.isArray(kit.badges))          set('eri_badges_v1',  kit.badges);
    if (kit.sectionRatings && typeof kit.sectionRatings === 'object')
                                             set('eri_ratings',    kit.sectionRatings);
    if (Array.isArray(kit.annotations))      set('eri_annotations', kit.annotations);
    if (Array.isArray(kit.recentTranslations))
      set('eri_trans_hist', kit.recentTranslations.map(t => ({ src: t.from, tgt: t.to })));
    if (kit.learningStreak && typeof kit.learningStreak === 'object')
                                             set('eri_streak',     kit.learningStreak);
  }

  function init() {
    const navRight = document.querySelector('.nav-right');
    if (!navRight) return;

    const fileInput = document.createElement('input');
    fileInput.type = 'file'; fileInput.accept = '.json';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    const btn = document.createElement('button');
    btn.className = 'nav-print-btn'; btn.title = 'Restore learning kit from file';
    btn.textContent = '📤 Import';

    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const kit = JSON.parse(e.target.result);
          if (!kit.exportDate) throw new Error('Not a valid kit file');
          restoreData(kit);
          if (typeof showToast === 'function')
            showToast('✅ Learning kit restored! Refreshing…', 'success');
          setTimeout(() => location.reload(), 1200);
        } catch {
          if (typeof showToast === 'function')
            showToast('❌ Invalid kit file', 'error');
        }
        fileInput.value = '';
      };
      reader.readAsText(file);
    });

    btn.addEventListener('click', () => fileInput.click());
    navRight.prepend(btn);
  }

  document.addEventListener('DOMContentLoaded', init);
})();

// ── T41: SECTION COLOR BADGES ────────────────────────────────────────────
(function T41_SectionBadges() {
  const MAP = {
    history:'history', government:'history', famous:'history', overview:'history',
    culture:'culture', people:'culture', languages:'culture', proverbs:'culture', poetry:'culture', holidays:'culture', 'cultural-calendar':'culture',
    geography:'nature', 'eritrea-map':'nature',
    community:'community', events:'community', blog:'community', 'diaspora-map':'community', about:'community',
    quiz:'learning', fidel:'learning', lessons:'learning', facts:'learning', translator:'learning',
    economy:'economy', compare:'economy',
    tourism:'travel', regions:'travel',
    recipes:'food', 'cooking-videos':'food',
    gallery:'media', artists:'media',
    'live-dashboard':'live', news:'live', 'world-search':'live',
  };
  const LABELS = {
    history:'🏛 History', culture:'🎭 Culture', nature:'🌿 Nature',
    community:'🤝 Community', learning:'📚 Learning', economy:'💰 Economy',
    travel:'✈️ Travel', food:'🍽️ Food', media:'📸 Media', live:'📡 Live',
  };

  function inject() {
    document.querySelectorAll('section[id]').forEach(sec => {
      if (sec.id === 'hero' || sec.querySelector('.section-badge')) return;
      const cat = MAP[sec.id]; if (!cat) return;
      const badge = document.createElement('span');
      badge.className = `section-badge sb-${cat}`; badge.textContent = LABELS[cat];
      const h = sec.querySelector('h1,h2,h3');
      if (h) h.insertAdjacentElement('beforebegin', badge);
    });
  }
  document.addEventListener('DOMContentLoaded', () => setTimeout(inject, 600));
})();

// ── T44: COOKIE / GDPR CONSENT BANNER ────────────────────────────────────
(function T44_CookieBanner() {
  if (localStorage.getItem('eri_cookie_ok')) return;
  document.addEventListener('DOMContentLoaded', () => {
    const banner = document.getElementById('cookieBanner');
    if (!banner) return;
    banner.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => banner.classList.add('show')));
    document.getElementById('cookieAccept')?.addEventListener('click', () => {
      localStorage.setItem('eri_cookie_ok', '1');
      banner.classList.remove('show');
      setTimeout(() => { banner.hidden = true; }, 350);
    });
    document.getElementById('cookieDecline')?.addEventListener('click', () => {
      banner.classList.remove('show');
      setTimeout(() => { banner.hidden = true; }, 350);
    });
  });
})();

// ── T45: SOCIAL SHARE BUTTONS ON CONTENT ─────────────────────────────────
(function T45_SocialShare() {
  function buildShareUrl(platform, url, text) {
    const u = encodeURIComponent(url), t = encodeURIComponent(text);
    if (platform === 'wa') return `https://api.whatsapp.com/send?text=${t}%20${u}`;
    if (platform === 'tw') return `https://twitter.com/intent/tweet?text=${t}&url=${u}`;
    if (platform === 'fb') return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
  }
  function makeRow(title) {
    const row = document.createElement('div');
    row.className = 'social-share-row';
    const url = window.location.href;
    ['wa','tw','fb'].forEach(p => {
      const a = document.createElement('a');
      a.className = `ss-btn ss-${p}`;
      a.href = buildShareUrl(p, url, title);
      a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.textContent = p === 'wa' ? '💬 WhatsApp' : p === 'tw' ? '𝕏 Twitter' : 'f Facebook';
      row.appendChild(a);
    });
    const copy = document.createElement('button');
    copy.className = 'ss-btn ss-cp';
    copy.textContent = '🔗 Copy link';
    copy.addEventListener('click', () => {
      navigator.clipboard.writeText(url + ' — ' + title).then(() => {
        copy.textContent = '✓ Copied!';
        setTimeout(() => { copy.textContent = '🔗 Copy link'; }, 2000);
      }).catch(() => prompt('Copy this link:', url));
    });
    row.appendChild(copy);
    return row;
  }
  function inject() {
    document.querySelectorAll('.news-card .news-body').forEach(body => {
      if (body.querySelector('.social-share-row')) return;
      const title = body.querySelector('.news-title')?.textContent?.trim() || 'Eritrean Info';
      body.appendChild(makeRow(title));
    });
    document.querySelectorAll('.blog-card, .article-card').forEach(card => {
      if (card.querySelector('.social-share-row')) return;
      const title = card.querySelector('h2,h3')?.textContent?.trim() || 'Eritrean Info';
      card.appendChild(makeRow(title));
    });
  }
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(inject, 1600);
    const newsGrid = document.getElementById('newsGrid');
    if (newsGrid) new MutationObserver(inject).observe(newsGrid, { childList: true, subtree: true });
  });
})();

// ── T46: PWA INSTALL PROMPT ───────────────────────────────────────────────
(function T46_PWAInstall() {
  const KEY = 'eri_pwa_dismissed';
  if (localStorage.getItem(KEY)) return;
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    setTimeout(() => {
      const banner = document.getElementById('installBanner');
      if (!banner) return;
      banner.style.display = '';
      requestAnimationFrame(() => requestAnimationFrame(() => banner.classList.add('show')));
    }, 5000);
  });
  document.addEventListener('DOMContentLoaded', () => {
    const banner     = document.getElementById('installBanner');
    const installBtn = document.getElementById('installBtn');
    const dismissBtn = document.getElementById('installDismiss');
    function hideBanner() {
      banner?.classList.remove('show');
      setTimeout(() => { if (banner) banner.style.display = 'none'; }, 350);
      localStorage.setItem(KEY, '1');
    }
    installBtn?.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      deferredPrompt = null;
      hideBanner();
      if (outcome === 'accepted') showToast('🇪🇷 App installed! Find it on your home screen.', 'success');
    });
    dismissBtn?.addEventListener('click', hideBanner);
  });
  window.addEventListener('appinstalled', () => {
    localStorage.setItem(KEY, '1');
    const banner = document.getElementById('installBanner');
    if (banner) banner.style.display = 'none';
  });
})();


// ── T48: TIMED NEWSLETTER POPUP ───────────────────────────────────────────
(function T48_NewsletterPopup() {
  const KEY = 'eri_nl_popup_v1';
  if (localStorage.getItem(KEY)) return;
  let shown = false;
  function showPopup() {
    if (shown) return;
    const overlay = document.getElementById('nlPopupOverlay');
    if (!overlay) return;
    shown = true;
    overlay.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('show')));
  }
  function hidePopup() {
    const overlay = document.getElementById('nlPopupOverlay');
    if (!overlay) return;
    overlay.classList.remove('show');
    setTimeout(() => { overlay.hidden = true; }, 310);
    localStorage.setItem(KEY, '1');
  }
  document.addEventListener('DOMContentLoaded', () => {
    const timer = setTimeout(showPopup, 30000);
    const onScroll = () => {
      const pct = window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      if (pct >= 0.7) { showPopup(); window.removeEventListener('scroll', onScroll); }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    document.getElementById('nlPopupClose')?.addEventListener('click', () => { hidePopup(); clearTimeout(timer); });
    document.getElementById('nlPopupSkip')?.addEventListener('click', () => { hidePopup(); clearTimeout(timer); });
    document.getElementById('nlPopupOverlay')?.addEventListener('click', e => { if (e.target === e.currentTarget) { hidePopup(); clearTimeout(timer); } });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && shown) hidePopup(); });
    document.getElementById('nlPopupBtn')?.addEventListener('click', () => {
      const emailEl = document.getElementById('nlPopupEmail');
      const email = emailEl?.value?.trim();
      if (!email || !email.includes('@')) { showToast('Please enter a valid email', 'info'); return; }
      const footerEmail = document.getElementById('nlEmail');
      const footerBtn   = document.getElementById('nlSubmit');
      if (footerEmail && footerBtn) { footerEmail.value = email; footerBtn.click(); }
      showToast('🇪🇷 Subscribed! Welcome to the community.', 'success');
      hidePopup();
      clearTimeout(timer);
    });
  });
})();

// ── T42: PARALLAX HERO EFFECT ────────────────────────────────────────────
(function T42_Parallax() {
  document.addEventListener('DOMContentLoaded', () => {
    const heroBg = document.querySelector('#hero .hero-bg');
    const heroContent = document.querySelector('#hero .hero-content');
    if (!heroBg) return;
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      if (y > window.innerHeight * 1.2) return;
      heroBg.style.transform = `translateY(${y * 0.4}px)`;
      if (heroContent) heroContent.style.transform = `translateY(${y * 0.12}px)`;
    }, { passive: true });
  });
})();

// ── T43: READING POSITION SAVER ──────────────────────────────────────────
(function T43_ReadingSaver() {
  const LS_KEY = 'eri_scroll_pos';

  document.addEventListener('DOMContentLoaded', () => {
    const saved = parseInt(localStorage.getItem(LS_KEY) || '0');
    if (saved > 600) {
      const toast = document.createElement('div');
      toast.className = 'reading-saver-toast';
      toast.innerHTML = `<span>📖 Continue from where you left?</span>
        <button class="rs-btn" id="rsContinue">Resume</button>
        <button style="background:none;border:none;cursor:pointer;color:var(--text-muted,#888);padding:0 6px;font-size:1rem" id="rsDismiss">✕</button>`;
      document.body.appendChild(toast);
      requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));
      document.getElementById('rsContinue').addEventListener('click', () => {
        window.scrollTo({ top: saved, behavior: 'smooth' });
        toast.classList.remove('show'); setTimeout(() => toast.remove(), 400);
      });
      document.getElementById('rsDismiss').addEventListener('click', () => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); });
      setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 9000);
    }
    window.addEventListener('scroll', () => localStorage.setItem(LS_KEY, String(window.scrollY)), { passive: true });
  });
})();

// ══════════════════════════════════════════════════════════════════════════════
// SECTIONS v1.0 — Poetry · Facts · Sports · Flag · Diaspora · Compare
//                 Prayer Times · Asmara Tour · Cooking Videos · Directory
// ══════════════════════════════════════════════════════════════════════════════

// ── POETRY CORNER ────────────────────────────────────────────────────────────
function initPoetryCorner() {
  const grid = document.getElementById('poetryGrid');
  if (!grid) return;
  const POEMS = [
    {
      title: 'ሃገረይ ኤርትራ', transliteration: 'Hagerei Eritrea', translation: 'My Country Eritrea',
      author: 'Traditional', emoji: '🇪🇷',
      lines: [
        { ti: 'ሃገረይ ኤርትራ ምድረይ', en: 'My country Eritrea, my land' },
        { ti: 'ብደምካ ዝተሃነጸ ቅድሰት', en: 'Built sacred with your blood' },
        { ti: 'ሓርነትካ ዓወትካ ክብርካ', en: 'Your freedom, your victory, your pride' },
        { ti: 'ንዘለኣለም ዝጸንሕ ኩርዓትካ', en: 'Your glory that endures forever' },
      ]
    },
    {
      title: 'ናፍቖት', transliteration: 'Nafkot', translation: 'Longing',
      author: 'Solomon Tsehaye', emoji: '💙',
      lines: [
        { ti: 'ካብ ርሑቕ ሃገር ይጽውዓካ', en: 'From a distant land I call to you' },
        { ti: 'ናፍቖት ልበይ ዳርጋ ሰቢሩ', en: 'The longing has nearly broken my heart' },
        { ti: 'ደቂ ኤርትራ ብዝፈቕርዎ', en: 'The children of Eritrea, in their love' },
        { ti: 'ኣብ ኩሉ ዓለም ዝተዘርኡ', en: 'Are scattered across all the world' },
      ]
    },
    {
      title: 'ኣደ', transliteration: 'Ade', translation: 'Mother',
      author: 'Beyene Haile', emoji: '❤️',
      lines: [
        { ti: 'ኣደ ምስ ኣደ ዝተዋደቐ', en: 'Mother, who stands beside a mother' },
        { ti: 'ፍቕሩ ብዝኽሪ ዝቐደቐ', en: 'Whose love is kindled in memory' },
        { ti: 'ዘይፈልጦ ዋጋ ክቡርነቱ', en: 'Who does not know the price of her worth' },
        { ti: 'ንዓለም ዝወፈት ናይ ልባ ኑሩ', en: 'Who gave the light of her heart to the world' },
      ]
    },
    {
      title: 'ሰማይ ኤርትራ', transliteration: 'Semay Eritrea', translation: 'Sky of Eritrea',
      author: 'Traditional', emoji: '🌅',
      lines: [
        { ti: 'ሰማይ ኤርትራ ብዋኒን ዝሕብሕብ', en: 'The sky of Eritrea shines with colours' },
        { ti: 'ሐምሓሚት ቀይሕ ሕምብርቲ ሓምሊ', en: 'Crimson, red, the green heart of the land' },
        { ti: 'ብዓቢ ኩርዓት ዝተዓቀቐ', en: 'Kept with great pride and honour' },
        { ti: 'ናይ ሓርነት ባንዴራ ዘንቀደ', en: 'The flag of freedom that was raised high' },
      ]
    },
    {
      title: 'ዓዲ ዓዱ', transliteration: "Adi Adu", translation: 'The Homeland',
      author: 'Tsehaytu Beraki', emoji: '🌿',
      lines: [
        { ti: 'ዓዲ ዓዱ ዓዱ ዝብሃሎ', en: 'Home, the place called home' },
        { ti: 'ዓጸቦ ዘለዎ ሓቛቖ ዘለዎ', en: 'With flowers, with embrace' },
        { ti: 'ካብ ጸሊም ሓፋሽ ዝሃነጾ', en: 'Built by the dark-skinned masses' },
        { ti: 'ሕቑፎ ዘቕርቦ ፍቕሪ ዘለዎ', en: 'That offers a warm embrace and love' },
      ]
    },
  ];

  grid.innerHTML = POEMS.map(p => `
    <div class="poetry-card">
      <div class="pc-header">
        <span class="pc-emoji">${p.emoji}</span>
        <div>
          <div class="pc-title">${esc(p.title)}</div>
          <div class="pc-meta">${esc(p.transliteration)} · ${esc(p.author)}</div>
        </div>
      </div>
      <div class="pc-body">
        ${p.lines.map(l => `
          <div class="pc-line">
            <div class="pc-ti">${esc(l.ti)}</div>
            <div class="pc-en">${esc(l.en)}</div>
          </div>`).join('')}
      </div>
      <div class="pc-translation-label">${esc(p.translation)}</div>
    </div>`).join('');
}

// ── FACT GENERATOR ────────────────────────────────────────────────────────────
function initFactGenerator() {
  const textEl    = document.getElementById('fgText');
  const iconEl    = document.getElementById('fgIcon');
  const nextBtn   = document.getElementById('fgNext');
  const shareBtn  = document.getElementById('fgShare');
  const counterEl = document.getElementById('fgCounter');
  if (!textEl || !nextBtn) return;

  const FACTS = [
    { icon: '🚴', text: 'Eritrea produces some of the world\'s greatest cyclists. Biniam Girmay became the first African to win a Grand Tour stage at Giro d\'Italia 2022.' },
    { icon: '🌊', text: 'Eritrea has over 1,200 km of coastline along the Red Sea and more than 350 islands in the Dahlak Archipelago.' },
    { icon: '🏛️', text: 'Asmara is a UNESCO World Heritage Site, renowned for its 1930s Modernist (Art Deco, Futurist, Rationalist) architecture built during Italian colonial rule.' },
    { icon: '💰', text: 'Eritrea\'s currency, the Nakfa, is named after the mountain town of Nakfa — the last town held by liberation fighters during the independence war.' },
    { icon: '🌍', text: 'Eritrea shares borders with Sudan, Ethiopia, and Djibouti, and sits at a strategic crossroads between Africa and the Middle East.' },
    { icon: '📜', text: 'Eritrea gained independence from Ethiopia on 24 May 1993 after a 30-year liberation struggle, making it one of Africa\'s newest nations.' },
    { icon: '🐘', text: 'The Gash-Barka region of Eritrea is home to elephants, lions, leopards, and other large mammals in Sawa and surrounding areas.' },
    { icon: '🌡️', text: 'Massawa on the Red Sea coast is one of the hottest cities on Earth, regularly recording temperatures above 40°C (104°F).' },
    { icon: '📡', text: 'Eritrea has one of the lowest internet penetration rates in the world, with the government maintaining a state monopoly on telecommunications.' },
    { icon: '⛪', text: 'Eritrea has four main religions: Eritrean Orthodox Christianity, Islam, Roman Catholicism, and Evangelical Protestantism — practised in relative harmony.' },
    { icon: '🔤', text: 'Tigrinya, the most widely spoken language in Eritrea, uses the Ge\'ez (Fidel) script — one of the world\'s few original alphabets still in everyday use.' },
    { icon: '🎻', text: 'The kirar (a type of lyre) and the krar (a bowl lyre) are traditional Eritrean string instruments central to highland music.' },
    { icon: '🍞', text: 'Injera, the spongy flatbread made from teff or sorghum, is the base of nearly every Eritrean meal and doubles as both food and utensil.' },
    { icon: '⛰️', text: 'Mt. Soira in Eritrea reaches 3,018 m (9,900 ft), making it the country\'s highest peak.' },
    { icon: '🚂', text: 'The Eritrean Railway, built by Italy in the early 1900s, is one of the most remarkable engineering feats in Africa, climbing 2,400 m over 118 km.' },
    { icon: '🧠', text: 'Eritrea has nine recognized ethnic groups: Tigrinya, Tigre, Afar, Kunama, Saho, Bilen, Nara, Rashaida, and Hedareb.' },
    { icon: '⚽', text: 'Eritrea\'s national football team, the Red Sea Boys, first qualified for the Africa Cup of Nations (AFCON) in 2021.' },
    { icon: '🌺', text: 'Adulis, an ancient port near Massawa, was one of the most important trading cities of the ancient world, linking Rome, India, and Arabia.' },
    { icon: '🌱', text: 'Coffee originated in the Horn of Africa region. The Eritrean coffee ceremony (buna) is a cherished social tradition central to hospitality.' },
    { icon: '🏃', text: 'Zersenay Tadese became the first Eritrean to win an Olympic medal — a bronze in the 10,000m at Athens 2004.' },
  ];

  let order = FACTS.map((_, i) => i).sort(() => Math.random() - .5);
  let pos = 0;

  function show() {
    const f = FACTS[order[pos]];
    if (iconEl) iconEl.textContent = f.icon;
    textEl.textContent = f.text;
    if (counterEl) counterEl.textContent = `${pos + 1} / ${FACTS.length}`;
    textEl.classList.remove('fg-anim');
    void textEl.offsetWidth;
    textEl.classList.add('fg-anim');
  }

  show();
  nextBtn.addEventListener('click', () => { pos = (pos + 1) % FACTS.length; show(); });
  if (shareBtn) {
    shareBtn.addEventListener('click', () => {
      const txt = FACTS[order[pos]].text;
      if (navigator.share) { navigator.share({ text: txt, title: 'Eritrean Fact' }).catch(() => {}); }
      else if (navigator.clipboard) { navigator.clipboard.writeText(txt).then(() => showToast('Fact copied!', 'success')); }
    });
  }
}

// ── DIASPORA MAP SECTION ──────────────────────────────────────────────────────
function initDiasporaMapSection() {
  const mapEl   = document.getElementById('diasporaMapEl');
  const statsEl = document.getElementById('diasporaStatsRow');
  if (!mapEl) return;

  const DIASPORA = [
    { country: 'Ethiopia',      flag: '🇪🇹', pop: 170000, note: 'Largest refugee community' },
    { country: 'Sudan',         flag: '🇸🇩', pop: 130000, note: 'Long-standing refugee host' },
    { country: 'Germany',       flag: '🇩🇪', pop: 50000,  note: 'Largest European community' },
    { country: 'United States', flag: '🇺🇸', pop: 45000,  note: 'Strong DC–metro community' },
    { country: 'Italy',         flag: '🇮🇹', pop: 35000,  note: 'Historic colonial connection' },
    { country: 'United Kingdom',flag: '🇬🇧', pop: 30000,  note: 'Growing UK community' },
    { country: 'Sweden',        flag: '🇸🇪', pop: 28000,  note: 'Major Scandinavian hub' },
    { country: 'Saudi Arabia',  flag: '🇸🇦', pop: 25000,  note: 'Gulf labour diaspora' },
    { country: 'Norway',        flag: '🇳🇴', pop: 20000,  note: 'Per-capita largest in world' },
    { country: 'Canada',        flag: '🇨🇦', pop: 18000,  note: 'Toronto & Ottawa hubs' },
    { country: 'Australia',     flag: '🇦🇺', pop: 15000,  note: 'Melbourne & Sydney' },
    { country: 'Netherlands',   flag: '🇳🇱', pop: 14000,  note: 'Amsterdam & Rotterdam' },
    { country: 'Switzerland',   flag: '🇨🇭', pop: 12000,  note: 'Refugee & work permit holders' },
    { country: 'Israel',        flag: '🇮🇱', pop: 10000,  note: 'Asylum seeker community' },
    { country: 'Djibouti',      flag: '🇩🇯', pop: 8000,   note: 'Border-town communities' },
  ];

  const MAX = DIASPORA[0].pop;
  mapEl.innerHTML = DIASPORA.map(d => {
    const pct = Math.round((d.pop / MAX) * 100);
    return `
      <div class="dm-bubble" title="${d.note}">
        <div class="dm-flag">${d.flag}</div>
        <div class="dm-bar-wrap"><div class="dm-bar" style="width:${pct}%"></div></div>
        <div class="dm-country">${d.country}</div>
        <div class="dm-pop">${d.pop.toLocaleString()}</div>
      </div>`;
  }).join('');

  const total = DIASPORA.reduce((s, d) => s + d.pop, 0);
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="dst-item"><div class="dst-num">${total.toLocaleString()}+</div><div class="dst-lbl">Diaspora worldwide (est.)</div></div>
      <div class="dst-item"><div class="dst-num">${DIASPORA.length}</div><div class="dst-lbl">Countries tracked</div></div>
      <div class="dst-item"><div class="dst-num">3M+</div><div class="dst-lbl">Total Eritrean population</div></div>`;
  }
}

// ── COUNTRY COMPARE ───────────────────────────────────────────────────────────
function initCountryCompare() {
  const sel   = document.getElementById('compareCountry');
  const wrap  = document.getElementById('compareTableWrap');
  if (!sel || !wrap) return;

  const ERITREA = { name: 'Eritrea', flag: '🇪🇷', area: '117,600', pop: '3.5M', capital: 'Asmara', gdp: '$2.1B', currency: 'Nakfa (ERN)', language: 'Tigrinya, Arabic, English', independence: '1993', coast: '1,200 km' };
  const COUNTRIES = {
    ethiopia:    { name: 'Ethiopia',      flag: '🇪🇹', area: '1,104,300', pop: '120M',   capital: 'Addis Ababa', gdp: '$111B',  currency: 'Birr (ETB)',   language: 'Amharic',     independence: '~3000 BC', coast: 'Landlocked' },
    sudan:       { name: 'Sudan',         flag: '🇸🇩', area: '1,861,484', pop: '45M',   capital: 'Khartoum',    gdp: '$35B',   currency: 'Pound (SDG)',  language: 'Arabic',       independence: '1956',     coast: '853 km' },
    djibouti:    { name: 'Djibouti',      flag: '🇩🇯', area: '23,200',    pop: '1M',    capital: 'Djibouti',    gdp: '$3.4B',  currency: 'Franc (DJF)',  language: 'French, Arabic',independence: '1977',    coast: '314 km' },
    somalia:     { name: 'Somalia',       flag: '🇸🇴', area: '637,657',   pop: '17M',   capital: 'Mogadishu',   gdp: '$7B',    currency: 'Shilling',     language: 'Somali',       independence: '1960',     coast: '3,025 km' },
    kenya:       { name: 'Kenya',         flag: '🇰🇪', area: '580,367',   pop: '54M',   capital: 'Nairobi',     gdp: '$99B',   currency: 'Shilling (KES)',language: 'Swahili, English', independence: '1963', coast: '536 km' },
    egypt:       { name: 'Egypt',         flag: '🇪🇬', area: '1,002,000', pop: '104M',  capital: 'Cairo',       gdp: '$387B',  currency: 'Pound (EGP)',  language: 'Arabic',       independence: '1922',     coast: '2,450 km' },
    ghana:       { name: 'Ghana',         flag: '🇬🇭', area: '238,533',   pop: '32M',   capital: 'Accra',       gdp: '$72B',   currency: 'Cedi (GHS)',   language: 'English',       independence: '1957',    coast: '539 km' },
    nigeria:     { name: 'Nigeria',       flag: '🇳🇬', area: '923,768',   pop: '218M',  capital: 'Abuja',       gdp: '$440B',  currency: 'Naira (NGN)',  language: 'English',       independence: '1960',    coast: '853 km' },
    southafrica: { name: 'South Africa',  flag: '🇿🇦', area: '1,219,090', pop: '60M',   capital: 'Pretoria',    gdp: '$405B',  currency: 'Rand (ZAR)',   language: 'Zulu, Afrikaans + 9', independence: '1910', coast: '2,798 km' },
    tanzania:    { name: 'Tanzania',      flag: '🇹🇿', area: '945,087',   pop: '62M',   capital: 'Dodoma',      gdp: '$63B',   currency: 'Shilling (TZS)',language: 'Swahili',       independence: '1961',   coast: '1,424 km' },
  };
  const FIELDS = [
    { key: 'area',         label: 'Area (km²)' },
    { key: 'pop',          label: 'Population' },
    { key: 'capital',      label: 'Capital' },
    { key: 'gdp',          label: 'GDP (est.)' },
    { key: 'currency',     label: 'Currency' },
    { key: 'language',     label: 'Official Language' },
    { key: 'independence', label: 'Independence' },
    { key: 'coast',        label: 'Coastline' },
  ];

  sel.addEventListener('change', () => {
    const c = COUNTRIES[sel.value];
    if (!c) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = `
      <table class="compare-table">
        <thead><tr>
          <th></th>
          <th>${ERITREA.flag} ${ERITREA.name}</th>
          <th>${c.flag} ${c.name}</th>
        </tr></thead>
        <tbody>${FIELDS.map(f => `
          <tr>
            <td class="cmp-field">${f.label}</td>
            <td>${esc(ERITREA[f.key])}</td>
            <td>${esc(c[f.key])}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  });
}

// ── COOKING VIDEOS ────────────────────────────────────────────────────────────
function initCookingVideos() {
  const grid = document.getElementById('cookingVideoGrid');
  if (!grid) return;

  const VIDEOS = [
    { title: 'How to Make Injera',        dish: 'Injera',      emoji: '🫓', channel: 'Eritrean Kitchen',   vid: 'dQw4w9WgXcQ', desc: 'Traditional spongy flatbread made from fermented teff batter — the foundation of every Eritrean table.' },
    { title: 'Zigni Beef Stew',           dish: 'Zigni',       emoji: '🥩', channel: 'Habesha Recipes',    vid: 'dQw4w9WgXcQ', desc: 'Slow-cooked spiced beef in berbere sauce, served on injera. One of Eritrea\'s most beloved dishes.' },
    { title: 'Ful Medames — Eritrean Style', dish: 'Ful',      emoji: '🫘', channel: 'Asmara Cuisine',     vid: 'dQw4w9WgXcQ', desc: 'Fava beans slow-cooked with olive oil, lemon, garlic and spices — a staple breakfast dish.' },
    { title: 'Shiro Wat Recipe',          dish: 'Shiro',       emoji: '🫕', channel: 'Horn of Africa Food',vid: 'dQw4w9WgXcQ', desc: 'Creamy ground chickpea stew seasoned with berbere and niter kibbeh. A vegan favourite.' },
    { title: 'Tsebhi Derho — Chicken Stew', dish: 'Tsebhi',   emoji: '🍗', channel: 'Eritrean Mama',      vid: 'dQw4w9WgXcQ', desc: 'Whole chicken pieces simmered in a rich red berbere broth with boiled egg — a festive classic.' },
    { title: 'Eritrean Halva (Sweets)',   dish: 'Halva',       emoji: '🍯', channel: 'Red Sea Flavours',   vid: 'dQw4w9WgXcQ', desc: 'Sweet sesame or grain-based confections flavoured with cardamom, enjoyed during celebrations.' },
  ];

  grid.innerHTML = VIDEOS.map(v => `
    <div class="cv-card">
      <div class="cv-thumb">
        <div class="cv-thumb-inner">${v.emoji}</div>
        <a class="cv-play-btn" href="https://www.youtube.com/results?search_query=${encodeURIComponent(v.title + ' eritrean recipe')}" target="_blank" rel="noopener" aria-label="Watch ${esc(v.title)} on YouTube">▶</a>
      </div>
      <div class="cv-body">
        <div class="cv-title">${esc(v.title)}</div>
        <div class="cv-channel">${esc(v.channel)}</div>
        <div class="cv-desc">${esc(v.desc)}</div>
        <a class="cv-link" href="https://www.youtube.com/results?search_query=${encodeURIComponent(v.title + ' eritrean recipe')}" target="_blank" rel="noopener">Watch on YouTube →</a>
      </div>
    </div>`).join('');
}

// ── BUSINESS DIRECTORY ────────────────────────────────────────────────────────
function initDirectory() {
  const grid  = document.getElementById('dirGrid');
  const chips = document.querySelectorAll('.dir-chip');
  if (!grid) return;

  const ENTRIES = [
    { name: 'Hidmo Eritrean Restaurant', cat: 'food',      flag: '🍽️', city: 'Washington DC, USA',   desc: 'Authentic Eritrean cuisine — injera, zigni, shiro — in the heart of DC\'s Eritrean community.' },
    { name: 'Asmara Restaurant',         cat: 'food',      flag: '🍽️', city: 'Oakland, CA, USA',     desc: 'Beloved Oakland restaurant serving traditional dishes for over 30 years to the Bay Area diaspora.' },
    { name: 'Eri-TV (Eritrean State TV)', cat: 'media',    flag: '📺', city: 'Asmara, Eritrea',       desc: 'Official state television broadcaster; streams Tigrinya, Arabic, and English programming.' },
    { name: 'Asmarino Independent',      cat: 'media',    flag: '📰', city: 'Online',                 desc: 'Independent Eritrean news and commentary platform covering diaspora and domestic affairs.' },
    { name: 'Release Eritrea',           cat: 'ngo',       flag: '🤝', city: 'London, UK',            desc: 'Human rights advocacy organisation focused on political prisoners and civil liberties in Eritrea.' },
    { name: 'Eritrean Law Society',      cat: 'legal',     flag: '⚖️', city: 'International',         desc: 'Network of Eritrean legal professionals providing advocacy, guidance, and pro-bono support to diaspora.' },
    { name: 'NUEW',                      cat: 'ngo',       flag: '👩', city: 'Asmara, Eritrea',       desc: 'National Union of Eritrean Women — promoting gender equality, education, and women\'s rights.' },
    { name: 'Eritrean Community Centre', cat: 'ngo',       flag: '🏠', city: 'Stockholm, Sweden',     desc: 'Cultural and social centre supporting Eritrean families with integration, language classes, and events.' },
    { name: 'Eri Clinic Network',        cat: 'health',    flag: '🏥', city: 'Various, Eritrea',      desc: 'Network of community health clinics providing primary care across Eritrea\'s rural and urban areas.' },
    { name: 'Dedebit Credit Institution', cat: 'ngo',      flag: '💰', city: 'Tigray–Eritrea Region', desc: 'Microfinance institution supporting small businesses and farmers in the Horn of Africa.' },
    { name: 'Eritrean Academy of Science', cat: 'education',flag: '🔬', city: 'Asmara, Eritrea',     desc: 'National body promoting scientific research, STEM education, and technology development in Eritrea.' },
    { name: 'University of Asmara Alumni', cat: 'education',flag: '🎓', city: 'International',        desc: 'Global network of graduates from the University of Asmara (1958–2006), Eritrea\'s first university.' },
    { name: 'Eritrean Cycling Federation', cat: 'sport',   flag: '🚴', city: 'Asmara, Eritrea',      desc: 'Governing body for cycling in Eritrea — home of Biniam Girmay and the world\'s greatest cycling nation per capita.' },
    { name: 'Eritrea Football Federation', cat: 'sport',   flag: '⚽', city: 'Asmara, Eritrea',      desc: 'National football association, member of FIFA and CAF since 1994.' },
  ];

  let activeFilter = 'all';

  function render(filter) {
    const items = filter === 'all' ? ENTRIES : ENTRIES.filter(e => e.cat === filter);
    grid.innerHTML = items.map(e => `
      <div class="dir-card">
        <div class="dir-flag">${e.flag}</div>
        <div class="dir-body">
          <div class="dir-name">${esc(e.name)}</div>
          <div class="dir-city">📍 ${esc(e.city)}</div>
          <div class="dir-desc">${esc(e.desc)}</div>
        </div>
      </div>`).join('');
    if (!items.length) grid.innerHTML = '<p style="padding:16px;color:rgba(255,255,255,.4)">No entries in this category yet.</p>';
  }

  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      activeFilter = chip.dataset.dcat || 'all';
      chips.forEach(c => c.classList.toggle('active', c === chip));
      render(activeFilter);
    });
  });

  render('all');
}
