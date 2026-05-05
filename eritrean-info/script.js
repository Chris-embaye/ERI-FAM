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
  if (backToTop) {
    if (window.scrollY > 400) {
      backToTop.classList.add('visible');
    } else {
      backToTop.classList.remove('visible');
    }
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
    document.getElementById(`tab-${tab}`)?.classList.add('active');
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
  lightboxImg.style.opacity = '0';
  lightboxImg.onerror = () => {
    lightboxImg.style.opacity = '0';
    lightboxCap.textContent = '⚠ Image could not load';
    setTimeout(() => {
      if (lightbox.classList.contains('open')) {
        if (currentGalleryItems.length > 1) {
          currentIndex = (currentIndex + 1) % currentGalleryItems.length;
          showLightboxItem(currentIndex);
        } else {
          closeLightbox();
        }
      }
    }, 1500);
  };
  lightboxImg.onload = () => { lightboxImg.style.opacity = '1'; };
  lightboxImg.src = img ? img.src : '';
  lightboxImg.alt = img ? img.alt : '';
  const h4 = caption?.querySelector('h4');
  const p  = caption?.querySelector('p');
  lightboxCap.textContent = h4 ? (h4.textContent + (p ? ' — ' + p.textContent : '')) : (p ? p.textContent : '');
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
  const currentTarget = targetLangSel ? targetLangSel.value : (currentSource === 'ti' ? 'en' : 'ti');

  // Swap source ↔ target dropdown values
  if (targetLangSel) targetLangSel.value = currentSource;

  if (currentTarget === 'ti') {
    sourceLangSel.value = 'ti';
    sourceText.classList.add('tigrinya-text');
    sourceText.placeholder = 'Type Tigrinya (ትግርኛ) here...\n\nExample: ሰላም! ከመይ ኣለካ?';
  } else {
    sourceLangSel.value = currentTarget;
    sourceText.classList.remove('tigrinya-text');
    sourceText.placeholder = 'Type here...';
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
  const targetLang = targetLangSel ? targetLangSel.value : (sourceLang === 'ti' ? 'en' : 'ti');

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
    document.querySelector('.phrasebook')?.appendChild(histEl);
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
  localStorage.setItem('pwa-dismissed-time', Date.now().toString());
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

// ── FIDEL TABS ───────────────────────────────
document.querySelectorAll('.fidel-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.fidel-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.fidel-tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('ftab-' + btn.getAttribute('data-ftab'))?.classList.add('active');
  });
});

// ── FIDEL WORDS & VOCABULARY ─────────────────
(function initFidelWords() {
  const WORDS = [
    // Greetings
    { cat:'Greetings', w:'ሰላም',      r:'Selam',       m:'Hello / Peace',               ex:'ሰላም! ከመይ ኣለካ? — Hello! How are you?' },
    { cat:'Greetings', w:'ከመይ ኣለካ', r:'Kemey aleka', m:'How are you? (to a male)',     ex:'ሰላም! ከመይ ኣለካ?' },
    { cat:'Greetings', w:'ሕሉፍ',      r:'Hluf',        m:'Fine / Good (reply)',          ex:'ሕሉፍ ኣለኹ — I am fine' },
    { cat:'Greetings', w:'ኣቤ',       r:'Abe',         m:'Yes',                          ex:'ኣቤ፡ ርዱእ — Yes, understood' },
    { cat:'Greetings', w:'ኣይፋሉን',    r:'Ayfalu',      m:'No',                          ex:'ኣይፋሉን፡ ሓሶት — No, that is false' },
    { cat:'Greetings', w:'የቐንየለይ',   r:'Yekenyeley',  m:'Thank you',                    ex:'የቐንየለይ ብዙሕ — Thank you very much' },
    { cat:'Greetings', w:'ስለምንታይ',   r:'Slemnita',    m:'Why',                          ex:'ስለምንታይ ምስ ናይ — Why is that?' },
    { cat:'Greetings', w:'ምስ ሰናይ',   r:'Ms senay',   m:'Goodbye',                      ex:'ምስ ሰናይ ቁሩ — Goodbye, go well' },

    // Family
    { cat:'Family',    w:'ኣቦ',       r:'Abo',         m:'Father',                       ex:'ኣቦይ ሓኪም — My father is a doctor' },
    { cat:'Family',    w:'ኣደ',       r:'Ade',         m:'Mother',                       ex:'ኣደይ ምሉእ — My mother is complete' },
    { cat:'Family',    w:'ወዲ',       r:'Wedi',        m:'Son / Boy',                    ex:'ወዲ ሃገር — Son of the nation' },
    { cat:'Family',    w:'ጓለይ',      r:'Gwaley',      m:'My daughter',                  ex:'ጓለይ ሕጂ ዓበይት — My daughter is grown now' },
    { cat:'Family',    w:'ሓዉ',       r:'Hawu',        m:'Brother',                      ex:'ሓዉ ናይ — My brother' },
    { cat:'Family',    w:'ሓፍቲ',      r:'Hafti',       m:'Sister',                       ex:'ሓፍተይ ፈቓር — My sister is kind' },
    { cat:'Family',    w:'ስድራቤት',    r:'Sidra-bet',   m:'Family',                       ex:'ስድራቤትና ሓቢርና — Our family together' },
    { cat:'Family',    w:'ሓዳር',      r:'Hadar',       m:'Marriage / Home',              ex:'ሓዳር ሰናይ — A good marriage' },

    // Numbers
    { cat:'Numbers',   w:'ሓደ',       r:'Hade',        m:'One (1)',                      ex:'ሓደ ሰብ — One person' },
    { cat:'Numbers',   w:'ክልተ',      r:'Kilte',       m:'Two (2)',                      ex:'ክልተ ቀለምቲ — Two colors' },
    { cat:'Numbers',   w:'ሰለስተ',     r:'Seleste',     m:'Three (3)',                    ex:'ሰለስተ ወለዶ — Three generations' },
    { cat:'Numbers',   w:'ኣርባዕተ',    r:'Arbate',      m:'Four (4)',                     ex:'ኣርባዕተ ኣቅጻጽ — Four directions' },
    { cat:'Numbers',   w:'ሓሙሽተ',     r:'Hamushte',    m:'Five (5)',                     ex:'ሓሙሽተ ዕጽፊ — Five times' },
    { cat:'Numbers',   w:'ሽዱሽተ',     r:'Shdushte',    m:'Six (6)',                      ex:'ሽዱሽተ ወርሒ — Six months' },
    { cat:'Numbers',   w:'ሸሞንተ',     r:'Shemonte',    m:'Eight (8)',                    ex:'ሸሞንተ ሰዓት — Eight hours' },
    { cat:'Numbers',   w:'ዓሰርተ',     r:'Aserte',      m:'Ten (10)',                     ex:'ዓሰርተ ዓመት — Ten years' },
    { cat:'Numbers',   w:'ሚእቲ',      r:'Mieti',       m:'One hundred (100)',            ex:'ሚእቲ ናቕፋ — One hundred Nakfa' },

    // Nature & Places
    { cat:'Nature',    w:'ባሕሪ',      r:'Bahri',       m:'Sea / Ocean',                  ex:'ባሕሪ ቀይሕ — The Red Sea' },
    { cat:'Nature',    w:'ደጋ',       r:'Dega',        m:'Highland / Mountain plateau',  ex:'ደጋ ኤርትራ — The Eritrean highlands' },
    { cat:'Nature',    w:'ምድሪ',      r:'Midri',       m:'Earth / Land',                 ex:'ምድሪ ኤርትራ — The land of Eritrea' },
    { cat:'Nature',    w:'ሰማይ',      r:'Semay',       m:'Sky',                          ex:'ሰማይ ጸሊም — The sky is dark' },
    { cat:'Nature',    w:'ማይ',       r:'May',         m:'Water',                        ex:'ማይ ሃቢ — Give me water' },
    { cat:'Nature',    w:'ሓዊ',       r:'Hawi',        m:'Fire',                         ex:'ሓዊ ዓቢ — A big fire' },
    { cat:'Nature',    w:'ፀሓይ',      r:'Tsehay',      m:'Sun',                          ex:'ፀሓይ ወጺኡ — The sun has risen' },
    { cat:'Nature',    w:'ወርሒ',      r:'Werhi',       m:'Moon / Month',                 ex:'ወርሒ ምሉእ — Full moon' },
    { cat:'Nature',    w:'ኣዶቦ',      r:'Adobo',       m:'Tree',                         ex:'ኣዶቦ ዓቢ — A big tree' },

    // Food & Drink
    { cat:'Food',      w:'እንጀራ',    r:'Injera',      m:'Injera — sour flatbread',      ex:'እንጀራ ምስ ጸብሒ — Injera with stew' },
    { cat:'Food',      w:'ጸብሒ',      r:'Tsebhi',      m:'Stew / Sauce',                 ex:'ጸብሒ ደርሆ — Chicken stew' },
    { cat:'Food',      w:'ቡን',       r:'Bun',         m:'Coffee (beans)',                ex:'ቡን ቀሪብካ — Brewing coffee' },
    { cat:'Food',      w:'ሻሂ',       r:'Shahy',       m:'Tea',                          ex:'ሻሂ ምስ ሸኮር — Tea with sugar' },
    { cat:'Food',      w:'ሽሮ',       r:'Shiro',       m:'Chickpea stew',                ex:'ሽሮ ምስ እንጀራ — Shiro with injera' },
    { cat:'Food',      w:'ስጋ',       r:'Siga',        m:'Meat',                         ex:'ስጋ ዝርጋዕ — Minced meat' },
    { cat:'Food',      w:'ዓሳ',       r:'Asa',         m:'Fish',                         ex:'ዓሳ ካብ ባሕሪ — Fish from the sea' },
    { cat:'Food',      w:'ዳቦ',       r:'Dabo',        m:'Bread',                        ex:'ዳቦ ምሩቕ — Fresh bread' },

    // Values & Identity
    { cat:'Values',    w:'ናጽነት',     r:'Natsnet',     m:'Freedom / Independence',       ex:'ናጽነት ኤርትራ — Independence of Eritrea' },
    { cat:'Values',    w:'ሃገር',      r:'Hager',       m:'Country / Homeland',           ex:'ሃገረ ኤርትራ — The State of Eritrea' },
    { cat:'Values',    w:'ሰላም',      r:'Selam',       m:'Peace',                        ex:'ሰላም ኩሉ — Peace for all' },
    { cat:'Values',    w:'ሓቂ',       r:'Haki',        m:'Truth',                        ex:'ሓቂ ዘናግፍ — Truth that speaks' },
    { cat:'Values',    w:'ዓወት',      r:'Awet',        m:'Victory',                      ex:'ዓወት ንሓፋሽ! — Victory to the masses!' },
    { cat:'Values',    w:'ፍቕሪ',      r:'Fiqri',       m:'Love',                         ex:'ፍቕሪ ሃገር — Love of country' },
    { cat:'Values',    w:'ክብሪ',      r:'Kibri',       m:'Respect / Honor',              ex:'ክብሪ ዓቢ — Great honor' },
    { cat:'Values',    w:'ሓቢርና',    r:'Habirna',     m:'Together / United',            ex:'ሓቢርና ንሰርሕ — Together we work' },
  ];

  const container = document.getElementById('fidelWordsContainer');
  const searchEl  = document.getElementById('fidelWordsSearch');
  if (!container) return;

  function speakWord(word) {
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(word);
    utt.lang = 'ti'; utt.rate = 0.8;
    const voices = window.speechSynthesis.getVoices();
    const v = voices.find(v => v.lang.startsWith('ti') || v.lang.startsWith('am'));
    if (v) utt.voice = v;
    window.speechSynthesis.speak(utt);
  }

  function renderWords(filter) {
    const q = (filter || '').toLowerCase().trim();
    const filtered = q ? WORDS.filter(w =>
      w.w.includes(q) || w.r.toLowerCase().includes(q) || w.m.toLowerCase().includes(q)
    ) : WORDS;

    if (!filtered.length) {
      container.innerHTML = '<p style="color:var(--text-muted);padding:20px 0">No words found. Try another search term.</p>';
      return;
    }

    // Group by category
    const cats = {};
    filtered.forEach(w => {
      if (!cats[w.cat]) cats[w.cat] = [];
      cats[w.cat].push(w);
    });

    container.innerHTML = Object.entries(cats).map(([cat, words]) => `
      <div class="fidel-category-label">${cat}</div>
      <div class="fidel-words-grid">
        ${words.map((w, i) => `
          <div class="fidel-word-card" title="${w.ex}">
            <div class="fwc-tigrinya">${w.w}</div>
            <div class="fwc-roman">${w.r}</div>
            <div class="fwc-meaning">${w.m}</div>
            <div class="fwc-example">${w.ex}</div>
            <button class="fwc-speak" data-word="${w.w}" title="Hear pronunciation">🔊</button>
          </div>`).join('')}
      </div>`).join('');

    container.querySelectorAll('.fwc-speak').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        speakWord(btn.getAttribute('data-word'));
        btn.textContent = '🔉';
        setTimeout(() => { btn.textContent = '🔊'; }, 1500);
      });
    });
  }

  renderWords('');
  if (searchEl) searchEl.addEventListener('input', () => renderWords(searchEl.value));
})();

