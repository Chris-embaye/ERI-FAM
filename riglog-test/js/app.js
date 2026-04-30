import { initAuth, onAuthReady, getCurrentUser } from './auth.js';
import { getAppMode }               from './store.js';
import { applyTheme, loadTheme }    from './theme.js';
import { renderSignIn }             from './screens/signin.js';
import { renderRoleSelect }         from './screens/role-select.js';

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

// Personal screens
import { renderPersonalDashboard } from './screens/personal-dashboard.js';
import { renderPersonalTrips }     from './screens/personal-trips.js';
import { renderPersonalFuel }      from './screens/personal-fuel.js';
import { renderPersonalExpenses }  from './screens/personal-expenses.js';
import { renderPersonalMore }      from './screens/personal-more.js';

const TRUCKING_SCREENS = {
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
};

const PERSONAL_SCREENS = {
  dashboard: renderPersonalDashboard,
  trips:     renderPersonalTrips,
  fuel:      renderPersonalFuel,
  expenses:  renderPersonalExpenses,
  'p-more':  renderPersonalMore,
  // alias 'more' → personal more so nav still works
  more:      renderPersonalMore,
};

const TRUCKING_MORE = new Set(['dvir','detention','settings','tax','maintenance','ifta']);
const PERSONAL_MORE = new Set(['p-more']);

const bottomNav = document.getElementById('bottom-nav');
let screenCleanup = null;

export function navigate(screen) {
  if (window.location.hash.slice(1) === screen) {
    render();
  } else {
    window.location.hash = screen;
  }
}

function updateNav(screen, mode) {
  const moreScreens = mode === 'personal' ? PERSONAL_MORE : TRUCKING_MORE;
  const navScreen   = moreScreens.has(screen) ? 'more' : screen;
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

  // Not signed in
  if (!user) {
    bottomNav.classList.add('hidden');
    const { html, mount } = renderSignIn();
    container.innerHTML = html;
    if (mount) screenCleanup = mount(container, navigate) || null;
    return;
  }

  const screen = window.location.hash.slice(1) || 'dashboard';

  // Role select screen (no nav)
  if (screen === 'role-select') {
    bottomNav.classList.add('hidden');
    const { html, mount } = renderRoleSelect();
    container.innerHTML = html;
    if (mount) screenCleanup = mount(container, navigate) || null;
    return;
  }

  // No mode chosen yet → show role selector
  const mode = getAppMode();
  if (!mode) {
    bottomNav.classList.add('hidden');
    const { html, mount } = renderRoleSelect();
    container.innerHTML = html;
    if (mount) screenCleanup = mount(container, navigate) || null;
    return;
  }

  bottomNav.classList.remove('hidden');

  // Colour the bottom nav to match mode
  const navColor = mode === 'personal' ? '#7c3aed' : '#0891b2';
  document.documentElement.style.setProperty('--mode-color', navColor);

  // Calculator tab is trucking-only
  const calcTab = bottomNav.querySelector('[data-screen="calculator"]');
  if (calcTab) calcTab.style.display = mode === 'personal' ? 'none' : '';

  const SCREENS  = mode === 'personal' ? PERSONAL_SCREENS : TRUCKING_SCREENS;
  const renderFn = SCREENS[screen] || (mode === 'personal' ? renderPersonalDashboard : renderDashboard);

  const { html, mount } = renderFn();
  container.innerHTML = html;
  if (mount) screenCleanup = mount(container, navigate) || null;

  updateNav(screen, mode);
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

// ── Boot ──────────────────────────────────────────────────────────────────────
const _t = loadTheme(); applyTheme(_t.accentColor, _t.bgTheme);

document.getElementById('screen').innerHTML = `
  <div class="flex items-center justify-center h-full">
    <div class="text-center space-y-4">
      <div class="text-4xl animate-pulse">🚗</div>
      <p class="text-gray-500 text-sm">Loading…</p>
    </div>
  </div>`;

window.addEventListener('hashchange', render);
onAuthReady(() => render());
initAuth();
