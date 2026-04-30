import { initAuth, onAuthReady, getCurrentUser } from './auth.js';
import { renderSignIn }   from './screens/signin.js';
import { renderDashboard } from './screens/dashboard.js';
import { renderExpenses }  from './screens/expenses.js';
import { renderTrips }     from './screens/trips.js';
import { renderFuel }      from './screens/fuel.js';
import { renderMore }      from './screens/more.js';
import { renderDVIR }        from './screens/dvir.js';
import { renderDetention }   from './screens/detention.js';
import { renderSettings }    from './screens/settings.js';
import { renderTax }         from './screens/tax.js';
import { renderMaintenance } from './screens/maintenance.js';
import { renderIFTA }        from './screens/ifta.js';

const SCREENS = {
  dashboard:   renderDashboard,
  expenses:    renderExpenses,
  trips:       renderTrips,
  fuel:        renderFuel,
  more:        renderMore,
  dvir:        renderDVIR,
  detention:   renderDetention,
  settings:    renderSettings,
  tax:         renderTax,
  maintenance: renderMaintenance,
  ifta:        renderIFTA,
};

const MORE_SCREENS = new Set(['dvir', 'detention', 'settings', 'tax', 'maintenance', 'ifta']);

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

  if (!user) {
    bottomNav.classList.add('hidden');
    const { html, mount } = renderSignIn();
    container.innerHTML = html;
    if (mount) screenCleanup = mount(container, navigate) || null;
    return;
  }

  bottomNav.classList.remove('hidden');

  const screen = window.location.hash.slice(1) || 'dashboard';
  const renderFn = SCREENS[screen] || renderDashboard;
  const { html, mount } = renderFn();

  container.innerHTML = html;
  if (mount) screenCleanup = mount(container, navigate) || null;

  const navScreen = MORE_SCREENS.has(screen) ? 'more' : screen;
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const active = btn.dataset.screen === navScreen;
    btn.classList.toggle('text-orange-600', active);
    btn.classList.toggle('text-gray-500', !active);
  });
}

// ── Nav ───────────────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => navigate(btn.dataset.screen));
});

document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) window.closeModal?.();
});

window.navigate = navigate;
window.refresh  = render;

// ── Service Worker + auto-update ──────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(reg => {
    // When a new SW is found, activate it immediately once installed
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      newWorker?.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New version is ready — skip waiting so it takes over now
          newWorker.postMessage('SKIP_WAITING');
        }
      });
    });

    // Check for updates every time the page gains focus (returning to the tab/app)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch(() => {});

  // When the active SW changes (new one took over), reload to get fresh files
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloading) { reloading = true; window.location.reload(); }
  });
}

// ── Boot ──────────────────────────────────────────────────────────────────────
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