// ── FIDEL ALPHABET GRID ──────────────────────
(function initFidelAlphabet() {
  const grid     = document.getElementById('fidelGrid');
  const searchEl = document.getElementById('fidelSearch');
  if (!grid) return;

  // 33 consonants × 7 vowel orders (ä u i a e ə o) = 231 characters
  const ROWS = [
    { r:'H',    c:['ሀ','ሁ','ሂ','ሃ','ሄ','ህ','ሆ'] },
    { r:'L',    c:['ለ','ሉ','ሊ','ላ','ሌ','ል','ሎ'] },
    { r:'Ḥ',    c:['ሐ','ሑ','ሒ','ሓ','ሔ','ሕ','ሖ'] },
    { r:'M',    c:['መ','ሙ','ሚ','ማ','ሜ','ም','ሞ'] },
    { r:'R',    c:['ረ','ሩ','ሪ','ራ','ሬ','ር','ሮ'] },
    { r:'S',    c:['ሰ','ሱ','ሲ','ሳ','ሴ','ስ','ሶ'] },
    { r:'Sh',   c:['ሸ','ሹ','ሺ','ሻ','ሼ','ሽ','ሾ'] },
    { r:'Q',    c:['ቀ','ቁ','ቂ','ቃ','ቄ','ቅ','ቆ'] },
    { r:'Qʷ',   c:['ቐ','ቑ','ቒ','ቓ','ቔ','ቕ','ቖ'] },
    { r:'B',    c:['በ','ቡ','ቢ','ባ','ቤ','ብ','ቦ'] },
    { r:'V',    c:['ቨ','ቩ','ቪ','ቫ','ቬ','ቭ','ቮ'] },
    { r:'T',    c:['ተ','ቱ','ቲ','ታ','ቴ','ት','ቶ'] },
    { r:'Ch',   c:['ቸ','ቹ','ቺ','ቻ','ቼ','ች','ቾ'] },
    { r:'N',    c:['ነ','ኑ','ኒ','ና','ኔ','ን','ኖ'] },
    { r:'Ny',   c:['ኘ','ኙ','ኚ','ኛ','ኜ','ኝ','ኞ'] },
    { r:'ʾ',    c:['አ','ኡ','ኢ','ኣ','ኤ','እ','ኦ'] },
    { r:'K',    c:['ከ','ኩ','ኪ','ካ','ኬ','ክ','ኮ'] },
    { r:'Kh',   c:['ኸ','ኹ','ኺ','ኻ','ኼ','ኽ','ኾ'] },
    { r:'W',    c:['ወ','ዉ','ዊ','ዋ','ዌ','ው','ዎ'] },
    { r:'ʿ',    c:['ዐ','ዑ','ዒ','ዓ','ዔ','ዕ','ዖ'] },
    { r:'Z',    c:['ዘ','ዙ','ዚ','ዛ','ዜ','ዝ','ዞ'] },
    { r:'D\'',  c:['ዸ','ዹ','ዺ','ዻ','ዼ','ዽ','ዾ'] },
    { r:'Y',    c:['የ','ዩ','ዪ','ያ','ዬ','ይ','ዮ'] },
    { r:'D',    c:['ደ','ዱ','ዲ','ዳ','ዴ','ድ','ዶ'] },
    { r:'J',    c:['ጀ','ጁ','ጂ','ጃ','ጄ','ጅ','ጆ'] },
    { r:'G',    c:['ገ','ጉ','ጊ','ጋ','ጌ','ግ','ጎ'] },
    { r:'Ṭ',    c:['ጠ','ጡ','ጢ','ጣ','ጤ','ጥ','ጦ'] },
    { r:'Ch\'', c:['ጨ','ጩ','ጪ','ጫ','ጬ','ጭ','ጮ'] },
    { r:'P\'',  c:['ጰ','ጱ','ጲ','ጳ','ጴ','ጵ','ጶ'] },
    { r:'Ṣ',    c:['ጸ','ጹ','ጺ','ጻ','ጼ','ጽ','ጾ'] },
    { r:'F',    c:['ፈ','ፉ','ፊ','ፋ','ፌ','ፍ','ፎ'] },
    { r:'P',    c:['ፐ','ፑ','ፒ','ፓ','ፔ','ፕ','ፖ'] },
  ];
  const SOUNDS = ['ä','u','i','a','e','ə','o'];

  function renderGrid(filter) {
    const q = (filter || '').trim().toLowerCase();
    const rows = q
      ? ROWS.filter(row =>
          row.c.some(ch => ch.includes(q)) ||
          row.r.toLowerCase().startsWith(q)
        )
      : ROWS;

    if (!rows.length) {
      grid.innerHTML = '<p style="padding:16px;color:var(--text-muted,#888)">No match found.</p>';
      return;
    }

    grid.innerHTML = rows.map(row =>
      `<div class="fidel-row">` +
      row.c.map((ch, i) =>
        `<div class="fidel-cell" title="${row.r + SOUNDS[i]}">` +
          `<span class="fidel-char">${ch}</span>` +
          `<span class="fidel-sound">${row.r + SOUNDS[i]}</span>` +
        `</div>`
      ).join('') +
      `</div>`
    ).join('');

    grid.querySelectorAll('.fidel-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        if ('speechSynthesis' in window) {
          const u = new SpeechSynthesisUtterance(cell.querySelector('.fidel-char').textContent);
          u.lang = 'ti'; u.rate = 0.7;
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(u);
        }
        grid.querySelectorAll('.fidel-cell').forEach(c => c.classList.remove('active'));
        cell.classList.add('active');
      });
    });
  }

  renderGrid('');
  if (searchEl) searchEl.addEventListener('input', () => renderGrid(searchEl.value));
})();

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
  if (anthemPlayBtn)    anthemPlayBtn.innerHTML    = icon;
  if (anthemBarPlayBtn) anthemBarPlayBtn.innerHTML = icon;
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


anthemAudio.addEventListener('play',  () => { if (namPlayBtn) namPlayBtn.innerHTML = '&#9646;&#9646;'; });
anthemAudio.addEventListener('pause', () => { if (namPlayBtn) namPlayBtn.innerHTML = '&#9654;'; });
anthemAudio.addEventListener('ended', () => { if (namPlayBtn) namPlayBtn.innerHTML = '&#9654;'; });

anthemAudio.addEventListener('timeupdate', () => {
  if (!anthemAudio.duration) return;
  const pct = (anthemAudio.currentTime / anthemAudio.duration) * 100;
  if (namFill)  namFill.style.width  = pct + '%';
  if (namTime)  namTime.textContent  = anthemFmt(anthemAudio.currentTime);
});

if (namTrack) {
  namTrack.addEventListener('click', e => {
    if (!anthemAudio.duration) return;
    const r = namTrack.getBoundingClientRect();
    anthemAudio.currentTime = ((e.clientX - r.left) / r.width) * anthemAudio.duration;
  });
}

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
        <div class="community-post-card" data-post-id="${doc.id}" data-upvotes="${d.upvotes || 0}">
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
    const app = appMod.getApps().length ? appMod.getApps()[0] : appMod.initializeApp(FIREBASE_CONFIG);
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

// ── GLOBAL SEARCH OVERLAY ────────────────────────────────
(function initGlobalSearch() {
  const overlay   = document.getElementById('globalSearchOverlay');
  const backdrop  = document.getElementById('gsoBackdrop');
  const input     = document.getElementById('gsoInput');
  const closeBtn  = document.getElementById('gsoClose');
  const results   = document.getElementById('gsoResults');
  const openBtn   = document.getElementById('globalSearchBtn');
  if (!overlay || !input) return;

  // Index of all sections with metadata for searching
  const SECTION_INDEX = [
    { id:'overview',         icon:'🏛️', title:'Overview of Eritrea',         desc:'Capital, population, area, and general facts' },
    { id:'history',          icon:'📜', title:'History',                      desc:'Ancient kingdoms, Italian colonialism, independence war' },
    { id:'geography',        icon:'🗺️', title:'Geography & Landscape',       desc:'Highlands, lowlands, Red Sea coast' },
    { id:'regions',          icon:'🗾', title:'Regions of Eritrea',           desc:'Maekel, Debub, Anseba, Gash-Barka, Northern & Southern Red Sea' },
    { id:'people',           icon:'👥', title:'People & Ethnic Groups',       desc:'9 ethnic groups: Tigrinya, Tigre, Saho, Afar, Kunama, Bilen, Nara, Rashaida, Hedareb' },
    { id:'culture',          icon:'🎭', title:'Culture & Traditions',         desc:'Music, dance, art, coffee ceremony, festivals' },
    { id:'recipes',          icon:'🍽️', title:'Eritrean Recipes',             desc:'Injera, tsebhi, zigni, kicha, shiro and more' },
    { id:'economy',          icon:'💰', title:'Economy',                      desc:'Agriculture, mining, Red Sea ports, Nakfa currency' },
    { id:'famous',           icon:'⭐', title:'Famous Eritreans',             desc:'Athletes, artists, politicians, scientists' },
    { id:'artists',          icon:'🎵', title:'Eritrean Artists',             desc:'Abraham Afewerki, Helen Meles, musicians and performers' },
    { id:'government',       icon:'⚖️', title:'Government & Politics',       desc:'President Isaias Afwerki, PFDJ, National Assembly' },
    { id:'cultural-calendar',icon:'📅', title:'Cultural Calendar',            desc:'Eritrean holidays, festivals, and important dates' },
    { id:'holidays',         icon:'🗓️', title:'Public Holidays',              desc:'Independence Day, Martyrs Day, Christmas, Eid' },
    { id:'languages',        icon:'🗣️', title:'Languages of Eritrea',        desc:'Tigrinya, Tigre, Saho, Afar, Arabic, and more' },
    { id:'gallery',          icon:'📸', title:'Photo Gallery',                desc:'Landscapes, cities, culture, and people of Eritrea' },
    { id:'translator',       icon:'🌐', title:'Tigrinya Translator',          desc:'Translate between Tigrinya and English' },
    { id:'tourism',          icon:'✈️', title:'Tourism Guide',                desc:'Asmara, Massawa, Dahlak Archipelago, Qohaito' },
    { id:'blog',             icon:'📖', title:'Blog & Articles',              desc:'Stories, analysis, and features about Eritrea' },
    { id:'quiz',             icon:'🏆', title:'Eritrea Knowledge Quiz',       desc:'Test your knowledge about Eritrea' },
    { id:'community',        icon:'🤝', title:'Community Stories',            desc:'Diaspora stories, travel guides, community posts' },
    { id:'fidel',            icon:'🔤', title:"Ge'ez Fidel Alphabet",         desc:'231 Tigrinya characters with pronunciation' },
    { id:'lessons',          icon:'📖', title:'Tigrinya Lessons',             desc:'Alphabet, numbers, colors, days, common phrases' },
    { id:'proverbs',         icon:'💬', title:'Eritrean Proverbs',            desc:'Ancient Tigrinya wisdom and sayings' },
    { id:'poetry',           icon:'📝', title:'Eritrean Poetry',              desc:'Famous Tigrinya poems with translation' },
    { id:'facts',            icon:'🌟', title:'Fact Generator',               desc:'Random fascinating facts about Eritrea' },
    { id:'diaspora-map',     icon:'🌍', title:'Diaspora Map',                 desc:'Eritrean communities around the world' },
    { id:'compare',          icon:'📊', title:'Country Comparisons',          desc:'Compare Eritrea to other nations' },
    { id:'cooking-videos',   icon:'🎬', title:'Cooking Videos',               desc:'Video tutorials for Eritrean dishes' },
    { id:'events',           icon:'📅', title:'Events & News',                desc:'Upcoming Eritrean community events' },
    { id:'directory',        icon:'📋', title:'Directory',                    desc:'Eritrean businesses, services, and organizations' },
    { id:'news',             icon:'📰', title:'Latest News',                  desc:'News and updates from Eritrea' },
    { id:'eritrea-map',      icon:'🗺️', title:'Interactive Map',             desc:'Explore Eritrea on an interactive Leaflet map' },
    { id:'world-search',     icon:'🌍', title:'World Search',                 desc:'Ask any question and get an AI-powered answer' },
    { id:'quick-facts',      icon:'📌', title:'Quick Facts',                  desc:'Capital, population, area, currency, calling code' },
  ];

  function openGSO() {
    overlay.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    setTimeout(() => input.focus(), 50);
    showResults('');
  }

  function closeGSO() {
    overlay.setAttribute('hidden', '');
    document.body.style.overflow = '';
    input.value = '';
  }

  function highlight(text, query) {
    if (!query) return text;
    const re = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return text.replace(re, '<mark>$1</mark>');
  }

  function showResults(query) {
    const q = query.trim().toLowerCase();
    if (!q) {
      results.innerHTML = '<div class="gso-results-hint">Start typing to search across all sections…</div>';
      return;
    }
    const matches = SECTION_INDEX.filter(s =>
      s.title.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q)
    );
    if (!matches.length) {
      results.innerHTML = '<div class="gso-no-results">No sections found for "<strong>' + query + '</strong>". Try another keyword.</div>';
      return;
    }
    results.innerHTML = matches.map(s => `
      <a class="gso-result-item" href="#${s.id}" tabindex="0">
        <span class="gso-result-icon">${s.icon}</span>
        <span class="gso-result-text">
          <span class="gso-result-title">${highlight(s.title, query)}</span>
          <span class="gso-result-desc">${highlight(s.desc, query)}</span>
        </span>
      </a>`).join('');

    results.querySelectorAll('.gso-result-item').forEach(item => {
      item.addEventListener('click', () => {
        closeGSO();
        const target = document.querySelector(item.getAttribute('href'));
        if (target) {
          setTimeout(() => {
            const top = target.getBoundingClientRect().top + window.scrollY - 80;
            window.scrollTo({ top, behavior: 'smooth' });
          }, 80);
        }
      });
    });
  }

  input.addEventListener('input', () => showResults(input.value));

  // Quick-jump chips
  document.querySelectorAll('.gso-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const sec = chip.getAttribute('data-section');
      closeGSO();
      const target = document.getElementById(sec);
      if (target) {
        setTimeout(() => {
          const top = target.getBoundingClientRect().top + window.scrollY - 80;
          window.scrollTo({ top, behavior: 'smooth' });
        }, 80);
      }
    });
  });

  if (openBtn)   openBtn.addEventListener('click', openGSO);
  if (closeBtn)  closeBtn.addEventListener('click', closeGSO);
  if (backdrop)  backdrop.addEventListener('click', closeGSO);

  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeGSO();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const first = results.querySelector('.gso-result-item');
      if (first) first.focus();
    }
  });

  results.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeGSO(); return; }
    const items = [...results.querySelectorAll('.gso-result-item')];
    const idx = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' && idx < items.length - 1) { e.preventDefault(); items[idx + 1].focus(); }
    if (e.key === 'ArrowUp')  {
      e.preventDefault();
      if (idx <= 0) input.focus();
      else items[idx - 1].focus();
    }
  });

  // Expose open function globally for keyboard shortcut
  window.openGlobalSearch = openGSO;
})();

