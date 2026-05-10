import { getSettings, saveSettings, clearCloudData, syncUp, getTrips, getExpenses } from '../store.js';
import { getCurrentUser, signOut, saveProfile } from '../auth.js';
import { openModal, closeModal, confirmSheet, toast } from '../modal.js';

function collectExportData(user) {
  const data = {};
  ['rl_expenses','rl_trips','rl_dvirs','rl_detention','rl_fuel','rl_settings'].forEach(k => {
    try { data[k] = JSON.parse(localStorage.getItem(k) || 'null'); } catch {}
  });
  if (user) data._account = { uid: user.uid, email: user.email, name: user.displayName };
  return data;
}

function downloadCSV(rows, filename) {
  const csv  = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
}

function exportTripsCSV() {
  const rows = [
    ['Date','Origin','Destination','Miles','Gross Revenue','Per Diem Days','State Miles','Load #','Duration (hrs)','Notes'],
    ...getTrips().map(t => [
      t.date, t.origin || '', t.destination || '',
      t.miles || 0, t.revenue || 0,
      t.perDiemDays ?? '', t.stateMiles || '',
      t.loadNum || '', t.durationHours || '', t.notes || '',
    ]),
  ];
  downloadCSV(rows, `rig-log-trips-${new Date().toISOString().slice(0, 10)}.csv`);
}

function exportExpensesCSV() {
  const rows = [
    ['Date','Category','Description','Amount'],
    ...getExpenses().map(e => [e.date, e.category || '', e.description || '', e.amount || 0]),
  ];
  downloadCSV(rows, `rig-log-expenses-${new Date().toISOString().slice(0, 10)}.csv`);
}

