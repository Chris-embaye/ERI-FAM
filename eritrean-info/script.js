/* ============================================
   ERITREAN INFO — JavaScript
   ============================================ */

// ── NAVIGATION ──────────────────────────────
const navbar      = document.getElementById('navbar');
const navToggle   = document.getElementById('navToggle');
const navDropdown = document.getElementById('navDropdown');

navToggle.addEventListener('click', () => {
  navDropdown.classList.toggle('open');
  navToggle.classList.toggle('active');
});

// Close dropdown on link click
document.querySelectorAll('.nav-dd-item').forEach(link => {
  link.addEventListener('click', () => {
    navDropdown.classList.remove('open');
    navToggle.classList.remove('active');
  });
});

// Close dropdown when clicking outside
document.addEventListener('click', e => {
  if (!navbar.contains(e.target)) {
    navDropdown.classList.remove('open');
    navToggle.classList.remove('active');
  }
});

// Active nav link on scroll
const sections = document.querySelectorAll('section[id]');
function updateActiveNav() {
  const scrollY = window.scrollY + 80;
  sections.forEach(section => {
    const top    = section.offsetTop;
    const bottom = top + section.offsetHeight;
    const id     = section.getAttribute('id');
    const link   = navDropdown.querySelector(`a[href="#${id}"]`);
    if (link) {
      if (scrollY >= top && scrollY < bottom) {
        navDropdown.querySelectorAll('.nav-dd-item').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
      }
    }
  });
}

// ── BACK TO TOP ──────────────────────────────
const backToTop = document.getElementById('backToTop');

window.addEventListener('scroll', () => {
  if (window.scrollY > 400) {
    backToTop.classList.add('visible');
  } else {
    backToTop.classList.remove('visible');
  }
  updateActiveNav();
});

// ── FADE-IN ANIMATIONS ───────────────────────
const fadeEls = document.querySelectorAll(
  '.fact-card, .timeline-card, .geo-card, .ethnic-card, .religion-card, ' +
  '.culture-card, .economy-card, .gov-card, .lang-card, .gallery-item, ' +
  '.tourism-card, .phrase-item, .border-item'
);

fadeEls.forEach(el => el.classList.add('fade-in'));

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      setTimeout(() => {
        entry.target.classList.add('visible');
      }, i * 60);
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

fadeEls.forEach(el => observer.observe(el));

// ── CULTURE TABS ─────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.getAttribute('data-tab');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${tab}`).classList.add('active');
  });
});

// ── GALLERY FILTER ───────────────────────────
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const filter = btn.getAttribute('data-filter');
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.gallery-item').forEach(item => {
      const cat = item.getAttribute('data-category');
      if (filter === 'all' || cat === filter) {
        item.classList.remove('hidden');
      } else {
        item.classList.add('hidden');
      }
    });
  });
});

// ── LIGHTBOX ─────────────────────────────────
const lightbox     = document.getElementById('lightbox');
const lightboxImg  = document.getElementById('lightboxImg');
const lightboxCap  = document.getElementById('lightboxCaption');
const lightboxClose = document.getElementById('lightboxClose');
const lightboxPrev = document.getElementById('lightboxPrev');
const lightboxNext = document.getElementById('lightboxNext');

let currentGalleryItems = [];
let currentIndex = 0;

function openLightbox(index) {
  currentGalleryItems = [...document.querySelectorAll('.gallery-item:not(.hidden)')];
  currentIndex = index;
  showLightboxItem(currentIndex);
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function showLightboxItem(index) {
  const item    = currentGalleryItems[index];
  const img     = item.querySelector('img');
  const caption = item.querySelector('.gallery-caption');
  lightboxImg.src = img.src;
  lightboxImg.alt = img.alt;
  lightboxCap.textContent = caption ? caption.querySelector('h4').textContent + ' — ' + caption.querySelector('p').textContent : '';
}

function closeLightbox() {
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
}

document.querySelectorAll('.gallery-item').forEach((item, i) => {
  item.addEventListener('click', () => {
    const visible = [...document.querySelectorAll('.gallery-item:not(.hidden)')];
    const visibleIdx = visible.indexOf(item);
    openLightbox(visibleIdx >= 0 ? visibleIdx : 0);
  });
});

lightboxClose.addEventListener('click', closeLightbox);
lightboxPrev.addEventListener('click', () => {
  currentIndex = (currentIndex - 1 + currentGalleryItems.length) % currentGalleryItems.length;
  showLightboxItem(currentIndex);
});
lightboxNext.addEventListener('click', () => {
  currentIndex = (currentIndex + 1) % currentGalleryItems.length;
  showLightboxItem(currentIndex);
});
lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) closeLightbox();
});
document.addEventListener('keydown', (e) => {
  if (!lightbox.classList.contains('open')) return;
  if (e.key === 'Escape')       closeLightbox();
  if (e.key === 'ArrowLeft')  { currentIndex = (currentIndex - 1 + currentGalleryItems.length) % currentGalleryItems.length; showLightboxItem(currentIndex); }
  if (e.key === 'ArrowRight') { currentIndex = (currentIndex + 1) % currentGalleryItems.length; showLightboxItem(currentIndex); }
});

// ── TRANSLATOR ───────────────────────────────
const sourceText     = document.getElementById('sourceText');
const sourceLangSel  = document.getElementById('sourceLang');
const targetLangSel  = document.getElementById('targetLang');
const translateBtn   = document.getElementById('translateBtn');
const clearBtn       = document.getElementById('clearBtn');
const copyBtn        = document.getElementById('copyBtn');
const swapBtn        = document.getElementById('swapBtn');
const charCount      = document.getElementById('charCount');
const transOutput    = document.getElementById('translationOutput');
const transStatus    = document.getElementById('translationStatus');

const MAX_CHARS = 500;

// Character counter
sourceText.addEventListener('input', () => {
  const len = sourceText.value.length;
  charCount.textContent = `${len} / ${MAX_CHARS}`;
  charCount.style.color = len > MAX_CHARS * 0.9 ? '#f87171' : 'rgba(255,255,255,0.4)';
  if (len > MAX_CHARS) {
    sourceText.value = sourceText.value.slice(0, MAX_CHARS);
    charCount.textContent = `${MAX_CHARS} / ${MAX_CHARS}`;
  }
});

// Clear button
clearBtn.addEventListener('click', () => {
  sourceText.value = '';
  transOutput.innerHTML = '<p class="output-placeholder">Translation will appear here...</p>';
  transStatus.textContent = '';
  transStatus.className = '';
  charCount.textContent = '0 / 500';
});

// Copy button
copyBtn.addEventListener('click', () => {
  const text = transOutput.innerText.trim();
  if (!text || text === 'Translation will appear here...') return;
  navigator.clipboard.writeText(text).then(() => {
    copyBtn.textContent = 'Copied!';
    setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
  });
});

// Swap languages
swapBtn.addEventListener('click', () => {
  const currentSource = sourceLangSel.value;

  if (currentSource === 'ti') {
    sourceLangSel.value = 'en';
    sourceText.classList.remove('tigrinya-text');
    sourceText.placeholder = 'Type English here...\n\nExample: Hello! How are you?';
  } else {
    sourceLangSel.value = 'ti';
    sourceText.classList.add('tigrinya-text');
    sourceText.placeholder = 'Type Tigrinya (ትግርኛ) here...\n\nExample: ሰላም! ከመይ ኣለካ?';
  }

  // Move output text to input
  const currentOutput = transOutput.innerText.trim();
  if (currentOutput && currentOutput !== 'Translation will appear here...') {
    sourceText.value = currentOutput;
    charCount.textContent = `${currentOutput.length} / ${MAX_CHARS}`;
  }
  transOutput.innerHTML = '<p class="output-placeholder">Translation will appear here...</p>';
  transStatus.textContent = '';
});