// ── KEYBOARD SHORTCUT: '/' to open global search ─────────
document.addEventListener('keydown', e => {
  if (e.key !== '/') return;
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  e.preventDefault();
  if (window.openGlobalSearch) window.openGlobalSearch();
});

// ── NEWS FEED ────────────────────────────────────────────
(async function loadNewsSection() {
  const grid = document.getElementById('newsGrid');
  if (!grid) return;
  // If the tabbed news system is on the page it owns #newsGrid — don't conflict
  if (document.getElementById('newsTabsRow')) return;

  // Hardcoded fallback so the section is never empty
  const STATIC_FALLBACK = [
    { tag:'Eritrea', title:'Eritrea marks 32 years of independence', excerpt:'Eritreans worldwide celebrate May 24th — the day EPLF forces liberated Asmara in 1991 and independence was declared in 1993.', link:'https://en.wikipedia.org/wiki/Eritrean_Independence_Day', date:'', source:'EritreanInfo' },
    { tag:'Culture', title:'Asmara named UNESCO World Heritage City', excerpt:"Asmara's extraordinary collection of Modernist Italian architecture earned UNESCO recognition in 2017, drawing global tourists.", link:'https://en.wikipedia.org/wiki/Asmara', date:'', source:'Wikipedia' },
    { tag:'Sports', title:'Biniam Girmay makes cycling history', excerpt:'The Eritrean sprinter became the first Black African to win a Grand Tour stage — a milestone for African cycling.', link:'https://en.wikipedia.org/wiki/Biniam_Girmay', date:'', source:'EritreanInfo' },
    { tag:'Language', title:'Tigrinya — one of the oldest written languages in Africa', excerpt:"Written in the ancient Ge'ez script, Tigrinya is spoken by over 7 million people across Eritrea and Ethiopia.", link:'https://en.wikipedia.org/wiki/Tigrinya_language', date:'', source:'Wikipedia' },
    { tag:'Nature', title:'Dahlak Archipelago — Red Sea diving paradise', excerpt:'The 200+ islands of the Dahlak Archipelago offer pristine coral reefs and stunning marine biodiversity.', link:'https://en.wikipedia.org/wiki/Dahlak_Archipelago', date:'', source:'EritreanInfo' },
    { tag:'History', title:"The Aksumite Empire: Eritrea's ancient legacy", excerpt:'The Aksumite Empire, centered in modern Eritrea and Ethiopia, was one of four great world powers of the ancient era.', link:'https://en.wikipedia.org/wiki/Aksumite_Empire', date:'', source:'Wikipedia' },
  ];

  function renderStaticFallback() {
    grid.innerHTML = STATIC_FALLBACK.map(n => `
      <div class="news-card"><div class="news-body">
        <span class="news-tag">${escHtml(n.tag)}</span>
        <h3 class="news-title">${escHtml(n.title)}</h3>
        <p class="news-excerpt">${escHtml(n.excerpt)}</p>
        <div class="news-meta"><span class="news-source">📚 ${escHtml(n.source)}</span></div>
        <a href="${escHtml(n.link)}" target="_blank" rel="noopener" class="news-read-more">Read more →</a>
      </div></div>`).join('');
  }

  try {
    const [appMod, fsMod] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'),
    ]);
    const app = appMod.getApps().length ? appMod.getApps()[0] : appMod.initializeApp(FIREBASE_CONFIG);
    const db  = fsMod.getFirestore(app);
    // Use a simple collection read first (no compound index needed), then filter client-side
    const colRef = fsMod.collection(db, 'eri_news');
    const snap = await Promise.race([
      fsMod.getDocs(fsMod.query(colRef, fsMod.orderBy('publishedAt', 'desc'), fsMod.limit(12))),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000)),
    ]);
    const docs = [];
    snap.forEach(doc => { const d = doc.data(); if (d.status === 'published' || !d.status) docs.push(d); });
    docs.sort((a, b) => (b.publishedAt?.seconds || 0) - (a.publishedAt?.seconds || 0));
    const visible = docs.slice(0, 6);
    if (!visible.length) { renderStaticFallback(); return; }
    grid.innerHTML = '';
    visible.forEach(d => {
      const date = d.publishedAt?.toDate ? d.publishedAt.toDate().toLocaleDateString('en-GB', { year:'numeric', month:'short', day:'numeric' }) : '';
      grid.insertAdjacentHTML('beforeend', `
        <div class="news-card">
          ${d.imageUrl ? `<div class="news-img-wrap"><img src="${escHtml(d.imageUrl)}" alt="${escHtml(d.title||'')}" loading="lazy" onerror="this.parentElement.remove()"/></div>` : ''}
          <div class="news-body">
            ${d.tag ? `<span class="news-tag">${escHtml(d.tag)}</span>` : ''}
            <h3 class="news-title">${escHtml(d.title||'')}</h3>
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
    console.warn('[News Firestore]', err.message);
    renderStaticFallback();
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

  const STATIC_ARTICLES = [
    { cat:'History',  title:'The 30-Year Liberation Struggle',            excerpt:'From 1961 to 1991, Eritrea fought one of Africa\'s longest independence wars against Ethiopian occupation — a story of extraordinary sacrifice and determination.',                 link:'https://en.wikipedia.org/wiki/Eritrean_War_of_Independence',   author:'EritreanInfo' },
    { cat:'Culture',  title:'Eritrean Coffee Ceremony: The Art of Bunna', excerpt:'Three rounds of coffee, incense, and deep conversation — the Eritrean coffee ceremony is a centuries-old ritual that brings families and communities together.',                      link:'https://en.wikipedia.org/wiki/Coffee_in_Eritrea',               author:'EritreanInfo' },
    { cat:'Sports',   title:'Biniam Girmay: Cycling\'s New Legend',       excerpt:'The young Eritrean sprinter made history as the first Black African to win a Grand Tour stage, opening the door for a new generation of African cyclists on the world stage.',        link:'https://en.wikipedia.org/wiki/Biniam_Girmay',                   author:'EritreanInfo' },
    { cat:'Diaspora', title:'Eritrean Communities Around the World',      excerpt:'From Stockholm to San Diego, the Eritrean diaspora has built vibrant communities preserving language, music, food, and faith far from home.',                                          link:'https://en.wikipedia.org/wiki/Eritrean_diaspora',               author:'EritreanInfo' },
    { cat:'Heritage', title:'Asmara: City of Art Deco Treasures',         excerpt:'Walk through Asmara\'s streets and you\'ll find a living museum of 1930s Italian Modernist architecture — a UNESCO World Heritage Site unlike any other in Africa.',                 link:'https://en.wikipedia.org/wiki/Asmara',                          author:'EritreanInfo' },
    { cat:'Nature',   title:'The Dahlak Archipelago: Red Sea Paradise',   excerpt:'Over 200 islands scattered across the Red Sea, home to pristine coral reefs and marine life that rivals any tropical destination — one of Africa\'s best-kept secrets.',               link:'https://en.wikipedia.org/wiki/Dahlak_Archipelago',              author:'EritreanInfo' },
  ];

  function renderStatic() {
    grid.innerHTML = STATIC_ARTICLES.map(a => `
      <a class="blog-card" href="${escHtml(a.link)}" target="_blank" rel="noopener">
        <div class="blog-body">
          <span class="blog-cat">${escHtml(a.cat)}</span>
          <h3 class="blog-title">${escHtml(a.title)}</h3>
          <p class="blog-excerpt">${escHtml(a.excerpt)}</p>
          <div class="blog-footer">
            <span class="blog-author">✍️ ${escHtml(a.author)}</span>
            <span class="blog-read-more">Read more →</span>
          </div>
        </div>
      </a>
    `).join('');
  }

  renderStatic(); // Show immediately — never blank

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
    if (snap.empty) return; // Keep static articles displayed
    grid.innerHTML = '';
    snap.forEach(doc => {
      const d = doc.data();
      const date = d.publishedAt?.toDate ? d.publishedAt.toDate().toLocaleDateString('en-GB', { year:'numeric', month:'short', day:'numeric' }) : '';
      grid.insertAdjacentHTML('beforeend', `
        <a class="blog-card" href="${escHtml(d.link || '#')}" target="_blank" rel="noopener">
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
        </a>
      `);
    });
  } catch (err) {
    console.warn('[Blog]', err);
    // Keep static articles — no error message shown to user
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

// ── MUSIC PHONE WIDGET v2 ────────────────────────────────────────
(function initMusicPhoneWidget() {
  // ─ DOM refs
  const tabBtn    = document.getElementById('musicPhoneTab');
  const frame     = document.getElementById('musicPhoneFrame');
  const closeBtn  = document.getElementById('mpfClose');
  const mpfAudio  = document.getElementById('mpfAudio');
  const playBtn   = document.getElementById('mpfPlay');
  const prevBtn   = document.getElementById('mpfPrev');
  const nextBtn   = document.getElementById('mpfNext');
  const shuffleBtn= document.getElementById('mpfShuffle');
  const repeatBtn = document.getElementById('mpfRepeat');
  const likeBtn   = document.getElementById('mpfLikeBtn');
  const volSlider = document.getElementById('mpfVolume');
  const playlist  = document.getElementById('mpfPlaylist');
  const progFill  = document.getElementById('mpfProgressFill');
  const progThumb = document.getElementById('mpfProgressThumb');
  const progBar   = document.getElementById('mpfProgressBar');
  const curEl     = document.getElementById('mpfCurrent');
  const durEl     = document.getElementById('mpfDuration');
  const titleEl   = document.getElementById('mpfTrackTitle');
  const artistEl  = document.getElementById('mpfTrackArtist');
  const disc      = document.getElementById('mpfDisc');
  const discRing  = document.getElementById('mpfDiscRing');
  const viz       = document.getElementById('mpfViz');
  const countEl   = document.getElementById('mpfTrackCount');
  const timeEl    = document.getElementById('mpfTime');
  const searchEl  = document.getElementById('mpfSearch');
  const filterRow = document.getElementById('mpfFilterRow');
  const miniPill  = document.getElementById('mpfMiniPill');
  const miniDisc  = document.getElementById('mpfMiniDisc');
  const miniTitle = document.getElementById('mpfMiniTitle');
  const miniArtist= document.getElementById('mpfMiniArtist');
  const miniViz   = document.getElementById('mpfMiniViz');
  const miniPlay  = document.getElementById('mpfMiniPlay');
  const miniPrev  = document.getElementById('mpfMiniPrev');
  const miniNext  = document.getElementById('mpfMiniNext');
  const miniExpand= document.getElementById('mpfMiniExpand');

  if (!tabBtn || !frame) return;

  // ─ State
  let tracks       = [];
  let playOrder    = [];   // may be shuffled
  let currentIdx   = -1;  // index into playOrder
  let tracksLoaded = false;
  let shuffle      = false;
  let repeat       = 'none';   // 'none' | 'one' | 'all'
  let activeFilter = 'all';
  let searchQuery  = '';
  const LIKED_KEY  = 'mpf_liked_v2';
  const LAST_KEY   = 'mpf_last_v2';

  function getLiked() { try { return new Set(JSON.parse(localStorage.getItem(LIKED_KEY) || '[]')); } catch { return new Set(); } }
  function saveLiked(s) { localStorage.setItem(LIKED_KEY, JSON.stringify([...s])); }
  let liked = getLiked();

  // ─ Disc gradient themes (cycles per track)
  const DISC_THEMES = [
    { from:'#007A3D', to:'#004d27', glow:'rgba(0,122,61,.5)'   },
    { from:'#4189DD', to:'#2d6abf', glow:'rgba(65,137,221,.5)' },
    { from:'#CE1126', to:'#8a0b1a', glow:'rgba(206,17,38,.5)'  },
    { from:'#D4A017', to:'#a07800', glow:'rgba(212,160,23,.5)' },
    { from:'#8B5CF6', to:'#5b21b6', glow:'rgba(139,92,246,.5)' },
    { from:'#EC4899', to:'#9d174d', glow:'rgba(236,72,153,.5)' },
    { from:'#14B8A6', to:'#0f766e', glow:'rgba(20,184,166,.5)' },
    { from:'#F97316', to:'#c2410c', glow:'rgba(249,115,22,.5)' },
  ];
  const DISC_EMOJIS = ['🎵','🎶','🎤','🎸','🎹','🥁','🎺','🎻','🪗','🎙️'];

  // ─ Helpers
  function fmtTime(s) {
    if (!isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    return `${m}:${Math.floor(s % 60).toString().padStart(2,'0')}`;
  }
  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  const UNK = ['ዘይፍለጥ','unknown','Unknown Artist','ዘይፍለጥ ስነጦባዊ'];
  function cleanField(raw, fb) {
    if (!raw) return fb;
    let s = String(raw);
    try { s = decodeURIComponent(s.replace(/\+/g,' ')); } catch {}
    if (s.includes('==')) s = s.split('==')[0].trim();
    s = s.replace(/\.(mp3|m4a|wav|flac|ogg|aac|opus)$/i,'').replace(/_+/g,' ').replace(/\s{2,}/g,' ').trim();
    return s || fb;
  }
  function cleanTitle(t) { return cleanField(t.title, 'Unknown Song'); }
  function cleanArtist(t) {
    const r = cleanField(t.artist, '');
    return (!r || UNK.some(p => r.startsWith(p))) ? 'Eritrean Artist' : r;
  }

  // ─ Clock in status bar
  function updateClock() {
    if (timeEl) timeEl.textContent = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', hour12:false });
  }
  updateClock();
  setInterval(updateClock, 30000);

  // ─ Open / close
  function openFrame() {
    frame.removeAttribute('hidden');
    miniPill?.setAttribute('hidden','');
    if (!tracksLoaded) loadTracks();
  }
  function closeFrame() {
    frame.setAttribute('hidden','');
    if (!mpfAudio.paused) showMiniPill();
  }

  tabBtn.addEventListener('click', () => frame.hidden ? openFrame() : closeFrame());
  closeBtn.addEventListener('click', closeFrame);
  closeBtn.addEventListener('keydown', e => { if (e.key==='Enter'||e.key===' ') closeFrame(); });
  miniExpand?.addEventListener('click', openFrame);

  // ─ Mini pill
  function showMiniPill() {
    if (!miniPill) return;
    miniPill.removeAttribute('hidden');
  }
  function hideMiniPill() {
    miniPill?.setAttribute('hidden','');
  }
  function updateMiniPill() {
    if (!miniPill || miniPill.hidden) return;
    const t = tracks[playOrder[currentIdx]];
    if (!t) return;
    if (miniTitle)  miniTitle.textContent  = cleanTitle(t).slice(0, 30);
    if (miniArtist) miniArtist.textContent = cleanArtist(t).slice(0, 24);
    const playing = !mpfAudio.paused;
    miniPlay?.textContent && (miniPlay.textContent = playing ? '⏸' : '▶');
    miniDisc?.classList.toggle('spinning', playing);
    miniViz?.classList.toggle('active', playing);
  }
  miniPlay?.addEventListener('click', togglePlayPause);
  miniPrev?.addEventListener('click', playPrev);
  miniNext?.addEventListener('click', playNext);

  // ─ Load tracks from Firebase
  async function loadTracks() {
    tracksLoaded = true;
    if (playlist) playlist.innerHTML = '<div class="mpf-loading">🎵 Loading music…</div>';
    try {
      const [appMod, fsMod] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'),
      ]);
      const app  = appMod.getApps().length ? appMod.getApps()[0] : appMod.initializeApp(FIREBASE_CONFIG);
      const db   = fsMod.getFirestore(app);
      const snap = await fsMod.getDocs(
        fsMod.query(fsMod.collection(db,'eri_tracks'), fsMod.orderBy('addedAt','desc'), fsMod.limit(300))
      );
      tracks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      buildOrder();
      renderPlaylist();
      // Restore last played track
      try {
        const last = JSON.parse(localStorage.getItem(LAST_KEY));
        if (last && typeof last.globalIdx === 'number') {
          highlightRow(last.globalIdx);
          titleEl.textContent  = cleanTitle(tracks[last.globalIdx] || {});
          artistEl.textContent = cleanArtist(tracks[last.globalIdx] || {});
        }
      } catch {}
    } catch (err) {
      if (playlist) playlist.innerHTML = '<div class="mpf-loading">Could not load music — check connection</div>';
      console.warn('[MusicWidget]', err);
    }
  }

  // ─ Build playback order (respects shuffle)
  function buildOrder() {
    playOrder = tracks.map((_,i) => i);
    if (shuffle) {
      for (let i = playOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [playOrder[i], playOrder[j]] = [playOrder[j], playOrder[i]];
      }
    }
  }

  // ─ Filter visible tracks (search + liked)
  function filteredIndices() {
    const q = searchQuery.toLowerCase();
    return tracks.reduce((acc, t, i) => {
      if (activeFilter === 'liked' && !liked.has(t.id)) return acc;
      if (q && !cleanTitle(t).toLowerCase().includes(q) && !cleanArtist(t).toLowerCase().includes(q)) return acc;
      acc.push(i);
      return acc;
    }, []);
  }

  // ─ Render playlist
  function renderPlaylist() {
    if (!playlist) return;
    const indices = filteredIndices();
    if (!tracks.length) {
      playlist.innerHTML = '<div class="mpf-loading">No songs yet — Admin → Eri Music to add tracks</div>';
      if (countEl) countEl.textContent = '0 songs';
      return;
    }
    if (!indices.length) {
      playlist.innerHTML = '<div class="mpf-loading">No results found</div>';
      return;
    }
    if (countEl) countEl.textContent = `${tracks.length} ደርፍታት`;

    playlist.innerHTML = indices.map(i => {
      const t = tracks[i];
      const isLiked = liked.has(t.id);
      const isActive = playOrder[currentIdx] === i;
      return `<div class="mpf-track-row${isActive?' active':''}" data-global="${i}">` +
        `<div class="mpf-track-playing-icon"><span></span><span></span><span></span></div>` +
        `<span class="mpf-track-num">${i + 1}</span>` +
        `<div class="mpf-track-row-info">` +
          `<div class="mpf-track-row-title">${escHtml(cleanTitle(t))}</div>` +
          `<div class="mpf-track-row-artist">${escHtml(cleanArtist(t))}</div>` +
        `</div>` +
        `<button class="mpf-track-row-like${isLiked?' liked':''}" data-id="${t.id}" title="${isLiked?'Unlike':'Like'}">${isLiked?'♥':'♡'}</button>` +
      `</div>`;
    }).join('');

    playlist.querySelectorAll('.mpf-track-row').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.classList.contains('mpf-track-row-like')) return;
        const gi = +row.dataset.global;
        // Find this global index in playOrder (or just play directly)
        let poi = playOrder.indexOf(gi);
        if (poi < 0) { playOrder.unshift(gi); poi = 0; }
        playOrderIdx(poi);
      });
      row.querySelector('.mpf-track-row-like')?.addEventListener('click', e => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.id;
        if (liked.has(id)) { liked.delete(id); } else { liked.add(id); }
        saveLiked(liked);
        renderPlaylist();
        updateLikeBtn();
      });
    });
  }

  // ─ Highlight current row in playlist
  function highlightRow(globalIdx) {
    playlist?.querySelectorAll('.mpf-track-row').forEach(r =>
      r.classList.toggle('active', +r.dataset.global === globalIdx)
    );
    const active = playlist?.querySelector('.mpf-track-row.active');
    if (active) active.scrollIntoView({ block:'nearest', behavior:'smooth' });
  }

  // ─ Play by order index
  function playOrderIdx(poi) {
    if (poi < 0 || poi >= playOrder.length) return;
    currentIdx = poi;
    const globalIdx = playOrder[poi];
    const t = tracks[globalIdx];
    if (!t) return;

    titleEl.textContent  = cleanTitle(t);
    artistEl.textContent = cleanArtist(t);
    highlightRow(globalIdx);
    updateLikeBtn();
    applyDiscTheme(globalIdx);
    localStorage.setItem(LAST_KEY, JSON.stringify({ globalIdx }));

    if (!t.url) { setPlayState(false); return; }
    mpfAudio.src = t.url;
    mpfAudio.play().catch(e => console.warn('[Music]', e));
  }

  function playNext() {
    if (!playOrder.length) return;
    if (repeat === 'one') { mpfAudio.currentTime = 0; mpfAudio.play(); return; }
    const next = (currentIdx + 1) % playOrder.length;
    playOrderIdx(next);
  }
  function playPrev() {
    if (!playOrder.length) return;
    if (mpfAudio.currentTime > 3) { mpfAudio.currentTime = 0; return; }
    playOrderIdx((currentIdx - 1 + playOrder.length) % playOrder.length);
  }
  function togglePlayPause() {
    if (currentIdx < 0 && tracks.length > 0) { playOrderIdx(0); return; }
    if (mpfAudio.paused) { mpfAudio.play().catch(() => {}); }
    else { mpfAudio.pause(); }
  }

  // ─ Disc theme per track
  function applyDiscTheme(globalIdx) {
    const theme = DISC_THEMES[globalIdx % DISC_THEMES.length];
    const emoji = DISC_EMOJIS[globalIdx % DISC_EMOJIS.length];
    disc.style.background = `radial-gradient(circle at 38% 38%, ${theme.from}, #0a0b12)`;
    disc.style.borderColor = theme.from;
    disc.style.boxShadow   = `0 0 30px ${theme.glow}`;
    document.getElementById('mpfDiscEmoji').textContent = emoji;
    if (miniDisc) miniDisc.textContent = emoji;
  }

  // ─ Like button
  function updateLikeBtn() {
    if (!likeBtn) return;
    const t = tracks[playOrder[currentIdx]];
    const isLiked = t && liked.has(t.id);
    likeBtn.textContent = isLiked ? '♥' : '♡';
    likeBtn.classList.toggle('liked', !!isLiked);
  }
  likeBtn?.addEventListener('click', () => {
    const t = tracks[playOrder[currentIdx]];
    if (!t) return;
    if (liked.has(t.id)) { liked.delete(t.id); } else { liked.add(t.id); }
    saveLiked(liked);
    updateLikeBtn();
    renderPlaylist();
  });

  // ─ Set play state visuals
  function setPlayState(playing) {
    playBtn.textContent = playing ? '⏸' : '▶';
    disc.classList.toggle('spinning', playing);
    discRing?.classList.toggle('active', playing);
    viz.classList.toggle('active', playing);
    miniPlay && (miniPlay.textContent = playing ? '⏸' : '▶');
    miniDisc?.classList.toggle('spinning', playing);
    miniViz?.classList.toggle('active', playing);
  }

  // ─ Controls
  playBtn.addEventListener('click', togglePlayPause);
  prevBtn.addEventListener('click', playPrev);
  nextBtn.addEventListener('click', playNext);

  shuffleBtn?.addEventListener('click', () => {
    shuffle = !shuffle;
    shuffleBtn.classList.toggle('active', shuffle);
    const curGlobal = playOrder[currentIdx];
    buildOrder();
    currentIdx = playOrder.indexOf(curGlobal);
    if (currentIdx < 0) currentIdx = 0;
  });

  repeatBtn?.addEventListener('click', () => {
    const modes = ['none','all','one'];
    repeat = modes[(modes.indexOf(repeat) + 1) % modes.length];
    const icons = { none:'↺', all:'🔁', one:'🔂' };
    repeatBtn.textContent = icons[repeat];
    repeatBtn.classList.toggle('active', repeat !== 'none');
  });

  // ─ Volume
  mpfAudio.volume = 0.8;
  volSlider?.addEventListener('input', () => {
    mpfAudio.volume = volSlider.value / 100;
    const volIcon = document.getElementById('mpfVolIcon');
    if (volIcon) volIcon.textContent = volSlider.value == 0 ? '🔇' : volSlider.value < 40 ? '🔈' : '🔊';
  });

  // ─ Audio events
  mpfAudio.addEventListener('play',  () => setPlayState(true));
  mpfAudio.addEventListener('pause', () => setPlayState(false));
  mpfAudio.addEventListener('ended', () => {
    if (repeat === 'one') { mpfAudio.currentTime = 0; mpfAudio.play(); return; }
    if (repeat === 'all' || currentIdx < playOrder.length - 1) { playNext(); return; }
    setPlayState(false);
  });
  mpfAudio.addEventListener('timeupdate', () => {
    if (!mpfAudio.duration) return;
    const pct = (mpfAudio.currentTime / mpfAudio.duration) * 100;
    if (progFill) progFill.style.width = pct + '%';
    if (progThumb) progThumb.style.left = pct + '%';
    if (curEl) curEl.textContent = fmtTime(mpfAudio.currentTime);
    if (durEl) durEl.textContent = fmtTime(mpfAudio.duration);
    updateMiniPill();
  });

  // ─ Seek on progress bar (click + drag)
  let seeking = false;
  function seekTo(e) {
    if (!mpfAudio.duration || !progBar) return;
    const rect = progBar.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    mpfAudio.currentTime = Math.max(0, Math.min(1, x / rect.width)) * mpfAudio.duration;
  }
  progBar?.addEventListener('mousedown', e => { seeking = true; seekTo(e); });
  progBar?.addEventListener('touchstart', e => { seeking = true; seekTo(e); }, { passive: true });
  document.addEventListener('mousemove', e => { if (seeking) seekTo(e); });
  document.addEventListener('mouseup',  () => { seeking = false; });
  document.addEventListener('touchend', () => { seeking = false; });

  // ─ Search
  searchEl?.addEventListener('input', () => {
    searchQuery = searchEl.value.trim();
    renderPlaylist();
  });

  // ─ Filter tabs
  filterRow?.querySelectorAll('.mpf-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.filter;
      filterRow.querySelectorAll('.mpf-filter-btn').forEach(b => b.classList.toggle('active', b === btn));
      renderPlaylist();
    });
  });

  // ─ Keyboard shortcuts (only when frame is visible)
  document.addEventListener('keydown', e => {
    if (frame.hidden || document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
    if (e.key === ' ' && e.target === document.body) { e.preventDefault(); togglePlayPause(); }
    if (e.key === 'ArrowRight' && e.altKey) { e.preventDefault(); playNext(); }
    if (e.key === 'ArrowLeft'  && e.altKey) { e.preventDefault(); playPrev(); }
    if ((e.key === 'l' || e.key === 'L') && e.altKey) { likeBtn?.click(); }
  });

  // ─ Swipe down mini pill to close it on mobile
  let touchStartY = 0;
  miniPill?.addEventListener('touchstart', e => { touchStartY = e.touches[0].clientY; }, { passive:true });
  miniPill?.addEventListener('touchend', e => {
    if (e.changedTouches[0].clientY - touchStartY > 50) hideMiniPill();
  });
})();