function downloadBackup(user) {
  const blob = new Blob([JSON.stringify(collectExportData(user), null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href: url, download: `rig-log-backup-${new Date().toISOString().slice(0,10)}.json`,
  });
  a.click();
  URL.revokeObjectURL(url);
}

async function shareBackup(user) {
  const file = new File(
    [JSON.stringify(collectExportData(user), null, 2)],
    `rig-log-backup-${new Date().toISOString().slice(0,10)}.json`,
    { type: 'application/json' }
  );
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Rig Log Backup' }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  downloadBackup(user);
  toast('Backup downloaded ✓');
}

export function renderSettings() {
  const s    = getSettings();
  const user = getCurrentUser();

  const avatarLetter = user?.displayName
    ? user.displayName.trim()[0].toUpperCase()
    : user?.email?.[0].toUpperCase() ?? '?';

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

        <!-- Account -->
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
            <button id="save-profile-btn" class="w-full bg-gray-800 text-white font-bold py-2.5 rounded-lg text-sm">Update Name</button>
            <button id="reset-pw-btn" class="w-full bg-gray-800/50 border border-gray-700 text-gray-400 font-bold py-2.5 rounded-lg text-sm">Send Password Reset Email</button>
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
            <div>
              <label class="text-xs text-gray-400 block mb-1">Home Base (City, State)</label>
              <input type="text" name="homeBase" class="form-input" value="${s.homeBase || ''}" placeholder="e.g. Atlanta, GA">
              <p class="text-xs text-gray-600 mt-1">Days away from home qualify for per diem deductions.</p>
            </div>
          </div>

          <!-- Dispatch -->
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
              ${monthlyFixed > 0 ? `<span class="text-xs text-red-400 font-bold">$${monthlyFixed.toLocaleString()}/mo</span>` : ''}
            </div>
            <div>
              <label class="text-xs text-gray-400 block mb-1">ELD Subscription ($/month)</label>
              <input type="number" name="eldMonthly" step="1" min="0" class="form-input" value="${s.eldMonthly || ''}" placeholder="e.g. 45">
              <p class="text-xs text-gray-600 mt-1">Samsara, Motive, KeepTruckin, etc. — fully deductible.</p>
            </div>
            <div>
              <label class="text-xs text-gray-400 block mb-1">Truck Payment / Lease ($/month)</label>
              <input type="number" name="truckPaymentMonthly" step="1" min="0" class="form-input" value="${s.truckPaymentMonthly || ''}" placeholder="e.g. 2800">
              <p class="text-xs text-gray-600 mt-1">Interest portion is deductible; principal is not.</p>
            </div>
            <div>
              <label class="text-xs text-gray-400 block mb-1">Insurance ($/month)</label>
              <input type="number" name="insuranceMonthly" step="1" min="0" class="form-input" value="${s.insuranceMonthly || ''}" placeholder="e.g. 800">
              <p class="text-xs text-gray-600 mt-1">Cargo, liability, physical damage — all deductible.</p>
            </div>
            <div>
              <label class="text-xs text-gray-400 block mb-1">Other Fixed Monthly ($/month)</label>
              <input type="number" name="otherFixedMonthly" step="1" min="0" class="form-input" value="${s.otherFixedMonthly || ''}" placeholder="e.g. 200">
              <p class="text-xs text-gray-600 mt-1">Permits, memberships, phone, etc.</p>
            </div>
            ${monthlyFixed > 0 ? `
            <div class="bg-gray-800 rounded-xl p-3 space-y-1.5 text-xs">
              <div class="flex justify-between"><span class="text-gray-500">Per month</span><span class="font-bold">$${monthlyFixed.toLocaleString()}</span></div>
              <div class="flex justify-between"><span class="text-gray-500">Per year</span><span class="font-bold text-red-400">$${(monthlyFixed * 12).toLocaleString()}</span></div>
            </div>` : ''}
          </div>

          <!-- Tax Preferences -->
          <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
            <p class="text-xs text-gray-400 font-bold uppercase tracking-wider">Tax Preferences</p>
            <div>
              <label class="text-xs text-gray-400 block mb-1">Per Diem Rate ($/day)</label>
              <input type="number" name="perDiemRate" step="1" min="0" class="form-input" value="${s.perDiemRate || 80}" placeholder="80">
              <p class="text-xs text-gray-600 mt-1">IRS 2025: $80/day for overnight trips away from your home base. Deducted from taxable income.</p>
            </div>
          </div>

          <!-- Detention -->
          <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
            <p class="text-xs text-gray-400 font-bold uppercase tracking-wider">Detention</p>
            <div>
              <label class="text-xs text-gray-400 block mb-1">Detention Rate ($/hour)</label>
              <input type="number" name="detentionRate" step="1" min="0" class="form-input" value="${s.detentionRate || 60}" placeholder="60">
              <p class="text-xs text-gray-600 mt-1">Hourly rate charged after the grace period expires.</p>
            </div>
            <div>
              <label class="text-xs text-gray-400 block mb-1">Grace Period (hours)</label>
              <input type="number" name="detentionGrace" step="0.5" min="0" class="form-input" value="${s.detentionGrace || 2}" placeholder="2">
              <p class="text-xs text-gray-600 mt-1">Free wait time before detention charges begin (typically 2h).</p>
            </div>
          </div>

          <!-- Profitability Targets -->
          <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
            <p class="text-xs text-gray-400 font-bold uppercase tracking-wider">Profitability Targets</p>
            <div>
              <label class="text-xs text-gray-400 block mb-1">Target Revenue / Mile ($)</label>
              <input type="number" name="targetRPM" step="0.01" min="0" class="form-input" value="${s.targetRPM || 2.00}" placeholder="2.00">
              <p class="text-xs text-gray-600 mt-1">Goal rate per mile — trips below this show as red on your list.</p>
            </div>
            <div>
              <label class="text-xs text-gray-400 block mb-1">Target Cost / Mile ($)</label>
              <input type="number" name="targetCPM" step="0.01" min="0" class="form-input" value="${s.targetCPM || 0.50}" placeholder="0.50">
              <p class="text-xs text-gray-600 mt-1">Operational cost per mile for profitability analysis.</p>
            </div>
          </div>

          <button type="submit" class="btn-primary">Save Settings</button>
        </form>

        <!-- Data & Sync -->
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
          <p class="text-xs text-gray-400 font-bold uppercase tracking-wider">Data &amp; Sync</p>
          <button id="sync-now-btn" class="w-full bg-gray-800 text-gray-300 font-bold py-2.5 rounded-lg text-sm">
            ☁ Sync Now to Cloud
          </button>
          <button id="export-trips-csv-btn" class="w-full bg-gray-800 text-gray-300 font-bold py-2.5 rounded-lg text-sm">
            ↓ Export Trips CSV
          </button>
          <button id="export-expenses-csv-btn" class="w-full bg-gray-800 text-gray-300 font-bold py-2.5 rounded-lg text-sm">
            ↓ Export Expenses CSV
          </button>
          <button id="export-btn" class="w-full bg-gray-800 text-gray-300 font-bold py-2.5 rounded-lg text-sm">
            ↓ Download Full Backup (JSON)
          </button>
          <button id="share-btn" class="w-full bg-gray-800 text-gray-300 font-bold py-2.5 rounded-lg text-sm">
            ↗ Send to Email / Share
          </button>
          <button id="force-update-btn" class="w-full bg-gray-800 text-gray-300 font-bold py-2.5 rounded-lg text-sm">
            ↺ Force Update App
          </button>
          <button id="clear-btn" class="w-full bg-red-900/20 text-red-400 font-bold py-2.5 rounded-lg text-sm border border-red-900/30">
            Clear All Data (Local + Cloud)
          </button>
        </div>

        <!-- Sign out -->
        ${user ? `
        <button id="signout-btn" class="w-full bg-gray-900 border border-gray-800 text-gray-400 font-bold py-3 rounded-xl text-sm">
          Sign Out
        </button>` : ''}

        <div style="height:20px"></div>
      </div>
    </div>`;

  function mount(container) {

    // ── Settings form ──────────────────────────────────────────────────────────
    container.querySelector('#settings-form').addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      saveSettings({
        truckId:             fd.get('truckId').trim() || 'My Truck',
        homeBase:            fd.get('homeBase').trim(),
        detentionRate:       parseFloat(fd.get('detentionRate'))       || 60,
        detentionGrace:      parseFloat(fd.get('detentionGrace'))      || 2,
        targetCPM:           parseFloat(fd.get('targetCPM'))           || 0.50,
        targetRPM:           parseFloat(fd.get('targetRPM'))           || 2.00,
        dispatchPct:         parseFloat(fd.get('dispatchPct'))         || 0,
        eldMonthly:          parseFloat(fd.get('eldMonthly'))          || 0,
        truckPaymentMonthly: parseFloat(fd.get('truckPaymentMonthly')) || 0,
        insuranceMonthly:    parseFloat(fd.get('insuranceMonthly'))    || 0,
        otherFixedMonthly:   parseFloat(fd.get('otherFixedMonthly'))   || 0,
        perDiemRate:         parseFloat(fd.get('perDiemRate'))         || 80,
      });
      toast('Settings saved ✓');
      window.refresh();
    });

    // ── Profile ────────────────────────────────────────────────────────────────
    container.querySelector('#save-profile-btn')?.addEventListener('click', async () => {
      const name = container.querySelector('#profile-name').value.trim();
      if (!name) return;
      const btn = container.querySelector('#save-profile-btn');
      btn.textContent = 'Saving…'; btn.disabled = true;
      try {
        await user.updateProfile({ displayName: name });
        if (user.uid) await saveProfile(user.uid, { name, email: user.email });
        toast('Name updated ✓');
      } catch {
        toast('Error updating name', 'error');
      }
      btn.textContent = 'Update Name'; btn.disabled = false;
    });

    container.querySelector('#reset-pw-btn')?.addEventListener('click', async () => {
      if (!user?.email || !window.firebase?.auth) return;
      const btn = container.querySelector('#reset-pw-btn');
      btn.textContent = 'Sending…'; btn.disabled = true;
      try {
        await firebase.auth().sendPasswordResetEmail(user.email);
        toast('Reset email sent — check your inbox ✓');
      } catch {
        toast('Error sending reset email', 'error');
      }
      btn.textContent = 'Send Password Reset Email'; btn.disabled = false;
    });

    // ── Data & Sync ────────────────────────────────────────────────────────────
    container.querySelector('#sync-now-btn')?.addEventListener('click', async () => {
      const btn = container.querySelector('#sync-now-btn');
      btn.textContent = 'Syncing…'; btn.disabled = true;
      try {
        await syncUp();
        toast('Synced to cloud ✓');
      } catch {
        toast('Sync failed — check your connection', 'error');
      }
      btn.textContent = '☁ Sync Now to Cloud'; btn.disabled = false;
    });

    container.querySelector('#export-trips-csv-btn')?.addEventListener('click', () => {
      exportTripsCSV();
      toast('Trips CSV downloaded ✓');
    });

    container.querySelector('#export-expenses-csv-btn')?.addEventListener('click', () => {
      exportExpensesCSV();
      toast('Expenses CSV downloaded ✓');
    });

    container.querySelector('#export-btn').addEventListener('click', () => {
      downloadBackup(user);
      toast('Backup downloaded ✓');
    });

    container.querySelector('#share-btn').addEventListener('click', () => shareBackup(user));

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

    container.querySelector('#clear-btn').addEventListener('click', () => {
      confirmSheet(
        'Clear all data?',
        'Deletes all trips, expenses, fuel, and DVIRs from this device and the cloud. Cannot be undone.',
        'Clear Everything',
        async () => {
          ['rl_expenses','rl_trips','rl_dvirs','rl_detention','rl_fuel','rl_settings','rl_active_detention'].forEach(k =>
            localStorage.removeItem(k)
          );
          await clearCloudData();
          window.navigate('dashboard');
        }
      );
    });

    // ── Sign out — backup reminder sheet ──────────────────────────────────────
    container.querySelector('#signout-btn')?.addEventListener('click', () => {
      openModal(`
        <div class="p-5">
          <div class="text-center mb-5">
            <div class="text-4xl mb-2">💾</div>
            <p class="font-black text-lg">Back up before signing out?</p>
            <p class="text-gray-400 text-sm mt-1.5 px-2">Your data syncs to the cloud automatically, but a local backup gives you an extra copy.</p>
          </div>
          <div class="space-y-2.5">
            <button id="so-download" class="w-full bg-gray-800 border border-gray-700 text-white font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2.5">
              <svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download Backup File
            </button>
            <button id="so-share" class="w-full bg-gray-800 border border-gray-700 text-white font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2.5">
              <svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              Send to Email / Share
            </button>
            <div class="border-t border-gray-800 pt-2.5">
              <button id="so-signout" class="w-full bg-orange-600/20 border border-orange-600/40 text-orange-400 font-bold py-3 rounded-xl text-sm">
                Sign Out Without Backup
              </button>
              <button onclick="closeModal()" class="btn-ghost mt-1">Cancel — Stay Signed In</button>
            </div>
          </div>
        </div>
      `, el => {
        el.querySelector('#so-download').addEventListener('click', () => {
          downloadBackup(user);
          toast('Backup downloaded ✓');
        });
        el.querySelector('#so-share').addEventListener('click', () => shareBackup(user));
        el.querySelector('#so-signout').addEventListener('click', async () => {
          closeModal();
          await signOut();
        });
      });
    });
  }

  return { html, mount };
}