// Main translate function
async function translateText() {
  const text = sourceText.value.trim();
  if (!text) {
    transOutput.innerHTML = '<p class="output-placeholder">Please enter some text to translate.</p>';
    return;
  }

  const sourceLang = sourceLangSel.value;
  const targetLang = sourceLang === 'ti' ? 'en' : 'ti';

  // Show loading
  translateBtn.disabled = true;
  translateBtn.innerHTML = '<span class="spinner"></span>Translating...';
  transStatus.textContent = 'Translating...';
  transStatus.className = 'translating';
  transOutput.innerHTML = '<p class="output-placeholder">AI is translating...</p>';

  try {
    // Primary: MyMemory API (free, no key needed, supports Tigrinya)
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`;
    const response = await fetch(url);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();

    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      let translation = data.responseData.translatedText;

      // MyMemory sometimes returns HTML entities for non-Latin scripts
      translation = decodeHTMLEntities(translation);

      transOutput.innerHTML = '';
      const p = document.createElement('p');
      p.style.cssText = targetLang === 'ti'
        ? 'font-family: var(--font-ethiopic, serif); font-size: 1.1rem; line-height: 1.8;'
        : 'font-size: 1rem; line-height: 1.7;';
      p.textContent = translation;
      transOutput.appendChild(p);

      transStatus.textContent = '✓ Translation complete';
      transStatus.className = 'done';

      // Add to history
      addToHistory(text, translation, sourceLang, targetLang);

    } else if (data.responseStatus === 429) {
      throw new Error('Rate limit reached. Please wait a moment and try again.');
    } else {
      throw new Error(data.responseDetails || 'Translation failed');
    }

  } catch (err) {
    console.error('Translation error:', err);
    transOutput.innerHTML = `<p style="color:#f87171;">⚠ ${err.message || 'Translation service unavailable. Please try again.'}</p>`;
    transStatus.textContent = 'Error';
    transStatus.className = 'error';
  } finally {
    translateBtn.disabled = false;
    translateBtn.innerHTML = '<span class="btn-icon">🌐</span>Translate';
  }
}

function decodeHTMLEntities(text) {
  const el = document.createElement('textarea');
  el.innerHTML = text;
  return el.value;
}

translateBtn.addEventListener('click', translateText);

// Ctrl+Enter to translate
sourceText.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'Enter') translateText();
});

// Translation history (last 5)
let translationHistory = [];

function addToHistory(source, translation, srcLang, tgtLang) {
  translationHistory.unshift({ source, translation, srcLang, tgtLang });
  if (translationHistory.length > 5) translationHistory.pop();
  renderHistory();
}

function renderHistory() {
  let histEl = document.getElementById('transHistory');
  if (!histEl) {
    histEl = document.createElement('div');
    histEl.id = 'transHistory';
    histEl.style.cssText = `
      margin-top: 16px;
      border-top: 1px solid rgba(255,255,255,0.1);
      padding-top: 16px;
    `;
    const histTitle = document.createElement('p');
    histTitle.style.cssText = 'font-size: 0.78rem; color: rgba(255,255,255,0.35); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;';
    histTitle.textContent = 'Recent Translations';
    histEl.appendChild(histTitle);
    document.querySelector('.phrasebook').appendChild(histEl);
  }

  const items = histEl.querySelectorAll('.history-item');
  items.forEach(i => i.remove());

  translationHistory.forEach(item => {
    const div = document.createElement('div');
    div.className = 'history-item phrase-item';
    div.style.cssText = 'cursor: default; opacity: 0.75;';
    div.innerHTML = `
      <span class="ti" style="font-size: 0.9rem;">${escapeHtml(item.source.slice(0, 40))}${item.source.length > 40 ? '…' : ''}</span>
      <span class="en">${escapeHtml(item.translation.slice(0, 60))}${item.translation.length > 60 ? '…' : ''}</span>
    `;
    histEl.appendChild(div);
  });
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── PHRASEBOOK ───────────────────────────────
document.querySelectorAll('.phrase-item').forEach(item => {
  item.addEventListener('click', () => {
    const ti = item.getAttribute('data-ti');
    if (!ti) return;
    sourceLangSel.value = 'ti';
    sourceText.classList.add('tigrinya-text');
    sourceText.placeholder = 'Type Tigrinya (ትግርኛ) here...';
    sourceText.value = ti;
    charCount.textContent = `${ti.length} / ${MAX_CHARS}`;
    transOutput.innerHTML = '<p class="output-placeholder">Click Translate to translate this phrase...</p>';
    // Scroll to translator
    document.getElementById('translator').scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(translateText, 600);
  });
});

// ── SMOOTH SCROLL for nav links ──────────────
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      e.preventDefault();
      const offset = 70;
      const top    = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

// ── INIT ─────────────────────────────────────
document.querySelectorAll('.gallery-item').forEach(i => i.classList.remove('hidden'));

// ── SERVICE WORKER REGISTRATION ──────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('[SW] Registered, scope:', reg.scope))
      .catch(err => console.warn('[SW] Registration failed:', err));
  });
}

// ── PWA INSTALL PROMPT ───────────────────────
let deferredPrompt = null;
const installBanner  = document.getElementById('installBanner');
const installBtn     = document.getElementById('installBtn');
const installDismiss = document.getElementById('installDismiss');
const installModal   = document.getElementById('installModal');
const installNowWrap = document.getElementById('installNowWrap');
const installNowBtn  = document.getElementById('installNowBtn');
const navDownloadBtn = document.getElementById('navDownloadBtn');
const heroInstallBtn = document.getElementById('heroInstallBtn');

function openInstallModal() {
  installNowWrap.style.display = deferredPrompt ? 'block' : 'none';
  installModal.classList.add('open');
}
function closeInstallModal() {
  installModal.classList.remove('open');
}

// Collect the deferred prompt when the browser fires it
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  // Show bottom banner after 3 s (existing behaviour)
  setTimeout(() => {
    if (!localStorage.getItem('pwa-dismissed')) {
      installBanner.style.display = 'block';
    }
  }, 3000);
});

// Bottom banner buttons (existing)
installBtn.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  installBanner.style.display = 'none';
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  console.log('[PWA] Install outcome:', outcome);
  deferredPrompt = null;
});
installDismiss.addEventListener('click', () => {
  installBanner.style.display = 'none';
  localStorage.setItem('pwa-dismissed', '1');
});

// New modal "Install Now" button
installNowBtn.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  closeInstallModal();
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  console.log('[PWA] Install outcome:', outcome);
  deferredPrompt = null;
});

// Nav + Hero buttons → open modal
navDownloadBtn.addEventListener('click', openInstallModal);
heroInstallBtn.addEventListener('click', openInstallModal);

// Close modal on backdrop click or ✕
document.getElementById('installModalClose').addEventListener('click', closeInstallModal);
installModal.addEventListener('click', e => { if (e.target === installModal) closeInstallModal(); });

// Show banner again if user revisits after 7 days
const dismissed = localStorage.getItem('pwa-dismissed-time');
if (dismissed && Date.now() - parseInt(dismissed) > 7 * 24 * 60 * 60 * 1000) {
  localStorage.removeItem('pwa-dismissed');
}

// When actually installed, hide everything
window.addEventListener('appinstalled', () => {
  installBanner.style.display = 'none';
  deferredPrompt = null;
  console.log('[PWA] App installed!');
});

// ── OFFLINE / ONLINE STATUS ──────────────────
const offlineToast = document.getElementById('offlineToast');

function showOfflineToast(msg) {
  offlineToast.textContent = msg;
  offlineToast.classList.add('show');
  setTimeout(() => offlineToast.classList.remove('show'), 4000);
}

window.addEventListener('offline', () => showOfflineToast('📡 You\'re offline — the app still works!'));
window.addEventListener('online',  () => showOfflineToast('✅ Back online!'));

// ── AI CHAT WIDGET ───────────────────────────
const GEMINI_MODEL  = 'gemini-1.5-flash';
const CHAT_SYSTEM   = `You are "Eritrea AI Guide", the assistant for the Eritrean Info website.
You are an expert on everything about Eritrea: its ancient and modern history, the 30-year
independence struggle, culture, the 9 ethnic groups, Tigrinya and other languages, geography
(highlands, lowlands, Red Sea coast), economy, government, cuisine, music, religion, and more.
Answer every question warmly, accurately, and concisely (2–4 sentences unless more is needed).
Use occasional Tigrinya phrases with translations to make responses feel authentic.
If someone asks about something unrelated to Eritrea, give a brief helpful answer then gently
invite them to ask about Eritrea.`;

const chatToggle   = document.getElementById('chatToggle');
const chatPanel    = document.getElementById('chatPanel');
const chatMessages = document.getElementById('chatMessages');
const chatInput    = document.getElementById('chatInput');
const chatSend     = document.getElementById('chatSend');
const chatClear    = document.getElementById('chatClear');
const chatKeyBtn   = document.getElementById('chatKeyBtn');
const chatStatus   = document.getElementById('chatStatus');
const apiModal     = document.getElementById('apiModal');
const apiKeyInput  = document.getElementById('apiKeyInput');
const apiKeySave   = document.getElementById('apiKeySave');
const apiKeyCancel = document.getElementById('apiKeyCancel');

let chatOpen    = false;
let chatHistory = [];
let chatBusy    = false;

// Open / close
chatToggle.addEventListener('click', () => {
  chatOpen = !chatOpen;
  chatPanel.classList.toggle('open', chatOpen);
  chatToggle.classList.toggle('open', chatOpen);
  chatToggle.querySelector('.chat-icon').style.display      = chatOpen ? 'none' : '';
  chatToggle.querySelector('.chat-close-icon').style.display = chatOpen ? ''     : 'none';
  if (chatOpen) {
    chatInput.focus();
    scrollChat();
    const dot = chatToggle.querySelector('.chat-notif');
    if (dot) dot.remove();
  }
});

// Send on button click or Enter
chatSend.addEventListener('click', sendMessage);
chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

// Clear chat
chatClear.addEventListener('click', () => {
  chatHistory = [];
  chatMessages.innerHTML = '';
  addBubble('bot', 'Selam! 👋 Chat cleared — ask me anything about Eritrea!');
});

// Change key button
chatKeyBtn.addEventListener('click', () => openApiModal());

// API modal — save
apiKeySave.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  if (!key) { apiKeyInput.focus(); return; }
  localStorage.setItem('gemini-api-key', key);
  apiKeyInput.value = '';
  closeApiModal();
  sendMessage();
});
apiKeyCancel.addEventListener('click', closeApiModal);
apiModal.addEventListener('click', e => { if (e.target === apiModal) closeApiModal(); });

function openApiModal(prefill) {
  if (prefill) apiKeyInput.value = prefill;
  apiModal.classList.add('open');
  apiKeyInput.focus();
}
function closeApiModal() { apiModal.classList.remove('open'); }

// ── Core send function ────────────────────────
async function sendMessage() {
  if (chatBusy) return;
  const text = chatInput.value.trim();
  if (!text) return;

  const key = localStorage.getItem('gemini-api-key');
  if (!key) { openApiModal(); return; }

  addBubble('user', text);
  chatHistory.push({ role: 'user', parts: [{ text }] });
  chatInput.value = '';
  chatBusy = true;
  chatSend.disabled = true;
  chatStatus.textContent = 'Thinking…';

  const typingEl = addTypingIndicator();

  try {
    const body = {
      system_instruction: { parts: [{ text: CHAT_SYSTEM }] },
      contents: chatHistory,
      generationConfig: { maxOutputTokens: 450, temperature: 0.72 }
    };
    const res  = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );
    const data = await res.json();

    if (!res.ok) {
      const msg = data?.error?.message || `Error ${res.status}`;
      if (res.status === 400 || msg.includes('API_KEY_INVALID')) {
        throw new Error('Invalid API key — click 🔑 to update it.');
      }
      throw new Error(msg);
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text
                  || 'Sorry, I could not generate a response. Please try again.';
    chatHistory.push({ role: 'model', parts: [{ text: reply }] });
    typingEl.remove();
    addBubble('bot', reply);
    chatStatus.textContent = 'Ask me anything';

  } catch (err) {
    typingEl.remove();
    addBubble('error', '⚠ ' + (err.message || 'Translation service unavailable.'));
    chatStatus.textContent = 'Error — try again';
  } finally {
    chatBusy = false;
    chatSend.disabled = false;
    chatInput.focus();
  }
}

function addBubble(role, text) {
  const wrap   = document.createElement('div');
  wrap.className = `chat-message ${role === 'error' ? 'bot error' : role}`;
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  bubble.textContent = text;
  wrap.appendChild(bubble);
  chatMessages.appendChild(wrap);
  scrollChat();
  return wrap;
}

function addTypingIndicator() {
  const wrap = document.createElement('div');
  wrap.className = 'chat-message bot';
  wrap.innerHTML = '<div class="chat-typing"><span></span><span></span><span></span></div>';
  chatMessages.appendChild(wrap);
  scrollChat();
  return wrap;
}

function scrollChat() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Show notification dot after 6 s if chat still closed
setTimeout(() => {
  if (!chatOpen && !chatToggle.querySelector('.chat-notif')) {
    const dot = document.createElement('div');
    dot.className = 'chat-notif';
    chatToggle.appendChild(dot);
  }
}, 6000);

// ── NATIONAL ANTHEM PLAYER ───────────────────
const anthemAudio     = document.getElementById('anthemAudio');
const anthemPlayBtn   = document.getElementById('anthemPlay');
const anthemBarPlayBtn= document.getElementById('anthemBarPlay');
const anthemBarToggle = document.getElementById('anthemBarToggle');
const anthemPanelEl   = document.getElementById('anthemPanel');
const anthemFill      = document.getElementById('anthemFill');
const anthemTrack     = document.getElementById('anthemTrack');
const anthemCurEl     = document.getElementById('anthemCur');
const anthemDurEl     = document.getElementById('anthemDur');

let anthemExpanded = false;

function anthemTogglePlay() {
  if (anthemAudio.paused) {
    anthemAudio.play();
  } else {
    anthemAudio.pause();
  }
}

function anthemFmt(s) {
  return Math.floor(s / 60) + ':' + Math.floor(s % 60).toString().padStart(2, '0');
}

function anthemSetPlayIcon(playing) {
  const icon = playing ? '&#9646;&#9646;' : '&#9654;';
  anthemPlayBtn.innerHTML    = icon;
  anthemBarPlayBtn.innerHTML = icon;
}

anthemAudio.addEventListener('play',  () => anthemSetPlayIcon(true));
anthemAudio.addEventListener('pause', () => anthemSetPlayIcon(false));
anthemAudio.addEventListener('ended', () => anthemSetPlayIcon(false));

anthemAudio.addEventListener('loadedmetadata', () => {
  anthemDurEl.textContent = anthemFmt(anthemAudio.duration);
});

anthemAudio.addEventListener('timeupdate', () => {
  if (!anthemAudio.duration) return;
  const pct = (anthemAudio.currentTime / anthemAudio.duration) * 100;
  anthemFill.style.width    = pct + '%';
  anthemCurEl.textContent   = anthemFmt(anthemAudio.currentTime);
  anthemDurEl.textContent   = anthemFmt(anthemAudio.duration);
});

anthemTrack.addEventListener('click', e => {
  if (!anthemAudio.duration) return;
  const r = anthemTrack.getBoundingClientRect();
  anthemAudio.currentTime = ((e.clientX - r.left) / r.width) * anthemAudio.duration;
});

anthemPlayBtn.addEventListener('click',    anthemTogglePlay);
anthemBarPlayBtn.addEventListener('click', anthemTogglePlay);

anthemBarToggle.addEventListener('click', () => {
  anthemExpanded = !anthemExpanded;
  anthemPanelEl.classList.toggle('open', anthemExpanded);
  anthemBarToggle.innerHTML = anthemExpanded ? '&#9650;' : '&#9660;';
});

// ── DARK MODE ─────────────────────────────────
const darkToggleBtn = document.getElementById('darkToggle');

function applyDarkMode(dark) {
  document.documentElement.classList.toggle('dark', dark);
  darkToggleBtn.textContent = dark ? '☀️' : '🌙';
  darkToggleBtn.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
}

applyDarkMode(localStorage.getItem('eri_dark') === 'true');

darkToggleBtn.addEventListener('click', () => {
  const nowDark = !document.documentElement.classList.contains('dark');
  applyDarkMode(nowDark);
  localStorage.setItem('eri_dark', nowDark);
});

// ── LANGUAGE PICKER ───────────────────────────
const langPickerBtn    = document.getElementById('langPickerBtn');
const langPickerWrap   = document.getElementById('langPickerWrap');
const langDropdown     = document.getElementById('langDropdown');
const currentLangLabel = document.getElementById('currentLangLabel');

langPickerBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (langDropdown.hasAttribute('hidden')) {
    langDropdown.removeAttribute('hidden');
  } else {
    langDropdown.setAttribute('hidden', '');
  }
});

document.addEventListener('click', (e) => {
  if (!langPickerWrap.contains(e.target)) langDropdown.setAttribute('hidden', '');
});

function triggerGoogleTranslate(langCode) {
  const sel = document.querySelector('.goog-te-combo');
  if (!sel) return;
  sel.value = langCode;
  sel.dispatchEvent(new Event('change'));
}

document.querySelectorAll('.lang-opt').forEach(btn => {
  btn.addEventListener('click', () => {
    const lang  = btn.getAttribute('data-lang');
    const label = btn.getAttribute('data-label');
    document.querySelectorAll('.lang-opt').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentLangLabel.textContent = label;
    langDropdown.setAttribute('hidden', '');
    localStorage.setItem('eri_lang', lang);
    localStorage.setItem('eri_lang_label', label);
    if (lang === 'en') {
      const iframe = document.querySelector('.goog-te-banner-frame');
      const closeBtn = iframe?.contentDocument?.querySelector('.goog-close-link');
      if (closeBtn) closeBtn.click();
      else triggerGoogleTranslate('');
    } else {
      triggerGoogleTranslate(lang);
    }
  });
});

window.addEventListener('load', () => {
  const savedLang  = localStorage.getItem('eri_lang');
  const savedLabel = localStorage.getItem('eri_lang_label');
  if (savedLang && savedLang !== 'en') {
    currentLangLabel.textContent = savedLabel || savedLang.toUpperCase();
    document.querySelectorAll('.lang-opt').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-lang') === savedLang);
    });
    setTimeout(() => triggerGoogleTranslate(savedLang), 1800);
  }
});

// ── WORLD SEARCH ──────────────────────────────
const wsInput      = document.getElementById('wsInput');
const wsBtn        = document.getElementById('wsBtn');
const wsResult     = document.getElementById('wsResult');
const wsResultQ    = document.getElementById('wsResultQ');
const wsResultBody = document.getElementById('wsResultBody');
const wsClose      = document.getElementById('wsClose');
const wsNewSearch  = document.getElementById('wsNewSearch');

const WS_SEARCH_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`;

async function doWorldSearch(query) {
  query = query.trim();
  if (!query) return;

  wsResultQ.textContent = query;
  wsResultBody.innerHTML = `<div class="ws-loading"><span class="spinner" style="width:18px;height:18px;border-width:2px;border-color:rgba(255,255,255,0.15);border-top-color:#4189DD"></span> Searching…</div>`;
  wsResult.removeAttribute('hidden');
  wsBtn.disabled = true;
  wsBtn.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px;border-color:rgba(255,255,255,0.2);border-top-color:#fff"></span> Searching…`;
  wsResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  // Update footer source label
  const poweredEl = document.querySelector('.ws-powered');

  try {
    const geminiKey = localStorage.getItem('gemini-api-key');

    if (geminiKey) {
      // ── Gemini path (if key saved) ──
      if (poweredEl) poweredEl.textContent = 'Powered by Gemini AI';
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `Answer this question clearly and informatively in 3-5 paragraphs using simple, engaging language. Question: ${query}` }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 800 }
          })
        }
      );
      if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!text) throw new Error('empty');
      wsResultBody.innerHTML = text
        .split(/\n\n+/).filter(p => p.trim())
        .map(p => `<p>${p.trim().replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>')}</p>`)
        .join('');
      return;
    }

    // ── Wikipedia path (no key needed) ──
    if (poweredEl) poweredEl.textContent = 'Powered by Wikipedia — free, no account needed';

    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=3`
    );
    const searchData = await searchRes.json();
    const hits = searchData.query?.search;
    if (!hits || hits.length === 0) {
      wsResultBody.innerHTML = `<p style="color:rgba(255,255,255,0.55)">No results found for "<em>${query}</em>". Try rephrasing your question.</p>`;
      return;
    }

    const title = hits[0].title;
    const extractRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=true&explaintext=true&titles=${encodeURIComponent(title)}&format=json&origin=*`
    );
    const extractData = await extractRes.json();
    const pages = extractData.query?.pages;
    const page  = pages ? Object.values(pages)[0] : null;
    const extract = page?.extract || '';

    if (!extract) {
      wsResultBody.innerHTML = `<p style="color:rgba(255,255,255,0.55)">Couldn't load article content. Try a more specific search.</p>`;
      return;
    }

    const paras = extract.split('\n').filter(p => p.trim().length > 40).slice(0, 5);
    wsResultBody.innerHTML =
      paras.map(p => `<p>${p.trim()}</p>`).join('') +
      `<p style="margin-top:16px"><a href="https://en.wikipedia.org/wiki/${encodeURIComponent(title)}" target="_blank" rel="noopener" style="color:#4189DD;text-decoration:underline;font-size:0.875rem">Read full article on Wikipedia →</a></p>`;

  } catch (err) {
    wsResultBody.innerHTML = `<p style="color:#f87171">⚠️ Search failed: ${err.message}. Please try again.</p>`;
  } finally {
    wsBtn.disabled = false;
    wsBtn.innerHTML = `${WS_SEARCH_ICON} Search`;
  }
}