// ══════════════════════════════════════════════════════════════
// ERITREAN INFO — NEW FEATURES BATCH
// ══════════════════════════════════════════════════════════════

// ── FEATURE 11: INTERACTIVE LEAFLET MAP ──────────────────────
const ERI_CITIES = [
  { name: 'Asmara', lat: 15.3384, lng: 38.9318, pop: '~963,000', desc: 'Capital city — UNESCO World Heritage Modernist architecture, cool highland climate at 2,325m altitude.', ico: '🏙️' },
  { name: 'Massawa', lat: 15.6095, lng: 39.4745, pop: '~32,000', desc: 'Ancient Red Sea port city, 3,000 years old. Ottoman architecture, Dahlak island gateway.', ico: '⚓' },
  { name: 'Keren', lat: 15.7770, lng: 38.4539, pop: '~75,000', desc: "Eritrea's 2nd city. Famous weekly camel market, Shrine of Our Lady of Keren, WWII battle sites.", ico: '🐪' },
  { name: 'Assab', lat: 13.0000, lng: 42.7350, pop: '~16,000', desc: 'Southern port city on the Red Sea, formerly Ethiopia\'s main sea outlet. Very hot and remote.', ico: '🌊' },
  { name: 'Mendefera', lat: 14.8872, lng: 38.8140, pop: '~25,000', desc: 'Capital of the Southern Region. Access point to ancient Qohaito archaeological sites.', ico: '⛰️' },
  { name: 'Barentu', lat: 15.1001, lng: 37.5906, pop: '~20,000', desc: 'Capital of Gash-Barka region — western lowland agricultural heartland. Home to Kunama people.', ico: '🌾' },
  { name: 'Adulis (Ruins)', lat: 15.2833, lng: 39.6167, pop: 'Ancient', desc: 'UNESCO candidate site — ruins of the greatest ancient Red Sea port, used by Aksumite Empire (1st–7th century AD).', ico: '🏺' },
];

