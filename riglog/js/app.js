import { initAuth, onAuthReady, getCurrentUser } from './auth.js';
import { renderSignIn }   from './screens/signin.js';
import { renderDashboard } from './screens/dashboard.js';
import { renderExpenses }  from './screens/expenses.js';
import { renderTrips }     from './screens/trips.js';
import { renderFuel }      from './screens/fuel.js';
import { renderMore }      from './screens/more.js';
import { renderDVIR }      from './screens/dvir.js';
import { renderDetention } from './screens/detention.js';
import { renderSettings }  from './screens/settings.js';

const SCREENS = {
  dashboard: renderDashboard,
  expenses:  renderExpenses,
  trips:     renderTrips,
  fuel:      renderFuel,
  more:      renderMore,
  dvir:      renderDVIR,
  detention: renderDetention,
  settings:  renderSettings,
};

const MORE_SCREENS = new Set(['dvir', 'detention', 'settings']);

const bottomNav = document.getElementById('bottom-nav');
let screenCleanup = null;

export function navigate(screen) {
  if (window.location.hash.slice(1) === screen) {
    render();
  } else {
    window.location.hash = screen;
  }
}

function render() {
  if (screenCleanup) { screenCleanup(); screenCleanup = null; }

  const user = getCurrentUser();
  const container = document.getElementById('screen');

  // ── Not signed in → show auth screen, hide nav ───────────────
  if (!user) {
    bottomNav.classList.add('hidden');
    const { html, mount } = renderSignIn();
    container.innerHTML = html;
    if (mount) screenCleanup = mount(container, navigate) || null;
    return;
  }

  // ── Signed in → show app ──────────────────────────────────────
  bottomNav.classList.remove('hidden');

  const screen = window.location.hash.slice(1) || 'dashboard';
  const renderFn = SCREENS[screen] || renderDashboard;
  const { html, mount } = renderFn();

  container.innerHTML = html;
  if (mount) screenCleanup = mount(container, navigate) || null;

  // Update nav active state
  const navScreen = MORE_SCREENS.has(screen) ? 'more' : screen;
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const active = btn.dataset.screen === navScreen;
    btn.classList.toggle('text-orange-600', active);
    btn.classList.toggle('text-gray-500', !active);
  });
}

// ── Nav button clicks ─────────────────────────────────────────────────────────
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => navigate(btn.dataset.screen));
});

// ── Modal overlay click-to-close ──────────────────────────────────────────────
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) window.closeModal?.();
});

// ── Globals used by inline onclick handlers in templates ──────────────────────
window.navigate = navigate;
window.refresh  = render;

// ── Register service worker ───────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// ── Boot: initialise Firebase auth, then render ───────────────────────────────
// Show spinner while auth state is being determined
document.getElementById('screen').innerHTML = `
  <div class="flex items-center justify-center h-full">
    <div class="text-center space-y-4">
      <div class="text-4xl animate-pulse">🚛</div>
      <p class="text-gray-500 text-sm">Loading…</p>
    </div>
  </div>`;

window.addEventListener('hashchange', render);

onAuthReady(() => render());
initAuth();