wsBtn.addEventListener('click', () => doWorldSearch(wsInput.value));
wsInput.addEventListener('keydown', e => { if (e.key === 'Enter') doWorldSearch(wsInput.value); });

document.querySelectorAll('.ws-topic').forEach(btn => {
  btn.addEventListener('click', () => {
    const q = btn.getAttribute('data-q');
    wsInput.value = q;
    doWorldSearch(q);
  });
});

wsClose.addEventListener('click', () => {
  wsResult.setAttribute('hidden', '');
  wsInput.value = '';
});

wsNewSearch.addEventListener('click', () => {
  wsResult.setAttribute('hidden', '');
  wsInput.value = '';
  wsInput.focus();
  document.getElementById('world-search').scrollIntoView({ behavior: 'smooth' });
});

// ── COMMUNITY ────────────────────────────────
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function loadCommunityPosts() {
  const grid = document.getElementById('communityPostsGrid');
  grid.innerHTML = '<div class="community-loading">Loading posts…</div>';
  try {
    const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
    const { getFirestore, collection, query, where, orderBy, getDocs } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
    const db  = getFirestore(app);
    const q   = query(
      collection(db, 'community_posts'),
      where('status', '==', 'approved'),
      orderBy('approvedAt', 'desc')
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      grid.innerHTML = '<p class="community-empty">No community posts yet — be the first to share your story!</p>';
      return;
    }
    grid.innerHTML = '';
    snap.forEach(doc => {
      const d = doc.data();
      const tags = Array.isArray(d.tags) ? d.tags.filter(Boolean) : [];
      const date = d.approvedAt?.toDate ? d.approvedAt.toDate().toLocaleDateString('en-GB', { year:'numeric', month:'short', day:'numeric' }) : '';
      grid.insertAdjacentHTML('beforeend', `
        <div class="community-post-card">
          ${d.imageUrl ? `<div class="cp-img-wrap"><img src="${escHtml(d.imageUrl)}" alt="${escHtml(d.title)}" loading="lazy" /></div>` : ''}
          <div class="cp-body">
            <h3 class="cp-title">${escHtml(d.title)}</h3>
            <p class="cp-text">${escHtml(d.body)}</p>
            <div class="cp-meta">
              <span class="cp-author">✍️ ${escHtml(d.authorName || 'Anonymous')}</span>
              ${date ? `<span class="cp-date">${escHtml(date)}</span>` : ''}
            </div>
            ${tags.length ? `<div class="cp-tags">${tags.map(t => `<span class="cp-tag">${escHtml(t)}</span>`).join('')}</div>` : ''}
          </div>
        </div>
      `);
    });
  } catch (err) {
    grid.innerHTML = '<p class="community-empty">Unable to load posts right now.</p>';
    console.error('Community load error:', err);
  }
}