function initLeafletMap() {
  const container = document.getElementById('eritreaLeafletMap');
  if (!container || typeof L === 'undefined') return;
  if (container.dataset.inited) return;
  container.dataset.inited = '1';

  const map = L.map('eritreaLeafletMap', { center: [15.1794, 39.7823], zoom: 7, zoomControl: true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 15
  }).addTo(map);

  ERI_CITIES.forEach(city => {
    const marker = L.marker([city.lat, city.lng]).addTo(map);
    marker.bindPopup(
      '<div style="font-family:Montserrat,sans-serif;max-width:200px">' +
      '<div style="font-size:1.4rem;margin-bottom:4px">' + city.ico + ' <strong>' + city.name + '</strong></div>' +
      '<div style="font-size:.75rem;color:#555;margin-bottom:6px">Pop: ' + city.pop + '</div>' +
      '<div style="font-size:.8rem;line-height:1.5">' + city.desc + '</div>' +
      '</div>'
    );
  });
}

// Try to init map after Leaflet script loads
window.addEventListener('load', () => setTimeout(initLeafletMap, 800));
// Also try when scrolled into view
(function() {
  const sec = document.getElementById('eritrea-map');
  if (!sec) return;
  let inited = false;
  const obs = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && !inited) { inited = true; setTimeout(initLeafletMap, 300); obs.disconnect(); }
  }, { threshold: 0.1 });
  obs.observe(sec);
})();

// ── FEATURE 12: ON THIS DAY ───────────────────────────────────
const ON_THIS_DAY_DATA = {
  '01-01': '1890 — Italy formally established the Colony of Eritrea, the first use of the name "Eritrea."',
  '02-11': '1975 — The Eritrean Liberation Front launched major offensives in the independence struggle.',
  '03-25': '1955 — The Eritrean Assembly, under pressure, voted to federate with Ethiopia.',
  '04-12': '1984 — Major EPLF victory at the Battle of Nakfa, securing the liberated zone.',
  '05-24': '1993 — 🎉 Eritrea officially declared independence! May 24 is celebrated as Independence Day.',
  '05-29': '1991 — EPLF captured Asmara, ending 30 years of armed independence struggle.',
  '06-20': 'Martyrs\' Day (Sehideti) — Eritrea honors the tens of thousands who gave their lives for independence.',
  '09-01': '1961 — Hamid Idris Awate fired the first shots of the Eritrean Liberation War, beginning a 30-year struggle.',
  '09-03': '2001 — The G-15 open letter to President Isaias calling for democratic reform was published.',
  '10-01': '1952 — Eritrea was federated with Ethiopia under UN Resolution 390A(V).',
  '11-14': '1962 — Ethiopia illegally annexed Eritrea, dissolving the federation and triggering full war.',
  '12-10': '2000 — The Algiers Peace Agreement formally ended the 1998–2000 Eritrea-Ethiopia War.',
};

function initOnThisDay() {
  if (localStorage.getItem('eri_otd_dismissed') === new Date().toDateString()) return;
  const today = new Date();
  const key = String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
  const event = ON_THIS_DAY_DATA[key];
  if (!event) return;
  const bar = document.getElementById('onThisDayBar');
  const el  = document.getElementById('onThisDayEvent');
  if (!bar || !el) return;
  el.textContent = event;
  bar.style.display = '';
  document.getElementById('onThisDayClose').addEventListener('click', () => {
    bar.style.display = 'none';
    localStorage.setItem('eri_otd_dismissed', new Date().toDateString());
  });
}
initOnThisDay();

// ── FEATURE 13: TIGRINYA PHRASEBOOK SPEECHSYNTHESIS ──────────
(function initPhrasebookSpeech() {
  if (!window.speechSynthesis) return;
  function addSpeakBtn(item) {
    if (item.querySelector('.speak-btn')) return;
    const btn = document.createElement('button');
    btn.className = 'speak-btn';
    btn.title = 'Listen to pronunciation';
    btn.textContent = '🔊';
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const tiText = item.querySelector('.phrase-ti, [lang="ti"], .phrase-tigrinya');
      const text = tiText ? tiText.textContent : item.querySelector('.phrase-en, .phrase-text')?.textContent || item.textContent.slice(0, 60);
      if (!text) return;
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text.trim());
      utt.lang = 'ti';
      utt.rate = 0.85;
      const voices = window.speechSynthesis.getVoices();
      const tiVoice = voices.find(v => v.lang.startsWith('ti') || v.lang.startsWith('am'));
      if (tiVoice) utt.voice = tiVoice;
      window.speechSynthesis.speak(utt);
      btn.textContent = '🔉';
      utt.addEventListener('end', () => { btn.textContent = '🔊'; });
    });
    item.appendChild(btn);
  }

  function tryAddButtons() {
    document.querySelectorAll('.phrase-item').forEach(addSpeakBtn);
  }
  tryAddButtons();
  // Also observe phrasebook history items added dynamically
  const phrasebook = document.querySelector('.phrasebook');
  if (phrasebook) {
    new MutationObserver(tryAddButtons).observe(phrasebook, { childList: true, subtree: true });
  }
})();

// ── FEATURE 15: QUIZ SCORE LEADERBOARD ───────────────────────
const QUIZ_LB_KEY = 'eri_quiz_scores';
const MAX_LB_ENTRIES = 5;

function saveQuizScore(score, total) {
  const entry = { score, total, date: new Date().toLocaleDateString(), pct: Math.round(score / total * 100) };
  const scores = JSON.parse(localStorage.getItem(QUIZ_LB_KEY) || '[]');
  scores.push(entry);
  scores.sort((a, b) => b.pct - a.pct || b.score - a.score);
  localStorage.setItem(QUIZ_LB_KEY, JSON.stringify(scores.slice(0, MAX_LB_ENTRIES)));
}

function renderQuizLeaderboard() {
  const lb     = document.getElementById('quizLeaderboard');
  const list   = document.getElementById('quizLeaderboardList');
  const scores = JSON.parse(localStorage.getItem(QUIZ_LB_KEY) || '[]');
  if (!lb || !list || !scores.length) return;
  const medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];
  list.innerHTML = scores.map((s, i) =>
    '<div class="ql-row">' +
    '<span class="ql-medal">' + (medals[i] || '') + '</span>' +
    '<span class="ql-score">' + s.score + ' / ' + s.total + '</span>' +
    '<span class="ql-pct">' + s.pct + '%</span>' +
    '<span class="ql-date">' + s.date + '</span>' +
    '</div>'
  ).join('');
  lb.style.display = '';
}

// Patch quiz showResult to save score and render leaderboard
(function patchQuiz() {
  const origShowResult = window.showResult;
  // Fallback: observe quizResult becoming visible
  const resultEl = document.getElementById('quizResult');
  if (resultEl) {
    new MutationObserver(() => {
      if (!resultEl.hasAttribute('hidden')) {
        const scoreEl = document.getElementById('quizFinalScore');
        if (scoreEl && scoreEl.textContent) {
          const parts = scoreEl.textContent.split('/');
          if (parts.length === 2) {
            const score = parseInt(parts[0].trim(), 10);
            const total = parseInt(parts[1].trim(), 10);
            if (!isNaN(score) && !isNaN(total)) {
              saveQuizScore(score, total);
              renderQuizLeaderboard();
            }
          }
        }
      }
    }).observe(resultEl, { attributes: true, attributeFilter: ['hidden'] });
  }
})();

// ── FEATURE 16: BOOKMARKS ─────────────────────────────────────
const BK_KEY = 'eri_bookmarks';

function getBookmarks() { return JSON.parse(localStorage.getItem(BK_KEY) || '[]'); }
function saveBookmarks(bks) { localStorage.setItem(BK_KEY, JSON.stringify(bks)); }

function toggleBookmark(id, label) {
  const bks = getBookmarks();
  const idx = bks.findIndex(b => b.id === id);
  if (idx >= 0) bks.splice(idx, 1);
  else bks.push({ id, label, href: '#' + id });
  saveBookmarks(bks);
  renderBookmarkPanel();
  updateBookmarkCount();
}

function updateBookmarkCount() {
  const bks = getBookmarks();
  const cnt = document.getElementById('bookmarkCount');
  if (!cnt) return;
  cnt.style.display = bks.length ? 'flex' : 'none';
  cnt.textContent = bks.length;
}

