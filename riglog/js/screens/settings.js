import { getSettings, saveSettings } from '../store.js';
import { getCurrentUser, signOut, saveProfile, loadProfile } from '../auth.js';

export function renderSettings() {
  const s    = getSettings();
  const user = getCurrentUser();

  const avatarLetter = user?.displayName
    ? user.displayName.trim()[0].toUpperCase()
    : user?.email?.[0].toUpperCase() ?? '?';

  const html = `
    <div class="flex flex-col h-full bg-black text-white">
      <div class="px-4 pt-5 pb-4 border-b border-gray-800 flex items-center gap-3 shrink-0">
        <button onclick="navigate('more')" class="text-gray-400">
          <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div>
          <h1 class="text-2xl font-black">Settings</h1>
          <p class="text-xs text-gray-500">App configuration</p>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-4 space-y-4">

        <!-- Account card -->
        ${user ? `
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p class="text-xs text-gray-400 font-bold uppercase tracking-wider mb-3">Account</p>
          <div class="flex items-center gap-3 mb-4">
            <div class="w-12 h-12 rounded-full bg-orange-600 flex items-center justify-center text-black font-black text-xl shrink-0">
              ${user.photoURL
                ? `<img src="${user.photoURL}" class="w-12 h-12 rounded-full object-cover" alt="">`
                : avatarLetter}
            </div>
            <div class="min-w-0">
              <p class="font-black truncate">${user.displayName || 'Driver'}</p>
              <p class="text-xs text-gray-500 truncate">${user.email}</p>
              <p class="text-xs text-gray-600 mt-0.5">UID: ${user.uid.slice(0, 8)}…</p>
            </div>
          </div>
          <div class="space-y-2">
            <div>
              <label class="text-xs text-gray-400 block mb-1">Display Name</label>
              <input type="text" id="profile-name" class="form-input" value="${user.displayName || ''}" placeholder="Your name">
            </div>
            <button id="save-profile-btn" class="w-full bg-gray-800 text-white font-bold py-2.5 rounded-lg text-sm hover:bg-gray-700 transition">
              Update Profile
            </button>
          </div>
        </div>
        ` : ''}

        <!-- App settings form -->
        <form id="settings-form" class="space-y-4">
          <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
            <p class="text-xs text-gray-400 font-bold uppercase tracking-wider">Truck</p>
            <div>
              <label class="text-xs text-gray-400 block mb-1">Truck Name / ID</label>
              <input type="text" name="truckId" class="form-input" value="${s.truckId || ''}" placeholder="My Truck">
            </div>
          </div>

          <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
            <p class="text-xs text-gray-400 font-bold uppercase tracking-wider">Detention</p>
            <div>
              <label class="text-xs text-gray-400 block mb-1">Detention Rate ($/hour)</label>
              <input type="number" name="detentionRate" step="1" min="0" class="form-input"
                value="${s.detentionRate || 60}" placeholder="60">
              <p class="text-xs text-gray-600 mt-1">Hourly rate charged after grace period expires.</p>
            </div>
            <div>
              <label class="text-xs text-gray-400 block mb-1">Grace Period (hours)</label>
              <input type="number" name="detentionGrace" step="0.5" min="0" class="form-input"
                value="${s.detentionGrace || 2}" placeholder="2">
              <p class="text-xs text-gray-600 mt-1">Free wait time before detention charges begin (typically 2h).</p>
            </div>
          </div>

          <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
            <p class="text-xs text-gray-400 font-bold uppercase tracking-wider">Cost Targets</p>
            <div>
              <label class="text-xs text-gray-400 block mb-1">Target Cost / Mile ($)</label>
              <input type="number" name="targetCPM" step="0.01" min="0" class="form-input"
                value="${s.targetCPM || 0.50}" placeholder="0.50">
              <p class="text-xs text-gray-600 mt-1">Operational cost per mile for profitability analysis.</p>
            </div>
          </div>

          <button type="submit" class="btn-primary">Save Settings</button>
        </form>

        <!-- Data & export -->
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
          <p class="text-xs text-gray-400 font-bold uppercase tracking-wider">Data</p>
          <button id="export-btn" class="w-full bg-gray-800 text-gray-300 font-bold py-2.5 rounded-lg text-sm">
            Export All Data (JSON)
          </button>
          <button id="clear-btn" class="w-full bg-red-900/20 text-red-400 font-bold py-2.5 rounded-lg text-sm border border-red-900/30">
            Clear All Local Data
          </button>
        </div>

        <!-- Sign out -->
        ${user ? `
        <button id="signout-btn"
          class="w-full bg-gray-900 border border-gray-800 text-gray-400 font-bold py-3 rounded-xl text-sm hover:border-red-900 hover:text-red-400 transition">
          Sign Out
        </button>` : ''}

        <div style="height:20px"></div>
      </div>
    </div>`;

  function mount(container) {
    // ── Settings form ───────────────────────────────────────────────────────
    container.querySelector('#settings-form').addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      saveSettings({
        truckId:       fd.get('truckId').trim() || 'My Truck',
        detentionRate: parseFloat(fd.get('detentionRate')) || 60,
        detentionGrace: parseFloat(fd.get('detentionGrace')) || 2,
        targetCPM:     parseFloat(fd.get('targetCPM')) || 0.50,
      });
      const btn = e.target.querySelector('[type=submit]');
      btn.textContent = 'Saved ✓';
      setTimeout(() => { btn.textContent = 'Save Settings'; }, 1500);
    });

    // ── Update profile name ─────────────────────────────────────────────────
    container.querySelector('#save-profile-btn')?.addEventListener('click', async () => {
      const nameInput = container.querySelector('#profile-name');
      const name = nameInput.value.trim();
      if (!name) return;
      const btn = container.querySelector('#save-profile-btn');
      btn.textContent = 'Saving…'; btn.disabled = true;
      try {
        await user.updateProfile({ displayName: name });
        if (user.uid) {
          await saveProfile(user.uid, { name, email: user.email });
        }
        btn.textContent = 'Updated ✓';
        setTimeout(() => { btn.textContent = 'Update Profile'; btn.disabled = false; }, 1500);
      } catch (err) {
        btn.textContent = 'Error — try again';
        btn.disabled = false;
      }
    });

    // ── Export ──────────────────────────────────────────────────────────────
    container.querySelector('#export-btn').addEventListener('click', () => {
      const data = {};
      ['rl_expenses','rl_trips','rl_dvirs','rl_detention','rl_fuel','rl_settings'].forEach(k => {
        try { data[k] = JSON.parse(localStorage.getItem(k) || 'null'); } catch {}
      });
      if (user) data._account = { uid: user.uid, email: user.email, name: user.displayName };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `riglog-export-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    // ── Clear data ──────────────────────────────────────────────────────────
    container.querySelector('#clear-btn').addEventListener('click', () => {
      if (confirm('Delete ALL local data? This cannot be undone.')) {
        ['rl_expenses','rl_trips','rl_dvirs','rl_detention','rl_fuel','rl_active_detention'].forEach(k => {
          localStorage.removeItem(k);
        });
        window.navigate('dashboard');
      }
    });

    // ── Sign out ────────────────────────────────────────────────────────────
    container.querySelector('#signout-btn')?.addEventListener('click', async () => {
      if (confirm('Sign out of RIGLOG?')) {
        await signOut();
        // auth state change → app.js re-renders to sign-in screen
      }
    });
  }

  return { html, mount };
}