// Lazy-load community posts when section scrolls into view
const communitySection = document.getElementById('community');
let communityLoaded = false;
const communityObserver = new IntersectionObserver(entries => {
  if (entries[0].isIntersecting && !communityLoaded) {
    communityLoaded = true;
    loadCommunityPosts();
  }
}, { threshold: 0.1 });
communityObserver.observe(communitySection);

// Submit modal
const communityModal      = document.getElementById('communityModal');
const communityModalClose = document.getElementById('communityModalClose');
const communityModalCancel= document.getElementById('communityModalCancel');
const communityModalSubmit= document.getElementById('communityModalSubmit');
const shareStoryFloat     = document.getElementById('shareStoryFloat');

function openCommunityModal() { communityModal.removeAttribute('hidden'); document.body.style.overflow = 'hidden'; }
function closeCommunityModal() { communityModal.setAttribute('hidden', ''); document.body.style.overflow = ''; }

shareStoryFloat.addEventListener('click', openCommunityModal);
communityModalClose.addEventListener('click', closeCommunityModal);
communityModalCancel.addEventListener('click', closeCommunityModal);
communityModal.addEventListener('click', e => { if (e.target === communityModal) closeCommunityModal(); });

// ── COMMUNITY TABS ───────────────────────────
document.querySelectorAll('.comm-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.comm-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.comm-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const panel = document.getElementById('commPanel' + tab.dataset.ctab.charAt(0).toUpperCase() + tab.dataset.ctab.slice(1));
    if (panel) panel.classList.add('active');
    if (tab.dataset.ctab === 'travel') renderTravelGuide();
  });
});

// ── TRAVEL GUIDE ─────────────────────────────
const TRAVEL_DATA = [
  { flag:'🇺🇸', country:'United States', cities:['Washington DC','New York','Atlanta','Los Angeles'], airlines:'Ethiopian Airlines, EgyptAir, Emirates', duration:'18–22 hrs', tip:'Fly via Addis Ababa (ADD) or Cairo (CAI). Ethiopian Airlines has the most direct connection to Asmara (ASM).' },
  { flag:'🇬🇧', country:'United Kingdom', cities:['London Heathrow (LHR)'], airlines:'Ethiopian Airlines, EgyptAir, Turkish Airlines', duration:'11–14 hrs', tip:'Connect via Addis Ababa or Cairo. Ethiopian Airlines flies LHR–ADD–ASM with the best schedule.' },
  { flag:'🇩🇪', country:'Germany', cities:['Frankfurt (FRA)','Berlin (BER)'], airlines:'Ethiopian Airlines, EgyptAir, Lufthansa+partner', duration:'10–14 hrs', tip:'Frankfurt is the main European hub for East Africa connections. Fly via Addis Ababa or Cairo.' },
  { flag:'🇮🇹', country:'Italy', cities:['Rome Fiumicino (FCO)','Milan (MXP)'], airlines:'Ethiopian Airlines, ITA Airways+partner', duration:'8–12 hrs', tip:'Shortest connection in Europe — strong historical ties. Rome to Asmara via Addis Ababa.' },
  { flag:'🇸🇪', country:'Sweden', cities:['Stockholm Arlanda (ARN)'], airlines:'Ethiopian Airlines, SAS+partner', duration:'11–15 hrs', tip:'Large Eritrean diaspora in Sweden. Connect via Addis Ababa or Frankfurt to Asmara.' },
  { flag:'🇳🇱', country:'Netherlands', cities:['Amsterdam Schiphol (AMS)'], airlines:'Ethiopian Airlines, KLM+Ethiopian codeshare', duration:'11–14 hrs', tip:'Connect via Addis Ababa. KLM and Ethiopian codeshare makes booking straightforward.' },
  { flag:'🇦🇺', country:'Australia', cities:['Sydney (SYD)','Melbourne (MEL)'], airlines:'Ethiopian Airlines, Emirates', duration:'22–26 hrs', tip:'Long journey — consider a stopover in Dubai (DXB) or Addis Ababa. Emirates via Dubai is popular.' },
  { flag:'🇨🇦', country:'Canada', cities:['Toronto (YYZ)','Ottawa (YOW)','Calgary (YYC)'], airlines:'Ethiopian Airlines, EgyptAir', duration:'18–24 hrs', tip:'Large Eritrean community in Ottawa and Toronto. Fly via Addis Ababa or Cairo.' },
  { flag:'🇦🇪', country:'UAE', cities:['Dubai (DXB)','Abu Dhabi (AUH)'], airlines:'Emirates, Air Arabia, flydubai, Eritrean Airlines', duration:'3–4 hrs', tip:'Closest major hub to Eritrea. Multiple daily flights across the Red Sea. Best transit point globally.' },
  { flag:'🇸🇦', country:'Saudi Arabia', cities:['Jeddah (JED)','Riyadh (RUH)'], airlines:'Eritrean Airlines, flynas, flydubai', duration:'2–3 hrs', tip:'Short Red Sea crossing. Jeddah is closest to Massawa. Multiple weekly connections available.' },
  { flag:'🇸🇩', country:'Sudan', cities:['Khartoum (KRT)'], airlines:'Eritrean Airlines, Sudan Airways', duration:'1–2 hrs', tip:'Neighboring country — short flight or land border crossing. Check current border status.' },
  { flag:'🇪🇹', country:'Ethiopia', cities:['Addis Ababa (ADD)'], airlines:'Ethiopian Airlines, Eritrean Airlines', duration:'~1 hr', tip:'Main hub for ALL international connections to Asmara. Multiple daily flights, best prices from here.' },
  { flag:'🇫🇷', country:'France', cities:['Paris CDG'], airlines:'Ethiopian Airlines, Air France+partner', duration:'10–13 hrs', tip:'Growing Eritrean community in Paris. Connect via Addis Ababa. Air France codeshares with Ethiopian.' },
  { flag:'🇳🇴', country:'Norway', cities:['Oslo Gardermoen (OSL)'], airlines:'Ethiopian Airlines, SAS+partner', duration:'11–15 hrs', tip:'Significant Eritrean population in Oslo. Connect via Addis Ababa or Frankfurt.' },
  { flag:'🇩🇰', country:'Denmark', cities:['Copenhagen (CPH)'], airlines:'Ethiopian Airlines', duration:'11–14 hrs', tip:'Connect via Addis Ababa. Copenhagen–Frankfurt–Addis–Asmara is a popular route.' },
  { flag:'🇨🇭', country:'Switzerland', cities:['Geneva (GVA)','Zurich (ZRH)'], airlines:'Ethiopian Airlines, SWISS+partner', duration:'10–13 hrs', tip:'Geneva hosts major UN agencies with Eritrean delegates. Connect via Addis Ababa.' },
  { flag:'🇸🇬', country:'Singapore', cities:['Singapore Changi (SIN)'], airlines:'Singapore Airlines+partner, Emirates', duration:'14–18 hrs', tip:'Connect via Dubai or Addis Ababa. Singapore is a great stopover for long-haul flights.' },
  { flag:'🇯🇵', country:'Japan', cities:['Tokyo Narita (NRT)'], airlines:'Ethiopian Airlines, Emirates', duration:'18–22 hrs', tip:'Connect via Addis Ababa or Dubai. Ethiopian Airlines offers a Tokyo–Addis–Asmara connection.' },
];

let travelRendered = false;
function renderTravelGuide() {
  if (travelRendered) return;
  travelRendered = true;
  const grid = document.getElementById('travelGuideGrid');
  grid.innerHTML = '';
  TRAVEL_DATA.forEach(d => {
    const card = document.createElement('div');
    card.className = 'travel-card';
    card.innerHTML = `
      <div class="travel-card-header">
        <span class="travel-flag">${d.flag}</span>
        <div class="travel-card-info">
          <div class="travel-country">${d.country}</div>
          <div class="travel-duration">✈️ ${d.duration} to ASM</div>
        </div>
        <span class="travel-chevron">▼</span>
      </div>
      <div class="travel-card-body">
        <div class="travel-detail"><strong>Hub cities:</strong> ${d.cities.join(', ')}</div>
        <div class="travel-detail"><strong>Airlines:</strong> ${d.airlines}</div>
        <div class="travel-detail">${d.tip}</div>
        <div class="travel-hubs">${d.cities.map(c => `<span class="travel-hub">${c}</span>`).join('')}</div>
      </div>
    `;
    card.addEventListener('click', () => {
      const isOpen = card.classList.contains('open');
      document.querySelectorAll('.travel-card.open').forEach(c => c.classList.remove('open'));
      if (!isOpen) card.classList.add('open');
    });
    grid.appendChild(card);
  });
}