function renderBookmarkPanel() {
  const list = document.getElementById('bookmarkList');
  if (!list) return;
  const bks = getBookmarks();
  if (!bks.length) { list.innerHTML = '<p class="bkp-empty">No bookmarks yet. Click 🔖 on any section to save it.</p>'; return; }
  list.innerHTML = bks.map(b =>
    '<div class="bkp-item">' +
    '<a href="' + b.href + '" class="bkp-link" onclick="document.getElementById(\'bookmarkPanel\').hidden=true">' + b.label + '</a>' +
    '<button class="bkp-remove" data-id="' + b.id + '">✕</button>' +
    '</div>'
  ).join('');
  list.querySelectorAll('.bkp-remove').forEach(btn => {
    btn.addEventListener('click', () => { toggleBookmark(btn.dataset.id, ''); });
  });
}

(function initBookmarks() {
  const fab   = document.getElementById('bookmarkFab');
  const panel = document.getElementById('bookmarkPanel');
  const close = document.getElementById('bookmarkClose');
  if (!fab || !panel) return;

  fab.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) renderBookmarkPanel();
  });
  if (close) close.addEventListener('click', () => { panel.hidden = true; });

  // Add bookmark icons to section headers
  const BOOKMARKABLE = [
    { id: 'overview',   label: '🏛️ Overview' },
    { id: 'history',    label: '📜 History' },
    { id: 'geography',  label: '🗺️ Geography' },
    { id: 'people',     label: '👥 People' },
    { id: 'culture',    label: '🎭 Culture' },
    { id: 'economy',    label: '💰 Economy' },
    { id: 'government', label: '⚖️ Government' },
    { id: 'recipes',    label: '🍽️ Recipes' },
    { id: 'tourism',    label: '✈️ Tourism' },
    { id: 'quiz',       label: '🏆 Quiz' },
  ];

  BOOKMARKABLE.forEach(({ id, label }) => {
    const section = document.getElementById(id);
    if (!section) return;
    const hdr = section.querySelector('.section-header, h2');
    if (!hdr) return;
    const btn = document.createElement('button');
    btn.className = 'section-bookmark-btn';
    btn.title = 'Bookmark this section';
    btn.dataset.id = id;
    btn.textContent = '🔖';
    btn.addEventListener('click', () => { toggleBookmark(id, label); btn.classList.toggle('active', getBookmarks().some(b => b.id === id)); });
    hdr.style.position = 'relative';
    hdr.appendChild(btn);
  });

  updateBookmarkCount();
})();

// ── FEATURE 17: RECIPE DETAIL MODAL ──────────────────────────
(function initRecipeModal() {
  const modal    = document.getElementById('recipeModal');
  const modalBox = document.getElementById('recipeModalBox');
  const closeBtn = document.getElementById('recipeModalClose');
  const printBtn = document.getElementById('recipePrintBtn');
  const body     = document.getElementById('recipeModalBody');
  const titleEl  = document.getElementById('recipeModalTitle');
  if (!modal || !body) return;

  if (closeBtn) closeBtn.addEventListener('click', () => { modal.hidden = true; document.body.style.overflow = ''; });
  modal.addEventListener('click', e => { if (e.target === modal) { modal.hidden = true; document.body.style.overflow = ''; } });
  if (printBtn) printBtn.addEventListener('click', () => {
    const w = window.open('', '_blank', 'width=700,height=900');
    w.document.write('<html><head><title>Recipe</title><style>body{font-family:sans-serif;padding:24px}h2{margin-bottom:8px}ul,ol{padding-left:20px}li{margin-bottom:6px}.ing-check{cursor:pointer}label{display:flex;align-items:flex-start;gap:8px;cursor:pointer;margin-bottom:4px}</style></head><body>');
    w.document.write('<h2>' + (titleEl ? titleEl.textContent : 'Recipe') + '</h2>');
    w.document.write(body.innerHTML);
    w.document.write('<br><script>window.onload=function(){window.print();window.close();}<\/script></body></html>');
    w.document.close();
  });

  function openRecipe(r) {
    if (!modal || !body || !titleEl) return;
    titleEl.textContent = r.emoji + ' ' + r.name;
    body.innerHTML =
      '<div class="rm-meta"><span>⏱ ' + r.time + '</span><span>🍽️ Serves ' + r.serves + '</span></div>' +
      '<div class="rm-cols">' +
      '<div class="rm-ingredients"><h4>🛒 Ingredients</h4><ul class="rm-ing-list">' +
      r.ingredients.map((ing, i) =>
        '<li><label class="rm-ing-item"><input type="checkbox" class="rm-cb" id="ing' + i + '"/><span>' + ing + '</span></label></li>'
      ).join('') +
      '</ul></div>' +
      '<div class="rm-steps"><h4>👨‍🍳 Steps</h4><ol>' +
      r.steps.map(s => '<li>' + s + '</li>').join('') +
      '</ol></div></div>' +
      '<div class="rm-tip">💡 <em>' + r.tip + '</em></div>';
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  // Wait for STATIC_RECIPES to be available then patch recipe cards
  function patchRecipeCards() {
    if (typeof STATIC_RECIPES === 'undefined') { setTimeout(patchRecipeCards, 500); return; }
    const grid = document.getElementById('recipeGrid');
    if (!grid) return;
    grid.addEventListener('click', e => {
      const card = e.target.closest('.recipe-card');
      if (!card) return;
      const btn = e.target.closest('.recipe-toggle, .recipe-card-header, h3');
      if (!btn) return;
      const idx = parseInt(card.id.replace('recipe-', ''), 10);
      if (!isNaN(idx) && STATIC_RECIPES[idx]) openRecipe(STATIC_RECIPES[idx]);
    });
    // Add "Open Details" to each card header
    grid.querySelectorAll('.recipe-card-header').forEach((hdr, idx) => {
      if (hdr.querySelector('.rm-open-btn')) return;
      const openBtn = document.createElement('button');
      openBtn.className = 'rm-open-btn recipe-toggle';
      openBtn.textContent = '📖 Details';
      openBtn.dataset.ri = idx;
      openBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (STATIC_RECIPES[idx]) openRecipe(STATIC_RECIPES[idx]);
      });
      hdr.appendChild(openBtn);
    });
  }
  setTimeout(patchRecipeCards, 800);
})();

// ── FEATURE 18: COMMUNITY STORIES VOTING ─────────────────────
(function initCommunityVoting() {
  const VOTED_KEY = 'eri_voted_posts';
  function getVoted() { return JSON.parse(localStorage.getItem(VOTED_KEY) || '[]'); }
  function markVoted(id) { const v = getVoted(); if (!v.includes(id)) { v.push(id); localStorage.setItem(VOTED_KEY, JSON.stringify(v)); } }

  async function upvotePost(id, btn) {
    if (getVoted().includes(id)) { return; }
    try {
      const [appMod, fsMod] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'),
      ]);
      const app  = appMod.getApps().length ? appMod.getApps()[0] : appMod.initializeApp(FIREBASE_CONFIG);
      const _db  = fsMod.getFirestore(app);
      await fsMod.updateDoc(fsMod.doc(_db, 'community_posts', id), { upvotes: fsMod.increment(1) });
      markVoted(id);
      const cnt = btn.querySelector('.vote-count');
      if (cnt) cnt.textContent = parseInt(cnt.textContent || '0', 10) + 1;
      btn.classList.add('voted');
      btn.title = 'Already voted';
    } catch(e) { console.warn('[Vote]', e); }
  }

  // Observe communityPostsGrid for new cards
  const grid = document.getElementById('communityPostsGrid');
  if (!grid) return;

  function addVoteButtons() {
    const voted = getVoted();
    grid.querySelectorAll('.community-post-card').forEach(card => {
      if (card.querySelector('.vote-btn')) return;
      const id = card.dataset.postId || card.getAttribute('data-id');
      if (!id) return;
      const votes = parseInt(card.dataset.upvotes || '0', 10);
      const isVoted = voted.includes(id);
      const btn = document.createElement('button');
      btn.className = 'vote-btn' + (isVoted ? ' voted' : '');
      btn.title = isVoted ? 'Already voted' : 'Like this story';
      btn.innerHTML = '❤️ <span class="vote-count">' + votes + '</span>';
      btn.addEventListener('click', () => upvotePost(id, btn));
      card.appendChild(btn);
    });
  }

  new MutationObserver(addVoteButtons).observe(grid, { childList: true });
  addVoteButtons();
})();

// ── FEATURE 20: RELATED SECTIONS (YOU MIGHT LIKE) ─────────────
const RELATED_MAP = {
  history:    [{ id: 'overview', label: '🏛️ Overview of Eritrea' }, { id: 'geography', label: '🗺️ Geography' }, { id: 'famous', label: '⭐ Famous Eritreans' }],
  geography:  [{ id: 'regions', label: '🗾 Explore the Regions' }, { id: 'eritrea-map', label: '🗺️ Interactive Map' }, { id: 'tourism', label: '✈️ Tourism Guide' }],
  people:     [{ id: 'culture', label: '🎭 Culture & Traditions' }, { id: 'languages', label: '🗣️ Languages' }, { id: 'community', label: '🤝 Community' }],
  culture:    [{ id: 'recipes', label: '🍽️ Recipes' }, { id: 'artists', label: '🎵 Famous Artists' }, { id: 'holidays', label: '🗓️ Holidays' }],
  economy:    [{ id: 'government', label: '⚖️ Government' }, { id: 'geography', label: '🗺️ Geography' }, { id: 'history', label: '📜 History' }],
  government: [{ id: 'history', label: '📜 History' }, { id: 'economy', label: '💰 Economy' }, { id: 'people', label: '👥 The People' }],
  recipes:    [{ id: 'culture', label: '🎭 Culture' }, { id: 'artists', label: '🎵 Artists' }, { id: 'community', label: '🤝 Community' }],
  tourism:    [{ id: 'geography', label: '🗺️ Geography' }, { id: 'eritrea-map', label: '🗺️ Interactive Map' }, { id: 'culture', label: '🎭 Culture' }],
  quiz:       [{ id: 'history', label: '📜 History' }, { id: 'overview', label: '🏛️ Overview' }, { id: 'famous', label: '⭐ Famous Eritreans' }],
};

function initRelatedSections() {
  Object.entries(RELATED_MAP).forEach(([sectionId, links]) => {
    const section = document.getElementById(sectionId);
    if (!section) return;
    const existing = section.querySelector('.related-sections-block');
    if (existing) return;
    const block = document.createElement('div');
    block.className = 'related-sections-block';
    block.innerHTML =
      '<div class="rs-title">You might also like</div>' +
      '<div class="rs-links">' +
      links.map(l => '<a href="#' + l.id + '" class="rs-link">' + l.label + ' →</a>').join('') +
      '</div>';
    const container = section.querySelector('.container');
    if (container) container.appendChild(block);
  });
}
initRelatedSections();

// ════════════════════════════════════════════════════════════════
//  ERITREAN INFO — BATCH 3 FEATURES  (11–20)
// ════════════════════════════════════════════════════════════════

