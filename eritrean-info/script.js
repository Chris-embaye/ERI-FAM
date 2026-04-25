/* ============================================
   ERITREAN INFO — JavaScript
   ============================================ */

// ── NAVIGATION ──────────────────────────────
const navbar    = document.getElementById('navbar');
const navToggle = document.getElementById('navToggle');
const navLinks  = document.getElementById('navLinks');

navToggle.addEventListener('click', () => {
  navLinks.classList.toggle('open');
});

// Close mobile nav on link click
navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => navLinks.classList.remove('open'));
});

// Active nav link on scroll
const sections = document.querySelectorAll('section[id]');
function updateActiveNav() {
  const scrollY = window.scrollY + 80;
  sections.forEach(section => {
    const top    = section.offsetTop;
    const bottom = top + section.offsetHeight;
    const id     = section.getAttribute('id');
    const link   = navLinks.querySelector(`a[href="#${id}"]`);
    if (link) {
      if (scrollY >= top && scrollY < bottom) {
        navLinks.querySelectorAll('a').forEach(l => l.classList.remove('active'));
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