communityModalSubmit.addEventListener('click', async () => {
  const name  = document.getElementById('cmName').value.trim();
  const title = document.getElementById('cmTitle').value.trim();
  const body  = document.getElementById('cmBody').value.trim();
  const img   = document.getElementById('cmImageUrl').value.trim();
  const tagsRaw = document.getElementById('cmTags').value;
  const status  = document.getElementById('cmStatus');

  if (!name || !title || !body) {
    status.textContent = 'Please fill in your name, title, and story.';
    status.style.color = '#e53e3e';
    return;
  }

  const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
  communityModalSubmit.disabled = true;
  status.textContent = 'Submitting…';
  status.style.color = '';

  try {
    const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
    const { getFirestore, collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
    const db  = getFirestore(app);
    await addDoc(collection(db, 'community_posts'), {
      authorName:  name,
      title,
      body,
      imageUrl:    img || '',
      tags,
      status:      'pending',
      source:      'community',
      submittedAt: serverTimestamp()
    });
    status.textContent = '✅ Story submitted! It will appear after admin review.';
    status.style.color = '#38a169';
    document.getElementById('cmName').value  = '';
    document.getElementById('cmTitle').value = '';
    document.getElementById('cmBody').value  = '';
    document.getElementById('cmImageUrl').value = '';
    document.getElementById('cmTags').value  = '';
    setTimeout(closeCommunityModal, 2500);
  } catch (err) {
    status.textContent = 'Submission failed — please try again.';
    status.style.color = '#e53e3e';
    console.error('Community submit error:', err);
  } finally {
    communityModalSubmit.disabled = false;
  }
});

// ── ABOUT FOOTER ──────────────────────────────────────────
(async function loadAboutFooter() {
  const socialDefs = [
    ['instagram', '📸', 'Instagram', 'instagram.com'],
    ['tiktok',    '🎵', 'TikTok',    'tiktok.com'],
    ['youtube',   '▶️', 'YouTube',   'youtube.com'],
    ['facebook',  '👥', 'Facebook',  'facebook.com'],
    ['twitter',   '🐦', 'Twitter/X', 'x.com'],
    ['telegram',  '✈️', 'Telegram',  't.me'],
  ];
  try {
    const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
    const { getFirestore, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const app  = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
    const db   = getFirestore(app);
    const snap = await getDoc(doc(db, 'hub_settings', 'about'));
    if (!snap.exists()) return;
    const d = snap.data();

    // Update brand
    const nameEl = document.getElementById('aboutFooterName');
    const descEl = document.getElementById('aboutFooterDesc');
    const logoEl = document.getElementById('aboutFooterLogo');
    if (d.name && nameEl) nameEl.textContent = d.name;
    if (d.description && descEl) descEl.textContent = d.description;
    if (d.logo && logoEl) {
      logoEl.innerHTML = `<img src="${d.logo}" alt="${d.name || 'Logo'}" style="width:80px;height:80px;border-radius:20px;object-fit:cover;border:3px solid rgba(255,255,255,0.2)"/>`;
    }

    // Contact links
    const contactLinks = [
      d.email   && `<a href="mailto:${d.email}" class="about-footer-link">✉️ ${d.email}</a>`,
      d.phone   && `<a href="tel:${d.phone}"   class="about-footer-link">📞 ${d.phone}</a>`,
      d.website && `<a href="${d.website}" target="_blank" rel="noopener" class="about-footer-link">🌐 Website</a>`,
    ].filter(Boolean);
    if (contactLinks.length) {
      const contactWrap = document.getElementById('aboutFooterContact');
      const contactEl   = document.getElementById('aboutFooterContactLinks');
      if (contactWrap) contactWrap.style.display = '';
      if (contactEl)   contactEl.innerHTML = contactLinks.join('');
    }

    // Social links
    const activeSocials = socialDefs.filter(([key]) => d.socials?.[key]);
    if (activeSocials.length) {
      const socialWrap = document.getElementById('aboutFooterSocial');
      const socialEl   = document.getElementById('aboutFooterSocialLinks');
      if (socialWrap) socialWrap.style.display = '';
      if (socialEl) socialEl.innerHTML = activeSocials.map(([key, ico, label, domain]) => {
        const h   = d.socials[key];
        const url = h.startsWith('http') ? h : `https://${domain}/${h.replace(/^@/, '')}`;
        return `<a href="${url}" target="_blank" rel="noopener" class="about-footer-social-btn">${ico}<span>${label}</span></a>`;
      }).join('');
    }
  } catch(e) { console.warn('[About footer]', e); }
})();

// ── MONETIZE (sponsors, donation, bio links) ──────────────
(async function loadEriMonetize() {
  try {
    const [appMod, fsMod] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'),
    ]);
    const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(FIREBASE_CONFIG);
    const db  = fsMod.getFirestore(app);

    const monSnap = await fsMod.getDoc(fsMod.doc(db, 'hub_settings', 'monetize'));
    if (monSnap.exists()) {
      const m   = monSnap.data();
      const don = m.donation || {};

      // Donation bar
      if (don.enabled !== false) {
        const bar = document.getElementById('eriDonateBar');
        if (bar) bar.style.display = '';
        const msgEl = document.getElementById('eriDonateMsg');
        if (msgEl && don.message) msgEl.textContent = don.message;
        const linksEl = document.getElementById('eriDonateLinks');
        if (linksEl) {
          const defs = [
            [don.paypal,   '💳', 'PayPal',   don.paypal],
            [don.cashapp,  '💵', 'Cash App', don.cashapp ? `https://cash.app/${don.cashapp.replace(/^\$/,'')}` : ''],
            [don.venmo,    '🏦', 'Venmo',    don.venmo   ? `https://venmo.com/${don.venmo.replace(/^@/,'')}` : ''],
            [don.kofi,     '☕', 'Ko-fi',    don.kofi],
            [don.patreon,  '🎨', 'Patreon',  don.patreon],
            [don.gofundme, '❤️', 'GoFundMe', don.gofundme],
          ].filter(([val]) => val);
          linksEl.innerHTML = defs.map(([, ico, label, url]) =>
            `<a href="${url}" target="_blank" rel="noopener" class="eri-donate-btn">${ico} ${label}</a>`
          ).join('');
        }
      }

      // Bio links
      const links = m.links || [];
      if (links.length) {
        const col = document.getElementById('aboutFooterLinksCol');
        if (col) col.style.display = '';
        const bioEl = document.getElementById('aboutFooterBioLinks');
        if (bioEl) {
          bioEl.innerHTML = links.map(l =>
            `<a href="${l.url}" target="_blank" rel="noopener" class="eri-bio-link">
               <span>${l.emoji || '🔗'}</span> ${l.title}
             </a>`
          ).join('');
        }
      }
    }

    // Sponsors
    const spSnap = await fsMod.getDocs(
      fsMod.query(fsMod.collection(db, 'hub_sponsors'),
        fsMod.where('status', '==', 'active'),
        fsMod.where('targetApp', 'in', ['all', 'eritreaninfo'])
      )
    );
    if (!spSnap.empty) {
      const strip = document.getElementById('eriSponsorStrip');
      if (strip) {
        strip.style.display = '';
        const sponsors = spSnap.docs.map(d => d.data());
        strip.innerHTML = `<div class="eri-sponsor-label">Our Sponsors</div>` +
          sponsors.map(s => `
            <a href="${s.link}" target="_blank" rel="noopener" class="eri-sponsor-item">
              ${s.logo ? `<img src="${s.logo}" alt="${s.name}" class="eri-sp-logo"/>` : ''}
              <div class="eri-sp-name">${s.name}</div>
            </a>`).join('');
      }
    }
  } catch(e) { console.warn('[EriMonetize]', e); }
})();

// ── READING PROGRESS BAR ─────────────────────────────────
const readingBar = document.getElementById('readingProgress');
if (readingBar) {
  window.addEventListener('scroll', () => {
    const total = document.documentElement.scrollHeight - window.innerHeight;
    readingBar.style.width = total > 0 ? Math.min(100, Math.round((window.scrollY / total) * 100)) + '%' : '0%';
  }, { passive: true });
}

// ── COPY FACT CARDS ON CLICK ─────────────────────────────
(function initCopyFacts() {
  function eriToast(msg) {
    let t = document.getElementById('eriCopyToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'eriCopyToast';
      t.className = 'eri-copy-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  document.querySelectorAll('.fact-card').forEach(card => {
    card.style.cursor = 'pointer';
    card.title = 'Click to copy';
    card.addEventListener('click', () => {
      const label = card.querySelector('.fact-label')?.textContent?.trim() || '';
      const value = card.querySelector('.fact-value')?.textContent?.trim() || '';
      navigator.clipboard?.writeText(`${label}: ${value}`).then(() => eriToast(`📋 Copied: ${label}`));
    });
  });
})();

// ── SECTION SHARE BUTTONS ────────────────────────────────
(function initSectionShare() {
  document.querySelectorAll('section[id]').forEach(section => {
    if (!section.id || section.id === 'hero') return;
    const heading = section.querySelector('h2, h3, .section-title, .sect-title');
    if (!heading) return;
    const btn = document.createElement('button');
    btn.className = 'section-share-btn';
    btn.innerHTML = '🔗';
    btn.title = 'Copy link to this section';
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const url = `${location.origin}${location.pathname}#${section.id}`;
      navigator.clipboard?.writeText(url).then(() => {
        btn.innerHTML = '✓';
        btn.style.color = '#10b981';
        setTimeout(() => { btn.innerHTML = '🔗'; btn.style.color = ''; }, 1800);
      });
    });
    heading.style.position = 'relative';
    heading.appendChild(btn);
  });
})();

// ── KEYBOARD SHORTCUT: '/' to focus world search ─────────
document.addEventListener('keydown', e => {
  if (e.key !== '/') return;
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  e.preventDefault();
  const si = document.getElementById('worldSearchInput') || document.querySelector('.world-search input');
  if (si) { si.focus(); si.select(); }
});

// ── NEWS FEED ────────────────────────────────────────────
(async function loadNewsSection() {
  const grid = document.getElementById('newsGrid');
  if (!grid) return;
  try {
    const [appMod, fsMod] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'),
    ]);
    const app = appMod.getApps().length ? appMod.getApps()[0] : appMod.initializeApp(FIREBASE_CONFIG);
    const db  = fsMod.getFirestore(app);
    const q   = fsMod.query(
      fsMod.collection(db, 'eri_news'),
      fsMod.where('status', '==', 'published'),
      fsMod.orderBy('publishedAt', 'desc'),
      fsMod.limit(6)
    );
    const snap = await fsMod.getDocs(q);
    if (snap.empty) {
      grid.innerHTML = '<p class="news-empty">No news articles yet — check back soon!</p>';
      return;
    }
    grid.innerHTML = '';
    snap.forEach(doc => {
      const d = doc.data();
      const date = d.publishedAt?.toDate ? d.publishedAt.toDate().toLocaleDateString('en-GB', { year:'numeric', month:'short', day:'numeric' }) : '';
      grid.insertAdjacentHTML('beforeend', `
        <div class="news-card">
          ${d.imageUrl ? `<div class="news-img-wrap"><img src="${escHtml(d.imageUrl)}" alt="${escHtml(d.title)}" loading="lazy"/></div>` : ''}
          <div class="news-body">
            ${d.tag ? `<span class="news-tag">${escHtml(d.tag)}</span>` : ''}
            <h3 class="news-title">${escHtml(d.title)}</h3>
            <p class="news-excerpt">${escHtml((d.excerpt || d.body || '').slice(0, 160))}…</p>
            <div class="news-meta">
              ${date ? `<span class="news-date">📅 ${date}</span>` : ''}
              ${d.source ? `<span class="news-source">• ${escHtml(d.source)}</span>` : ''}
            </div>
            ${d.link ? `<a href="${escHtml(d.link)}" target="_blank" rel="noopener" class="news-read-more">Read more →</a>` : ''}
          </div>
        </div>
      `);
    });
  } catch (err) {
    grid.innerHTML = '<p class="news-empty">News unavailable right now.</p>';
    console.warn('[News]', err);
  }
})();