// ── FEATURE 11: TIGRINYA WORD OF THE DAY ─────────────────────────
(function initWordOfDay() {
  const WORDS = [
    { word: 'ሰላም', roman: 'Selam', meaning: 'Peace / Hello — the universal Tigrinya greeting', example: 'ሰላም! ከመይ ኣለኻ?' },
    { word: 'ሃገር', roman: 'Hager', meaning: 'Country / Homeland', example: 'ሃገረ ኤርትራ — the State of Eritrea' },
    { word: 'ፍቕሪ', roman: 'Fiqri', meaning: 'Love', example: 'ፍቕሪ ሃገር — love of country' },
    { word: 'ጀጋኑ', roman: 'Jeganu', meaning: 'Heroes / Warriors', example: 'ጀጋኑ ኤርትራ — Heroes of Eritrea' },
    { word: 'ብርሃን', roman: 'Birhan', meaning: 'Light', example: 'ብርሃን ናይ ሃገር — Light of the nation' },
    { word: 'ሰብ', roman: 'Seb', meaning: 'Person / Human being', example: 'ሰብ ሃገር — a person of the country' },
    { word: 'ቤት', roman: 'Bet', meaning: 'House / Home', example: 'ቤተ-ክርስቲያን — church (house of Christ)' },
    { word: 'ማይ', roman: 'May', meaning: 'Water', example: 'ማይ ሂቡኒ — give me water' },
    { word: 'ምድሪ', roman: 'Midri', meaning: 'Earth / Land / Ground', example: 'ምድሪ ኤርትራ — the land of Eritrea' },
    { word: 'ዓወት', roman: 'Awet', meaning: 'Victory', example: 'ዓወት ንሓፋሽ! — Victory to the masses!' },
    { word: 'ሰማይ', roman: 'Semay', meaning: 'Sky / Heaven', example: 'ሰማይ ጸሊም — the sky is dark' },
    { word: 'ስድራቤት', roman: 'Sidra-bet', meaning: 'Family', example: 'ስድራቤተይ — my family' },
    { word: 'ሓቂ', roman: 'Haki', meaning: 'Truth', example: 'ሓቂ ኣዘንቱ — speak the truth' },
    { word: 'ተስፋ', roman: 'Tesfa', meaning: 'Hope', example: 'ተስፋ ኣይኮርዑን — don\'t lose hope' },
    { word: 'ጥዕና', roman: 'Tiena', meaning: 'Health', example: 'ጥዕናኻ ይሓሉ — may your health be guarded' },
    { word: 'ምህሮ', roman: 'Mihro', meaning: 'Education / Knowledge', example: 'ምህሮ ሓይሊ — education is power' },
    { word: 'ጽጋብ', roman: 'Tsigab', meaning: 'Satisfaction / Fullness', example: 'ጽጋብ ሂቡና — he gave us satisfaction' },
    { word: 'ዓለም', roman: 'Alem', meaning: 'World', example: 'ዓለም ሰፊሕ — the world is vast' },
    { word: 'ናጽነት', roman: 'Natsnet', meaning: 'Freedom / Independence', example: 'ናጽነት ኤርትራ — Independence of Eritrea' },
    { word: 'ኩራት', roman: 'Kurat', meaning: 'Pride', example: 'ኩራት ሃገር — pride of the country' },
    { word: 'ኣቦ', roman: 'Abo', meaning: 'Father', example: 'ኣቦ ኤርትራ — father of Eritrea' },
    { word: 'ኣደ', roman: 'Ade', meaning: 'Mother', example: 'ኣደ ኤርትራ — mother Eritrea' },
    { word: 'ወዲ', roman: 'Wedi', meaning: 'Son / Child (male)', example: 'ወዲ ሃገር — son of the nation' },
    { word: 'ልቢ', roman: 'Libi', meaning: 'Heart', example: 'ልቢ ሰብ — the human heart' },
    { word: 'ፀሓይ', roman: 'Tsehay', meaning: 'Sun', example: 'ፀሓይ ወጺኡ — the sun has risen' },
    { word: 'ሓዊ', roman: 'Hawi', meaning: 'Fire', example: 'ሓዊ ምጻር — kindling fire' },
    { word: 'ክንፊ', roman: 'Kinfi', meaning: 'Wing', example: 'ክንፊ ሃገር — wing of the nation' },
    { word: 'ጎደና', roman: 'Godena', meaning: 'Road / Path', example: 'ጎደና ሃገር — the road of the nation' },
    { word: 'ወርሒ', roman: 'Werhi', meaning: 'Month / Moon', example: 'ወርሒ ምሉእ — full moon' },
    { word: 'ዕዳጋ', roman: 'Idaga', meaning: 'Market', example: 'ዕዳጋ ኣስመራ — Asmara market' },
  ];

  const dayIdx = Math.floor(Date.now() / 86400000) % WORDS.length;
  const word = WORDS[dayIdx];

  const wodWord   = document.getElementById('wodWord');
  const wodRoman  = document.getElementById('wodRoman');
  const wodMeaning = document.getElementById('wodMeaning');
  const wodSpeak  = document.getElementById('wodSpeak');
  const widget    = document.getElementById('wordOfDayWidget');
  if (!wodWord || !word) return;

  wodWord.textContent    = word.word;
  wodRoman.textContent   = word.roman;
  wodMeaning.textContent = word.meaning;
  if (widget) widget.title = 'Example: ' + word.example;

  if (wodSpeak) {
    wodSpeak.addEventListener('click', () => {
      const utt = new SpeechSynthesisUtterance(word.word);
      utt.lang = 'ti'; utt.rate = 0.8;
      const voices = window.speechSynthesis.getVoices();
      const v = voices.find(v => v.lang.startsWith('ti') || v.lang.startsWith('am'));
      if (v) utt.voice = v;
      window.speechSynthesis.speak(utt);
    });
  }
})();


// ── FEATURE 12: CURRENCY CONVERTER ───────────────────────────────
(function initCurrencyConverter() {
  const RATES = { USD: 0.0067, EUR: 0.0062, ETB: 0.77, SAR: 0.025 };

  function convert() {
    const amtEl = document.getElementById('cwAmount');
    const dirEl = document.getElementById('cwDir');
    const curEl = document.getElementById('cwCurrency');
    const resEl = document.getElementById('cwResult');
    if (!amtEl || !resEl) return;

    const amt = parseFloat(amtEl.value) || 0;
    const dir = dirEl ? dirEl.value : 'from';
    const cur = curEl ? curEl.value : 'USD';
    const rate = RATES[cur] || 0.0067;
    const SYMBOLS = { USD: '$', EUR: '€', ETB: 'Br', SAR: '﷼' };
    const sym = SYMBOLS[cur] || '';

    if (dir === 'from') {
      const result = (amt * rate).toFixed(2);
      resEl.textContent = '= ' + sym + result + ' ' + cur;
    } else {
      const result = (amt / rate).toFixed(2);
      resEl.textContent = '= ' + result + ' ERN';
    }
  }

  ['cwAmount', 'cwDir', 'cwCurrency'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', convert);
  });
  convert();
})();


// ── FEATURE 13: ASMARA WEATHER WIDGET ────────────────────────────
(function initWeatherWidget() {
  const CACHE_KEY = 'eri_weather_cache';
  const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
  const WEATHER_CODES = {
    0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
    45: '🌫️', 48: '🌫️',
    51: '🌦️', 53: '🌦️', 55: '🌦️',
    61: '🌧️', 63: '🌧️', 65: '🌧️',
    71: '🌨️', 73: '🌨️', 75: '❄️',
    80: '🌦️', 81: '🌧️', 82: '⛈️',
    95: '⛈️', 96: '⛈️', 99: '⛈️',
  };

  async function fetchWeather() {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

    const resp = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=15.3384&longitude=38.9318&current_weather=true&temperature_unit=celsius'
    );
    const json = await resp.json();
    const data = json.current_weather;
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
    return data;
  }

  async function renderWeather() {
    const tempEl = document.getElementById('wwTemp');
    const iconEl = document.getElementById('wwIcon');
    if (!tempEl) return;
    try {
      const w = await fetchWeather();
      if (!w) return;
      tempEl.textContent = Math.round(w.temperature) + '°C';
      if (iconEl) iconEl.textContent = WEATHER_CODES[w.weathercode] || '🌡️';
    } catch(e) {
      if (tempEl) tempEl.textContent = '—°C';
    }
  }

  renderWeather();
})();


// ── FEATURE 15: EMOJI REACTIONS ON COMMUNITY POSTS ───────────────
(function initEmojiReactions() {
  const REACT_KEY_PREFIX = 'eri_reactions_';
  const EMOJIS = ['❤️', '👍', '🙏', '🇪🇷'];

  function getUserReactions(postId) {
    try { return JSON.parse(localStorage.getItem(REACT_KEY_PREFIX + postId) || '[]'); } catch(e) { return []; }
  }
  function saveUserReactions(postId, arr) {
    localStorage.setItem(REACT_KEY_PREFIX + postId, JSON.stringify(arr));
  }

  async function toggleReaction(postId, emoji, btn) {
    const userReacts = getUserReactions(postId);
    const already = userReacts.includes(emoji);

    if (already) {
      userReacts.splice(userReacts.indexOf(emoji), 1);
      btn.classList.remove('reacted');
    } else {
      userReacts.push(emoji);
      btn.classList.add('reacted');
    }
    saveUserReactions(postId, userReacts);

    // Update Firestore reaction count
    try {
      const [appMod, fsMod] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'),
      ]);
      const app  = appMod.getApps().length ? appMod.getApps()[0] : appMod.initializeApp(FIREBASE_CONFIG);
      const _db  = fsMod.getFirestore(app);
      const field = 'reactions.' + emoji.codePointAt(0).toString(16);
      const delta = already ? fsMod.increment(-1) : fsMod.increment(1);
      await fsMod.updateDoc(fsMod.doc(_db, 'community_posts', postId), { [field]: delta });
    } catch(e) { /* graceful fail */ }

    // Update count display
    const countEl = btn.querySelector('.react-count');
    if (countEl) {
      const current = parseInt(countEl.textContent) || 0;
      countEl.textContent = Math.max(0, current + (already ? -1 : 1));
    }
  }

  function addReactionBar(card) {
    if (card.querySelector('.reaction-bar')) return;
    const postId = card.dataset.postId || card.getAttribute('data-id');
    if (!postId) return;
    const userReacts = getUserReactions(postId);

    const bar = document.createElement('div');
    bar.className = 'reaction-bar';
    EMOJIS.forEach(emoji => {
      const btn = document.createElement('button');
      btn.className = 'react-btn' + (userReacts.includes(emoji) ? ' reacted' : '');
      btn.innerHTML = emoji + ' <span class="react-count">0</span>';
      btn.addEventListener('click', e => { e.stopPropagation(); toggleReaction(postId, emoji, btn); });
      bar.appendChild(btn);
    });
    card.appendChild(bar);
  }

  const grid = document.getElementById('communityPostsGrid');
  if (grid) {
    new MutationObserver(() => {
      grid.querySelectorAll('.community-post-card').forEach(addReactionBar);
    }).observe(grid, { childList: true });
    grid.querySelectorAll('.community-post-card').forEach(addReactionBar);
  }
})();


// ── FEATURE 16: DEMOGRAPHICS DONUT CHART ─────────────────────────
(function initDemographicsChart() {
  const canvas = document.getElementById('demographicsChart');
  if (!canvas) return;

  const DATA = [
    { label: 'Tigrinya',  pct: 55, color: '#007A3D' },
    { label: 'Tigre',     pct: 30, color: '#4189DD' },
    { label: 'Saho',      pct: 4,  color: '#CE1126' },
    { label: 'Afar',      pct: 4,  color: '#f59e0b' },
    { label: 'Kunama',    pct: 2,  color: '#8b5cf6' },
    { label: 'Bilen',     pct: 2,  color: '#06b6d4' },
    { label: 'Nara',      pct: 1,  color: '#ec4899' },
    { label: 'Rashaida',  pct: 1,  color: '#f97316' },
    { label: 'Others',    pct: 1,  color: '#64748b' },
  ];

  // Render legend
  const legend = document.getElementById('demoLegend');
  if (legend) {
    legend.innerHTML = DATA.map(d =>
      '<div class="demo-leg-item"><span class="demo-leg-dot" style="background:' + d.color + '"></span>' +
      '<span class="demo-leg-label">' + d.label + '</span>' +
      '<span class="demo-leg-pct">' + d.pct + '%</span></div>'
    ).join('');
  }

  // Draw donut
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 8, r = R * 0.56;
  let start = -Math.PI / 2;
  const total = DATA.reduce((a, d) => a + d.pct, 0);

  DATA.forEach(d => {
    const slice = (d.pct / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, start, start + slice);
    ctx.closePath();
    ctx.fillStyle = d.color;
    ctx.fill();
    start += slice;
  });

  // Hole
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg') || '#0d1117';
  ctx.fill();

  // Center text
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px Montserrat, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('9 Groups', cx, cy - 8);
  ctx.font = '11px Montserrat, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,.6)';
  ctx.fillText('Ethnic', cx, cy + 10);
})();


// ── FEATURE 17: CULTURAL CALENDAR ────────────────────────────────
(function initCulturalCalendar() {
  const ERI_EVENTS = {
    '01-01': { name: 'New Year (Gregorian)', type: 'national', icon: '🎆' },
    '01-07': { name: 'Christmas (Orthodox — Lidat)', type: 'religious', icon: '⛪' },
    '01-19': { name: 'Timkat — Epiphany (Orthodox)', type: 'religious', icon: '💧' },
    '03-08': { name: "International Women's Day", type: 'national', icon: '♀️' },
    '04-07': { name: 'Women\'s Fighters Day — Remembrance', type: 'national', icon: '🌹' },
    '05-24': { name: 'Independence Day 🇪🇷 — Yom Selfi Natsnet', type: 'national', icon: '🎉' },
    '06-20': { name: 'Martyrs\' Day — Sehid', type: 'national', icon: '🕯️' },
    '09-01': { name: 'Armed Struggle Day — anniversary of 1961 uprising', type: 'national', icon: '⚔️' },
    '09-27': { name: 'Meskel — Finding of the True Cross', type: 'religious', icon: '✝️' },
    '11-01': { name: 'All Saints Day (Catholic)', type: 'religious', icon: '🕊️' },
    '12-25': { name: 'Christmas (Western)', type: 'religious', icon: '🎄' },
  };

  let _calYear = new Date().getFullYear();
  let _calMonth = new Date().getMonth(); // 0-based

  function renderCal() {
    const grid = document.getElementById('calGrid');
    const label = document.getElementById('calMonthLabel');
    if (!grid) return;

    const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    if (label) label.textContent = MONTH_NAMES[_calMonth] + ' ' + _calYear;

    const firstDay = new Date(_calYear, _calMonth, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(_calYear, _calMonth + 1, 0).getDate();
    const today = new Date();

    let html = '<div class="cal-weekdays">' +
      ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => '<div class="cal-wday">' + d + '</div>').join('') +
      '</div><div class="cal-days">';

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) html += '<div class="cal-day cal-day-empty"></div>';

    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(_calMonth + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      const key = mm + '-' + dd;
      const ev = ERI_EVENTS[key];
      const isToday = (d === today.getDate() && _calMonth === today.getMonth() && _calYear === today.getFullYear());
      const hasEvent = !!ev;
      const evType = ev ? ev.type : '';
      html += '<div class="cal-day' +
        (isToday ? ' cal-today' : '') +
        (hasEvent ? ' cal-has-event cal-ev-' + evType : '') +
        '" data-key="' + key + '">' +
        '<span class="cal-day-num">' + d + '</span>' +
        (ev ? '<span class="cal-ev-dot" title="' + ev.name + '">' + ev.icon + '</span>' : '') +
        '</div>';
    }
    html += '</div>';
    grid.innerHTML = html;

    // Click events
    grid.querySelectorAll('.cal-has-event').forEach(cell => {
      cell.addEventListener('click', () => {
        const key = cell.dataset.key;
        const ev = ERI_EVENTS[key];
        if (!ev) return;
        const panel = document.getElementById('calEventPanel');
        const content = document.getElementById('calEventContent');
        if (!panel || !content) return;
        content.innerHTML = '<div class="cal-ev-icon">' + ev.icon + '</div>' +
          '<div class="cal-ev-name">' + ev.name + '</div>' +
          '<div class="cal-ev-date">' + key.replace('-', '/') + '</div>' +
          '<div class="cal-ev-type ' + ev.type + '">' + ev.type.toUpperCase() + '</div>';
        panel.hidden = false;
      });
    });
  }

  document.getElementById('calPrev') && document.getElementById('calPrev').addEventListener('click', () => {
    _calMonth--; if (_calMonth < 0) { _calMonth = 11; _calYear--; } renderCal();
  });
  document.getElementById('calNext') && document.getElementById('calNext').addEventListener('click', () => {
    _calMonth++; if (_calMonth > 11) { _calMonth = 0; _calYear++; } renderCal();
  });
  document.getElementById('calEventClose') && document.getElementById('calEventClose').addEventListener('click', () => {
    const panel = document.getElementById('calEventPanel');
    if (panel) panel.hidden = true;
  });

  renderCal();
})();


