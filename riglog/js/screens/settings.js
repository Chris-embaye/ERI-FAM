import { getSettings, saveSettings, clearCloudData } from '../store.js';
import { getCurrentUser, signOut, saveProfile } from '../auth.js';
import { confirmSheet, toast } from '../modal.js';

export function renderSettings() {
  const s    = getSettings();
  const user = getCurrentUser();

  const avatarLetter = user?.displayName
    ? user.displayName.trim()[0].toUpperCase()
    : user?.email?.[0].toUpperCase() ?? '?';

  // Monthly fixed cost total for display
  const monthlyFixed = (Number(s.eldMonthly) || 0)
    + (Number(s.truckPaymentMonthly) || 0)
    + (Number(s.insuranceMonthly) || 0)
    + (Number(s.otherFixedMonthly) || 0);

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
            <div class="w-12 h-12 rounded-full bg-orange-600 flex items-center justify-center text-black font-black text-xl shrink-0 overflow-hidden">
              ${user.photoURL
                ? `<img src="${user.photoURL}" class="w-12 h-12 rounded-full object-cover" alt="">`
                : avatarLetter}
            </div>
            <div class="min-w-0">
              <p class="font-black truncate">${user.displayName || 'Driver'}</p>
              <p class="text-xs text-gray-500 truncate">${user.email}</p>
            </div>
          </div>
          <div class="space-y-2">
            <div>
              <label class="text-xs text-gray-400 block mb-1">Display Name</label>
              <input type="text" id="profile-name" class="form-input" value="${user.displayName || ''}" placeholder="Your name">
            </div>
            <button id="save-profile-btn" class="w-full bg-gray-800 text-white font-bold py-2.5 rounded-lg text-sm">
              Update Name
            </button>
            <button id="reset-pw-btn" class="w-full bg-gray-800/50 border border-gray-700 text-gray-400 font-bold py-2.5 rounded-lg text-sm">
              Send Password Reset Email
            </button>
          </div>
        </div>
        ` : ''}

        <form id="settings-form" class="space-y-4">

          <!-- Truck -->
          <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
            <p class="text-xs text-gray-400 font-bold uppercase tracking-wider">Truck</p>
            <div>
              <label class="text-xs text-gray-400 block mb-1">Truck Name / Unit ID</label>
              <input type="text" name="truckId" class="form-input" value="${s.truckId || ''}" placeholder="My Truck">
            </div>
          </div>

          <!-- Dispatch & Carrier -->
          <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
            <div class="flex justify-between items-center">
              <p class="text-xs text-gray-400 font-bold uppercase tracking-wider">Dispatch / Carrier</p>
              ${Number(s.dispatchPct) > 0
                ? `<span class="text-xs text-orange-500 font-bold">${s.dispatchPct}% off gross</span>`
                : `<span class="text-xs text-gray-700">Owner-op (no cut)</span>`}
            </div>
            <div>
              <label class="text-xs text-gray-400 block mb-1">Dispatcher / Carrier Fee (%)</label>
              <input type="number" name="dispatchPct" step="0.5" min="0" max="50" class="form-input"
                value="${s.dispatchPct || 0}" placeholder="0">
              <p class="text-xs text-gray-600 mt-1">
                Percentage taken off your gross load revenue before it reaches you.
                ${Number(s.dispatchPct) > 0
                  ? `On a $1,000 load you keep <span class="text-white font-bold">$${(1000 * (1 - Number(s.dispatchPct)/100)).toFixed(0)}</span>.`
                  : 'Enter 0 if you book all loads yourself.'}
              </p>
            </div>
          </div>

          <!-- Monthly Fixed Costs -->
          <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
            <div class="flex justify-between items-center">
              <p class="text-xs text-gray-400 font-bold uppercase tracking-wider">Monthly Fixed Costs</p>
              ${monthlyFixed > 0
                ? `<span class="text-xs text-red-400 font-bold">$${monthlyFixed.toLocaleString()}/mo</span>`
                : ''}
            </div>

            <div>
              <label class="text-xs text-gray-400 block mb-1">ELD Subscription ($/month)</label>
              <input type="number" name="eldMonthly" step="1" min="0" class="form-input"
                value="${s.eldMonthly || ''}" placeholder="e.g. 45">
              <p class="text-xs text-gray-600 mt-1">Samsara, KeepTruckin, Motive, etc. — fully tax-deductible.</p>
            </div>

            <div>
              <label class="text-xs text-gray-400 block mb-1">Truck Payment / Lease ($/month)</label>
              <input type="number" name="truckPaymentMonthly" step="1" min="0" class="form-input"
                value="${s.truckPaymentMonthly || ''}" placeholder="e.g. 2800">
              <p class="text-xs text-gray-600 mt-1">Interest portion is deductible; principal is not.</p>
            </div>

            <div>
              <label class="text-xs text-gray-400 block mb-1">Insurance ($/month)</label>
              <input type="number" name="insuranceMonthly" step="1" min="0" class="form-input"
                value="${s.insuranceMonthly || ''}" placeholder="e.g. 800">
              <p class="text-xs text-gray-600 mt-1">Cargo, liability, physical damage — all deductible.</p>
            </div>

            <div>
              <label class="text-xs text-gray-400 block mb-1">Other Fixed Monthly ($/month)</label>
              <input type="number" name="otherFixedMonthly" step="1" min="0" class="form-input"
                value="${s.otherFixedMonthly || ''}" placeholder="e.g. 200">
              <p class="text-xs text-gray-600 mt-1">Permits, memberships, phone, etc.</p>
            </div>

            ${monthlyFixed > 0 ? `
            <div class="bg-gray-800 rounded-xl p-3 space-y-1.5 text-xs">
              <p class="text-gray-400 font-bold">Annual fixed cost estimate</p>
              <div class="flex justify-between"><span class="text-gray-500">Per month</span><span class="font-bold">$${monthlyFixed.toLocaleString()}</span></div>
              <div class="flex justify-between"><span class="text-gray-500">Per year (12 mo)</span><span class="font-bold text-red-400">$${(monthlyFixed * 12).toLocaleString()}</span></div>
              <div class="flex justify-between border-t border-gray-700 pt-1.5 mt-1.5"><span class="text-gray-500">Break-even revenue needed</span><span class="font-bold text-orange-500">$${(monthlyFixed * 12).toLocaleString()}/yr</span></div>
            </div>
            ` : ''}
          </div>

          <!-- Detention -->
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

          <!-- Cost targets -->
          <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
            <p class="text-xs text-gray-400 font-bold uppercase tracking-wider">Profitability Targets</p>
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
          <button id="force-update-btn" class="w-full bg-gray-800 text-gray-300 font-bold py-2.5 rounded-lg text-sm">
            Force Update App
          </button>
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
          class="w-full bg-gray-900 border border-gray-800 text-gray-400 font-bold py-3 rounded-xl text-sm">
          Sign Out
        </button>` : ''}

        <div style="height:20px"></div>
      </div>
    </div>`;

  function mount(container) {
    container.querySelector('#settings-form').addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      saveSettings({
        truckId:              fd.get('truckId').trim() || 'My Truck',
        detentionRate:        parseFloat(fd.get('detentionRate'))        || 60,
        detentionGrace:       parseFloat(fd.get('detentionGrace'))       || 2,
        targetCPM:            parseFloat(fd.get('targetCPM'))            || 0.50,
        dispatchPct:          parseFloat(fd.get('dispatchPct'))          || 0,
        eldMonthly:           parseFloat(fd.get('eldMonthly'))           || 0,
        truckPaymentMonthly:  parseFloat(fd.get('truckPaymentMonthly'))  || 0,
        insuranceMonthly:     parseFloat(fd.get('insuranceMonthly'))     || 0,
        otherFixedMonthly:    parseFloat(fd.get('otherFixedMonthly'))    || 0,
      });
      toast('Settings saved ✓');
      window.refresh();
    });

    container.querySelector('#save-profile-btn')?.addEventListener('click', async () => {
      const nameInput = container.querySelector('#profile-name');
      const name = nameInput.value.trim();
      if (!name) return;
      const btn = container.querySelector('#save-profile-btn');
      btn.textContent = 'Saving…'; btn.disabled = true;
      try {
        await user.updateProfile({ displayName: name });
        if (user.uid) await saveProfile(user.uid, { name, email: user.email });
        btn.textContent = 'Updated ✓';
        setTimeout(() => { btn.textContent = 'Update Name'; btn.disabled = false; }, 1500);
      } catch {
        btn.textContent = 'Error — try again'; btn.disabled = false;
      }
    });

    container.querySelector('#reset-pw-btn')?.addEventListener('click', async () => {
      if (!user?.email) return;
      const btn = container.querySelector('#reset-pw-btn');
      btn.textContent = 'Sending…'; btn.disabled = true;
      try {
        await firebase.auth().sendPasswordResetEmail(user.email);
        btn.textContent = 'Email sent ✓';
        setTimeout(() => { btn.textContent = 'Send Password Reset Email'; btn.disabled = false; }, 3000);
      } catch {
        btn.textContent = 'Error — try again'; btn.disabled = false;
      }
    });

    container.querySelector('#force-update-btn').addEventListener('click', async () => {
      const btn = container.querySelector('#force-update-btn');
      btn.textContent = 'Clearing cache…'; btn.disabled = true;
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r => r.unregister()));
        }
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      } catch {}
      window.location.reload();
    });

    container.querySelector('#export-btn').addEventListener('click', () => {
      const data = {};
      ['rl_expenses','rl_trips','rl_dvirs','rl_detention','rl_fuel','rl_settings'].forEach(k => {
        try { data[k] = JSON.parse(localStorage.getItem(k) || 'null'); } catch {}
      });
      if (user) data._account = { uid: user.uid, email: user.email, name: user.displayName };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = Object.assign(document.createElement('a'), { href: url, download: `rig-log-export-${new Date().toISOString().slice(0,10)}.json` });
      a.click();
      URL.revokeObjectURL(url);
    });

    container.querySelector('#clear-btn').addEventListener('click', () => {
      confirmSheet('Clear all data?', 'Deletes everything — trips, expenses, fuel, DVIRs — from this device and the cloud. Cannot be undone.', 'Clear Everything', async () => {
        ['rl_expenses','rl_trips','rl_dvirs','rl_detention','rl_fuel','rl_active_detention'].forEach(k => {
          localStorage.removeItem(k);
        });
        await clearCloudData();
        window.navigate('dashboard');
      });
    });

    container.querySelector('#signout-btn')?.addEventListener('click', async () => {
      if (confirm('Sign out?')) await signOut();
    });
  }

  return { html, mount };
}
