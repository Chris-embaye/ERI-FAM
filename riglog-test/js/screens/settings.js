import { getSettings, saveSettings, clearCloudData, syncUp } from '../store.js';
import { getCurrentUser, signOut, saveProfile } from '../auth.js';
import { openModal, closeModal, confirmSheet, toast } from '../modal.js';

function collectExportData(user) {
  const data = {};
  ['rl_test_expenses','rl_test_trips','rl_test_dvirs','rl_test_detention','rl_test_fuel','rl_test_settings'].forEach(k => {
    try { data[k] = JSON.parse(localStorage.getItem(k) || 'null'); } catch {}
  });
  if (user) data._account = { uid: user.uid, email: user.email, name: user.displayName };
  return data;
}

function downloadBackup(user) {
  const blob = new Blob([JSON.stringify(collectExportData(user), null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href: url, download: `riglog-test-backup-${new Date().toISOString().slice(0,10)}.json`,
  });
  a.click();
  URL.revokeObjectURL(url);
}

async function shareBackup(user) {
  const file = new File(
    [JSON.stringify(collectExportData(user), null, 2)],
    `riglog-test-backup-${new Date().toISOString().slice(0,10)}.json`,
    { type: 'application/json' }
  );
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'RigLog TEST Backup' }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  downloadBackup(user);
  toast('Backup downloaded ✓');
}

function section(title, accent, body) {
  return `
    <div class="glass-card">
      <p class="settings-section-label" style="color:${accent}">${title}</p>
      ${body}
    </div>`;
}

function field(label, hint, inputHtml) {
  return `
    <div class="settings-field">
      <label class="settings-label">${label}</label>
      ${inputHtml}
      ${hint ? `<p class="settings-hint">${hint}</p>` : ''}
    </div>`;
}

function inp(name, type, value, extra = '') {
  return `<input type="${type}" name="${name}" class="form-input" value="${value ?? ''}" ${extra}>`;
}