// ── REGIONS MAP ──────────────────────────────────────────
const REGIONS_DATA = [
  { id:'maekel',   name:'Maekel',               sub:'Central Region',        emoji:'🏙️', color:'#007A3D',
    capital:'Asmara', pop:'~900,000', area:'2,100 km²', climate:'Cool highland 15–22°C', people:'Predominantly Tigrinya',
    desc:'The Central Region contains the capital Asmara — a UNESCO World Heritage City renowned for its Modernist architecture. Home to the national government, major universities, and the main international airport.',
    highlights:['Asmara — UNESCO World Heritage City','National Museum of Eritrea','Asmara International Airport (ASM)','Fiat Tagliero Building (1938)','Art Deco cafés and opera house'] },
  { id:'debub',    name:'Debub',                 sub:'Southern Region',       emoji:'⛰️', color:'#4189DD',
    capital:'Mendefera', pop:'~450,000', area:'8,000 km²', climate:'Highland, seasonal rains', people:'Tigrinya, Saho',
    desc:'The Southern Region borders Ethiopia and features important Aksumite archaeological sites. The ruins of Qohaito stand as testament to Eritrea\'s ancient civilization.',
    highlights:['Qohaito Ancient Archaeological Site','Metera Aksumite Ruins','Adi Keyih town','Senafe — gateway to ancient sites','Border crossing to Ethiopia'] },
  { id:'debubawi', name:'Debubawi Keyih Bahri',  sub:'Southern Red Sea',      emoji:'🌊', color:'#CE1126',
    capital:'Assab (Aseb)', pop:'~120,000', area:'28,000 km²', climate:'Extremely hot 30–50°C', people:'Afar, Saho',
    desc:'The most sparsely populated region, stretching to Djibouti. Features the Danakil Depression — one of the lowest and hottest places on Earth — and the strategic port of Assab.',
    highlights:['Assab Port — strategic Red Sea terminal','Danakil Depression (116m below sea level)','Border with Djibouti','Remote Afar communities','Extreme volcanic landscape'] },
  { id:'semenawi', name:'Semenawi Keyih Bahri',  sub:'Northern Red Sea',      emoji:'⚓', color:'#f59e0b',
    capital:'Massawa (Mitsiwa)', pop:'~250,000', area:'29,000 km²', climate:'Hot coastal 25–40°C', people:'Tigrinya, Tigre, Rashaida',
    desc:'Home to the historic port city of Massawa — 3,000 years old — with Ottoman, Egyptian, and Italian architecture. The Dahlak Archipelago\'s 200+ islands are a diver\'s paradise.',
    highlights:['Massawa — ancient port city','Dahlak Archipelago — 200+ islands','Dahlak Marine National Park','Ancient Adulis (Aksumite era)','Green Island beach resort'] },
  { id:'anseba',   name:'Anseba',                sub:'Northern Highland',     emoji:'🐪', color:'#7c3aed',
    capital:'Keren', pop:'~290,000', area:'23,000 km²', climate:'Semi-arid 20–35°C', people:'Tigre, Bilen, Tigrinya',
    desc:'Home to Keren — Eritrea\'s second city — famous for its camel market, the Shrine of Our Lady of Keren, and WWII battle sites. The Anseba River runs through this rugged region.',
    highlights:['Keren — Eritrea\'s 2nd city','Famous weekly camel market','Shrine of Our Lady of Keren','WWII battle sites','Anseba River Valley'] },
  { id:'gash',     name:'Gash-Barka',            sub:'Western Lowland',       emoji:'🌾', color:'#059669',
    capital:'Barentu', pop:'~400,000', area:'33,500 km²', climate:'Hot semi-arid 25–40°C', people:'Kunama, Nara, Tigre, Tigrinya',
    desc:'The largest region by area and Eritrea\'s agricultural heartland. The Gash and Setit rivers support farming. Home to the Kunama and Nara peoples with unique Nilo-Saharan languages.',
    highlights:['Barentu — regional capital','Gash & Setit River valleys','Kunama and Nara cultural heritage','Agricultural heartland','Border with Sudan and Ethiopia'] },
];

function initRegions() {
  const grid = document.getElementById('regionsGrid');
  const detail = document.getElementById('regionDetail');
  const detailContent = document.getElementById('regionDetailContent');
  const closeBtn = document.getElementById('regionDetailClose');
  if (!grid) return;

  REGIONS_DATA.forEach(r => {
    const card = document.createElement('div');
    card.className = 'region-card';
    card.style.setProperty('--rc', r.color);
    card.innerHTML = `
      <div class="region-card-top">
        <span class="region-emoji">${r.emoji}</span>
        <div>
          <div class="region-name">${r.name}</div>
          <div class="region-sub">${r.sub}</div>
        </div>
      </div>
      <div class="region-capital">🏛️ ${r.capital}</div>
      <div class="region-tap-hint">Tap to explore →</div>
    `;
    card.addEventListener('click', () => {
      detailContent.innerHTML = `
        <div class="rd-header" style="background:${r.color}20;border-left:4px solid ${r.color}">
          <span class="rd-emoji">${r.emoji}</span>
          <div>
            <div class="rd-name">${r.name}</div>
            <div class="rd-sub">${r.sub}</div>
          </div>
        </div>
        <p class="rd-desc">${r.desc}</p>
        <div class="rd-stats">
          <div class="rd-stat"><strong>Capital</strong><span>🏛️ ${r.capital}</span></div>
          <div class="rd-stat"><strong>Population</strong><span>👥 ${r.pop}</span></div>
          <div class="rd-stat"><strong>Area</strong><span>📐 ${r.area}</span></div>
          <div class="rd-stat"><strong>Climate</strong><span>🌡️ ${r.climate}</span></div>
          <div class="rd-stat"><strong>People</strong><span>👤 ${r.people}</span></div>
        </div>
        <div class="rd-highlights">
          <strong>Highlights</strong>
          <ul>${r.highlights.map(h => `<li>${h}</li>`).join('')}</ul>
        </div>
      `;
      detail.removeAttribute('hidden');
      detail.scrollIntoView({ behavior:'smooth', block:'nearest' });
    });
    grid.appendChild(card);
  });

  closeBtn.addEventListener('click', () => detail.setAttribute('hidden', ''));
}
initRegions();

// ── RECIPES ──────────────────────────────────────────────
const STATIC_RECIPES = [
  { name:'Injera (ኢንጀራ)', emoji:'🫓', time:'48 hrs + 30 min', serves:'6',
    ingredients:['2 cups teff flour','3 cups water','1 tsp salt','1 tsp baking soda (optional)'],
    steps:['Mix teff flour and water. Cover and ferment 48–72 hours until bubbly.','Stir in salt and baking soda if using.','Heat a non-stick skillet on medium-high.','Pour batter in a spiral, starting from the edges. Cover and cook 2 min until bubbles appear. Do not flip.','Slide onto a cloth. Serve as a platter with stews on top.'],
    tip:'True injera uses only teff — a tiny ancient grain rich in iron and fiber. Fermentation creates the signature sour flavor.' },
  { name:'Tsebhi Derho (ጽብሒ ደርሆ)', emoji:'🍲', time:'1 hr 20 min', serves:'4',
    ingredients:['1 whole chicken, cut up','3 onions, finely chopped','4 tbsp berbere spice','3 tbsp clarified butter (tesmi)','4 hard-boiled eggs','2 tbsp tomato paste','Salt to taste','1 cup water'],
    steps:['Dry-fry onions in a heavy pot 20 min until golden.','Add clarified butter and berbere. Cook 5 min until fragrant.','Add tomato paste and water. Stir well.','Add chicken and salt. Cook covered 40 min on medium heat.','Score hard-boiled eggs and add in the last 10 min.','Serve hot on injera.'],
    tip:'Berbere is the soul of Eritrean cooking — a complex blend of chili, fenugreek, coriander, cardamom, and more.' },
  { name:'Shiro (ሽሮ)', emoji:'🫘', time:'25 min', serves:'4',
    ingredients:['2 cups shiro powder (ground chickpeas)','3 cups water','1 onion, chopped','3 tbsp oil','2 garlic cloves, minced','1 tsp berbere','Salt'],
    steps:['Sauté onions in oil until golden. Add garlic and berbere.','Slowly whisk in shiro powder with water to avoid lumps.','Cook on medium heat 15–20 min, stirring constantly, until thick.','Adjust salt. Serve hot on injera.'],
    tip:'Shiro is the everyday staple of Eritrean homes. Add more water for a thinner stew. The earthy flavor is addictive.' },
  { name:'Ful Medames (ፉል)', emoji:'🫙', time:'20 min', serves:'4',
    ingredients:['2 cans fava beans, drained','3 tbsp olive oil','3 garlic cloves, minced','Juice of 1 lemon','1 tsp cumin','Salt and pepper','Fresh parsley (optional)'],
    steps:['Heat olive oil. Add garlic and cumin, cook 1 min.','Add fava beans. Mash roughly — leave some beans whole.','Add lemon juice, salt, pepper. Heat through 5 min.','Drizzle with olive oil and serve with bread or injera.'],
    tip:'Ful reflects Eritrea\'s centuries of Red Sea trade with Arab neighbors. Eaten for breakfast across Eritrea and the Middle East.' },
  { name:'Coffee Ceremony (ቡን)', emoji:'☕', time:'45 min', serves:'6',
    ingredients:['½ cup green coffee beans','Water','Sugar to taste','Cardamom (optional)'],
    steps:['Wash and roast green beans over medium heat, stirring until dark and aromatic.','Grind roasted beans in a mortar or grinder.','Boil water in a jebena (clay pot). Add coffee. Simmer 10 min.','Pour through a strainer into small cups. Serve 3 rounds: Abol, Tona, and Baraka.','Traditionally served with popcorn or bread.'],
    tip:'Refusing coffee is considered impolite. Always stay for all three rounds — it is a time for community and conversation.' },
  { name:'Mes — Honey Wine (መስ)', emoji:'🍯', time:'7 days', serves:'8',
    ingredients:['1 cup raw honey','4 cups water','1 tsp gesho (buckthorn) leaves or hops','Yeast (optional)'],
    steps:['Dissolve honey in warm (not hot) water. Stir well.','Add gesho leaves for bitterness and flavor.','Cover loosely and leave at room temperature 5–7 days to ferment.','Taste daily. When pleasantly alcoholic and tangy, strain and bottle.','Serve chilled at celebrations and ceremonies.'],
    tip:'Mes is Eritrean mead — one of the world\'s oldest alcoholic drinks. Traditionally served at weddings and religious feasts.' },
];

function initRecipes() {
  const grid = document.getElementById('recipeGrid');
  if (!grid) return;
  grid.innerHTML = STATIC_RECIPES.map((r, i) => `
    <div class="recipe-card" id="recipe-${i}">
      <div class="recipe-card-header">
        <span class="recipe-emoji">${r.emoji}</span>
        <div class="recipe-info">
          <h3 class="recipe-name">${r.name}</h3>
          <div class="recipe-meta-row">
            <span>⏱ ${r.time}</span>
            <span>🍽️ Serves ${r.serves}</span>
          </div>
        </div>
        <button class="recipe-toggle" data-ri="${i}" aria-expanded="false">▼</button>
      </div>
      <div class="recipe-body" hidden>
        <div class="recipe-cols">
          <div class="recipe-ingredients">
            <h4>🛒 Ingredients</h4>
            <ul>${r.ingredients.map(ing => `<li>${ing}</li>`).join('')}</ul>
          </div>
          <div class="recipe-steps">
            <h4>👨‍🍳 Steps</h4>
            <ol>${r.steps.map(s => `<li>${s}</li>`).join('')}</ol>
          </div>
        </div>
        <div class="recipe-tip">💡 <em>${r.tip}</em></div>
      </div>
    </div>
  `).join('');

  grid.addEventListener('click', e => {
    const btn = e.target.closest('.recipe-toggle');
    if (!btn) return;
    const card = btn.closest('.recipe-card');
    const body = card.querySelector('.recipe-body');
    const open = !body.hasAttribute('hidden');
    body.toggleAttribute('hidden', open);
    btn.textContent = open ? '▼' : '▲';
    btn.setAttribute('aria-expanded', String(!open));
  });
}
initRecipes();