// ── FEATURE 18: WEB SHARE API ─────────────────────────────────────
(function initWebShare() {
  const SHAREABLE = [
    { id: 'overview',   title: 'Overview of Eritrea' },
    { id: 'history',    title: 'History of Eritrea' },
    { id: 'geography',  title: 'Geography of Eritrea' },
    { id: 'culture',    title: 'Culture of Eritrea' },
    { id: 'economy',    title: 'Economy of Eritrea' },
    { id: 'government', title: 'Government of Eritrea' },
    { id: 'famous',     title: 'Famous Eritreans' },
    { id: 'tourism',    title: 'Eritrea Tourism Guide' },
    { id: 'recipes',    title: 'Eritrean Recipes' },
    { id: 'quiz',       title: 'Eritrea Knowledge Quiz' },
  ];

  function addShareBtn(sectionId, sectionTitle) {
    const section = document.getElementById(sectionId);
    if (!section) return;
    const header = section.querySelector('.section-header');
    if (!header || header.querySelector('.share-section-btn')) return;

    const btn = document.createElement('button');
    btn.className = 'share-section-btn';
    btn.title = 'Share this section';
    btn.innerHTML = '🔗 Share';
    btn.addEventListener('click', async () => {
      const url = location.origin + location.pathname + '#' + sectionId;
      const shareData = { title: sectionTitle + ' — Eritrean Info', text: 'Learn about ' + sectionTitle + ' on Eritrean Info', url };

      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        try { await navigator.share(shareData); return; } catch(e) { if (e.name === 'AbortError') return; }
      }
      // Clipboard fallback
      try {
        await navigator.clipboard.writeText(url);
        btn.textContent = '✅ Copied!';
        setTimeout(() => { btn.innerHTML = '🔗 Share'; }, 2000);
      } catch(e) {
        prompt('Copy this link:', url);
      }
    });
    header.appendChild(btn);
  }

  SHAREABLE.forEach(s => addShareBtn(s.id, s.title));
})();


// ── FEATURE 19: OFFLINE READING MODE (IndexedDB) ─────────────────
(function initOfflineReading() {
  const DB_NAME = 'EritreanInfoOffline', DB_VER = 1, STORE = 'sections';
  const SECTIONS = [
    { id: 'overview', label: '🏛️ Overview' },
    { id: 'history', label: '📜 History' },
    { id: 'geography', label: '🗺️ Geography' },
    { id: 'culture', label: '🎭 Culture' },
    { id: 'economy', label: '💰 Economy' },
    { id: 'government', label: '⚖️ Government' },
    { id: 'people', label: '👥 People' },
    { id: 'famous', label: '⭐ Famous' },
    { id: 'tourism', label: '✈️ Tourism' },
    { id: 'languages', label: '🗣️ Languages' },
  ];

  let _db = null;

  function openDB() {
    return new Promise((res, rej) => {
      if (_db) return res(_db);
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = e => e.target.result.createObjectStore(STORE, { keyPath: 'id' });
      req.onsuccess = e => { _db = e.target.result; res(_db); };
      req.onerror   = e => rej(e);
    });
  }

  async function getSaved() {
    const db = await openDB();
    return new Promise(res => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror   = () => res([]);
    });
  }

  async function saveSection(id, label) {
    const section = document.getElementById(id);
    if (!section) return;
    const html = section.querySelector('.container') ? section.querySelector('.container').innerHTML : section.innerHTML;
    const db = await openDB();
    return new Promise(res => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ id, label, html, savedAt: new Date().toISOString() });
      tx.oncomplete = res;
    });
  }

  async function removeSection(id) {
    const db = await openDB();
    return new Promise(res => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = res;
    });
  }

  async function updateFab() {
    const saved = await getSaved();
    const fab = document.getElementById('offlineFab');
    const badge = document.getElementById('offlineFabBadge');
    if (!fab) return;
    if (saved.length > 0) {
      fab.style.display = '';
      if (badge) badge.textContent = saved.length;
    } else {
      fab.style.display = 'none';
    }
  }

  async function renderOfflinePanel() {
    const list = document.getElementById('offlineList');
    if (!list) return;
    const saved = await getSaved();
    if (saved.length === 0) { list.innerHTML = '<p class="op-empty">No sections saved yet. Look for the 💾 button on section headers.</p>'; return; }
    list.innerHTML = saved.map(s =>
      '<div class="op-item"><a class="op-link" href="#' + s.id + '">' + s.label + '</a>' +
      '<span class="op-date">' + new Date(s.savedAt).toLocaleDateString() + '</span>' +
      '<button class="op-del" data-id="' + s.id + '">🗑</button></div>'
    ).join('');
    list.querySelectorAll('.op-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        await removeSection(btn.dataset.id);
        renderOfflinePanel();
        updateFab();
        updateSaveBtnStates();
      });
    });
  }

  async function updateSaveBtnStates() {
    const saved = await getSaved();
    const savedIds = saved.map(s => s.id);
    document.querySelectorAll('.save-offline-btn').forEach(btn => {
      const id = btn.dataset.sectionId;
      btn.textContent = savedIds.includes(id) ? '✅ Saved' : '💾';
      btn.classList.toggle('is-saved', savedIds.includes(id));
    });
  }

  // Add save buttons to section headers
  SECTIONS.forEach(s => {
    const section = document.getElementById(s.id);
    if (!section) return;
    const header = section.querySelector('.section-header');
    if (!header || header.querySelector('.save-offline-btn')) return;

    const btn = document.createElement('button');
    btn.className = 'save-offline-btn';
    btn.dataset.sectionId = s.id;
    btn.textContent = '💾';
    btn.title = 'Save for offline reading';
    btn.addEventListener('click', async () => {
      const isSaved = btn.classList.contains('is-saved');
      if (isSaved) {
        await removeSection(s.id);
        btn.textContent = '💾';
        btn.classList.remove('is-saved');
      } else {
        await saveSection(s.id, s.label);
        btn.textContent = '✅ Saved';
        btn.classList.add('is-saved');
      }
      updateFab();
    });
    header.appendChild(btn);
  });

  // FAB + panel
  const fab  = document.getElementById('offlineFab');
  const panel = document.getElementById('offlinePanel');
  if (fab)  fab.addEventListener('click', () => { if (panel) { panel.hidden = false; renderOfflinePanel(); } });
  const closeBtn = document.getElementById('offlinePanelClose');
  if (closeBtn) closeBtn.addEventListener('click', () => { if (panel) panel.hidden = true; });

  updateFab();
  updateSaveBtnStates();
})();


// ── FEATURE 20: PHOTO STORY VIEWER ───────────────────────────────
(function initStoryViewer() {
  const viewer = document.getElementById('storyViewer');
  if (!viewer) return;

  const svImg       = document.getElementById('svImg');
  const svCaption   = document.getElementById('svCaption');
  const svProgressRow = document.getElementById('svProgressRow');
  const svClose     = document.getElementById('svClose');
  const svPrev      = document.getElementById('svPrev');
  const svNext      = document.getElementById('svNext');

  let _stories = [];
  let _current = 0;
  let _autoId  = null;
  let _progId  = null;
  let _progPct = 0;

  function collectStories() {
    _stories = [];
    document.querySelectorAll('#galleryGrid .gallery-item').forEach(item => {
      const img  = item.querySelector('img');
      const cap  = item.querySelector('.gallery-caption');
      if (!img || !img.src) return;
      _stories.push({
        src:     img.src,
        caption: cap ? cap.querySelector('h4')?.textContent || '' : '',
      });
    });
  }

  function renderProgress() {
    if (!svProgressRow) return;
    svProgressRow.innerHTML = _stories.map((_, i) =>
      '<div class="sv-prog-bar' + (i < _current ? ' sv-prog-done' : (i === _current ? ' sv-prog-active' : '')) + '"><div class="sv-prog-fill" id="svPF' + i + '"></div></div>'
    ).join('');
  }

  function showSlide(idx) {
    if (!_stories.length) return;
    clearInterval(_autoId);
    clearInterval(_progId);
    _current = (idx + _stories.length) % _stories.length;
    _progPct = 0;

    const story = _stories[_current];

    // Hide img while loading; show placeholder if it fails
    if (svImg) {
      svImg.style.opacity = '0';
      svImg.onerror = () => {
        svImg.style.opacity = '0';
        if (svCaption) svCaption.textContent = '⚠ Image could not load — press Esc to close';
        // Auto-advance after 1.5s on error
        clearInterval(_progId);
        setTimeout(() => {
          if (!viewer.hidden && _stories.length > 1) advanceSlide(1);
          else if (!viewer.hidden && _stories.length <= 1) closeViewer();
        }, 1500);
      };
      svImg.onload = () => { svImg.style.opacity = '1'; };
      svImg.src = story.src;
    }
    if (svCaption) svCaption.textContent = story.caption;
    renderProgress();

    // Animate current progress bar
    const fill = document.getElementById('svPF' + _current);
    _progId = setInterval(() => {
      _progPct += (100 / 50);
      if (fill) fill.style.width = Math.min(_progPct, 100) + '%';
      if (_progPct >= 100) { clearInterval(_progId); advanceSlide(1); }
    }, 100);
  }

  function advanceSlide(dir) { showSlide(_current + dir); }

  function openViewer() {
    collectStories();
    if (!_stories.length) {
      // No gallery images found — don't open a black screen
      alert('No gallery images available to view as stories.');
      return;
    }
    viewer.hidden = false;
    document.body.style.overflow = 'hidden';
    showSlide(0);
  }

  function closeViewer() {
    clearInterval(_autoId);
    clearInterval(_progId);
    viewer.hidden = true;
    document.body.style.overflow = '';
    if (svImg) { svImg.src = ''; svImg.style.opacity = '1'; }
  }

  if (svClose) svClose.addEventListener('click', closeViewer);
  if (svPrev)  svPrev.addEventListener('click', () => { clearInterval(_progId); advanceSlide(-1); });
  if (svNext)  svNext.addEventListener('click', () => { clearInterval(_progId); advanceSlide(1);  });

  // Click dark area outside image to close
  viewer.addEventListener('click', e => {
    if (e.target === viewer || e.target.classList.contains('sv-slide')) closeViewer();
  });

  // Keyboard
  document.addEventListener('keydown', e => {
    if (viewer.hidden) return;
    if (e.key === 'Escape') closeViewer();
    if (e.key === 'ArrowRight') { clearInterval(_progId); advanceSlide(1); }
    if (e.key === 'ArrowLeft')  { clearInterval(_progId); advanceSlide(-1); }
  });

  // Touch swipe
  let _touchX = null;
  viewer.addEventListener('touchstart', e => { _touchX = e.changedTouches[0].clientX; }, { passive: true });
  viewer.addEventListener('touchend', e => {
    if (_touchX === null) return;
    const dx = e.changedTouches[0].clientX - _touchX;
    if (Math.abs(dx) > 50) { clearInterval(_progId); advanceSlide(dx < 0 ? 1 : -1); }
    _touchX = null;
  });

  // Add "View as Stories" button above the gallery
  const gallerySection = document.getElementById('gallery');
  if (gallerySection) {
    const header = gallerySection.querySelector('.section-header');
    if (header) {
      const launchBtn = document.createElement('button');
      launchBtn.className = 'story-launch-btn';
      launchBtn.innerHTML = '📖 View as Stories';
      launchBtn.addEventListener('click', openViewer);
      header.appendChild(launchBtn);
    }
  }
})();