function selField(name, value, options) {
  return `<select name="${name}" class="form-input">
    ${options.map(([v, l]) => `<option value="${v}"${v === String(value) ? ' selected' : ''}>${l}</option>`).join('')}
  </select>`;
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

  const weeklyBreakeven = monthlyFixed > 0
    ? Math.round(monthlyFixed / 4.33)
    : null;

  const html = `
    <div class="flex flex-col h-full text-white" style="background:rgb(4,10,18)">

      <!-- Header -->
      <div class="settings-header shrink-0">
        <button onclick="navigate('more')" class="settings-back-btn">
          <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div>
          <h1 class="text-xl font-black">Settings</h1>
          <p class="text-xs" style="color:rgba(100,200,255,0.5)">RigLog TEST — isolated data</p>
        </div>
        <button type="submit" form="settings-form" class="save-fab">Save</button>
      </div>

      <div class="flex-1 overflow-y-auto p-4 space-y-3" style="padding-bottom:32px">

        <!-- Account card -->
        ${user ? `
        <div class="glass-card">
          <p class="settings-section-label" style="color:#06b6d4">Account</p>
          <div class="flex items-center gap-3 mb-4">
            <div class="w-14 h-14 rounded-full flex items-center justify-center font-black text-2xl shrink-0 overflow-hidden"
                 style="background:linear-gradient(135deg,#0891b2,#0e7490);color:#fff">
              ${user.photoURL
                ? `<img src="${user.photoURL}" class="w-14 h-14 rounded-full object-cover" alt="">`
                : avatarLetter}
            </div>
            <div class="min-w-0">
              <p class="font-black text-lg truncate">${user.displayName || 'Driver'}</p>
              <p class="text-xs truncate" style="color:rgba(148,163,184,0.8)">${user.email}</p>
            </div>
          </div>
          <div class="space-y-2">
            ${field('Display Name', null, `<input type="text" id="profile-name" class="form-input" value="${user.displayName || ''}" placeholder="Your name">`)}
            <div class="flex gap-2">
              <button id="save-profile-btn" class="flex-1 settings-action-btn">Update Name</button>
              <button id="reset-pw-btn" class="flex-1 settings-ghost-btn">Reset Password</button>
            </div>
          </div>
        </div>
        ` : ''}

        <form id="settings-form" class="space-y-3">

          <!-- ── Driver & Truck ── -->
          ${section('🚛  Driver & Truck', '#06b6d4', `
            <div class="grid grid-cols-2 gap-3">
              ${field('Truck Name / Unit ID', null, inp('truckId', 'text', s.truckId, 'placeholder="My Truck"'))}
              ${field('Driver Type', null, selField('driverType', s.driverType || 'OTR', [
                ['OTR','OTR (Long Haul)'],['Regional','Regional'],['Local','Local / City'],['Lease','Lease Op'],['Company','Company Driver']
              ]))}
              ${field('Truck Make', null, inp('truckMake', 'text', s.truckMake, 'placeholder="Freightliner"'))}
              ${field('Truck Model', null, inp('truckModel', 'text', s.truckModel, 'placeholder="Cascadia"'))}
              ${field('Year', null, inp('truckYear', 'number', s.truckYear, 'placeholder="2022" min="1990" max="2030"'))}
              ${field('License Plate', null, inp('truckPlate', 'text', s.truckPlate, 'placeholder="ABC 1234"'))}
            </div>
            ${field('Home Base', 'Days away from home base qualify for per diem deductions.',
              inp('homeBase', 'text', s.homeBase, 'placeholder="Atlanta, GA"'))}
          `)}

          <!-- ── Revenue Targets ── -->
          ${section('🎯  Revenue Targets', '#22d3ee', `
            ${field('Weekly Revenue Goal ($)',
              s.targetWeeklyRevenue > 0 ? `You need <strong style="color:#06b6d4">${Math.ceil(s.targetWeeklyRevenue / 7 / 2)}</strong> miles/day at $2/mi to hit this.` : 'Set a weekly goal to see your progress on the dashboard.',
              inp('targetWeeklyRevenue', 'number', s.targetWeeklyRevenue || '', 'step="100" min="0" placeholder="e.g. 6000"'))}
            <div class="grid grid-cols-2 gap-3">
              ${field('Target Revenue/Mile ($)', 'Trips below this show red.',
                inp('targetRPM', 'number', s.targetRPM, 'step="0.01" min="0" placeholder="2.00"'))}
              ${field('Target Cost/Mile ($)', 'Used in profit margin calc.',
                inp('targetCPM', 'number', s.targetCPM, 'step="0.01" min="0" placeholder="0.50"'))}
            </div>
          `)}

          <!-- ── Dispatch / Carrier ── -->
          ${section('📋  Dispatch / Carrier', '#0ea5e9', `
            ${field('Dispatcher / Carrier Fee (%)',
              Number(s.dispatchPct) > 0
                ? `On a $1,000 load you keep <strong style="color:#fff">$${(1000*(1-Number(s.dispatchPct)/100)).toFixed(0)}</strong>.`
                : 'Enter 0 if you book all loads yourself.',
              inp('dispatchPct', 'number', s.dispatchPct || 0, 'step="0.5" min="0" max="50" placeholder="0"'))}
          `)}

          <!-- ── Monthly Fixed Costs ── -->
          ${section('💸  Monthly Fixed Costs', '#f59e0b', `
            <div class="grid grid-cols-2 gap-3">
              ${field('ELD Subscription ($/mo)', 'Samsara, Motive, etc. — deductible.',
                inp('eldMonthly', 'number', s.eldMonthly || '', 'step="1" min="0" placeholder="45"'))}
              ${field('Truck Payment ($/mo)', 'Interest portion is deductible.',
                inp('truckPaymentMonthly', 'number', s.truckPaymentMonthly || '', 'step="1" min="0" placeholder="2800"'))}
              ${field('Insurance ($/mo)', 'Cargo, liability, physical — all deductible.',
                inp('insuranceMonthly', 'number', s.insuranceMonthly || '', 'step="1" min="0" placeholder="800"'))}
              ${field('Other Fixed ($/mo)', 'Permits, memberships, phone, etc.',
                inp('otherFixedMonthly', 'number', s.otherFixedMonthly || '', 'step="1" min="0" placeholder="200"'))}
            </div>
            ${monthlyFixed > 0 ? `
            <div class="cost-summary-grid">
              <div class="cost-summary-item">
                <span class="cost-summary-label">Per month</span>
                <span class="cost-summary-val">$${monthlyFixed.toLocaleString()}</span>
              </div>
              <div class="cost-summary-item">
                <span class="cost-summary-label">Per year</span>
                <span class="cost-summary-val" style="color:#f87171">$${(monthlyFixed * 12).toLocaleString()}</span>
              </div>
              <div class="cost-summary-item">
                <span class="cost-summary-label">Weekly break-even</span>
                <span class="cost-summary-val" style="color:#fbbf24">$${weeklyBreakeven?.toLocaleString() ?? '—'}</span>
              </div>
            </div>` : ''}
          `)}

          <!-- ── Detention ── -->
          ${section('⏱  Detention', '#8b5cf6', `
            <div class="grid grid-cols-2 gap-3">
              ${field('Rate ($/hour)', 'Charged after grace period ends.',
                inp('detentionRate', 'number', s.detentionRate || 60, 'step="5" min="0" placeholder="60"'))}
              ${field('Grace Period (hours)', 'Free wait time (typically 2h).',
                inp('detentionGrace', 'number', s.detentionGrace || 2, 'step="0.5" min="0" placeholder="2"'))}
            </div>
          `)}

          <!-- ── Fuel ── -->
          ${section('⛽  Fuel Preferences', '#10b981', `
            <div class="grid grid-cols-2 gap-3">
              ${field('Target MPG', 'Average fuel economy for your truck.',
                inp('targetMPG', 'number', s.targetMPG || 6.5, 'step="0.1" min="1" placeholder="6.5"'))}
              ${field('Fuel Type', null, selField('fuelType', s.fuelType || 'diesel', [
                ['diesel','Diesel'],['def','Diesel + DEF'],['gas','Gasoline'],['ng','Natural Gas'],['electric','Electric']
              ]))}
            </div>
          `)}

          <!-- ── Tax ── -->
          ${section('🧾  Tax Preferences', '#06b6d4', `
            ${field('Per Diem Rate ($/day)',
              'IRS 2025: $80/day for overnight trips away from home base.',
              inp('perDiemRate', 'number', s.perDiemRate || 80, 'step="1" min="0" placeholder="80"'))}
          `)}

          <!-- ── Appearance ── -->
          ${section('🎨  Appearance', '#a78bfa', `
            <label class="toggle-row">
              <span class="toggle-label">
                <span class="font-semibold">Compact Mode</span>
                <span class="settings-hint" style="margin:0">Smaller cards, tighter spacing</span>
              </span>
              <input type="checkbox" name="compactMode" id="compactModeToggle" class="toggle-checkbox" ${s.compactMode ? 'checked' : ''}>
              <span class="toggle-track"></span>
            </label>
            <label class="toggle-row" style="margin-top:12px">
              <span class="toggle-label">
                <span class="font-semibold">Darkest Mode</span>
                <span class="settings-hint" style="margin:0">Pure black backgrounds</span>
              </span>
              <input type="checkbox" name="darkestMode" id="darkestModeToggle" class="toggle-checkbox" ${s.darkestMode ? 'checked' : ''}>
              <span class="toggle-track"></span>
            </label>
          `)}

          <button type="submit" class="save-btn-full">Save All Settings</button>
        </form>

        <!-- ── Data ── -->
        <div class="glass-card space-y-2">
          <p class="settings-section-label" style="color:#64748b">Data &amp; Backup</p>
          <button id="export-btn" class="settings-action-btn w-full">↓ Download Backup (JSON)</button>
          <button id="share-btn" class="settings-action-btn w-full">↗ Send to Email / Share</button>
          <button id="force-update-btn" class="settings-ghost-btn w-full">↺ Force Update App</button>
        </div>

        <!-- ── TEST ENV ── -->
        <div class="glass-card space-y-2" style="border-color:rgba(8,145,178,0.3)">
          <p class="settings-section-label" style="color:#0891b2">⚗ Test Environment</p>
          <p class="settings-hint" style="margin:0 0 8px">All data is stored under isolated keys (rl_test_*) and never syncs to the cloud. Safe to clear at any time.</p>
          <button id="clear-test-btn" class="w-full font-bold py-2.5 rounded-xl text-sm" style="background:rgba(8,145,178,0.15);color:#0891b2;border:1px solid rgba(8,145,178,0.3)">
            Clear Test Data Only
          </button>
          <button id="clear-btn" class="w-full font-bold py-2.5 rounded-xl text-sm" style="background:rgba(220,38,38,0.12);color:#f87171;border:1px solid rgba(220,38,38,0.2)">
            Clear All Data
          </button>
        </div>

        <!-- Sign out -->
        ${user ? `
        <button id="signout-btn" class="settings-signout-btn w-full">Sign Out</button>
        ` : ''}

        <div style="height:24px"></div>
      </div>
    </div>`;

  function mount(container) {

    container.querySelector('#settings-form').addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      saveSettings({
        truckId:             fd.get('truckId')?.trim() || 'My Truck',
        truckMake:           fd.get('truckMake')?.trim() || '',
        truckModel:          fd.get('truckModel')?.trim() || '',
        truckYear:           fd.get('truckYear')?.trim() || '',
        truckPlate:          fd.get('truckPlate')?.trim() || '',
        driverType:          fd.get('driverType') || 'OTR',
        homeBase:            fd.get('homeBase')?.trim() || '',
        targetWeeklyRevenue: parseFloat(fd.get('targetWeeklyRevenue')) || 0,
        targetRPM:           parseFloat(fd.get('targetRPM'))           || 2.00,
        targetCPM:           parseFloat(fd.get('targetCPM'))           || 0.50,
        dispatchPct:         parseFloat(fd.get('dispatchPct'))         || 0,
        eldMonthly:          parseFloat(fd.get('eldMonthly'))          || 0,
        truckPaymentMonthly: parseFloat(fd.get('truckPaymentMonthly')) || 0,
        insuranceMonthly:    parseFloat(fd.get('insuranceMonthly'))    || 0,
        otherFixedMonthly:   parseFloat(fd.get('otherFixedMonthly'))   || 0,
        detentionRate:       parseFloat(fd.get('detentionRate'))       || 60,
        detentionGrace:      parseFloat(fd.get('detentionGrace'))      || 2,
        targetMPG:           parseFloat(fd.get('targetMPG'))           || 6.5,
        fuelType:            fd.get('fuelType') || 'diesel',
        perDiemRate:         parseFloat(fd.get('perDiemRate'))         || 80,
        compactMode:         fd.get('compactMode') === 'on',
        darkestMode:         fd.get('darkestMode') === 'on',
      });
      toast('Settings saved ✓');
      window.refresh();
    });

    container.querySelector('#save-profile-btn')?.addEventListener('click', async () => {
      const name = container.querySelector('#profile-name').value.trim();
      if (!name) return;
      const btn = container.querySelector('#save-profile-btn');
      btn.textContent = 'Saving…'; btn.disabled = true;
      try {
        await user.updateProfile({ displayName: name });
        if (user.uid) await saveProfile(user.uid, { name, email: user.email });
        toast('Name updated ✓');
      } catch { toast('Error updating name', 'error'); }
      btn.textContent = 'Update Name'; btn.disabled = false;
    });

    container.querySelector('#reset-pw-btn')?.addEventListener('click', async () => {
      if (!user?.email) return;
      const btn = container.querySelector('#reset-pw-btn');
      btn.textContent = 'Sending…'; btn.disabled = true;
      try {
        await firebase.auth().sendPasswordResetEmail(user.email);
        toast('Reset email sent ✓');
      } catch { toast('Error sending reset email', 'error'); }
      btn.textContent = 'Reset Password'; btn.disabled = false;
    });

    container.querySelector('#export-btn').addEventListener('click', () => { downloadBackup(user); toast('Backup downloaded ✓'); });
    container.querySelector('#share-btn').addEventListener('click', () => shareBackup(user));

    container.querySelector('#force-update-btn').addEventListener('click', async () => {
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

    container.querySelector('#clear-test-btn').addEventListener('click', () => {
      confirmSheet(
        'Clear test data?',
        'Removes all rl_test_* entries from localStorage. Cloud data is untouched.',
        'Clear Test Data',
        () => {
          ['rl_test_expenses','rl_test_trips','rl_test_dvirs','rl_test_detention','rl_test_fuel','rl_test_settings','rl_test_active_detention']
            .forEach(k => localStorage.removeItem(k));
          toast('Test data cleared ✓');
          window.navigate('dashboard');
        }
      );
    });

    container.querySelector('#clear-btn').addEventListener('click', () => {
      confirmSheet(
        'Clear ALL data?',
        'Deletes all test trips, expenses, fuel, DVIRs. Cannot be undone.',
        'Clear Everything',
        async () => {
          ['rl_test_expenses','rl_test_trips','rl_test_dvirs','rl_test_detention','rl_test_fuel','rl_test_settings','rl_test_active_detention']
            .forEach(k => localStorage.removeItem(k));
          await clearCloudData();
          window.navigate('dashboard');
        }
      );
    });

    container.querySelector('#signout-btn')?.addEventListener('click', () => {
      openModal(`
        <div class="p-5">
          <div class="text-center mb-5">
            <div class="text-4xl mb-2">💾</div>
            <p class="font-black text-lg">Back up before signing out?</p>
            <p class="text-sm mt-1.5 px-2" style="color:rgba(148,163,184,0.8)">A local backup gives you an extra copy of your test data.</p>
          </div>
          <div class="space-y-2.5">
            <button id="so-download" class="settings-action-btn w-full">↓ Download Backup</button>
            <button id="so-share" class="settings-action-btn w-full">↗ Share Backup</button>
            <div class="border-t pt-2.5" style="border-color:rgba(255,255,255,0.07)">
              <button id="so-signout" class="w-full font-bold py-3 rounded-xl text-sm" style="background:rgba(8,145,178,0.15);color:#0891b2;border:1px solid rgba(8,145,178,0.3)">
                Sign Out Without Backup
              </button>
              <button onclick="closeModal()" class="btn-ghost mt-1">Cancel</button>
            </div>
          </div>
        </div>
      `, el => {
        el.querySelector('#so-download').addEventListener('click', () => { downloadBackup(user); toast('Backup downloaded ✓'); });
        el.querySelector('#so-share').addEventListener('click', () => shareBackup(user));
        el.querySelector('#so-signout').addEventListener('click', async () => { closeModal(); await signOut(); });
      });
    });
  }

  return { html, mount };
}
