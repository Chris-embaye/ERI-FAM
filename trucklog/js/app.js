import { initAuth, onAuthReady, getCurrentUser } from './auth.js';
import { getAppMode, setAppMode }               from './store.js';
import { applyTheme, loadTheme }                from './theme.js';
import { renderSignIn }                          from './screens/signin.js';
import { requestCameraPermission, requestLocation } from './permissions.js';

// Trucking screens
import { renderDashboard }   from './screens/dashboard.js';
import { renderExpenses }    from './screens/expenses.js';
import { renderTrips }       from './screens/trips.js';
import { renderFuel }        from './screens/fuel.js';
import { renderMore }        from './screens/more.js';
import { renderCalculator }  from './screens/calculator.js';
import { renderDVIR }        from './screens/dvir.js';
import { renderDetention }   from './screens/detention.js';
import { renderSettings }    from './screens/settings.js';
import { renderTax }         from './screens/tax.js';
import { renderMaintenance } from './screens/maintenance.js';
import { renderIFTA }        from './screens/ifta.js';
import { renderPay }         from './screens/pay.js';

const SCREENS = {
  dashboard:   renderDashboard,
  calculator:  renderCalculator,
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
  pay:         renderPay,
};

// Screens that live under the "More" tab for nav-highlight purposes
const MORE_SCREENS = new Set(['dvir','detention','settings','tax','maintenance','ifta','pay']);

const bottomNav = document.getElementById('bottom-nav');
let screenCleanup = null;

export function navigate(screen) {
  if (window.location.hash.slice(1) === screen) {
    render();
  } else {
    window.location.hash = screen;
  }
}

function updateNav(screen) {
  const navScreen = MORE_SCREENS.has(screen) ? 'more' : screen;
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const active = btn.dataset.screen === navScreen;
    btn.classList.toggle('text-orange-600', active);
    btn.classList.toggle('text-gray-500', !active);
  });
}

function render() {
  if (screenCleanup) { screenCleanup(); screenCleanup = null; }

  const user      = getCurrentUser();
  const container = document.getElementById('screen');

  if (!user) {
    bottomNav.classList.add('hidden');
    const { html, mount } = renderSignIn();
    container.innerHTML = html;
    if (mount) screenCleanup = mount(container, navigate) || null;
    return;
  }

  // Always trucking mode — auto-set if somehow unset
  if (!getAppMode()) setAppMode('trucking');

  bottomNav.classList.remove('hidden');
  document.documentElement.style.setProperty('--mode-color', '#ea580c');

  const screen   = window.location.hash.slice(1) || 'dashboard';
  const renderFn = SCREENS[screen] || renderDashboard;

  const { html, mount } = renderFn();
  container.innerHTML = html;
  if (mount) screenCleanup = mount(container, navigate) || null;

  updateNav(screen);
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
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      newWorker?.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          newWorker.postMessage('SKIP_WAITING');
        }
      });
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch(() => {});

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloading) { reloading = true; window.location.reload(); }
  });
}

// ── First-launch permission request ──────────────────────────────────────────
async function maybeRequestPermissions() {
  if (localStorage.getItem('rl_perms_v1')) return;
  localStorage.setItem('rl_perms_v1', '1');
  // Request camera — iOS will show its permission dialog
  await requestCameraPermission();
  // Request location — iOS will show its permission dialog
  requestLocation({ timeout: 5000 });
}

// ── Version check — bypasses SW + HTTP cache, forces reload on new deploy ────
(async () => {
  try {
    const res = await fetch('./version.json', { cache: 'no-store' });
    if (!res.ok) return;
    const { v } = await res.json();
    const stored = localStorage.getItem('rl_ver');
    if (stored && stored !== v) {
      localStorage.setItem('rl_ver', v);
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      window.location.reload();
      return;
    }
    localStorage.setItem('rl_ver', v);
  } catch {}
})();

// ── Boot ──────────────────────────────────────────────────────────────────────
const _t = loadTheme(); applyTheme(_t.accentColor, _t.bgTheme);

document.getElementById('screen').innerHTML = `
  <div class="flex items-center justify-center h-full">
    <div class="text-center space-y-4">
      <div class="text-4xl animate-pulse">🚛</div>
      <p class="text-gray-500 text-sm">Loading…</p>
    </div>
  </div>`;

window.addEventListener('hashchange', render);
onAuthReady(() => {
  render();
  if (getCurrentUser()) maybeRequestPermissions();
});
initAuth();