// ── MUSIC ARTISTS ─────────────────────────────────────────
const ARTISTS_DATA = [
  { name:'Abraham Afewerki',  role:'Singer-Songwriter',         years:'1966–2006', genre:'Tigrinya Pop / Traditional',  emoji:'🎤', color:'linear-gradient(135deg,#007A3D,#4189DD)', desc:'Called the "Voice of Eritrea", Abraham Afewerki blended traditional Tigrinya music with modern sounds. His songs Hamid and Hagerey remain global anthems of Eritrean identity.' },
  { name:'Yemane Barya',      role:'Singer & Poet',             years:'1954–1997', genre:'Traditional Tigrinya',         emoji:'📜', color:'linear-gradient(135deg,#7c3aed,#007A3D)', desc:'Known as the "King" (ንጉስ) of Tigrinya music, Yemane Barya was a revolutionary poet-fighter whose timeless songs remain cornerstones of Eritrean cultural heritage.' },
  { name:'Helen Meles',       role:'Vocalist',                  years:'Born 1974',  genre:'Tigrinya Ballads / Pop',      emoji:'🎵', color:'linear-gradient(135deg,#CE1126,#f59e0b)', desc:'Eritrea\'s "Golden Voice" — her powerful vocals span traditional Tigrinya to modern ballads. Songs like Lbi Haway made her a beloved icon across the diaspora.' },
  { name:'Dehab Faytinga',    role:'Singer & Cultural Ambassador', years:'Born 1965', genre:'Traditional / Pan-African', emoji:'🌍', color:'linear-gradient(135deg,#4189DD,#CE1126)', desc:'A legendary vocalist who blends Eritrean rhythms with pan-African influences. She performed at major international festivals and is celebrated for keeping traditions alive globally.' },
  { name:'Yohannes Tikabo',   role:'Singer & Actor',            years:'Born 1971',  genre:'Modern Tigrinya',             emoji:'🎭', color:'linear-gradient(135deg,#f59e0b,#059669)', desc:'A hugely popular contemporary artist known for his melodic voice and modern Tigrinya music. Also an accomplished actor in Eritrean cinema.' },
  { name:'Alamin Abdullatif', role:'Tigre Music Icon',          years:'Born 1962',  genre:'Tigre Traditional',           emoji:'🎶', color:'linear-gradient(135deg,#059669,#7c3aed)', desc:'Master of traditional Tigre music, Alamin Abdullatif preserves the musical heritage of the Tigre ethnic group with powerful poetry-songs spanning decades.' },
];

function initArtists() {
  const grid = document.getElementById('artistsGrid');
  if (!grid) return;
  grid.innerHTML = ARTISTS_DATA.map(a => `
    <div class="artist-card">
      <div class="artist-avatar" style="background:${a.color}">${a.emoji}</div>
      <div class="artist-info">
        <div class="artist-name">${a.name}</div>
        <div class="artist-role">${a.role}</div>
        <div class="artist-years">${a.years} · ${a.genre}</div>
        <p class="artist-desc">${a.desc}</p>
      </div>
    </div>
  `).join('');
}
initArtists();

// ── HOLIDAYS ─────────────────────────────────────────────
const HOLIDAYS_DATA = [
  { month:'Jan',      day:'7',   name:'Orthodox Christmas (Ledet ልደት)',   type:'religious', icon:'⛪',
    desc:'Orthodox Christians celebrate the birth of Jesus with midnight church services, family feasts, and community celebrations. Traditional white clothing is worn.' },
  { month:'Jan',      day:'19',  name:'Timkat — Epiphany (ጥምቀት)',          type:'religious', icon:'💧',
    desc:'One of the most spectacular Orthodox celebrations. The Tabot (replica Ark of the Covenant) is carried in colorful processions to water sources with singing and prayer.' },
  { month:'Mar',      day:'8',   name:"International Women's Day",          type:'national',  icon:'👩',
    desc:'Widely celebrated in Eritrea, honoring women\'s central role in the 30-year independence struggle and ongoing nation-building.' },
  { month:'May',      day:'24',  name:'Independence Day 🇪🇷',               type:'national',  icon:'🎉',
    desc:'THE most important holiday. On May 24, 1993, Eritrea became independent. Celebrated with parades, concerts, fireworks, and community gatherings in Eritrea and diaspora cities worldwide.' },
  { month:'Jun',      day:'20',  name:"Martyrs' Day (ዓወቱ)",                type:'national',  icon:'🕯️',
    desc:'A solemn day of remembrance for those who gave their lives in the liberation struggle. Ceremonies at cemeteries and national reflection mark this important day.' },
  { month:'Sep',      day:'1',   name:'Start of the Armed Struggle',        type:'national',  icon:'⚔️',
    desc:'Commemorates September 1, 1961, when the ELF launched armed resistance against Ethiopian annexation — the beginning of the 30-year independence war.' },
  { month:'Sep',      day:'27',  name:'Meskel (መስቀል)',                      type:'religious', icon:'🔥',
    desc:'The Orthodox celebration of the Finding of the True Cross. Communities light massive bonfires (Demera), sing, pray, and celebrate. A UNESCO-listed intangible heritage.' },
  { month:'Variable', day:'',    name:'Eid al-Fitr (ዒድ ኣል-ፊጥር)',           type:'religious', icon:'☪️',
    desc:'Marking the end of Ramadan, celebrated by Eritrea\'s Muslim communities (nearly half the population) with prayers, feasting, charity, and community gatherings.' },
  { month:'Variable', day:'',    name:'Eid al-Adha (ዒድ ኣል-ኣድሃ)',           type:'religious', icon:'🐑',
    desc:'The Feast of Sacrifice — Islam\'s holiest holiday. Special prayers, animal sacrifice, and sharing meat with family, neighbors, and the poor.' },
  { month:'Nov',      day:'25',  name:"Women's Movement Day (NUEW)",        type:'national',  icon:'💪',
    desc:'Marks the founding of the National Union of Eritrean Women (NUEW), celebrating women\'s organizations and their transformative contributions to Eritrean society.' },
];

function initHolidays() {
  const list = document.getElementById('holidaysList');
  const filters = document.querySelectorAll('.hol-filt');
  if (!list) return;

  function renderHolidays(type) {
    const items = type === 'all' ? HOLIDAYS_DATA : HOLIDAYS_DATA.filter(h => h.type === type);
    list.innerHTML = items.map(h => `
      <div class="holiday-item ${h.type}">
        <div class="holiday-icon">${h.icon}</div>
        <div class="holiday-date">
          <span class="hol-month">${h.month}</span>
          ${h.day ? `<span class="hol-day">${h.day}</span>` : '<span class="hol-day hol-var">Variable</span>'}
        </div>
        <div class="holiday-body">
          <div class="holiday-name">${h.name}</div>
          <p class="holiday-desc">${h.desc}</p>
          <span class="holiday-type-badge ${h.type}">${h.type === 'national' ? '🇪🇷 National' : '🕌 Religious'}</span>
        </div>
      </div>
    `).join('');
  }

  renderHolidays('all');

  filters.forEach(btn => {
    btn.addEventListener('click', () => {
      filters.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderHolidays(btn.dataset.htype);
    });
  });
}
initHolidays();

// ── BLOG / ARTICLES ───────────────────────────────────────
let _blogLoaded = false;
const blogSection = document.getElementById('blog');
if (blogSection) {
  new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && !_blogLoaded) {
      _blogLoaded = true;
      loadBlogSection();
    }
  }, { threshold: 0.1 }).observe(blogSection);
}

async function loadBlogSection() {
  const grid = document.getElementById('blogGrid');
  if (!grid) return;
  try {
    const [appMod, fsMod] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'),
    ]);
    const app = appMod.getApps().length ? appMod.getApps()[0] : appMod.initializeApp(FIREBASE_CONFIG);
    const db  = fsMod.getFirestore(app);
    const q   = fsMod.query(
      fsMod.collection(db, 'eri_articles'),
      fsMod.where('status', '==', 'published'),
      fsMod.orderBy('publishedAt', 'desc'),
      fsMod.limit(6)
    );
    const snap = await fsMod.getDocs(q);
    if (snap.empty) {
      grid.innerHTML = '<p class="blog-empty">No articles yet — the first one is coming soon!</p>';
      return;
    }
    grid.innerHTML = '';
    snap.forEach(doc => {
      const d = doc.data();
      const date = d.publishedAt?.toDate ? d.publishedAt.toDate().toLocaleDateString('en-GB', { year:'numeric', month:'short', day:'numeric' }) : '';
      grid.insertAdjacentHTML('beforeend', `
        <div class="blog-card">
          ${d.imageUrl ? `<div class="blog-img"><img src="${escHtml(d.imageUrl)}" alt="${escHtml(d.title)}" loading="lazy"/></div>` : ''}
          <div class="blog-body">
            ${d.category ? `<span class="blog-cat">${escHtml(d.category)}</span>` : ''}
            <h3 class="blog-title">${escHtml(d.title)}</h3>
            <p class="blog-excerpt">${escHtml((d.excerpt || d.body || '').slice(0, 180))}…</p>
            <div class="blog-footer">
              <span class="blog-author">✍️ ${escHtml(d.author || 'EritreanInfo')}</span>
              ${date ? `<span class="blog-date">📅 ${date}</span>` : ''}
            </div>
          </div>
        </div>
      `);
    });
  } catch (err) {
    grid.innerHTML = '<p class="blog-empty">Articles unavailable right now.</p>';
    console.warn('[Blog]', err);
  }
}

