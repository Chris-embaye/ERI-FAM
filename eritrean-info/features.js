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
    list.innerHTML = bms.map(b => `
      <div class="bmp-item">
        <span class="bmp-emoji">${b.emoji || (b.type==='recipe'?'🍽️':b.type==='proverb'?'💬':b.type==='person'?'⭐':'📖')}</span>
        <div class="bmp-info">
          <p class="bmp-title">${esc(b.title)}</p>
          <p class="bmp-type">${esc(b.type)}</p>
        </div>
        <button class="bmp-remove" onclick="toggleBookmark('${b.id}','${esc(b.title)}','${b.type}');renderBookmarkPanel()">✕</button>
      </div>`).join('');
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

  loadLiveNewsFeed();
  initEventsBoard();
  updateBookmarkCount();
});
