import { getDVIRs, getDetentionSessions, getActiveDetention, getSettings, getMaintenanceLogs } from '../store.js';
import { toast } from '../modal.js';

const chevron = `<svg width="16" height="16" fill="none" stroke="rgba(100,116,139,0.7)" viewBox="0 0 24 24" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`;

function moreCard(iconSvg, iconBg, title, sub, badge, onClick) {
  return `
    <button onclick="${onClick}" class="glass-card w-full text-left" style="padding:14px 16px;margin-bottom:10px">
      <div class="flex items-center gap-3">
        <div style="background:${iconBg};border-radius:14px;padding:10px;flex-shrink:0">${iconSvg}</div>
        <div class="flex-1 min-w-0">
          <p style="font-weight:800;font-size:0.9rem;color:#e0f2fe">${title}</p>
          <p style="font-size:0.72rem;color:rgba(100,116,139,0.85);margin-top:2px;line-height:1.3">${sub}</p>
        </div>
        ${badge ? `<div style="font-size:0.75rem;font-weight:800;color:#67e8f9">${badge}</div>` : ''}
        ${chevron}
      </div>
    </button>`;
}

export function renderMore() {
  const dvirs    = getDVIRs();
  const sessions = getDetentionSessions();
  const active   = getActiveDetention();
  const settings = getSettings();
  const maint    = getMaintenanceLogs();

  const lastDVIRDate = dvirs[0]
    ? new Date(dvirs[0].date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  const totalDetention = sessions.reduce((s, d) => s + Number(d.value || 0), 0);

  const year = new Date().getFullYear();

  // Maintenance alert count
  const odo = Number(settings.currentOdometer) || 0;
  const maintAlerts = maint.filter(m => {
    const INTERVALS = { oil:25000, pm:30000, tires:50000, brakes:60000, airfilt:50000, fuelfilt:30000, trans:100000, coolant:100000 };
    const interval = m.customInterval || INTERVALS[m.serviceType];
    if (!interval || !m.odometer || !odo) return false;
    return (Number(m.odometer) + interval - odo) <= 3000;
  }).length;

  const html = `
    <div class="flex flex-col h-full text-white" style="background:transparent">
      <!-- Header -->
      <div class="dash-header shrink-0">
        <div>
          <h1 style="font-size:1.4rem;font-weight:900;color:#e0f2fe;letter-spacing:-0.3px">More</h1>
          <p style="font-size:0.7rem;color:rgba(100,116,139,0.8);margin-top:1px">Tools &amp; settings</p>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto" style="padding:14px 14px 80px">

        <!-- Tool cards -->
        ${moreCard(
          `<svg width="22" height="22" fill="none" stroke="#67e8f9" viewBox="0 0 24 24" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
          'rgba(8,145,178,0.15)',
          'Detention Timer',
          active ? 'Session active — tap to manage' : sessions.length > 0 ? `${sessions.length} sessions logged` : 'No sessions yet',
          active ? '<span style="color:#67e8f9;animation:pulse-cyan 2s infinite">● LIVE</span>' : totalDetention > 0 ? `$${Math.round(totalDetention)}` : '',
          "navigate('detention')"
        )}
        ${moreCard(
          `<svg width="22" height="22" fill="none" stroke="#60a5fa" viewBox="0 0 24 24" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>`,
          'rgba(59,130,246,0.15)',
          'Vehicle Inspection (DVIR)',
          lastDVIRDate ? `Last: ${lastDVIRDate} · 37 check items` : '37 inspection items · no entries yet',
          dvirs.length > 0 ? `${dvirs.length}` : '',
          "navigate('dvir')"
        )}
        ${moreCard(
          `<svg width="22" height="22" fill="none" stroke="#fb923c" viewBox="0 0 24 24" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
          'rgba(251,146,60,0.12)',
          'Maintenance Log',
          maint.length > 0 ? `${maint.length} service records` : 'Track oil changes, tires, PM intervals',
          maintAlerts > 0 ? `<span style="color:#fbbf24">⚠ ${maintAlerts} due</span>` : '',
          "navigate('maintenance')"
        )}
        ${moreCard(
          `<svg width="22" height="22" fill="none" stroke="#a78bfa" viewBox="0 0 24 24" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`,
          'rgba(139,92,246,0.12)',
          'IFTA Report',
          'Miles by state/province · quarterly filing',
          '',
          "navigate('ifta')"
        )}
        ${moreCard(
          `<svg width="22" height="22" fill="none" stroke="#4ade80" viewBox="0 0 24 24" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/><path d="M7 10h2l2-4 2 8 2-4h2"/></svg>`,
          'rgba(21,128,61,0.15)',
          'Tax Summary',
          `YTD ${year} · estimates &amp; quarterly payments`,
          '',
          "navigate('tax')"
        )}
        ${moreCard(
          `<svg width="22" height="22" fill="none" stroke="#94a3b8" viewBox="0 0 24 24" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
          'rgba(100,116,139,0.15)',
          'Settings',
          `${settings.truckId || 'My Truck'} · $${settings.detentionRate || 60}/hr detention`,
          '',
          "navigate('settings')"
        )}

        <!-- Load Acceptance Calculator -->
        <div class="glass-card" id="load-calc" style="padding:16px;margin-bottom:10px">
          <p style="font-size:0.58rem;font-weight:900;letter-spacing:2.5px;text-transform:uppercase;color:rgba(8,145,178,0.85);margin-bottom:14px">Load Acceptance Calculator</p>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
            <div class="settings-field" style="margin:0">
              <label class="settings-label">Offered Rate ($)</label>
              <input id="lc-rate" type="number" inputmode="decimal" step="0.01" class="form-input" placeholder="1 800" style="text-align:center;font-size:1rem;font-weight:700">
            </div>
            <div class="settings-field" style="margin:0">
              <label class="settings-label">Loaded Miles</label>
              <input id="lc-miles" type="number" inputmode="decimal" class="form-input" placeholder="450" style="text-align:center;font-size:1rem;font-weight:700">
            </div>
            <div class="settings-field" style="margin:0">
              <label class="settings-label">Empty Miles (DH)</label>
              <input id="lc-empty" type="number" inputmode="decimal" class="form-input" placeholder="0" style="text-align:center">
            </div>
            <div class="settings-field" style="margin:0">
              <label class="settings-label">Fuel $/gal</label>
              <input id="lc-ppg" type="number" inputmode="decimal" step="0.01" class="form-input" placeholder="3.99" style="text-align:center">
            </div>
          </div>

          <div id="lc-result" style="display:none;border-radius:14px;padding:14px;margin-bottom:12px;border:1px solid transparent">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center;margin-bottom:12px">
              <div>
                <p style="font-size:0.6rem;color:rgba(100,116,139,0.8);font-weight:700">RPM</p>
                <p id="lc-rpm-out" style="font-size:1.05rem;font-weight:900">—</p>
              </div>
              <div>
                <p style="font-size:0.6rem;color:rgba(100,116,139,0.8);font-weight:700">Fuel Cost</p>
                <p id="lc-fuel-out" style="font-size:1.05rem;font-weight:900;color:#fca5a5">—</p>
              </div>
              <div>
                <p style="font-size:0.6rem;color:rgba(100,116,139,0.8);font-weight:700">Net</p>
                <p id="lc-net-out" style="font-size:1.05rem;font-weight:900">—</p>
              </div>
            </div>
            <div id="lc-verdict" style="text-align:center;padding:10px;border-radius:10px;font-weight:800;font-size:0.9rem"></div>
          </div>

          <button id="lc-btn" class="save-btn-full" style="margin-top:0;padding:11px">Evaluate Load</button>
        </div>

        <!-- Version -->
        <div class="glass-card" style="padding:14px 16px;text-align:center">
          <p style="font-weight:800;font-size:0.85rem;color:rgba(8,145,178,0.9)">Rig Log · TEST BUILD</p>
          <p style="font-size:0.7rem;color:rgba(100,116,139,0.7);margin-top:3px">v3.1 · owner-operator toolkit · isolated data</p>
        </div>

      </div>
    </div>`;

  function mount(container) {
    const btn = container.querySelector('#lc-btn');
    if (!btn) return;

    btn.addEventListener('click', () => {
      try {
        const rateEl  = container.querySelector('#lc-rate');
        const milesEl = container.querySelector('#lc-miles');
        const emptyEl = container.querySelector('#lc-empty');
        const ppgEl   = container.querySelector('#lc-ppg');
        const result  = container.querySelector('#lc-result');
        const rpmOut  = container.querySelector('#lc-rpm-out');
        const fuelOut = container.querySelector('#lc-fuel-out');
        const netOut  = container.querySelector('#lc-net-out');
        const verdict = container.querySelector('#lc-verdict');

        const rate   = parseFloat(rateEl?.value)  || 0;
        const loaded = parseFloat(milesEl?.value) || 0;
        const empty  = parseFloat(emptyEl?.value) || 0;
        const ppg    = parseFloat(ppgEl?.value)   || 3.99;

        if (!rate && !loaded) { toast('Enter Offered Rate and Loaded Miles', 'error'); return; }
        if (!rate)            { toast('Enter the Offered Rate ($)', 'error'); return; }
        if (!loaded)          { toast('Enter the Loaded Miles', 'error'); return; }

        const cfg = getSettings();
        const mpg       = Number(cfg?.targetMPG)   || 6.5;
        const targetRPM = Number(cfg?.targetRPM)   || 2.00;
        const dispPct   = Number(cfg?.dispatchPct) || 0;

        const totalMiles = loaded + empty;
        const fuelCost   = (totalMiles / mpg) * ppg;
        const netRevenue = rate * (1 - dispPct / 100);
        const rpm        = rate / loaded;
        const net        = netRevenue - fuelCost;

        if (rpmOut)  rpmOut.textContent  = `$${rpm.toFixed(2)}/mi`;
        if (fuelOut) fuelOut.textContent = `-$${Math.round(fuelCost).toLocaleString()}`;
        if (netOut) {
          netOut.textContent = (net < 0 ? '-$' : '$') + Math.abs(Math.round(net)).toLocaleString();
          netOut.style.color = net >= 0 ? '#4ade80' : '#f87171';
        }

        const pctOfTarget = rpm / targetRPM;
        let bg, border, text, msg;
        if (pctOfTarget >= 1) {
          bg = 'rgba(21,128,61,0.15)'; border = 'rgba(21,128,61,0.4)'; text = '#4ade80';
          msg = `✓ TAKE IT — $${rpm.toFixed(2)}/mi beats your $${targetRPM.toFixed(2)} target`;
        } else if (pctOfTarget >= 0.85) {
          bg = 'rgba(251,191,36,0.1)'; border = 'rgba(251,191,36,0.3)'; text = '#fbbf24';
          msg = `~ BORDERLINE — ${Math.round(pctOfTarget * 100)}% of your $${targetRPM.toFixed(2)} target`;
        } else {
          bg = 'rgba(220,38,38,0.12)'; border = 'rgba(220,38,38,0.35)'; text = '#f87171';
          msg = `✕ PASS — only $${rpm.toFixed(2)}/mi, need $${targetRPM.toFixed(2)}`;
        }

        if (result) {
          result.style.background  = bg;
          result.style.borderColor = border;
          result.style.display     = 'block';
        }
        if (verdict) { verdict.textContent = msg; verdict.style.color = text; }
        if (rpmOut)  rpmOut.style.color = text;
      } catch (err) {
        console.error('[lc-btn]', err);
        toast('Calculator error — check your inputs', 'error');
      }
    });
  }

  return { html, mount };
}