// ── QUIZ ─────────────────────────────────────────────────
const QUIZ_QS = [
  { q:'What year did Eritrea officially become an independent nation?',
    opts:['1991','1993','1995','1998'], ans:1,
    fact:'Eritrea gained independence on May 24, 1993, after a UN-supervised referendum where 99.83% voted for independence.' },
  { q:'What is the capital city of Eritrea?',
    opts:['Massawa','Keren','Asmara','Assab'], ans:2,
    fact:'Asmara (ኣስመራ) sits at 2,325 m above sea level. In 2017 it became a UNESCO World Heritage Site for its Modernist architecture.' },
  { q:'What percentage voted for independence in the 1993 referendum?',
    opts:['75%','89.5%','95.2%','99.83%'], ans:3,
    fact:'An overwhelming 99.83% voted for independence — one of the highest referendum results in history.' },
  { q:'How many officially recognized ethnic groups does Eritrea have?',
    opts:['5','7','9','12'], ans:2,
    fact:'Eritrea has 9 recognized groups: Tigrinya, Tigre, Saho, Kunama, Rashaida, Bilen, Afar, Beja (Hedareb), and Nara.' },
  { q:'What ancient empire had Eritrea as its heartland?',
    opts:['Egyptian Empire','Aksumite Empire','Ottoman Empire','Kingdom of Meroe'], ans:1,
    fact:'The Aksumite Empire (100–940 AD) was one of the great civilizations of the ancient world, with its main port at Adulis near modern Massawa.' },
  { q:"What is the name of Eritrea's currency?",
    opts:['Birr','Shilling','Nakfa','Riyal'], ans:2,
    fact:"The Nakfa (ERN) has been Eritrea's currency since 1997. Named after the town of Nakfa — a symbol of resistance during the liberation war." },
  { q:'In what year was Asmara inscribed as a UNESCO World Heritage Site?',
    opts:['2005','2010','2017','2020'], ans:2,
    fact:"Asmara was recognized in 2017 for its extraordinary collection of Futurist, Rationalist, Art Deco, and Expressionist architecture from the Italian colonial era." },
  { q:'Which Eritrean athlete won the marathon at the 2016 Rio Olympics?',
    opts:['Zersenay Tadese','Ghirmay Ghebreslassie','Daniel Teklehaimanot','Yonas Kifle'], ans:1,
    fact:'Ghirmay Ghebreslassie won gold at Rio 2016 at just 20 years old, becoming one of the youngest marathon champions in Olympic history.' },
  { q:"What is the length of Eritrea's Red Sea coastline?",
    opts:['1,200 km','1,800 km','2,234 km','3,100 km'], ans:2,
    fact:"Eritrea has over 2,234 km of Red Sea coastline — one of the longest in Africa — including the Dahlak Archipelago with 200+ islands." },
  { q:"What does 'Hade Hzbi, Hade Libbi' mean?",
    opts:['One Nation, One Flag','Unity and Peace','Eritrea Forever','One People, One Heart'], ans:3,
    fact:"'ሓደ ህዝቢ ሓደ ልቢ' is the national motto, reflecting the deep Eritrean value of community and collective identity across 9 diverse ethnic groups." },
];

let _quizIdx = 0, _quizScore = 0, _quizAnswered = false;

function initQuiz() {
  const startDiv  = document.getElementById('quizStart');
  const playDiv   = document.getElementById('quizPlay');
  const resultDiv = document.getElementById('quizResult');
  const startBtn  = document.getElementById('quizStartBtn');
  const retryBtn  = document.getElementById('quizRetryBtn');
  const shareBtn  = document.getElementById('quizShareBtn');
  const nextBtn   = document.getElementById('quizNextBtn');
  if (!startBtn) return;

  function startQuiz() {
    _quizIdx = 0; _quizScore = 0; _quizAnswered = false;
    startDiv.hidden = true;
    resultDiv.hidden = true;
    playDiv.removeAttribute('hidden');
    renderQuestion();
  }

  function renderQuestion() {
    const q = QUIZ_QS[_quizIdx];
    document.getElementById('quizCounter').textContent = `${_quizIdx + 1} / ${QUIZ_QS.length}`;
    document.getElementById('quizScoreLive').textContent = `${_quizScore} pts`;
    document.getElementById('quizFill').style.width = `${(_quizIdx / QUIZ_QS.length) * 100}%`;
    document.getElementById('quizQ').textContent = q.q;
    const factBox = document.getElementById('quizFactBox');
    factBox.setAttribute('hidden', '');
    nextBtn.setAttribute('hidden', '');
    _quizAnswered = false;
    const opts = document.getElementById('quizOpts');
    opts.innerHTML = q.opts.map((o, i) => `
      <button class="quiz-opt" data-idx="${i}">${o}</button>
    `).join('');
    opts.querySelectorAll('.quiz-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        if (_quizAnswered) return;
        _quizAnswered = true;
        const chosen = parseInt(btn.dataset.idx);
        const correct = chosen === q.ans;
        if (correct) _quizScore++;
        opts.querySelectorAll('.quiz-opt').forEach((b, i) => {
          b.disabled = true;
          if (i === q.ans) b.classList.add('correct');
          else if (i === chosen) b.classList.add('wrong');
        });
        factBox.textContent = `💡 ${q.fact}`;
        factBox.removeAttribute('hidden');
        nextBtn.removeAttribute('hidden');
        document.getElementById('quizScoreLive').textContent = `${_quizScore} pts`;
      });
    });
  }

  nextBtn.addEventListener('click', () => {
    _quizIdx++;
    if (_quizIdx >= QUIZ_QS.length) showResult();
    else renderQuestion();
  });

  function showResult() {
    playDiv.setAttribute('hidden', '');
    resultDiv.removeAttribute('hidden');
    document.getElementById('quizFinalScore').textContent = `${_quizScore} / ${QUIZ_QS.length}`;
    const pct = (_quizScore / QUIZ_QS.length) * 100;
    const msgs = [
      [80, '🏆 Eritrea Expert!', 'Outstanding! You know Eritrea deeply.'],
      [50, '⭐ Good knowledge!', 'Solid! Keep exploring Eritrean history.'],
      [0, '📚 Keep learning!', 'Every question is a chance to discover Eritrea.'],
    ];
    const [, trophy, msg] = msgs.find(([threshold]) => pct >= threshold);
    document.getElementById('quizTrophy').textContent = trophy;
    document.getElementById('quizFinalMsg').textContent = msg;
  }

  startBtn.addEventListener('click', startQuiz);
  retryBtn.addEventListener('click', startQuiz);
  shareBtn.addEventListener('click', () => {
    const text = `I scored ${_quizScore}/${QUIZ_QS.length} on the Eritrea Quiz! 🇪🇷 Test your knowledge: ${location.href}#quiz`;
    if (navigator.share) navigator.share({ text });
    else navigator.clipboard?.writeText(text).then(() => {
      shareBtn.textContent = '✓ Copied!';
      setTimeout(() => { shareBtn.textContent = '🔗 Share Result'; }, 2000);
    });
  });
}
initQuiz();

// ── GALLERY DYNAMIC LOADER ────────────────────────────────
let _galleryDynLoaded = false;
const gallerySection = document.getElementById('gallery');
if (gallerySection) {
  new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && !_galleryDynLoaded) {
      _galleryDynLoaded = true;
      loadDynamicGallery();
    }
  }, { threshold: 0.1 }).observe(gallerySection);
}

async function loadDynamicGallery() {
  const dyn = document.getElementById('galleryDynamic');
  if (!dyn) return;
  try {
    const [appMod, fsMod] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'),
    ]);
    const app = appMod.getApps().length ? appMod.getApps()[0] : appMod.initializeApp(FIREBASE_CONFIG);
    const db  = fsMod.getFirestore(app);
    const q   = fsMod.query(
      fsMod.collection(db, 'eri_gallery'),
      fsMod.where('status', '==', 'active'),
      fsMod.orderBy('createdAt', 'desc')
    );
    const snap = await fsMod.getDocs(q);
    if (snap.empty) return;
    snap.forEach(doc => {
      const d = doc.data();
      const item = document.createElement('div');
      item.className = 'gallery-item';
      item.setAttribute('data-category', d.category || 'culture');
      item.innerHTML = `
        <img src="${escHtml(d.imageUrl)}" alt="${escHtml(d.caption || d.title || 'Gallery image')}" loading="lazy" />
        <div class="gallery-caption">
          <h4>${escHtml(d.title || '')}</h4>
          <p>${escHtml(d.caption || '')}</p>
        </div>
      `;
      item.addEventListener('click', () => {
        const visible = [...document.querySelectorAll('.gallery-item:not(.hidden)')];
        openLightbox(Math.max(0, visible.indexOf(item)));
      });
      dyn.appendChild(item);
    });
  } catch (err) {
    console.warn('[Gallery dynamic]', err);
  }
}

// ── NEWSLETTER ────────────────────────────────────────────
document.getElementById('nlSubmit')?.addEventListener('click', async () => {
  const emailEl = document.getElementById('nlEmail');
  const msgEl   = document.getElementById('nlMsg');
  const btn     = document.getElementById('nlSubmit');
  const email   = emailEl?.value?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    msgEl.textContent = 'Please enter a valid email address.';
    msgEl.style.color = '#f87171';
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Subscribing…';
  try {
    const [appMod, fsMod] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'),
    ]);
    const app = appMod.getApps().length ? appMod.getApps()[0] : appMod.initializeApp(FIREBASE_CONFIG);
    const db  = fsMod.getFirestore(app);
    await fsMod.addDoc(fsMod.collection(db, 'eri_newsletter'), {
      email,
      source: 'eritreaninfo',
      subscribedAt: fsMod.serverTimestamp()
    });
    emailEl.value = '';
    msgEl.textContent = '✅ Subscribed! Thank you for joining the community.';
    msgEl.style.color = '#10b981';
  } catch (err) {
    msgEl.textContent = 'Subscription failed — please try again.';
    msgEl.style.color = '#f87171';
    console.warn('[Newsletter]', err);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Subscribe';
  }
});

// ── PHRASEBOOK CATEGORY FILTER ────────────────────────────
(function initPhrasebookFilter() {
  const filterBtns = document.querySelectorAll('.phrase-filt');
  const catLists   = document.querySelectorAll('.phrase-cat');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.dataset.pfilt;
      catLists.forEach(list => {
        list.style.display = (cat === 'all' || list.classList.contains(cat)) ? '' : 'none';
      });
    });
  });

  // Event delegation for new phrase-item categories
  document.querySelectorAll('.phrase-list.phrase-cat').forEach(list => {
    list.querySelectorAll('.phrase-item[data-ti]').forEach(item => {
      item.addEventListener('click', () => {
        const ti = item.getAttribute('data-ti');
        if (!ti) return;
        sourceLangSel.value = 'ti';
        sourceText.classList.add('tigrinya-text');
        sourceText.placeholder = 'Type Tigrinya (ትግርኛ) here...';
        sourceText.value = ti;
        charCount.textContent = `${ti.length} / ${MAX_CHARS}`;
        transOutput.innerHTML = '<p class="output-placeholder">Click Translate to translate this phrase…</p>';
        document.getElementById('translator').scrollIntoView({ behavior:'smooth', block:'center' });
        setTimeout(translateText, 600);
      });
    });
  });
})();
